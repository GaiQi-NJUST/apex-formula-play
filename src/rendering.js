import * as THREE from '../vendor/build/three.module.js';
import {RGBELoader} from 'three/addons/loaders/RGBELoader.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {SMAAPass} from 'three/addons/postprocessing/SMAAPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {clamp} from './config.js';

export function createRendering(container){
 const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.35));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.92;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.info.autoReset=false;container.appendChild(renderer.domElement);
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(54,innerWidth/innerHeight,.08,5000),target=new THREE.WebGLRenderTarget(innerWidth,innerHeight,{type:THREE.HalfFloatType}),composer=new EffectComposer(renderer,target);
 composer.addPass(new RenderPass(scene,camera));const ao=new GTAOPass(scene,camera,innerWidth/2,innerHeight/2);ao.blendIntensity=.42;ao.updateGtaoMaterial({radius:1.3,distanceExponent:2,thickness:.7});composer.addPass(ao);
 const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.16,.5,1.1);composer.addPass(bloom);
 const grade=new ShaderPass({uniforms:{tDiffuse:{value:null},speed:{value:0},impact:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 vUv;uniform sampler2D tDiffuse;uniform float speed;uniform float impact;void main(){vec2 d=vUv-.5;float shift=dot(d,d)*(impact*.002+speed*.0006);vec3 c=vec3(texture2D(tDiffuse,vUv+d*shift).r,texture2D(tDiffuse,vUv).g,texture2D(tDiffuse,vUv-d*shift).b);c*=1.-dot(d*vec2(.7,1.),d)*.28;gl_FragColor=vec4(c*vec3(1.015,1.005,.985),1.);}'});composer.addPass(grade);composer.addPass(new OutputPass());const smaa=new SMAAPass(innerWidth,innerHeight);composer.addPass(smaa);
 let envTexture=null,quality='high';const gl=renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info'),gpu=ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'WebGL2';
 async function environment(){if(!envTexture){const hdr=await new RGBELoader().loadAsync('./assets/sunset.hdr'),pmrem=new THREE.PMREMGenerator(renderer);envTexture=pmrem.fromEquirectangular(hdr).texture;hdr.dispose();pmrem.dispose();}scene.environment=envTexture;return envTexture;}
 function setQuality(q){quality=q;const ratio=q==='ultra'?Math.min(devicePixelRatio,1.65):q==='high'?Math.min(devicePixelRatio,1.2):Math.min(devicePixelRatio,.8);renderer.setPixelRatio(ratio);composer.setPixelRatio(ratio);renderer.shadowMap.enabled=q!=='performance';ao.enabled=q==='ultra';smaa.enabled=q!=='performance';bloom.enabled=q!=='performance';resize();}
 function resize(){renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight);ao.setSize(Math.floor(innerWidth*renderer.getPixelRatio()*.5),Math.floor(innerHeight*renderer.getPixelRatio()*.5));camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}
 window.addEventListener('resize',resize);
 const look=new THREE.Vector3(),desired=new THREE.Vector3(),desiredLook=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
 function updateCamera(car,mode,dt,intro=false,instant=false){const p=car.position,f=car.forward,right=car.right,mobile=innerWidth<700;
  if(intro){desired.copy(p).addScaledVector(f,-7.4).addScaledVector(right,-5.1).addScaledVector(up,2.35);desiredLook.copy(p).addScaledVector(right,mobile?0:-1.8).addScaledVector(up,mobile?-.3:-.1);if(mobile)desired.addScaledVector(f,-4);}
  else if(car.pit?.state==='service'||car.pit?.state==='release'){desired.copy(p).addScaledVector(f,-4.6).addScaledVector(right,-7.5).addScaledVector(up,3.1);desiredLook.copy(p).addScaledVector(up,.3);}
  else if(mode===1){desired.copy(p).addScaledVector(f,-.12).addScaledVector(up,.24);desiredLook.copy(p).addScaledVector(f,45).addScaledVector(up,.23);}
  else if(mode===2){desired.copy(p).addScaledVector(f,-.64).addScaledVector(up,.98);desiredLook.copy(p).addScaledVector(f,40).addScaledVector(up,.12);}
  else if(mode===3){desired.copy(p).addScaledVector(f,-6.3).addScaledVector(right,5.3).addScaledVector(up,2);desiredLook.copy(p).addScaledVector(f,5);}
  else{desired.copy(p).addScaledVector(f,mobile?-10.4:-8.2-car.speed*.012).addScaledVector(up,mobile?3:2.25+car.speed*.004);desiredLook.copy(p).addScaledVector(f,mobile?5:9).addScaledVector(up,mobile?-.45:-.12);}
  const a=instant?1:1-Math.exp(-dt*(mode===1||mode===2?15:6));camera.position.lerp(desired,a);look.lerp(desiredLook,instant?1:1-Math.exp(-dt*8));const kick=clamp(car.shake||0,0,1.2);if(kick){camera.position.addScaledVector(right,(Math.random()-.5)*kick*.22);camera.position.y+=(Math.random()-.5)*kick*.15;}camera.fov=THREE.MathUtils.lerp(camera.fov,intro?48:mode===1?70:(mobile?61:54)+car.speed*.08,instant?1:1-Math.exp(-dt*3));camera.updateProjectionMatrix();camera.lookAt(look);grade.enabled=kick>.01;grade.uniforms.speed.value=car.speed/90;grade.uniforms.impact.value=kick;
 }
 function render(){renderer.info.reset();composer.render();}
 function clear(){const geometries=new Set(),materials=new Set(),textures=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));});for(const m of materials)for(const value of Object.values(m))if(value?.isTexture&&value!==envTexture)textures.add(value);scene.clear();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());scene.environment=envTexture;}
 return {renderer,scene,camera,composer,ao,bloom,gpu,environment,setQuality,updateCamera,render,clear,get quality(){return quality;}};
}

