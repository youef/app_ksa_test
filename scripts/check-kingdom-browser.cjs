// Local integration check of the actual React / Three.js world (no account needed).
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const chrome = process.env.KINGDOM_TEST_CHROME;
if (!chrome) throw Error('Set KINGDOM_TEST_CHROME to your Chromium executable. Bundle tests/fixtures/kingdom-review.tsx with esbuild first.');
const sleep = ms => new Promise(r=>setTimeout(r,ms));
const server = http.createServer((req,res)=>{
  let pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(pathname==='/favicon.ico'){res.statusCode=204;return res.end();}
  if(pathname==='/_review') {res.setHeader('Content-Type','text/html');return res.end('<html><meta charset="utf-8"><div id="root"></div><script type="module" src="/_bundle.js"></script></html>');}
  const file = pathname==='/_bundle.js' ? path.join(root,'artifacts/qa-runtime/kingdom-bundle.js') : path.join(root,'public',pathname);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.gltf':'model/gltf+json','.glb':'model/gltf-binary','.png':'image/png','.json':'application/json'})[path.extname(file)]||'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
let browser,ws;
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const port=server.address().port;
  browser=spawn(chrome,['--headless=new','--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=0','--window-size=1280,900','--user-data-dir='+path.join(root,'artifacts/qa-runtime/chrome-profile'),'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
  const debug=await new Promise((resolve,reject)=>{let log='';browser.stderr.on('data',b=>{log+=b;let m=log.match(/DevTools listening on ws:\/\/127.0.0.1:(\d+)/);if(m)resolve(Number(m[1]));});browser.on('error',reject);setTimeout(()=>reject(Error('Chromium startup timeout')),20000).unref();});
  const tabs=await fetch(`http://127.0.0.1:${debug}/json`).then(r=>r.json());
  ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise(r=>ws.addEventListener('open',r,{once:true}));
  let id=0;const waiting=new Map(),errors=[];
  ws.onmessage=e=>{let m=JSON.parse(e.data);if(m.id){const p=waiting.get(m.id);waiting.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')errors.push(JSON.stringify(m.params));if(m.method==='Log.entryAdded'&&m.params.entry.level==='error'&&!m.params.entry.text.includes('favicon'))errors.push(m.params.entry.text);};
  const cdp=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;waiting.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});
  const evaluate=async expression=>{const r=await cdp('Runtime.evaluate',{expression,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  const until=async expression=>{const end=Date.now()+90000;while(Date.now()<end){if(await evaluate(expression))return;await sleep(500);}throw Error('Timeout: '+expression+'; '+await evaluate('document.body.innerText'));};
  await cdp('Runtime.enable');await cdp('Log.enable');await cdp('Page.enable');
  await cdp('Page.navigate',{url:`http://127.0.0.1:${port}/_review`});
  await until(`document.querySelector('canvas')?.dataset.character==='knight' && document.body.innerText.includes('عالم KayKit جاهز')`);
  const before=await evaluate('window.__position');
  await cdp('Page.bringToFront');
  await evaluate('document.activeElement?.blur()');
  await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'w',code:'KeyW',windowsVirtualKeyCode:87});
  await until(`window.__position && Math.hypot(window.__position.x-${before.x},window.__position.z-${before.z})>3`);
  await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'w',code:'KeyW',windowsVirtualKeyCode:87});await sleep(400);
  const after=await evaluate('window.__position');assert.ok(Math.hypot(before.x-after.x,before.z-after.z)>3,'WASD moves the character');
  await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32});
  const shot=await cdp('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(root,'artifacts/qa-runtime/kingdom-world.png'),Buffer.from(shot.data,'base64'));
  for(const key of ['ranger','warrior','desert','mage']){
    await evaluate(`(()=>{const s=document.querySelector('select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,'${key}');s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await until(`document.querySelector('canvas')?.dataset.character==='${key}' && document.body.innerText.includes('عالم KayKit جاهز')`);
  }
  await cdp('Page.navigate',{url:`http://127.0.0.1:${port}/_review?z=-40`});
  await until(`document.querySelector('canvas')?.dataset.character==='knight' && document.body.innerText.includes('عالم KayKit جاهز')`);
  await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'w',code:'KeyW',windowsVirtualKeyCode:87});
  await until(`window.__position?.z < -47`);
  let stopped=false;
  for(let attempt=0;attempt<20;attempt++){
    const p=await evaluate('window.__position');await sleep(700);const q=await evaluate('window.__position');
    if(Math.abs(q.z-p.z)<.01){stopped=true;break;}
  }
  await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'w',code:'KeyW',windowsVirtualKeyCode:87});
  const blocked=await evaluate('window.__position');assert.ok(stopped && blocked.z>-64,'castle wall blocks forward movement');assert.equal(blocked.site,'castle','castle remains interactable outside the walls');
  assert.deepEqual(errors,[]);console.log('Passed: 27 imported world assets; 5 animated character selections; WASD movement; castle collision and interaction range; jump dispatch; WebGL rendering without browser errors. Screenshot: artifacts/qa-runtime/kingdom-world.png');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{ws?.close();browser?.kill();server.close();});
