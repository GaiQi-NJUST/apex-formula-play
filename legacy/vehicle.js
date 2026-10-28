import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

export async function loadVehicle(scene,onProgress){
  const draco=new DRACOLoader().setDecoderPath('./vendor/draco/');
  const loader=new GLTFLoader().setDRACOLoader(draco);
  const gltf=await loader.loadAsync('./assets/ferrari.glb',onProgress);
  const template=gltf.scene;
  template.updateMatrixWorld(true);
  let box=new THREE.Box3().setFromObject(template),size=box.getSize(new THREE.Vector3());
  if(size.x>size.z)template.rotation.y+=Math.PI/2;
  template.updateMatrixWorld(true);
  const fl=template.getObjectByName('wheel_fl'),rr=template.getObjectByName('wheel_rr');
  if(fl&&rr&&fl.getWorldPosition(new THREE.Vector3()).z>rr.getWorldPosition(new THREE.Vector3()).z)template.rotation.y+=Math.PI;
  template.updateMatrixWorld(true);box.setFromObject(template);size=box.getSize(new THREE.Vector3());template.scale.multiplyScalar(4.64/size.z);
  template.updateMatrixWorld(true);box.setFromObject(template);const center=box.getCenter(new THREE.Vector3());template.position.add(new THREE.Vector3(-center.x,-box.min.y,-center.z));template.updateMatrixWorld(true);

  const paint=new THREE.MeshPhysicalMaterial({color:0x315e56,metalness:.68,roughness:.26,clearcoat:1,clearcoatRoughness:.06,envMapIntensity:1.05});
  const rim=new THREE.MeshStandardMaterial({color:0xc4ccc4,metalness:.95,roughness:.23});
  const glass=new THREE.MeshPhysicalMaterial({color:0x182b31,metalness:.3,roughness:.1,clearcoat:1,envMapIntensity:1.2});
  const body=template.getObjectByName('body');if(body){body.material=paint;body.geometry=body.geometry.clone();body.geometry.computeBoundingBox();}
  const brakeMaterials=[];
  template.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(o.name.startsWith('rim_')||o.name==='trim')o.material=rim;if(o.name==='glass')o.material=glass;if(o.material?.name==='Taillight_Glass'){o.material=o.material.clone();o.material.emissive.set(0xff250c);o.material.emissiveIntensity=.55;brakeMaterials.push(o.material);}}});
  const root=new THREE.Group(),suspension=new THREE.Group();root.add(suspension);suspension.add(template);scene.add(root);
  const wheels=['wheel_fl','wheel_fr','wheel_rl','wheel_rr'].map(n=>template.getObjectByName(n)).filter(Boolean);
  const originalBody=body?Float32Array.from(body.geometry.attributes.position.array):null;
  const brakeMat=new THREE.MeshBasicMaterial({color:0xff381a,toneMapped:false});
  const flameMat=new THREE.MeshBasicMaterial({color:0x7dcaff,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false});
  const flames=[];for(const x of [-.32,0,.32]){const m=new THREE.Mesh(new THREE.ConeGeometry(.07,.7,8),flameMat);m.rotation.x=Math.PI/2;m.position.set(x,.34,2.45);suspension.add(m);flames.push(m);}
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=128;const c=shadowCanvas.getContext('2d'),gradient=c.createRadialGradient(64,64,10,64,64,64);gradient.addColorStop(0,'rgba(0,0,0,.65)');gradient.addColorStop(.65,'rgba(0,0,0,.35)');gradient.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=gradient;c.fillRect(0,0,128,128);
  const contactShadow=new THREE.Mesh(new THREE.PlaneGeometry(3.1,5.5),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}));contactShadow.rotation.x=-Math.PI/2;contactShadow.position.y=.085;root.add(contactShadow);
  const scratchCanvas=document.createElement('canvas');scratchCanvas.width=256;scratchCanvas.height=128;const sc=scratchCanvas.getContext('2d');sc.clearRect(0,0,256,128);for(let i=0;i<40;i++){sc.strokeStyle=i%3?'#d9d6c5aa':'#323c37bb';sc.lineWidth=.5+Math.random()*1.5;const x=Math.random()*100,y=20+Math.random()*90;sc.beginPath();sc.moveTo(x,y);sc.lineTo(x+60+Math.random()*90,y+(Math.random()-.5)*14);sc.stroke();}
  const scrapeMaterial=new THREE.MeshStandardMaterial({map:new THREE.CanvasTexture(scratchCanvas),transparent:true,depthWrite:false,roughness:.9,polygonOffset:true,polygonOffsetFactor:-2});const scrapes=[];for(const side of [-1,1]){const m=new THREE.Mesh(new THREE.PlaneGeometry(2,.7),scrapeMaterial);m.rotation.y=side*Math.PI/2;m.position.set(side*.968,.64,.15);m.visible=false;suspension.add(m);scrapes.push(m);}

  function damage(side,severity){
    scrapes[side<0?0:1].visible=true;
    if(!body)return;
    const attr=body.geometry.attributes.position,b=body.geometry.boundingBox,center=b.getCenter(new THREE.Vector3()),half=b.getSize(new THREE.Vector3()).multiplyScalar(.5);
    const mainAxis=half.z>half.x?'z':'x';
    for(let i=0;i<attr.count;i++){
      let x=attr.getX(i),y=attr.getY(i),z=attr.getZ(i);const normalized=mainAxis==='z'?(x-center.x)/Math.max(half.x,.001):(z-center.z)/Math.max(half.z,.001);
      const dent=Math.max(0,normalized*side-.4)*Math.min(.08,severity*.035);
      if(mainAxis==='z')x-=side*dent*half.x;else z-=side*dent*half.z;
      attr.setXYZ(i,x,y-dent*half.y*.25,z);
    }attr.needsUpdate=true;body.geometry.computeVertexNormals();
  }
  function repair(){if(body&&originalBody){body.geometry.attributes.position.array.set(originalBody);body.geometry.attributes.position.needsUpdate=true;body.geometry.computeVertexNormals();}scrapes.forEach(s=>s.visible=false);}
  function update(dt,speed,steering,braking,boosting,slip,roll,kick,time){
    for(let i=0;i<wheels.length;i++){wheels[i].rotation.x-=speed*dt/.34;if(i<2)wheels[i].rotation.y=steering*.32;}
    suspension.rotation.y=slip+kick;suspension.rotation.z=roll;suspension.rotation.x=braking&&speed>1?.017:-Math.min(.018,speed*.0002);
    suspension.position.y=.065+Math.sin(time*26)*Math.min(speed*.00012,.008);
    brakeMat.color.set(braking?0xff3a16:0x711a0d);
    brakeMaterials.forEach(m=>m.emissiveIntensity=braking?2:.55);
    flameMat.opacity=boosting?.8:0;flames.forEach(m=>m.scale.y=.6+Math.random()*.7);
  }
  function clone(color){const g=new THREE.Group(),copy=template.clone(true);copy.traverse(o=>{if(o.isMesh){o.castShadow=true;if(o.name==='body'){o.material=paint.clone();o.material.color.set(color);o.geometry=o.geometry.clone();}}});g.add(copy);scene.add(g);return g;}
  return {root,suspension,template,paint,wheels,damage,repair,update,clone};
}