export function createEffects(scene){
 const max=220,positions=new Float32Array(max*6),colors=new Float32Array(max*6),particles=Array.from({length:max},()=>({p:new THREE.Vector3(),v:new THREE.Vector3(),life:0})),geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(positions,3));geo.setAttribute('color',new THREE.BufferAttribute(colors,3));const lines=new THREE.LineSegments(geo,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));lines.frustumCulled=false;scene.add(lines);let cursor=0;
 const pieces=Array.from({length:18},()=>{const m=new THREE.Mesh(new THREE.BoxGeometry(.04,.014,.12),new THREE.MeshStandardMaterial({color:0x25302d,roughness:.5,metalness:.4}));m.visible=false;scene.add(m);return {m,v:new THREE.Vector3(),life:0};});
 const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext('2d'),g=ctx.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'#cbd7d344');g.addColorStop(.5,'#a8b9be22');g.addColorStop(1,'#98aab200');ctx.fillStyle=g;ctx.fillRect(0,0,64,64);const texture=new THREE.CanvasTexture(canvas),clouds=Array.from({length:70},()=>{const m=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false,opacity:0}));scene.add(m);return {m,v:new THREE.Vector3(),life:0,ttl:1};});let cloudCursor=0;
 const rainCount=1200,rainPositions=new Float32Array(rainCount*6),rainGeo=new THREE.BufferGeometry();rainGeo.setAttribute('position',new THREE.BufferAttribute(rainPositions,3));const rain=new THREE.LineSegments(rainGeo,new THREE.LineBasicMaterial({color:0xc6dce3,transparent:true,opacity:.22,depthWrite:false}));rain.frustumCulled=false;rain.visible=false;scene.add(rain);
 const seeds=Array.from({length:rainCount},()=>({x:(Math.random()-.5)*70,y:Math.random()*30,z:(Math.random()-.5)*70}));
 function puff(p,wet=false){const c=clouds[cloudCursor++%clouds.length];c.m.position.copy(p);c.life=c.ttl=wet?.55:.85;c.m.scale.setScalar(wet?.7:.45);c.v.set((Math.random()-.5)*1.1,wet?.25:1,(Math.random()-.5)*1.1);}
 function hit(p,normal,impact){for(let i=0;i<45;i++){const o=particles[cursor++%max];o.p.copy(p);o.life=.25+Math.random()*.5;o.v.set((Math.random()-.5)*9,2+Math.random()*6,(Math.random()-.5)*9).addScaledVector(normal,2);}for(const o of pieces){o.m.visible=true;o.m.position.copy(p);o.life=1.2+Math.random();o.v.set((Math.random()-.5)*4,2+Math.random()*3,(Math.random()-.5)*4);}for(let i=0;i<4;i++)puff(p);}
 function update(dt,time,player,wet,raining=true){particles.forEach((o,i)=>{const k=i*6;o.life-=dt;if(o.life>0){o.v.y-=10*dt;o.p.addScaledVector(o.v,dt);positions.set([o.p.x,o.p.y,o.p.z,o.p.x-o.v.x*.027,o.p.y-o.v.y*.027,o.p.z-o.v.z*.027],k);for(let j=0;j<2;j++)colors.set([o.life*3,o.life*1.5,o.life*.24],k+j*3);}else colors.fill(0,k,k+6);});geo.attributes.position.needsUpdate=geo.attributes.color.needsUpdate=true;
  for(const o of pieces){if(o.life<=0)continue;o.life-=dt;o.v.y-=10*dt;o.m.position.addScaledVector(o.v,dt);o.m.rotation.x+=dt*6;o.m.rotation.y+=dt*3;if(o.m.position.y<player.position.y-.5){o.m.position.y=player.position.y-.5;o.v.y=Math.abs(o.v.y)*.25;o.v.x*=.9;o.v.z*=.9;}o.m.visible=o.life>0;}
  for(const c of clouds){c.life-=dt;c.m.material.opacity=Math.max(0,c.life/c.ttl);if(c.life>0){c.m.position.addScaledVector(c.v,dt);c.m.scale.addScalar(dt*2.5);}}
  rain.visible=wet>.3&&raining;if(rain.visible){for(let i=0;i<rainCount;i++){const s=seeds[i],y=((s.y-time*21)%30+30)%30,p=player.position;rainPositions.set([p.x+s.x,y+p.y-3,p.z+s.z,p.x+s.x-.12,y+p.y-2.2,p.z+s.z+.1],i*6);}rainGeo.attributes.position.needsUpdate=true;}
 }
 const skids=new THREE.InstancedMesh(new THREE.PlaneGeometry(.23,1.3).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0x0a1012,transparent:true,opacity:.23,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}),1400),skidDummy=new THREE.Object3D();skids.frustumCulled=false;scene.add(skids);for(let i=0;i<1400;i++){skidDummy.scale.setScalar(0);skidDummy.updateMatrix();skids.setMatrixAt(i,skidDummy.matrix);}let skidCursor=0;
 function skid(car){skidDummy.scale.setScalar(1);skidDummy.quaternion.copy(car.rotation);const up=new THREE.Vector3(0,1,0).applyQuaternion(car.rotation);for(const side of [-1,1]){skidDummy.position.copy(car.position).addScaledVector(car.forward,-1.55).addScaledVector(car.right,side).addScaledVector(up,-.518);skidDummy.updateMatrix();skids.setMatrixAt(skidCursor++%1400,skidDummy.matrix);}skids.instanceMatrix.needsUpdate=true;}
 return {hit,puff,update,skid};
}

