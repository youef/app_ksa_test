import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { TERRAIN_HALF, TERRAIN_SEGMENTS, terrainHeight, terrainSlope, biomeColor, fractal, coastRadius, lakeDistance, riverX, ROAD_ROUTES, ROAD_SAMPLES, roadDistance, walkHeight, bridgeAt, waterLevel } from './KingdomTerrain';

const mat = (color: string) => new THREE.MeshStandardMaterial({ color, roughness: .95 });
function randomSource(seed: number) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let n = Math.imul(seed ^ seed >>> 15, 1 | seed); n ^= n + Math.imul(n ^ n >>> 7, 61 | n); return ((n ^ n >>> 14) >>> 0) / 4294967296; }; }
const clearings = [[0,-69,34],[-65,-87,31],[77,-85,24],[-110,92,25],[0,85,43],[72,30,36],[117,104,25],[-93,-23,19],[0,9,15]];
const inClearing = (x: number, z: number, extra = 0) => clearings.some(([cx,cz,r]) => Math.hypot(x-cx,z-cz) < r+extra);

export function createKingdomLandscape(scene: THREE.Scene, detail: boolean) {
  let disposed = false;
  const random = randomSource(96273);
  scene.background = new THREE.Color('#bcced0');
  scene.fog = new THREE.FogExp2('#c5d2cf', .0029);
  const sky = new Sky(); sky.scale.setScalar(900);
  const atmosphere = sky.material.uniforms;
  atmosphere.turbidity.value = 5; atmosphere.rayleigh.value = 1.65;
  atmosphere.mieCoefficient.value = .003; atmosphere.mieDirectionalG.value = .8;
  atmosphere.sunPosition.value.set(-.5, .45, -.7); scene.add(sky);
  scene.add(new THREE.HemisphereLight('#d7e9ee', '#4e5037', 1.7));
  const sun = new THREE.DirectionalLight('#fff0d5', 2.7);
  sun.position.set(-100, 160, -110); sun.castShadow = detail;
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -160; sun.shadow.camera.right = 160;
  sun.shadow.camera.top = 160; sun.shadow.camera.bottom = -160; sun.shadow.camera.far = 420;
  sun.shadow.bias = -.00035; sun.shadow.normalBias = .45; scene.add(sun);

  const ground = new THREE.PlaneGeometry(TERRAIN_HALF * 2, TERRAIN_HALF * 2, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS);
  ground.rotateX(-Math.PI/2);
  const positions = ground.getAttribute('position');
  const colors: number[] = [];
  for (let i=0; i<positions.count; i++) {
    const x=positions.getX(i), z=positions.getZ(i); positions.setY(i,terrainHeight(x,z));
    const rgb=biomeColor(x,z); colors.push(...rgb.map(v=>v/255));
  }
  ground.setAttribute('color',new THREE.Float32BufferAttribute(colors,3)); ground.computeVertexNormals();
  // Local 1K albedos blended by surface slope and elevation. No remote requests at runtime.
  const textures: THREE.Texture[]=[];
  function texture(file: string, fallback: string) {
    const c=document.createElement('canvas');c.width=2;c.height=2;const ctx=c.getContext('2d')!;ctx.fillStyle=fallback;ctx.fillRect(0,0,2,2);
    const placeholder=new THREE.CanvasTexture(c);textures.push(placeholder);
    const t=new THREE.TextureLoader().load('/kingdom/terrain/'+file,loaded=>{
      if(disposed){loaded.dispose();return;}
      (placeholder as any).image=loaded.image;placeholder.needsUpdate=true;loaded.dispose();
    },undefined,()=>{});
    t.colorSpace=THREE.SRGBColorSpace;
    placeholder.colorSpace=THREE.SRGBColorSpace;placeholder.wrapS=placeholder.wrapT=THREE.RepeatWrapping;placeholder.anisotropy=detail?4:2;
    return placeholder;
  }
  const grass=texture('aerial_grass_rock.jpg','#95a079'),rock=texture('rocky_terrain.jpg','#99958a'),sand=texture('coast_sand_01.jpg','#cfbf98');
  const terrainMaterial=new THREE.MeshStandardMaterial({roughness:.97,vertexColors:true,color:'#ffffff'});
  terrainMaterial.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,{terrainGrass:{value:grass},terrainRock:{value:rock},terrainSand:{value:sand}});
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 terrainPosition; varying vec3 terrainNormal;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nterrainPosition=position; terrainNormal=normal;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D terrainGrass;uniform sampler2D terrainRock;uniform sampler2D terrainSand;varying vec3 terrainPosition;varying vec3 terrainNormal;')
      .replace('#include <color_fragment>',`#include <color_fragment>
        vec3 p=terrainPosition; vec3 n=normalize(terrainNormal);
        float steep=smoothstep(.12,.58,1.0-abs(n.y));
        float high=smoothstep(22.0,53.0,p.y)*.7;
        float beach=1.0-smoothstep(2.0,4.3,p.y);
        vec3 g=texture2D(terrainGrass,p.xz*.105).rgb;
        vec3 r=texture2D(terrainRock,p.xz*.07).rgb;
        vec3 s=texture2D(terrainSand,p.xz*.09).rgb;
        vec3 surface=mix(g,r,clamp(steep+high,0.0,1.0));surface=mix(surface,s,beach);
        diffuseColor.rgb=mix(diffuseColor.rgb, surface, .82);
      `);
  };
  terrainMaterial.customProgramCacheKey=()=> 'hayna-terrain-splat-v1';
  const land=new THREE.Mesh(ground,terrainMaterial); land.name='kingdom-terrain';land.receiveShadow=true;scene.add(land);

  const waterTime={value:0};
  function waterMesh(geometry: THREE.BufferGeometry, level: number, opacity: number) {
    const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{time:waterTime,alpha:{value:opacity}},
      vertexShader:`varying vec3 wp;uniform float time;void main(){vec3 p=position;vec4 world=modelMatrix*vec4(p,1.0);world.y+=sin(world.x*.17+time*.9)*.07+cos(world.z*.22-time*.65)*.06;wp=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`,
      fragmentShader:`varying vec3 wp;uniform float time;uniform float alpha;void main(){float a=sin(wp.x*.55+wp.z*.37+time*1.4)*sin(wp.z*.29-time*.8);float ripple=pow(max(0.0,a),9.0);vec3 color=mix(vec3(.055,.22,.25),vec3(.15,.43,.44),.5+.22*sin(wp.z*.018));color+=vec3(.32,.43,.38)*ripple*.4;gl_FragColor=vec4(color,alpha);}`});
    const mesh=new THREE.Mesh(geometry,material);mesh.position.y=level;mesh.renderOrder=1;scene.add(mesh);return mesh;
  }
  const seaGeo=new THREE.PlaneGeometry(1300,1300,40,40);seaGeo.rotateX(-Math.PI/2);waterMesh(seaGeo,0,.88).name='ocean';
  const riverVertices:number[]=[];
  for(let z=-124;z<196;z+=2){for(const [xx,zz] of [[-6.6,z],[6.6,z],[-6.6,z+2],[-6.6,z+2],[6.6,z],[6.6,z+2]])riverVertices.push(riverX(zz)+xx,0,zz);}
  const riverGeo=new THREE.BufferGeometry();riverGeo.setAttribute('position',new THREE.Float32BufferAttribute(riverVertices,3));waterMesh(riverGeo,1.4,.86).name='river';
  const lakeGeo=new THREE.CircleGeometry(1,64);lakeGeo.rotateX(-Math.PI/2);lakeGeo.scale(25,1,19);const lake=waterMesh(lakeGeo,3.05,.9);lake.position.x=-88;lake.position.z=41;lake.name='lake';

  const roadMaterial=new THREE.MeshStandardMaterial({color:'#a59570',roughness:1,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
  const bridgeMaterial=mat('#79604a');
  const timberGeometry=new THREE.BoxGeometry(.2,.2,.2);
  const bridgeDetails=new THREE.Group();bridgeDetails.name='river-crossings';scene.add(bridgeDetails);
  function timber(x:number,y:number,z:number,sx:number,sy:number,sz:number){const m=new THREE.Mesh(timberGeometry,bridgeMaterial);m.position.set(x,y,z);m.scale.set(sx*5,sy*5,sz*5);m.castShadow=detail;bridgeDetails.add(m);}
  ROAD_SAMPLES.forEach((points,r)=>{
    const vertices:number[]=[],deck:number[]=[];
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);if(len<.01)continue;
      const width=ROAD_ROUTES[r].width/2;
      const side=(p:{x:number;z:number},sign:number)=>{const x=p.x-dz/len*width*sign,z=p.z+dx/len*width*sign;return [x,walkHeight(x,z)+.14,z];};
      const target=bridgeAt((a.x+b.x)/2,(a.z+b.z)/2)?deck:vertices;
      target.push(...side(a,-1),...side(a,1),...side(b,-1),...side(b,-1),...side(a,1),...side(b,1));
      if(target===deck&&i%3===0){
        for(const sign of [-1,1]){const x=a.x-dz/len*(width+.15)*sign,z=a.z+dx/len*(width+.15)*sign;timber(x,6.35,z,.18,1.25,.18);}
      }
    }
    for(const [positions,material] of [[vertices,roadMaterial],[deck,bridgeMaterial]] as const){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();const m=new THREE.Mesh(g,material);m.receiveShadow=true;scene.add(m);}
  });

  // Instanced tree parts keep dense forests within a small, fixed draw-call budget.
  const treeCount=detail?900:420;
  const trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.22,.52,1,7),mat('#675139'),treeCount);
  const crowns=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),mat('#71805a'),treeCount*3);
  const pines=new THREE.InstancedMesh(new THREE.ConeGeometry(1,1,9),mat('#344d3f'),treeCount*3);
  const branches=new THREE.InstancedMesh(new THREE.CylinderGeometry(.09,.16,1,5),mat('#715a40'),treeCount*2);
  const dummy=new THREE.Object3D(),color=new THREE.Color();let nt=0,nc=0,np=0,nb=0;
  for(let attempt=0;nt<treeCount&&attempt<treeCount*16;attempt++){
    const x=(random()-.5)*342,z=(random()-.5)*342,h=terrainHeight(x,z),slope=terrainSlope(x,z),density=fractal(x+120,z-50);
    if(h<waterLevel(x,z)+1.5||h>36||slope>.8||inClearing(x,z,2)||roadDistance(x,z)<5||coastRadius(x,z)>162||random()>density+.15)continue;
    const s=.8+random()*1.3,pine=z<-70||h>18,trunkHeight=(pine?6:4.8)*s;
    dummy.position.set(x,h+trunkHeight/2,z);dummy.scale.set(s,trunkHeight,s);dummy.rotation.set(0,random()*6.28,0);dummy.updateMatrix();trunks.setMatrixAt(nt++,dummy.matrix);
    const mesh=pine?pines:crowns;
    for(let part=0;part<3;part++){
      if(pine){dummy.position.set(x,h+(4.7+part*1.7)*s,z);dummy.scale.set((3.1-part*.6)*s,4.5*s,(3.1-part*.6)*s);}
      else{const a=part*2.1;dummy.position.set(x+Math.cos(a)*s,h+(5.3+part*.7)*s,z+Math.sin(a)*s);dummy.scale.set((2.3+random()*.5)*s,(2+random()*.5)*s,(2.4+random()*.6)*s);}
      dummy.rotation.set(random()*.15,random()*6.28,random()*.1);dummy.updateMatrix();mesh.setMatrixAt(pine?np++:nc++,dummy.matrix);
      color.setHSL(pine?.31+random()*.035:.21+random()*.09,.18+random()*.2,.2+random()*.12);mesh.setColorAt((pine?np:nc)-1,color);
    }
    if(!pine)for(let branch=0;branch<2;branch++){dummy.position.set(x+(branch?-.7:.7)*s,h+4*s,z);dummy.scale.set(s,2.5*s,s);dummy.rotation.set(.4,random()*6.28,branch?-.6:.6);dummy.updateMatrix();branches.setMatrixAt(nb++,dummy.matrix);}
  }
  trunks.count=nt;crowns.count=nc;pines.count=np;branches.count=nb;
  for(const mesh of [trunks,crowns,pines,branches]){mesh.instanceMatrix.needsUpdate=true;mesh.castShadow=detail;mesh.receiveShadow=true;mesh.computeBoundingSphere();scene.add(mesh);}

  const rockGeo=new THREE.IcosahedronGeometry(1,1);const rockPos=rockGeo.getAttribute('position');
  for(let i=0;i<rockPos.count;i++){const x=rockPos.getX(i),y=rockPos.getY(i),z=rockPos.getZ(i),s=.8+fractal(x*20,z*20)*.4;rockPos.setXYZ(i,x*s,y*s,z*s);}rockGeo.computeVertexNormals();
  const rocks=new THREE.InstancedMesh(rockGeo,mat('#8b8879'),detail?420:180);let nr=0;
  for(let attempt=0;nr<rocks.count&&attempt<6000;attempt++){
    const x=(random()-.5)*346,z=(random()-.5)*346,h=terrainHeight(x,z);
    if(h<1||inClearing(x,z,2)||roadDistance(x,z)<5||lakeDistance(x,z)<1.18)continue;
    const s=(h>18?2.8:1.1)+random()*(h>18?4:1.8);dummy.position.set(x,h+s*.18,z);dummy.scale.set(s,s*(.45+random()*.65),s*(.7+random()*.5));dummy.rotation.set(random()*.3,random()*6.28,random()*.25);dummy.updateMatrix();rocks.setMatrixAt(nr++,dummy.matrix);
  }
  rocks.count=nr;rocks.instanceMatrix.needsUpdate=true;rocks.castShadow=detail;rocks.receiveShadow=true;rocks.computeBoundingSphere();scene.add(rocks);

  const grassGeo=new THREE.BufferGeometry();grassGeo.setAttribute('position',new THREE.Float32BufferAttribute([-.14,0,0,.14,0,0,0,.8,0,0,0,-.14,0,0,.14,0,.72,0],3));grassGeo.computeVertexNormals();
  const grassMat=new THREE.MeshStandardMaterial({color:'#7c8752',side:THREE.DoubleSide,roughness:1});
  const wind={value:0};grassMat.onBeforeCompile=shader=>{shader.uniforms.windTime=wind;shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float windTime;').replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.x+=sin(windTime+instanceMatrix[3].x*.16+instanceMatrix[3].z*.12)*position.y*position.y*.2;');};
  const blades=new THREE.InstancedMesh(grassGeo,grassMat,detail?6500:2200);let ng=0;
  for(let attempt=0;ng<blades.count&&attempt<40000;attempt++){
    const x=(random()-.5)*320,z=(random()-.5)*320,h=terrainHeight(x,z);
    if(h<3.8||h>22||terrainSlope(x,z)>.45||roadDistance(x,z)<3||inClearing(x,z,-8)||coastRadius(x,z)>154)continue;
    const s=.45+random()*.9;dummy.position.set(x,h,z);dummy.scale.set(s,s,s);dummy.rotation.set(0,random()*6.28,0);dummy.updateMatrix();blades.setMatrixAt(ng++,dummy.matrix);
  }
  blades.count=ng;blades.instanceMatrix.needsUpdate=true;blades.computeBoundingSphere();scene.add(blades);
  const flowers=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.16,0),mat('#d3bc79'),detail?300:100);let nf=0;
  for(let attempt=0;nf<flowers.count&&attempt<6000;attempt++){
    const x=(random()-.5)*265,z=(random()-.5)*265,h=terrainHeight(x,z);
    if(h<4||h>16||inClearing(x,z)||roadDistance(x,z)<4)continue;
    dummy.position.set(x,h+.45,z);dummy.scale.setScalar(.7+random());dummy.rotation.set(0,0,0);dummy.updateMatrix();flowers.setMatrixAt(nf,dummy.matrix);color.set(['#d9c263','#a8a2c5','#e3dfcb'][nf%3]);flowers.setColorAt(nf++,color);
  }
  flowers.count=nf;flowers.instanceMatrix.needsUpdate=true;flowers.computeBoundingSphere();scene.add(flowers);
  return {
    update(time:number){waterTime.value=time;wind.value=time;},
    dispose(){disposed=true;textures.forEach(t=>t.dispose());sun.shadow.map?.dispose();},
  };
}
