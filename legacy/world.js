import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

const UP = new THREE.Vector3(0,1,0);
export function randomSeed(seed=37){return ()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
const rng=randomSeed();
const mix=THREE.MathUtils.lerp;
function hash(x,z){const n=Math.sin(x*127.1+z*311.7)*43758.5453;return n-Math.floor(n);}
function noise(x,z){const a=Math.floor(x),b=Math.floor(z);let u=x-a,v=z-b;u=u*u*(3-2*u);v=v*v*(3-2*v);return mix(mix(hash(a,b),hash(a+1,b),u),mix(hash(a,b+1),hash(a+1,b+1),u),v);}
function fbm(x,z){return noise(x,z)*.55+noise(x*2.03,z*2.03)*.27+noise(x*4.1,z*4.1)*.13+noise(x*8.3,z*8.3)*.05;}
function canvasTexture(size,paint){const c=document.createElement('canvas');c.width=c.height=size;paint(c.getContext('2d'),size);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;}
function asphaltTexture(){return canvasTexture(1024,(c,n)=>{const image=c.createImageData(n,n);for(let y=0;y<n;y++)for(let x=0;x<n;x++){const i=(y*n+x)*4;const k=49+rng()*26+fbm(x*.018,y*.018)*14;image.data[i]=k;image.data[i+1]=k+1;image.data[i+2]=k+1;image.data[i+3]=255;}c.putImageData(image,0,0);c.lineCap='round';for(let i=0;i<18;i++){let x=rng()*n,y=rng()*n;c.beginPath();c.moveTo(x,y);for(let j=0;j<12;j++){x+=(rng()-.5)*50;y+=rng()*24;c.lineTo(x,y);}c.strokeStyle='#22262955';c.lineWidth=.4+rng()*1.7;c.stroke();}for(const x of [180,320,680,820]){const grad=c.createLinearGradient(x-20,0,x+20,0);grad.addColorStop(0,'#111b2000');grad.addColorStop(.5,'#111b2025');grad.addColorStop(1,'#111b2000');c.fillStyle=grad;c.fillRect(x-20,0,40,n);}});}
function terrainTexture(){return canvasTexture(512,(c,n)=>{const d=c.createImageData(n,n);for(let y=0;y<n;y++)for(let x=0;x<n;x++){const p=(y*n+x)*4;const k=100+fbm(x*.05,y*.05)*100+rng()*35;d.data[p]=k;d.data[p+1]=k*.98;d.data[p+2]=k*.89;d.data[p+3]=255;}c.putImageData(d,0,0);});}
function pineTexture(){return canvasTexture(512,(c)=>{c.clearRect(0,0,512,512);c.strokeStyle='#554b36';c.lineWidth=7;c.beginPath();c.moveTo(256,500);c.lineTo(254,35);c.stroke();for(let layer=0;layer<36;layer++){const y=50+layer*11.5;const spread=9+layer*4.6;for(let side=-1;side<=1;side+=2){c.strokeStyle=layer%2?'#344f3d':'#415a40';c.lineWidth=2;c.beginPath();c.moveTo(255,y);c.lineTo(255+side*spread,y+spread*.23);c.stroke();for(let j=0;j<95;j++){const u=rng();const x=255+side*spread*u+(rng()-.5)*15;const yy=y+spread*.23*u+(rng()-.5)*14;c.strokeStyle=['#3c563d','#536843','#2e4938','#61734c','#344f3b'][Math.floor(rng()*5)];c.lineWidth=1.2+rng()*2;c.beginPath();c.moveTo(x,yy);c.lineTo(x+side*(4+rng()*11),yy+3+rng()*8);c.stroke();}}}});}

export function createWorld(scene,renderer){
  const curve=new THREE.CatmullRomCurve3([
    [-260,13,180],[-290,17,-50],[-210,30,-300],[-20,47,-440],[210,35,-380],
    [360,20,-200],[370,13,60],[260,20,280],[60,29,350],[-130,17,310]
  ].map(a=>new THREE.Vector3(...a)),true,'catmullrom',.42);
  curve.arcLengthDivisions=2500;curve.updateArcLengths();const length=curve.getLength();
  function frame(s){const t=((s%length)+length)%length/length,p=curve.getPointAt(t),forward=curve.getTangentAt(t).normalize(),right=new THREE.Vector3().crossVectors(forward,UP).normalize(),up=new THREE.Vector3().crossVectors(right,forward).normalize();return {p,forward,right,up};}
  const samples=Array.from({length:600},(_,i)=>frame(i/600*length));
  function nearest(x,z){let d=Infinity,f=samples[0];for(let i=0;i<samples.length;i++){const a=samples[i].p,v=(a.x-x)**2+(a.z-z)**2;if(v<d){d=v;f=samples[i];}}return {distance:Math.sqrt(d),y:f.p.y,signed:(x-f.p.x)*f.right.x+(z-f.p.z)*f.right.z};}
  function height(x,z){const n=fbm(x*.012,z*.012),radius=Math.sqrt((x/1.03)**2+(z/1.05)**2);const ridge=185*Math.exp(-((x-10)**2/35000+(z+90)**2/75000))+87*Math.exp(-((x-130)**2/28000+(z-100)**2/22000));let h=5+ridge*(.55+n*.7)+n*23;const edge=THREE.MathUtils.smoothstep(radius,430,650);h=mix(h,-25,edge);const near=nearest(x,z);if(near.signed<0)h=mix(near.y-1,-25,THREE.MathUtils.smoothstep(near.distance,18,65));const roadInfluence=1-THREE.MathUtils.smoothstep(near.distance,14,48);return mix(h,near.y-.45,roadInfluence);}

  const sunDir=new THREE.Vector3(-.5,.23,-.85).normalize();
  const sky=new THREE.Mesh(new THREE.SphereGeometry(3500,48,24),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{sunDirection:{value:sunDir}},vertexShader:`varying vec3 vDirection;void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec3 vDirection;uniform vec3 sunDirection;float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}float fbm(vec2 p){float n=0.,a=.5;for(int i=0;i<5;i++){n+=a*noise(p);p=p*2.03+13.1;a*=.5;}return n;}void main(){vec3 d=normalize(vDirection);float h=max(d.y,0.);vec3 horizon=vec3(.46,.52,.51),middle=vec3(.08,.24,.39),zenith=vec3(.025,.09,.19);vec3 color=mix(horizon,middle,smoothstep(0.,.35,h));color=mix(color,zenith,smoothstep(.25,1.,h));float sun=max(dot(d,sunDirection),0.);color+=vec3(.95,.47,.15)*pow(sun,18.)*.25;float clouds=smoothstep(.52,.74,fbm(d.xz/(h+.17)*3.5));clouds*=smoothstep(.08,.22,h)*(1.-smoothstep(.55,.8,h));color=mix(color,vec3(.55,.59,.57),clouds*.72);color+=vec3(8.,5.8,3.)*smoothstep(.99983,.99994,sun);gl_FragColor=vec4(color,1.);}` }));sky.renderOrder=-1000;scene.add(sky);
  scene.fog=new THREE.Fog(0xbac0b8,450,2200);
  const sun=new THREE.DirectionalLight(0xffd5a7,2.8);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-55;sun.shadow.camera.right=55;sun.shadow.camera.top=55;sun.shadow.camera.bottom=-55;sun.shadow.camera.near=10;sun.shadow.camera.far=450;sun.shadow.normalBias=.015;sun.shadow.bias=-.00012;sun.shadow.radius=2;scene.add(sun,sun.target);
  scene.add(new THREE.HemisphereLight(0x96bfd7,0x6b684a,.35));

  const rockTex=terrainTexture();rockTex.anisotropy=8;
  const terrainGeo=new THREE.PlaneGeometry(1700,1700,220,220);terrainGeo.rotateX(-Math.PI/2);const pos=terrainGeo.attributes.position,colors=[];
  for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i),h=height(x,z);pos.setY(i,h);const n=fbm(x*.025,z*.025);const slope=Math.abs(height(x+3,z)-height(x-3,z))+Math.abs(height(x,z+3)-height(x,z-3));const grass=new THREE.Color().setRGB(.56+n*.15,.61+n*.15,.43+n*.15),rock=new THREE.Color(.88,.85,.76);const c=grass.lerp(rock,THREE.MathUtils.smoothstep(slope,3,10));if(h<-4)c.setRGB(.8,.77,.7);colors.push(c.r,c.g,c.b);}
  terrainGeo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));const uv=terrainGeo.attributes.uv;for(let i=0;i<uv.count;i++){uv.setXY(i,pos.getX(i)/13,pos.getZ(i)/13);}terrainGeo.computeVertexNormals();
  const grassMap=new THREE.TextureLoader().load('./assets/grass.jpg');grassMap.colorSpace=THREE.SRGBColorSpace;grassMap.wrapS=grassMap.wrapT=THREE.RepeatWrapping;grassMap.anisotropy=8;
  const terrainMaterial=new THREE.MeshStandardMaterial({map:grassMap,bumpMap:rockTex,bumpScale:.3,vertexColors:true,roughness:.96});
  const rockMap=new THREE.TextureLoader().load('./assets/rock.jpg');rockMap.colorSpace=THREE.SRGBColorSpace;rockMap.wrapS=rockMap.wrapT=THREE.RepeatWrapping;rockMap.anisotropy=8;
  const rockNormal=new THREE.TextureLoader().load('./assets/rock-normal.jpg');rockNormal.wrapS=rockNormal.wrapT=THREE.RepeatWrapping;rockNormal.anisotropy=8;
  terrainMaterial.onBeforeCompile=shader=>{
    shader.uniforms.uRockMap={value:rockMap};
    shader.vertexShader='varying vec3 vTerrainPosition;varying vec3 vTerrainNormal;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvTerrainPosition=(modelMatrix*vec4(position,1.)).xyz;vTerrainNormal=normalize(mat3(modelMatrix)*normal);');
    shader.fragmentShader='uniform sampler2D uRockMap;varying vec3 vTerrainPosition;varying vec3 vTerrainNormal;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`vec3 weights=pow(abs(vTerrainNormal),vec3(5.));weights/=max(dot(weights,vec3(1.)),.001);vec3 rockDetail=texture2D(uRockMap,vTerrainPosition.yz*.12).rgb*weights.x+texture2D(uRockMap,vTerrainPosition.xz*.12).rgb*weights.y+texture2D(uRockMap,vTerrainPosition.xy*.12).rgb*weights.z;float cliff=smoothstep(.08,.42,1.-abs(vTerrainNormal.y));cliff=max(cliff,smoothstep(105.,160.,vTerrainPosition.y)*.7);vec3 groundDetail=mix(texture2D(map,vMapUv).rgb,rockDetail,cliff);diffuseColor*=vec4(groundDetail,1.);`);
  };
  const terrain=new THREE.Mesh(terrainGeo,terrainMaterial);terrain.receiveShadow=true;scene.add(terrain);

  // The road is a continuous ribbon in world space, with banked normals and tiled surface detail.
  const asphalt=new THREE.TextureLoader().load('./assets/asphalt.jpg');asphalt.colorSpace=THREE.SRGBColorSpace;asphalt.wrapS=asphalt.wrapT=THREE.RepeatWrapping;asphalt.anisotropy=16;
  const asphaltNormal=new THREE.TextureLoader().load('./assets/asphalt-normal.jpg');asphaltNormal.wrapS=asphaltNormal.wrapT=THREE.RepeatWrapping;asphaltNormal.anisotropy=16;
  const roadMat=new THREE.MeshStandardMaterial({color:0x919997,map:asphalt,normalMap:asphaltNormal,normalScale:new THREE.Vector2(.5,.5),roughness:.62,metalness:.05,envMapIntensity:.65});
  function ribbon(left,right,mat,segments=1250,lift=.02,curb=false){const vertices=[],uvs=[],indices=[],cs=[];for(let i=0;i<=segments;i++){const s=i/segments*length,f=frame(s);for(const offset of [left,right]){const p=f.p.clone().addScaledVector(f.right,offset).addScaledVector(f.up,lift);vertices.push(p.x,p.y,p.z);uvs.push((offset+7.4)/6,s/9);if(curb){const c=new THREE.Color(Math.floor(s/2.4)%2?0xd7d2b9:0x9f4835);cs.push(c.r,c.g,c.b);}}if(i<segments){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));if(curb)geo.setAttribute('color',new THREE.Float32BufferAttribute(cs,3));geo.setIndex(indices);geo.computeVertexNormals();const m=new THREE.Mesh(geo,mat);m.receiveShadow=true;scene.add(m);return m;}
  ribbon(-8.5,8.5,new THREE.MeshStandardMaterial({map:rockTex,color:0xaaa58a,roughness:1}));ribbon(-7.2,7.2,roadMat,1250,.055);
  const curbMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.85,map:rockTex});ribbon(-7.9,-7.2,curbMat,1250,.08,true);ribbon(7.2,7.9,curbMat,1250,.08,true);
  const stripeMat=new THREE.MeshStandardMaterial({color:0xe4e0cf,roughness:.8});ribbon(-6.85,-6.72,stripeMat,1250,.07);ribbon(6.72,6.85,stripeMat,1250,.07);
  const dummy=new THREE.Object3D(),basis=new THREE.Matrix4();
  function orient(obj,f,offset=0,y=0){obj.position.copy(f.p).addScaledVector(f.right,offset).addScaledVector(f.up,y);basis.makeBasis(f.right,f.up,f.forward.clone().negate());obj.quaternion.setFromRotationMatrix(basis);}
  const dashCount=Math.floor(length/14),dashes=new THREE.InstancedMesh(new THREE.BoxGeometry(.12,.014,5.5),new THREE.MeshStandardMaterial({color:0xdbc67d,roughness:.7}),dashCount*2);
  for(let i=0;i<dashCount;i++){for(let j=0;j<2;j++){orient(dummy,frame(i*14),j===0?-.16:.16,.082);dummy.updateMatrix();dashes.setMatrixAt(i*2+j,dummy.matrix);}}dashes.receiveShadow=true;scene.add(dashes);
  const steel=new THREE.MeshStandardMaterial({color:0x969c96,metalness:.75,roughness:.38}),postCount=Math.floor(length/6);
  const posts=new THREE.InstancedMesh(new THREE.BoxGeometry(.09,1.1,.1),steel,postCount*2);for(let side=-1;side<=1;side+=2){const railPoints=[];for(let i=0;i<=700;i++){const f=frame(i/700*length);railPoints.push(f.p.clone().addScaledVector(f.right,side*9).addScaledVector(f.up,1.05));}const path=new THREE.CatmullRomCurve3(railPoints,false,'centripetal');const rail=new THREE.Mesh(new THREE.TubeGeometry(path,1400,.065,5,false),steel);scene.add(rail);const lower=rail.clone();lower.position.y=-.32;scene.add(lower);for(let i=0;i<postCount;i++){orient(dummy,frame(i/postCount*length),side*9,.53);dummy.updateMatrix();posts.setMatrixAt(i*2+(side===1?1:0),dummy.matrix);}}posts.castShadow=true;scene.add(posts);

  // Fine alpha-tested branches retain a natural tree silhouette at close range.
  const pine=new THREE.TextureLoader().load('./assets/pine.png');pine.colorSpace=THREE.SRGBColorSpace;pine.anisotropy=8;
  const treePositions=[];let attempts=0;while(treePositions.length<740&&attempts++<16000){const x=(rng()-.5)*1150,z=(rng()-.5)*1200;const n=nearest(x,z),h=height(x,z);if(n.signed>18&&n.distance>19&&h>5&&h<155&&Math.hypot(x,z)<590)treePositions.push({x,z,y:h,size:6+rng()*10});}
  const treeVertices=[],treeUvs=[],treeIndices=[];for(let i=0;i<3;i++){const a=i/3*Math.PI,dx=Math.cos(a)*.5,dz=Math.sin(a)*.5,k=i*4;treeVertices.push(-dx,0,-dz,dx,0,dz,-dx,1,-dz,dx,1,dz);treeUvs.push(0,0,1,0,0,1,1,1);treeIndices.push(k,k+1,k+2,k+2,k+1,k+3);}const tg=new THREE.BufferGeometry();tg.setAttribute('position',new THREE.Float32BufferAttribute(treeVertices,3));tg.setAttribute('uv',new THREE.Float32BufferAttribute(treeUvs,2));tg.setIndex(treeIndices);tg.computeVertexNormals();
  const trees=new THREE.InstancedMesh(tg,new THREE.MeshBasicMaterial({map:pine,alphaTest:.24,side:THREE.DoubleSide,fog:true,color:0xffffff}),treePositions.length);const trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.11,.22,1,6),new THREE.MeshStandardMaterial({color:0x5e4f38,roughness:1}),treePositions.length);
  treePositions.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,rng()*Math.PI,0);dummy.scale.set(p.size*.95,p.size,p.size*.95);dummy.updateMatrix();trees.setMatrixAt(i,dummy.matrix);trees.setColorAt(i,new THREE.Color().setHSL(.23+rng()*.03,.12+rng()*.14,.62+rng()*.2));dummy.position.y=p.y+p.size*.25;dummy.scale.set(p.size*.025,p.size*.5,p.size*.025);dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);});trees.castShadow=true;trees.receiveShadow=true;trunks.castShadow=true;scene.add(trees,trunks);dummy.scale.set(1,1,1);
  const rockGeometry=new THREE.IcosahedronGeometry(1,3),rockPositions=rockGeometry.attributes.position;for(let i=0;i<rockPositions.count;i++){const x=rockPositions.getX(i),y=rockPositions.getY(i),z=rockPositions.getZ(i),k=.7+fbm(x*3.5+z*2.1,y*4.3)*.6;rockPositions.setXYZ(i,x*k,y*k,z*k);}rockGeometry.computeVertexNormals();
  const rocks=new THREE.InstancedMesh(rockGeometry,new THREE.MeshStandardMaterial({color:0xb9b3a1,map:rockMap,normalMap:rockNormal,normalScale:new THREE.Vector2(.6,.6),roughness:1}),120);let ri=0;while(ri<120){const s=rng()*length,f=frame(s),offset=(rng()>.5?1:-1)*(16+rng()*28),p=f.p.addScaledVector(f.right,offset),h=height(p.x,p.z);if(h<1)continue;const size=.6+rng()*2.7;dummy.position.set(p.x,h+.3,p.z);dummy.rotation.set(rng()*3,rng()*3,rng()*3);dummy.scale.set(size,size*(.6+rng()),size*(.6+rng()));dummy.updateMatrix();rocks.setMatrixAt(ri++,dummy.matrix);}rocks.castShadow=true;rocks.receiveShadow=true;scene.add(rocks);dummy.scale.set(1,1,1);dummy.rotation.set(0,0,0);

  const oceanMaterial=new THREE.ShaderMaterial({
    uniforms:{uTime:{value:0},uSun:{value:sunDir}},
    vertexShader:`varying vec3 vWorld;uniform float uTime;void main(){vec3 p=position;p.z+=sin(p.x*.021+p.y*.017+uTime*.65)*.3+sin(p.x*.039-p.y*.027-uTime*.45)*.12;vec4 world=modelMatrix*vec4(p,1.);vWorld=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`,
    fragmentShader:`varying vec3 vWorld;uniform float uTime;uniform vec3 uSun;
      float wave(vec2 p){return sin(dot(p,vec2(.73,.42))*.35+uTime*.8)*.45+sin(dot(p,vec2(-.47,.86))*.57-uTime*.6)*.22+sin(dot(p,vec2(.92,-.21))*1.11+uTime*.4)*.1;}
      void main(){vec2 p=vWorld.xz;vec3 V=normalize(cameraPosition-vWorld);float dist=distance(cameraPosition,vWorld);float detail=mix(.15,.03,smoothstep(60.,1200.,dist));vec3 N=normalize(vec3((wave(p+vec2(.3,0))-wave(p-vec2(.3,0)))*detail,1.,(wave(p+vec2(0,.3))-wave(p-vec2(0,.3)))*detail));float fres=pow(1.-max(dot(N,V),0.),4.);vec3 col=mix(vec3(.016,.09,.12),vec3(.16,.29,.34),fres);float spec=pow(max(dot(reflect(-uSun,N),V),0.),130.);col+=vec3(1.,.67,.35)*spec*.7;float fog=1.-exp(-dist*.0005);gl_FragColor=vec4(mix(col,vec3(.46,.52,.51),fog),1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`
  });
  const ocean=new THREE.Mesh(new THREE.PlaneGeometry(6500,6500,160,160),oceanMaterial);ocean.rotation.x=-Math.PI/2;ocean.position.y=-13;scene.add(ocean);

  for(const [cx,cz,radius,peak] of [[-1050,-850,380,105],[-1200,650,310,83],[800,-1200,500,135]]){
    const geo=new THREE.PlaneGeometry(radius*2,radius*2,55,55);geo.rotateX(-Math.PI/2);const a=geo.attributes.position;
    for(let i=0;i<a.count;i++){const x=a.getX(i),z=a.getZ(i),fall=Math.max(0,1-Math.hypot(x,z)/radius);a.setY(i,-18+peak*Math.pow(fall,1.25)*(.6+fbm(x*.015,z*.015)*.7));}geo.computeVertexNormals();const island=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:0x5e736a,roughness:1}));island.position.set(cx,0,cz);scene.add(island);
  }

  const grassTuft=canvasTexture(256,(c)=>{c.clearRect(0,0,256,256);for(let i=0;i<80;i++){const x=30+rng()*196,top=50+rng()*160;c.strokeStyle=['#84905c','#aaa575','#63784f','#b7ac77'][i%4];c.lineWidth=.7+rng()*1.2;c.beginPath();c.moveTo(128+(rng()-.5)*75,256);c.quadraticCurveTo(x,160,x+(rng()-.5)*32,top);c.stroke();}});
  const grasses=new THREE.InstancedMesh(tg,new THREE.MeshStandardMaterial({map:grassTuft,alphaTest:.36,side:THREE.DoubleSide,roughness:1,color:0xb8b994}),2600);
  for(let i=0;i<2600;i++){const f=frame(rng()*length),side=rng()>.5?1:-1;const p=f.p.clone().addScaledVector(f.right,side*(10.1+rng()*7));dummy.position.set(p.x,height(p.x,p.z),p.z);dummy.rotation.set(0,rng()*Math.PI,0);const size=.25+rng()*.45;dummy.scale.set(size*1.5,size,size*1.5);dummy.updateMatrix();grasses.setMatrixAt(i,dummy.matrix);}grasses.receiveShadow=true;scene.add(grasses);dummy.scale.set(1,1,1);dummy.rotation.set(0,0,0);

  function meshBox(parent,w,h,d,material,x,y,z){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  const concrete=new THREE.MeshStandardMaterial({color:0xc6c2aa,map:rockTex,roughness:.9}),charcoal=new THREE.MeshStandardMaterial({color:0x26332e,roughness:.55}),windowMat=new THREE.MeshPhysicalMaterial({color:0x36595c,metalness:.4,roughness:.13,clearcoat:1});
  function sign(text,width=512,height=128,bg='#213c38',color='#e5ebd0'){const c=document.createElement('canvas');c.width=width;c.height=height;const x=c.getContext('2d');x.fillStyle=bg;x.fillRect(0,0,width,height);x.strokeStyle=color;x.lineWidth=3;x.strokeRect(8,8,width-16,height-16);x.fillStyle=color;x.font=`500 ${height*.31}px Bahnschrift, sans-serif`;x.textAlign='center';x.textBaseline='middle';x.fillText(text,width/2,height/2);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return new THREE.MeshBasicMaterial({map:t});}
  for(let i=0;i<9;i++){const f=frame(100+i*length/9),g=new THREE.Group();orient(g,f,14,0);meshBox(g,.12,3.6,.12,steel,0,1.8,0);const panel=new THREE.Mesh(new THREE.PlaneGeometry(3.8,1),sign(i%3===0?'COASTLINE  →':i%3===1?'MOUNTAIN PASS  ↑':'SCENIC ROUTE  ↑'));panel.position.set(0,3.1,.08);g.add(panel);scene.add(g);}
  for(let i=0;i<34;i++){const f=frame(130+i*length/34),g=new THREE.Group();orient(g,f,8.35,0);meshBox(g,.06,1.8,.06,steel,0,.9,0);const panel=new THREE.Mesh(new THREE.PlaneGeometry(.85,.65),sign('›',128,128,'#ded2a0','#26302b'));panel.position.y=1.55;g.add(panel);scene.add(g);}
  for(let i=0;i<5;i++){const f=frame(55+i*length/5),g=new THREE.Group();orient(g,f,27,0);g.position.y=height(g.position.x,g.position.z);meshBox(g,15,5,9,concrete,0,2.5,0);meshBox(g,16,.4,10,charcoal,0,5.2,0);meshBox(g,13,2.6,.15,windowMat,0,2.8,4.58);for(let j=-5;j<6;j+=2)meshBox(g,.1,3,.2,charcoal,j,2.8,4.7);meshBox(g,17,.23,7,concrete,0,5.9,4);for(const x of [-7.8,7.8])meshBox(g,.16,5.7,.16,steel,x,2.8,6.8);const panel=new THREE.Mesh(new THREE.PlaneGeometry(9,1.2),sign(i===0?'COASTLINE / MOTOR CLUB':'COASTLINE / OUTPOST'));panel.position.set(0,4.6,4.7);g.add(panel);scene.add(g);}

  const gates=[];for(let i=1;i<=6;i++){const s=i*length/6-18,f=frame(s),g=new THREE.Group();orient(g,f,0,0);meshBox(g,.32,5.8,.4,charcoal,-8.3,2.9,0);meshBox(g,.32,5.8,.4,charcoal,8.3,2.9,0);meshBox(g,17,.65,.6,charcoal,0,5.6,0);const panel=new THREE.Mesh(new THREE.PlaneGeometry(11,.45),sign(i===6?'COASTLINE / FINISH':`CHECKPOINT 0${i} / COASTLINE`,1024,64));panel.position.set(0,5.6,.32);g.add(panel);const glow=new THREE.MeshBasicMaterial({color:0xc8e889});for(const x of [-8.1,8.1])meshBox(g,.07,4.3,.08,glow,x,2.5,.24);scene.add(g);gates.push({s,group:g,glow});}
  // Start markings and warm roadside lamps give the road a human scale.
  const startFrame=frame(0);const startLine=new THREE.Group();orient(startLine,startFrame,0,.075);for(let i=0;i<16;i++)for(let j=0;j<2;j++){meshBox(startLine,.85,.012,.75,new THREE.MeshStandardMaterial({color:(i+j)%2?0xd8d5c1:0x26312f,roughness:.9}),-6.4+i*.85,0,j*.75);}scene.add(startLine);
  for(let i=0;i<28;i++){const f=frame(i*length/28),g=new THREE.Group();orient(g,f,-10.7,0);meshBox(g,.14,7,.14,steel,0,3.5,0);meshBox(g,2,.12,.15,steel,1,7,0);meshBox(g,.7,.08,.35,new THREE.MeshBasicMaterial({color:0xffdda0}),1.7,6.9,0);scene.add(g);}

  function update(time,carPosition){oceanMaterial.uniforms.uTime.value=time;sun.position.copy(carPosition).addScaledVector(sunDir,240);sun.target.position.copy(carPosition);sun.target.updateMatrixWorld();}
  return {curve,length,frame,height,nearest,sun,sky,sunDir,gates,update};
}
