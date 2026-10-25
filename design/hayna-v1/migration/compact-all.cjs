const fs=require('fs'),path=require('path'),ts=require('typescript'),os=require('os');
const backup=fs.mkdtempSync(path.join(os.tmpdir(),'hayna-compact-ios-'));const files=[];function walk(d){for(const x of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,x.name);if(x.isDirectory()){if(p.replaceAll('\\','/')!=='components/oasis')walk(p)}else if(/\.tsx?$/.test(p))files.push(p)}}walk('app');walk('components');files.push('lib/dialog.tsx','lib/ui.ts');
const report=[];
for(const p of files){const input=fs.readFileSync(p,'utf8'),source=ts.createSourceFile(p,input,ts.ScriptTarget.Latest,true,p.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS),edits=[];
function name(n){return n?.name?.getText(source).replace(/['"]/g,'')||''}
function visit(n){if(ts.isObjectLiteralExpression(n)){
 const context=name(n.parent);const props=n.properties.filter(ts.isPropertyAssignment);const prop=k=>props.find(p=>name(p)===k);const num=k=>{const v=prop(k)?.initializer;return v&&ts.isNumericLiteral(v)?Number(v.text):undefined};const set=(k,v)=>{const a=prop(k);if(a&&Number(a.initializer.getText(source))!==v){const start=a.initializer.getStart(source);const existing=edits.find(e=>e.start===start);if(existing)existing.text=String(v);else edits.push({start,end:a.initializer.end,text:String(v)})}};
 const media=/image|photo|video|preview|map|canvas|cover|poster|qr|orbit|ring|progress|story|avatar|logo|dot|badge|swatch|color/i.test(context);
 const control=/button|btn|input|field|searchbox|searchwrap|segment|chip|filter|tabitem|tabbutton/i.test(context);
 const card=/card|panel|sheet|modal|dialog|section|container|content|hero|row|tile|toolbar|form|empty/i.test(context);
 const fsiz=num('fontSize');if(fsiz!==undefined){let next=fsiz;if(fsiz<11)next=11;else if(fsiz>22&&!/temperature|temp|emoji|metric|stat|count|number|value|price|initial|letter/i.test(context))next=fsiz>=40?28:fsiz>=28?22:20;if(next!==fsiz){set('fontSize',next);if(num('lineHeight'))set('lineHeight',Math.max(next+4,Math.round(num('lineHeight')*next/fsiz)))} }
 const weight=prop('fontWeight');if(weight&&ts.isStringLiteral(weight.initializer)&&['900','800'].includes(weight.initializer.text))edits.push({start:weight.initializer.getStart(source),end:weight.initializer.end,text:weight.initializer.text==='900'?"'700'":"'600'"});
 if(!media){for(const k of ['padding','paddingVertical','paddingTop','paddingBottom','gap','rowGap','marginTop','marginBottom','marginVertical']){const v=num(k);if(v>=20&&v<=48)set(k,v>=32?24:v>=24?16:14);else if(k==='padding'&&card&&v===16)set(k,14)}
 const radius=num('borderRadius');if(radius>=18&&radius<=32)set('borderRadius',/sheet|modal|dialog/.test(context)?20:14);
 if(control){for(const k of ['height','minHeight']){const v=num(k);if(v>=48&&v<=72)set(k,44)} }
 if(/row/i.test(context)&&!control){const v=num('minHeight');if(v>56&&v<=80)set('minHeight',56)}
 }
 if(/iconbox|iconwrap|featureicon|serviceicon|navigationicon|quickactionicon/i.test(context)){const w=num('width'),h=num('height');if(w&&h&&w===h&&w>36&&w<=80){set('width',36);set('height',36);if(num('borderRadius'))set('borderRadius',10)}}
 if(/shadowOpacity/.test(props.map(name).join(' '))&&!media)set('shadowOpacity',0);
 }
ts.forEachChild(n,visit)}visit(source);if(edits.length){fs.mkdirSync(path.dirname(path.join(backup,p)),{recursive:true});fs.writeFileSync(path.join(backup,p),input);edits.sort((a,b)=>b.start-a.start);let s=input,last=input.length+1;for(const e of edits){if(e.end>last)throw Error('Overlap '+p);s=s.slice(0,e.start)+e.text+s.slice(e.end);last=e.start}fs.writeFileSync(p,s);report.push({file:p,adjustments:edits.length})}}
fs.writeFileSync('design/hayna-v1/migration/compact-report.json',JSON.stringify({backup,files:report},null,2));console.log(JSON.stringify({backup,files:report.length,adjustments:report.reduce((s,r)=>s+r.adjustments,0)}));