export function createImpactEffects(scene){
  const max=180,position=new Float32Array(max*6),color=new Float32Array(max*6),particles=Array.from({length:max},()=>({life:0,p:new THREE.Vector3(),v:new THREE.Vector3()}));
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(position,3));geo.setAttribute('color',new THREE.BufferAttribute(color,3));
  const lines=new THREE.LineSegments(geo,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));lines.frustumCulled=false;scene.add(lines);
  const shards=[];const mat=new THREE.MeshStandardMaterial({color:0x9aa77b,metalness:.7,roughness:.4});for(let i=0;i<26;i++){const m=new THREE.Mesh(new THREE.TetrahedronGeometry(.08+Math.random()*.09),mat);m.visible=false;scene.add(m);shards.push({m,v:new THREE.Vector3(),spin:new THREE.Vector3(),life:0});}
  const cloudCanvas=document.createElement('canvas');cloudCanvas.width=cloudCanvas.height=64;const c=cloudCanvas.getContext('2d'),gr=c.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba(220,216,201,.22)');gr.addColorStop(.4,'rgba(203,203,193,.12)');gr.addColorStop(1,'rgba(180,187,180,0)');c.fillStyle=gr;c.fillRect(0,0,64,64);const smokeTex=new THREE.CanvasTexture(cloudCanvas);
  const smoke=[];for(let i=0;i<42;i++){const m=new THREE.Sprite(new THREE.SpriteMaterial({map:smokeTex,transparent:true,depthWrite:false,opacity:0,color:0xb8c0b3}));scene.add(m);smoke.push({m,v:new THREE.Vector3(),life:0,ttl:1});}
  let particleCursor=0,smokeCursor=0;
  function cloud(p,amount=1){for(let k=0;k<amount;k++){const o=smoke[smokeCursor++%smoke.length];o.m.position.copy(p).add(new THREE.Vector3((Math.random()-.5)*.5,.1,(Math.random()-.5)*.5));o.v.set((Math.random()-.5)*1.5,1+Math.random(),(Math.random()-.5)*1.5);o.life=o.ttl=.6+Math.random()*.6;o.m.scale.setScalar(.7);}}
  function burst(p,normal,severity=1){
    for(let k=0;k<65;k++){const o=particles[particleCursor++%max];o.p.copy(p);o.life=.25+Math.random()*.75;o.v.set((Math.random()-.5)*14,2+Math.random()*10,(Math.random()-.5)*16).addScaledVector(normal,4);o.v.multiplyScalar(Math.min(severity,2));}
    for(const o of shards){o.m.position.copy(p);o.m.visible=true;o.life=1.7+Math.random();o.v.set((Math.random()-.5)*8,2+Math.random()*5,(Math.random()-.5)*8).addScaledVector(normal,3);o.spin.set(Math.random()*12,Math.random()*12,Math.random()*12);}cloud(p,8);
  }
  function update(dt,groundY){
    particles.forEach((o,i)=>{const j=i*6;if(o.life>0){o.life-=dt;o.v.y-=12*dt;o.p.addScaledVector(o.v,dt);position[j]=o.p.x;position[j+1]=o.p.y;position[j+2]=o.p.z;position[j+3]=o.p.x-o.v.x*.025;position[j+4]=o.p.y-o.v.y*.025;position[j+5]=o.p.z-o.v.z*.025;const fade=Math.max(0,o.life);color[j]=color[j+3]=Math.min(2,fade*4);color[j+1]=color[j+4]=fade*1.5;color[j+2]=color[j+5]=fade*.3;}else{for(let k=0;k<6;k++)color[j+k]=0;}});geo.attributes.position.needsUpdate=true;geo.attributes.color.needsUpdate=true;
    shards.forEach(o=>{if(o.life<=0)return;o.life-=dt;o.v.y-=12*dt;o.m.position.addScaledVector(o.v,dt);o.m.rotation.x+=o.spin.x*dt;o.m.rotation.y+=o.spin.y*dt;o.m.rotation.z+=o.spin.z*dt;if(o.m.position.y<groundY+.1){o.m.position.y=groundY+.1;o.v.y=Math.abs(o.v.y)*.28;o.v.x*=.8;o.v.z*=.8;}o.m.visible=o.life>0;});
    smoke.forEach(o=>{if(o.life<=0){o.m.material.opacity=0;return;}o.life-=dt;o.m.position.addScaledVector(o.v,dt);o.m.scale.addScalar(dt*2);o.m.material.opacity=Math.max(0,o.life/o.ttl)*.8;});
  }
  return {burst,cloud,update,activeParticles:()=>particles.filter(p=>p.life>0).length};
}
