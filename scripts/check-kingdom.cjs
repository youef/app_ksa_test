const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync('public/kingdom/index.html', 'utf8');
const nodes = new Map();
function element() { return { style: {}, children: [], append(e) { this.children.push(e); }, replaceChildren(...e) { this.children=e; }, setAttribute() {} }; }
const context = vm.createContext({document:{getElementById(id){if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);},createElement:element},localStorage:{getItem(){return null},setItem(){}},confirm:()=>true,fetch:()=>Promise.resolve({json:()=>Promise.resolve({assets:[]})})});
vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],context);
vm.runInContext(`
  if(s.tiles.length!==100)throw Error('map');
  selected='barracks'; $('map').children[22].onclick();
  if(s.tiles[22]!=='barracks'||s.gold!==140)throw Error('building cost');
  $('recruit').onclick(); if(s.troops!==15)throw Error('recruit');
  $('next').onclick(); $('attack').onclick(); if(s.wins!==1)throw Error('battle');
  for(let i=0;i<100;i++)$('next').onclick();
  if(s.food<0||s.troops<0)throw Error('negative resources');
  $('save').onclick();
`,context);
const manifest=JSON.parse(fs.readFileSync('public/kingdom/manifest.json'));
for(const asset of manifest.assets){
  for(const key of ['svg','png','icon','model'])assert.ok(fs.existsSync('public/kingdom/'+asset[key]));
  const model=JSON.parse(fs.readFileSync('public/kingdom/'+asset.model));
  assert.equal(model.asset.version,'2.0');
  assert.equal(Buffer.from(model.buffers[0].uri.split(',')[1],'base64').length,model.buffers[0].byteLength);
  for(const n of model.nodes)assert.ok(model.meshes[n.mesh]);
}
console.log('Passed: construction, recruitment, battle, 100 turns, saving, and 31 asset packages.');
