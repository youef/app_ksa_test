"""Fetch original 1K CC0 terrain albedos, self-hosted with source hashes."""
from pathlib import Path
import concurrent.futures,hashlib,json,urllib.request
root=Path(__file__).resolve().parents[1]/'public'/'kingdom'/'terrain'
root.mkdir(parents=True,exist_ok=True)
def fetch(name):
    url=f'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/{name}/{name}_diff_1k.jpg'
    with urllib.request.urlopen(url,timeout=90) as r:data=r.read()
    assert data[:2]==b'\xff\xd8'
    (root/(name+'.jpg')).write_bytes(data)
    return {'file':name+'.jpg','source':f'https://polyhaven.com/a/{name}','download':url,'license':'CC0-1.0','sha256':hashlib.sha256(data).hexdigest()}
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:assets=list(pool.map(fetch,['aerial_grass_rock','rocky_terrain','coast_sand_01']))
(root/'sources.json').write_text(json.dumps({'provider':'Poly Haven','licenseSource':'https://polyhaven.com/license','assets':assets},indent=2),encoding='utf-8')
print('Downloaded three original CC0 1K terrain textures')