let treeAsset=null;
export async function loadNearVegetation(scene,circuit){
 try{if(!treeAsset){const [gltf,alpha]=await Promise.all([new GLTFLoader().loadAsync('./assets/tree/pine_sapling_small_1k.gltf'),new THREE.TextureLoader().loadAsync('./assets/tree/textures/pine_sapling_small_twig_alpha_1k.png')]);treeAsset=gltf.scene.children[0];treeAsset.traverse(o=>{if(o.isMesh){o.castShadow=o.receiveShadow=true;for(const m of Array.isArray(o.material)?o.material:[o.material]){if(m.name.toLowerCase().includes('twig')){m.alphaMap=alpha;m.alphaTest=.4;m.side=THREE.DoubleSide;m.needsUpdate=true;}}}});}
  const group=new THREE.Group();scene.add(group);const items=[];for(let i=0;i<28;i++){const f=circuit.frame(i/28*circuit.length+25),m=treeAsset.clone(true);m.scale.setScalar(2.2+(i%4)*.5);m.position.copy(f.p).addScaledVector(f.right,Math.min((i/28*circuit.length+25)%circuit.length,circuit.length-(i/28*circuit.length+25)%circuit.length)<240?72:18+(i%3)*4);m.position.y=circuit.height(m.position.x,m.position.z);m.rotation.y=i*2.1;group.add(m);items.push(m);}return p=>{for(const m of items)m.visible=m.position.distanceToSquared(p)<65*65;};
 }catch(error){console.warn('近景植被加载失败，保留中远景植被',error.message);return ()=>{};}
}
