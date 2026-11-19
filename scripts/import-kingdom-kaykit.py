"""Download pinned official CC0 KayKit packs, preserving glTF dependencies."""
from pathlib import Path
import concurrent.futures, hashlib, json, urllib.request
ROOT=Path(__file__).resolve().parents[1]/'public'/'kingdom'/'kaykit'
PACKS={'adventurers':'KayKit-Character-Pack-Adventures-1.0','medieval':'KayKit-Medieval-Hexagon-Pack-1.0'}
def get(url):
    with urllib.request.urlopen(url,timeout=90) as r:return r.read()
def download(job):
    url,target,sha=job
    data=get(url)
    if hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()!=sha:raise ValueError('SHA mismatch: '+url)
    target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
    return {'path':str(target.relative_to(ROOT)).replace('\\','/'),'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data)}
manifest={'license':'CC0-1.0','author':'Kay Lousberg / KayKit','packs':[]}
for key,repo in PACKS.items():
    api='https://api.github.com/repos/KayKit-Game-Assets/'+repo
    commit=json.loads(get(api+'/commits/main'))['sha']
    tree=json.loads(get(api+'/git/trees/'+commit+'?recursive=1'))['tree']
    files=[f for f in tree if f['type']=='blob' and (f['path'] in ['LICENSE.txt','README.md'] or ('/gltf/' in f['path'] and f['path'].endswith(('.glb','.gltf','.bin','.png'))))]
    jobs=[('https://raw.githubusercontent.com/KayKit-Game-Assets/'+repo+'/'+commit+'/'+f['path'],ROOT/key/f['path'],f['sha']) for f in files]
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool: records=list(pool.map(download,jobs))
    manifest['packs'].append({'id':key,'repository':'https://github.com/KayKit-Game-Assets/'+repo,'commit':commit,'files':records})
    print(key,len(records),'files',flush=True)
(ROOT/'manifest.json').write_text(json.dumps(manifest,indent=2))
