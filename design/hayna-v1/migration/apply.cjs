const fs=require('fs'),path=require('path'),os=require('os'),ts=require('typescript');
const backup=fs.mkdtempSync(path.join(os.tmpdir(),'hayna-oasis-ui-'));
const palette={
 '#f8fafc':'background','#f9fafb':'background','#f9fcf8':'background','#f5f3e9':'background','#f3f4f6':'background',
 '#fff':'surface','#ffffff':'surface','#fffefa':'surface','#fffbf5':'surface',
 '#0f172a':'ink','#111827':'ink','#1e293b':'ink','#173f30':'ink','#334155':'ink',
 '#64748b':'muted','#6b7280':'muted','#475569':'muted','#63766a':'muted',
 '#e2e8f0':'line','#e2ece6':'line','#e5e7eb':'line','#dbe7e1':'line','#d5e4d9':'line',
 '#059669':'primary','#047857':'primary','#10b981':'primary','#16a34a':'primary',
 '#064e3b':'deep','#065f46':'deep','#022c22':'deep',
 '#ecfdf5':'soft','#f0fdf4':'soft','#e9f3ec':'soft','#d1fae5':'soft',
 '#dc2626':'danger','#ef4444':'danger','#b91c1c':'danger','#b93838':'danger',
 '#fef2f2':'dangerSoft','#fff0ec':'dangerSoft','#f59e0b':'warning','#fffbeb':'warningSoft',
 '#c4a45f':'gold','#0284c7':'info','#eff6ff':'infoSoft','#f0f9ff':'infoSoft',
 '#020617':'live','#0d211b':'live'
};
const files=[];function walk(d){for(const x of fs.readdirSync(d,{withFileTypes:true})){const f=path.join(d,x.name);if(x.isDirectory()){if(f!=='components/oasis')walk(f);}else if(/\.tsx?$/.test(f))files.push(f);}}walk('app');walk('components');files.push('lib/ui.ts','lib/dialog.tsx');
const report=[];
for(const f of files){if(['components/shared/HaynaActionButton.tsx','components/shared/haynaButtonTokens.ts','components/shared/HeaderArtwork.tsx','components/shared/GlassIconArtwork.tsx','components/shared/Button.tsx','components/shared/Card.tsx','components/home/OasisGlassFrame.tsx'].includes(f.replaceAll('\\','/')))continue;
 const input=fs.readFileSync(f,'utf8'),source=ts.createSourceFile(f,input,ts.ScriptTarget.Latest,true,f.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);const edits=[],needed=new Set();let tokenCount=0,tagCount=0;const primitiveNames=[];const imports=source.statements.filter(ts.isImportDeclaration);const hasOasis=imports.some(i=>i.moduleSpecifier.text==='@/lib/oasis');
 function edit(start,end,text){edits.push({start,end,text});}
 for(const imp of imports){if(imp.moduleSpecifier.text!=='react-native'||!imp.importClause?.namedBindings||!ts.isNamedImports(imp.importClause.namedBindings))continue;const keep=[];for(const spec of imp.importClause.namedBindings.elements){const original=spec.propertyName?.text||spec.name.text;if(['Pressable','TextInput'].includes(original)&&!spec.isTypeOnly){primitiveNames.push(`Oasis${original} as ${spec.name.text}`);}else keep.push(spec.getText(source));}
 if(primitiveNames.length){const defaultName=imp.importClause.name?.text;edit(imp.getStart(source),imp.end,keep.length||defaultName?`import ${defaultName?defaultName+(keep.length?', ':''):''}${keep.length?'{ '+keep.join(', ')+' }':''} from 'react-native';`:'');}}
 function attributes(node){return node.attributes.properties.filter(ts.isJsxAttribute);}
 function tag(node){return node.tagName.getText(source);}
 function classify(node,all){const style=all.find(a=>a.name.text==='style')?.initializer?.getText(source)||'';const full=node.getText(source);const attrs=all.map(a=>a.getText(source)).join(' ');const props=[...style.matchAll(/\b(?:styles|s|st|layout)\.([A-Za-z][\w]*)/g)].map(m=>m[1]);const names=props.join(' ');if(!names&&!style)return;
  if(tag(node)==='Pressable'&&!all.some(a=>a.name.text==='oasisKind')){
   let kind;
   if(/card|tile/i.test(names)&&!/discard/i.test(names))kind='card';
   else if(/accessibilityRole=["']tab|chip|pill|segmentBtn|fTab|filterBtn|filterButton|sortBtn|sortButton/i.test(attrs+' '+names))kind='chip';
   else if(/(?:Button|Btn)\b/.test(names)&&!/avatar|story|preview|image|photo|video|attachment/i.test(names)){
    const parent=ts.isJsxOpeningElement(node)?node.parent.getText(source):full;
    kind=/<Text\b/.test(parent)?(/like|reaction|reply|share|bookmark/i.test(names)?'chip':'action'):'icon';
   }
   if(kind){edit(node.tagName.end,node.tagName.end,` oasisKind="${kind}"`);tagCount++;}
  }
  if(tag(node)==='View'){
   let role;if(props.some(n=>/Card$|^card$|^formContainer$|^sheet$|^dialog$/.test(n)))role='card';
   if(props.some(n=>/^(?:modalCard|sheetCard|sheet|dialogCard)$/.test(n)))role='sheet';
   if(props.some(n=>/^(?:iconBox|iconWrap|serviceIconBox|serviceIcon|featureIcon)$/.test(n)))role='icon';
   if(props.some(n=>/^(?:inputWrapper|searchBox|searchWrap)$/.test(n)))role='field';
   if(role){needed.add('OasisSurface');edit(node.tagName.getStart(source),node.tagName.end,'OasisSurface');edit(node.tagName.end,node.tagName.end,` oasisSurface="${role}"`);if(ts.isJsxOpeningElement(node)){const close=node.parent.closingElement.tagName;edit(close.getStart(source),close.end,'OasisSurface');}tagCount++;}
  }
 }
 function visit(n){
  if(ts.isStringLiteral(n)&&palette[n.text.toLowerCase()]&&!ts.isImportDeclaration(n.parent)&&!ts.isLiteralTypeNode(n.parent)){
   const key=palette[n.text.toLowerCase()];let value=`OASIS.colors.${key}`;if(ts.isJsxAttribute(n.parent))value='{'+value+'}';edit(n.getStart(source),n.end,value);needed.add('OASIS');tokenCount++;
  }
  if(ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n)){
   const all=attributes(n);
   if(tag(n)==='ImageBackground'&&all.some(a=>a.name.text==='source'&&a.initializer?.getText(source).includes('HAYNA_ACTION_ART'))&&ts.isJsxSelfClosingElement(n)){edit(n.getStart(source),n.end,'');return;}
   if((tag(n)==='ImageBackground'||tag(n)==='Image')&&all.some(a=>a.name.text==='pointerEvents')){for(const a of all.filter(a=>a.name.text==='pointerEvents'))edit(a.getStart(source),a.end,'');}
   if(tag(n)==='ScrollView'){for(const a of all.filter(a=>a.name.text==='inverted'))edit(a.getStart(source),a.end,'');}
   classify(n,all);
  }
  ts.forEachChild(n,visit);
 }
 visit(source);
 const extra=[];if(primitiveNames.length)extra.push(...primitiveNames);if(needed.has('OasisSurface'))extra.push('OasisSurface');let prefix=extra.length?`import { ${extra.join(', ')} } from '@/components/oasis/OasisPrimitives';\n`:'';if(needed.has('OASIS')&&!hasOasis)prefix+=`import { OASIS } from '@/lib/oasis';\n`;
 if(edits.length||prefix){const target=path.join(backup,f);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,input);edits.sort((a,b)=>b.start-a.start||b.end-a.end);let output=input;let last=input.length+1;for(const e of edits){if(e.end>last)throw Error('Overlapping edits '+f);output=output.slice(0,e.start)+e.text+output.slice(e.end);last=e.start;}fs.writeFileSync(f,prefix+output);report.push({file:f,tokens:tokenCount,taggedElements:tagCount,primitives:primitiveNames});}
}
fs.writeFileSync('design/hayna-v1/migration/report.json',JSON.stringify({backup,files:report},null,2));console.log(JSON.stringify({backup,files:report.length,tokens:report.reduce((n,r)=>n+r.tokens,0),taggedElements:report.reduce((n,r)=>n+r.taggedElements,0)}));
