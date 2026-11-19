"""Check all imported dependencies, model headers, hashes, skins and locomotion."""
from pathlib import Path
import hashlib,json,struct
from urllib.parse import unquote
root=Path(__file__).resolve().parents[1]/'public'/'kingdom'/'kaykit'
manifest=json.loads((root/'manifest.json').read_text())
models=0;characters=0
for pack in manifest['packs']:
    for f in pack['files']:
        p=root/f['path']; data=p.read_bytes()
        assert hashlib.sha256(data).hexdigest()==f['sha256'],p
        if p.suffix=='.gltf':
            model=json.loads(data);models+=1
            for item in model.get('buffers',[])+model.get('images',[]):
                uri=item.get('uri','')
                if uri and not uri.startswith('data:'):assert (p.parent/unquote(uri)).is_file(),(p,uri)
        if p.suffix=='.glb':
            magic,version,length=struct.unpack_from('<III',data)
            assert magic==0x46546c67 and version==2 and length==len(data)
            size=struct.unpack_from('<I',data,12)[0];model=json.loads(data[20:20+size])
            names={a['name'] for a in model['animations']}
            assert {'Idle','Walking_A','Running_A','Jump_Idle'}<=names
            assert model['skins'];characters+=1
print(f'Passed: {models} glTF models and all dependencies; {characters} skinned characters with locomotion; SHA256 for every file.')
