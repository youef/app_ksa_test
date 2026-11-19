"""Original low-poly Kingdoms of Hayna assets. Python standard library only."""
import json, math, struct, zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / 'public' / 'kingdom'
ROOT.mkdir(parents=True, exist_ok=True)
COLORS = ['#d6b782','#efdcaa','#087f70','#e5ad44','#714f3b','#43986c','#376d91','#ad674e']
ASSETS = {}
def box(x,y,z,w,h,d,c): return (x,y,z,w,h,d,c)
for name, col in [('house',7),('market',3),('barracks',6),('storehouse',4),('workshop',2)]:
    ASSETS[name] = [box(0,.6,0,1.6,1.2,1.4,0),box(0,1.3,0,1.9,.3,1.7,col),box(0,.35,.72,.35,.7,.08,4),box(-.5,.85,.73,.25,.3,.08,2)]
ASSETS['castle'] = [box(0,1,0,2,2,1.7,0),box(0,2.1,0,2.2,.25,1.9,1),box(0,.5,.9,.5,1,.1,4)] + [box(x,1.4,z,.6,2.8,.6,0) for x in [-1,1] for z in [-.85,.85]] + [box(x,2.9,z,.75,.3,.75,3) for x in [-1,1] for z in [-.85,.85]]
ASSETS['tower'] = [box(0,1,0,.9,2,.9,0),box(0,2.1,0,1.2,.3,1.2,1),box(0,2.6,0,.08,.8,.08,4),box(.25,2.8,0,.5,.35,.06,2)]
ASSETS['wall'] = [box(0,.65,0,2,1.3,.45,0)] + [box(x,1.4,0,.3,.3,.5,1) for x in [-.8,-.4,0,.4,.8]]
ASSETS['farm'] = [box(0,.05,0,2,.1,2,4)] + [box(x,.23,z,.12,.36,.12,3) for x in [-.7,-.35,0,.35,.7] for z in [-.7,-.2,.3,.7]]
ASSETS['forest'] = [box(x,.4,z,.18,.8,.18,4) for x,z in [(-.5,0),(.5,.4),(0,-.5)]] + [box(x,1.1,z,.8,1,.8,5) for x,z in [(-.5,0),(.5,.4),(0,-.5)]]
ASSETS['mine'] = [box(0,.4,0,1.8,.8,1.4,6),box(-.4,.95,0,.9,.5,.8,6),box(.5,.9,.3,.3,.3,.3,3)]
ASSETS['harbor'] = [box(0,.15,0,2,.3,1.6,4),box(0,.45,0,.2,.6,.2,1),box(.4,.9,0,.8,.8,.08,1)]
for name, c in [('commander',3),('guard',6),('archer',5),('worker',7),('merchant',2),('scout',4)]:
    ASSETS[name] = [box(0,.9,0,.55,.65,.3,c),box(0,1.45,0,.4,.4,.4,0),box(-.17,.3,0,.2,.6,.25,4),box(.17,.3,0,.2,.6,.25,4),box(-.4,.9,0,.18,.6,.2,0),box(.4,.9,0,.18,.6,.2,0),box(0,1.7,0,.48,.15,.45,c)]
for name,c in [('grass',5),('sand',0),('water',6),('road',4)]: ASSETS[name] = [box(0,.04,0,2,.08,2,c)]
for name,c in [('gold',3),('food',5),('wood',4),('shield',6),('build',0),('attack',7),('upgrade',2),('save',6)]:
    ASSETS[name] = [box(0,.4,0,.8,.8,.3,c),box(0,.95,0,.25,.3,.2,1)]

def project(p):
    x,y,z=p
    return (128+(x-z)*34,192+(x+z)*17-y*37)
def polygons(boxes):
    faces=[]
    for x,y,z,w,h,d,c in boxes:
        verts=[(x+dx*w/2,y+dy*h/2,z+dz*d/2) for dx,dy,dz in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
        for ids,shade in [([4,5,6,7],.85),([1,2,6,5],.68),([3,7,6,2],1.12)]:
            rgb=tuple(min(255,int(int(COLORS[c][i:i+2],16)*shade)) for i in (1,3,5))
            faces.append((sum(verts[i][0]+verts[i][2] for i in ids)/4, [project(verts[i]) for i in ids],rgb))
    return sorted(faces,key=lambda f:f[0])

def png(faces):
    pixels=bytearray(256*256*4)
    for _,pts,rgb in faces:
        for yy in range(max(0,int(min(y for x,y in pts))),min(256,math.ceil(max(y for x,y in pts)))):
            xs=[]
            for (x1,y1),(x2,y2) in zip(pts,pts[1:]+pts[:1]):
                if (y1<=yy+.5<y2) or (y2<=yy+.5<y1): xs.append(x1+(yy+.5-y1)*(x2-x1)/(y2-y1))
            if len(xs)>=2:
                for xx in range(max(0,math.ceil(min(xs))),min(256,math.ceil(max(xs)))):
                    j=(yy*256+xx)*4; pixels[j:j+4]=bytes((*rgb,255))
    def chunk(t,b): return struct.pack('>I',len(b))+t+b+struct.pack('>I',zlib.crc32(t+b)&0xffffffff)
    raw=b''.join(b'\0'+pixels[y*1024:(y+1)*1024] for y in range(256))
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',256,256,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(raw))+chunk(b'IEND',b'')

def gltf(boxes):
    import base64
    v=[(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]
    ix=[0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,3,7,6,3,6,2,1,2,6,1,6,5,0,4,7,0,7,3]
    data=struct.pack('<24f',*(n for p in v for n in p))+struct.pack('<36H',*ix)
    return {'asset':{'version':'2.0','generator':'Hayna original assets'},'scene':0,'scenes':[{'nodes':list(range(len(boxes)))}],'nodes':[{'mesh':b[6],'translation':list(b[:3]),'scale':[a/2 for a in b[3:6]]} for b in boxes], 'materials':[{'pbrMetallicRoughness':{'baseColorFactor':[int(c[i:i+2],16)/255 for i in (1,3,5)]+[1],'metallicFactor':0,'roughnessFactor':.85}} for c in COLORS], 'meshes':[{'primitives':[{'attributes':{'POSITION':0},'indices':1,'material':i}]} for i in range(len(COLORS))], 'buffers':[{'uri':'data:application/octet-stream;base64,'+base64.b64encode(data).decode(),'byteLength':len(data)}],'bufferViews':[{'buffer':0,'byteOffset':0,'byteLength':96,'target':34962},{'buffer':0,'byteOffset':96,'byteLength':72,'target':34963}],'accessors':[{'bufferView':0,'componentType':5126,'count':8,'type':'VEC3','min':[-1,-1,-1],'max':[1,1,1]},{'bufferView':1,'componentType':5123,'count':36,'type':'SCALAR'}]}

world=[]
placements={55:'castle',34:'farm',73:'forest',27:'mine',64:'house',65:'market',46:'barracks',61:'harbor',76:'tower',67:'workshop'}
for i in range(100):
    x,z=(i%10-4.5)*2.2,(i//10-4.5)*2.2
    terrain='water' if i<10 or i%10==0 else 'sand' if i%10==1 else 'grass'
    for b in ASSETS[terrain]+ASSETS.get(placements.get(i,''),[]):
        bx,by,bz,w,h,d,c=b
        world.append(box(bx+x,by,bz+z,w,h,d,c))
ASSETS['world-map']=world
manifest=[]
for name,boxes in ASSETS.items():
    preview=[box(x/6,y/6,z/6,w/6,h/6,d/6,c) for x,y,z,w,h,d,c in boxes] if name=='world-map' else boxes
    faces=polygons(preview)
    svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">'+''.join('<polygon points="'+ ' '.join(f'{x:.2f},{y:.2f}' for x,y in pts)+'" fill="#{:02x}{:02x}{:02x}"/>'.format(*rgb) for _,pts,rgb in faces)+'</svg>'
    (ROOT/f'{name}.svg').write_text(svg)
    raster=png(faces); (ROOT/f'{name}.png').write_bytes(raster)
    (ROOT/f'{name}.ico').write_bytes(struct.pack('<HHHBBBBHHII',0,1,1,0,0,0,0,1,32,len(raster),22)+raster)
    (ROOT/f'{name}.gltf').write_text(json.dumps(gltf(boxes)))
    manifest.append({'id':name,'svg':name+'.svg','png':name+'.png','icon':name+'.ico','model':name+'.gltf'})
(ROOT/'manifest.json').write_text(json.dumps({'license':'CC0-1.0','assets':manifest},indent=2))
print(f'Generated {len(ASSETS)} original assets in four formats')
