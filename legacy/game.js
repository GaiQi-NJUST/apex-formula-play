import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { createWorld } from './world.js';
import { loadVehicle, createImpactEffects } from './vehicle.js';
import { DrivingAudio } from './audio.js';

const $=id=>document.getElementById(id);
const clamp=THREE.MathUtils.clamp,lerp=THREE.MathUtils.lerp;
const params=new URLSearchParams(location.search),testing=params.has('test');
const smallScreen=matchMedia('(max-width: 700px)').matches;
const scene=new THREE.Scene();
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.info.autoReset=false;
renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,smallScreen?1.3:1.7));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.69;renderer.outputColorSpace=THREE.SRGBColorSpace;
$('game').appendChild(renderer.domElement);
const camera=new THREE.PerspectiveCamera(52,innerWidth/innerHeight,.12,5000);
const target=new THREE.WebGLRenderTarget(innerWidth,innerHeight,{type:THREE.HalfFloatType});
const composer=new EffectComposer(renderer,target);composer.addPass(new RenderPass(scene,camera));
const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.16,.55,1.15);composer.addPass(bloom);
const grade=new ShaderPass({uniforms:{tDiffuse:{value:null},uTime:{value:0},uSpeed:{value:0},uImpact:{value:0}},vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`uniform sampler2D tDiffuse;uniform float uTime;uniform float uSpeed;uniform float uImpact;varying vec2 vUv;void main(){vec2 uv=vUv;vec2 d=uv-.5;float shift=(uSpeed*.0007+uImpact*.002)*dot(d,d);vec3 c;c.r=texture2D(tDiffuse,uv+d*shift).r;c.g=texture2D(tDiffuse,uv).g;c.b=texture2D(tDiffuse,uv-d*shift).b;float vig=1.-dot(d*vec2(.75,1.),d)*.3;c*=vig;c=mix(c,vec3(dot(c,vec3(.2126,.7152,.0722))),.045);c*=vec3(1.015,1.005,.985);gl_FragColor=vec4(c,1.);}`});composer.addPass(grade);composer.addPass(new OutputPass());
const smaa=new SMAAPass(innerWidth*renderer.getPixelRatio(),innerHeight*renderer.getPixelRatio());composer.addPass(smaa);

const audio=new DrivingAudio(),keys=new Set();
const state={status:'loading',mode:'sprint',s:0,lateral:-3.35,speed:0,vx:0,steer:0,nitro:100,damage:0,score:0,combo:1,comboTime:0,elapsed:0,remaining:90,checkpoint:0,topSpeed:0,collisionCount:0,driftScore:0,drifting:false,boosting:false,shake:0,impactYaw:0,roll:0,rollVelocity:0,hitCooldown:0,rescueCooldown:0,slowmo:0,countdown:3.3,camera:0,quality:smallScreen?'high':'ultra',autoThrottle:false};
let world,vehicle,effects,traffic=[],ready=false,toastTime=0,toastPriority=0,simTime=0,smokeAccumulator=0,lastFrame=performance.now(),uiAccumulator=0,countBeep=4;
const carPosition=new THREE.Vector3(),cameraTarget=new THREE.Vector3(),desiredCamera=new THREE.Vector3(),desiredLook=new THREE.Vector3(),basis=new THREE.Matrix4();
let best=0;try{best=Number(localStorage.getItem('apex-coastline-best'))||0;}catch{}
if(best)$('best').textContent=`最佳 ${formatTime(best)}`;

function progress(amount,text){$('load-progress').style.width=amount+'%';$('load-status').textContent=text;}
function formatTime(value,decimals=false){value=Math.max(0,value);const minutes=Math.floor(value/60),seconds=Math.floor(value%60);return `${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}${decimals?'.'+Math.floor((value%1)*10):''}`;}
function notify(type,title,detail='',duration=2.2,priority=1){if(toastTime>0&&priority<toastPriority)return;toastTime=duration;toastPriority=priority;$('event-type').textContent=type;$('event-title').textContent=title;$('event-detail').textContent=detail;$('event-toast').classList.add('show');}
function orient(object,f,lateral=0,lift=.08){object.position.copy(f.p).addScaledVector(f.right,lateral).addScaledVector(f.up,lift);basis.makeBasis(f.right,f.up,f.forward.clone().negate());object.quaternion.setFromRotationMatrix(basis);}
function circularDiff(a,b){return ((a-b+world.length*1.5)%world.length)-world.length*.5;}

async function init(){
  try{
    progress(8,'雕刻海岸与山体');
    // Allow the loading interface to paint before creating the terrain.
    await new Promise(r=>requestAnimationFrame(r));
    world=createWorld(scene,renderer);effects=createImpactEffects(scene);
    $('route-length').textContent=(world.length/1000).toFixed(1);
    progress(35,'载入精细车身与高动态范围环境');
    const pmrem=new THREE.PMREMGenerator(renderer);pmrem.compileEquirectangularShader();
    const [car,hdr]=await Promise.all([loadVehicle(scene,e=>{if(e.total)progress(35+e.loaded/e.total*30,'载入 Ferrari 458 Italia');}),new RGBELoader().loadAsync('./assets/sunset.hdr')]);
    vehicle=car;const env=pmrem.fromEquirectangular(hdr);scene.environment=env.texture;hdr.dispose();pmrem.dispose();
    progress(78,'部署车流、检查点与驾驶系统');
    const colors=[0xc5c9bd,0x38586a,0x9e4b3f,0xb7a47b,0x34413b,0x8b969e,0xd2d1bf,0x3e4655];
    traffic=colors.map((color,i)=>{const object=vehicle.clone(color);return {object,s:65+i*world.length/9,lateral:i%3===0?-3.4:3.4,speed:19+i%4*4.2,offset:i*1.8,hit:0,impact:0,passed:false,prevDiff:0,oncoming:i===2||i===6};});
    vehicle.root.updateMatrixWorld(true);positionVehicle();updateCamera(1,true);world.update(0,carPosition);
    setQuality(state.quality);drawMinimap();updateUI();
    progress(92,'准备光影与材质');
    renderer.compile(scene,camera);composer.render();
    ready=true;state.status='showcase';progress(100,'本地素材已就绪 · W / ↑ 加速，空格漂移');$('start-label').textContent='发动引擎，出发';$('start').disabled=false;
    window.__APEX_READY__=true;
    renderer.setAnimationLoop(loop);
  }catch(error){console.error(error);$('error-screen').classList.remove('hidden');$('error-message').textContent=`场景加载失败：${error.message}。请通过“开始游戏.cmd”或本地地址运行。`;window.__APEX_ERROR__=String(error);}
}

const skidCount=1800,skidMesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({color:0x111917,roughness:1,transparent:true,opacity:.38,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}),skidCount);
const skidDummy=new THREE.Object3D(),lastSkid=[null,null];let skidCursor=0;skidMesh.count=0;skidMesh.frustumCulled=false;scene.add(skidMesh);
function skids(f){for(let i=0;i<2;i++){const p=f.p.clone().addScaledVector(f.right,state.lateral+(i===0?-.79:.79)).addScaledVector(f.forward,-1.4).addScaledVector(f.up,.095);if(lastSkid[i]){const delta=p.clone().sub(lastSkid[i]),len=delta.length();if(len>.04&&len<4){skidDummy.position.copy(p).add(lastSkid[i]).multiplyScalar(.5);skidDummy.quaternion.copy(vehicle.root.quaternion);skidDummy.rotation.y+=Math.atan2(-delta.x,-delta.z)-Math.atan2(-f.forward.x,-f.forward.z);skidDummy.scale.set(.2,.006,len+.05);skidDummy.updateMatrix();skidMesh.setMatrixAt(skidCursor++%skidCount,skidDummy.matrix);skidMesh.count=Math.min(skidCursor,skidCount);skidMesh.instanceMatrix.needsUpdate=true;}}lastSkid[i]=p;}}

function positionVehicle(){if(!vehicle)return;const f=world.frame(state.s);orient(vehicle.root,f,state.lateral,.07);carPosition.copy(vehicle.root.position);return f;}

function crash(side,strength,other=null){
  if(state.hitCooldown>0||state.status!=='running')return;
  state.hitCooldown=.9;state.collisionCount++;const intensity=clamp(strength,.35,2);
  state.damage=clamp(state.damage+8+intensity*12,0,100);state.speed*=other?.59:.76;state.vx=-side*(3+intensity*2.3);state.impactYaw=side*clamp(intensity*.42,.15,.85);state.rollVelocity=-side*intensity*.65;state.shake=.55+intensity*.35;state.slowmo=.18;state.combo=1;state.comboTime=0;
  const f=world.frame(state.s),p=vehicle.root.position.clone().addScaledVector(f.right,side*1.02).addScaledVector(f.up,.95).addScaledVector(f.forward,other?1.65:0);
  effects.burst(p,f.right.clone().multiplyScalar(-side),intensity);vehicle.damage(side,intensity);audio.hit(intensity);
  if(other){
    other.hit=2;other.impact=side*.22;
    const diff=circularDiff(other.s,state.s);
    if(Math.abs(diff)>1.8){state.s=other.s-Math.sign(diff)*4.8;}
    else{const midpoint=(other.lateral+state.lateral)*.5;state.lateral=clamp(midpoint-side*1.3,-7.8,7.8);other.lateral=clamp(midpoint+side*1.3,-7.8,7.8);}
  }
  notify('IMPACT','抓稳方向',`车身受损 ${Math.round(state.damage)}% · R 道路救援`,2.2,3);
  if(state.damage>=100)finish(false,'车辆损伤过重。重新出发，或在自由驾驶中熟悉弯道。');
}

function physics(dt){
  if(state.status==='countdown'){
    state.countdown-=dt;const n=Math.ceil(state.countdown);if(n>0&&n!==countBeep){audio.beep();countBeep=n;}
    $('countdown').textContent=n>0?n:'GO';if(state.countdown<=0){state.status='running';$('countdown').textContent='';audio.beep(true);notify('THE COASTLINE RUN','追着光，出发。','通过全部 6 个检查点，完成环岛挑战',2.6,2);}return;
  }
  if(state.status!=='running')return;
  const f=world.frame(state.s),gas=keys.has('w')||keys.has('arrowup')||keys.has('gas')||state.autoThrottle,brake=keys.has('s')||keys.has('arrowdown')||keys.has('brake'),handbrake=keys.has(' ')||keys.has('drift');
  const steer=(keys.has('a')||keys.has('arrowleft')||keys.has('left')?-1:0)+(keys.has('d')||keys.has('arrowright')||keys.has('right')?1:0);
  state.steer=lerp(state.steer,steer,1-Math.exp(-dt*6));
  state.boosting=(keys.has('shift')||keys.has('boost'))&&gas&&state.nitro>1&&state.speed>5&&!brake;
  const damageFactor=1-state.damage*.003;
  const acceleration=(gas?10.5*damageFactor:0)+(state.boosting?15.5:0)-(brake?24:0)-(handbrake?5.5:0)-.65-state.speed*state.speed*.00125;
  state.speed=Math.max(0,state.speed+acceleration*dt);const speedLimit=state.boosting?94:77;if(state.speed>speedLimit)state.speed=Math.max(speedLimit,state.speed-dt*9);
  if(state.boosting)state.nitro=Math.max(0,state.nitro-24*dt);else state.nitro=Math.min(100,state.nitro+2.6*dt);
  const next=world.frame(state.s+8),curvature=next.forward.dot(f.right)/8;
  const grip=handbrake?1.05:4.1;
  const sideAcceleration=state.steer*(5.3+state.speed*.48)-curvature*state.speed*state.speed*.14;
  state.vx+=(sideAcceleration-state.vx*grip)*dt;state.vx=clamp(state.vx,-13,13);state.lateral+=state.vx*dt;
  if(Math.abs(state.lateral)>6.65){state.speed=Math.max(0,state.speed-dt*state.speed*.16);state.shake=Math.max(state.shake,.07);}
  if(Math.abs(state.lateral)>8.02){const side=Math.sign(state.lateral);state.lateral=side*7.98;crash(side,Math.abs(state.vx)*.13+state.speed*.008);}
  const movement=state.speed*dt*Math.max(.75,1-Math.abs(state.vx)*.012);state.s+=movement;state.elapsed+=dt;state.remaining-=dt;state.topSpeed=Math.max(state.topSpeed,state.speed*3.6);
  state.hitCooldown=Math.max(0,state.hitCooldown-dt);state.rescueCooldown=Math.max(0,state.rescueCooldown-dt);state.comboTime=Math.max(0,state.comboTime-dt);if(state.comboTime===0)state.combo=1;
  state.drifting=handbrake&&state.speed>13&&Math.abs(state.vx)>1.15;
  if(state.drifting){const points=(Math.abs(state.vx)*7+state.speed*.3)*dt;state.driftScore+=points;state.score+=points;state.nitro=Math.min(100,state.nitro+dt*7);if(state.driftScore>80&&toastTime<.4)notify('CONTROLLED SLIDE',`漂移 +${Math.floor(state.driftScore)}`,'松开手刹，回正车身恢复抓地',.8,1);}
  else if(state.driftScore>0){if(state.driftScore>70)notify('DRIFT COMPLETE',`漂亮的出弯 +${Math.floor(state.driftScore)}`,'氮气已补充',1.4,1);state.driftScore=0;}
  if(state.mode==='sprint'&&state.checkpoint<6&&state.s>=world.gates[state.checkpoint].s){
    state.checkpoint++;state.remaining+=12;state.nitro=Math.min(100,state.nitro+18);state.score+=600;audio.beep(true);
    if(state.checkpoint===6)finish(true);else notify('CHECKPOINT',`${state.checkpoint} / 6  检查点通过`,'时间 +12 秒 · 氮气 +18 · 得分 +600',2.2,3);
  }
  if(state.mode==='free'&&state.s>=world.length){state.s-=world.length;state.score+=500;notify('ANOTHER LAP','再去看一遍海。','新的一圈 · 氮气已补满',2.5,2);state.nitro=100;}
  if(state.mode==='sprint'&&state.remaining<=0&&state.status==='running')finish(false,'倒计时结束。保持出弯速度，使用氮气连接直道。');
  for(const t of traffic){
    const oldDiff=circularDiff(t.s,state.s);t.s+=(t.oncoming?-t.speed:t.speed)*dt;t.hit=Math.max(0,t.hit-dt);t.impact*=Math.exp(-dt*2.2);const diff=circularDiff(t.s,state.s);
    if(Math.abs(diff)<4.55&&Math.abs(t.lateral-state.lateral)<1.96&&t.hit<=0){crash(t.lateral>state.lateral?1:-1,Math.abs(state.speed-(t.oncoming?-t.speed:t.speed))*.025,t);}
    if(diff<-4.3&&t.prevDiff>=-4.3&&state.speed>8&&state.hitCooldown<=0&&Math.abs(diff)<10){
      const gap=Math.abs(t.lateral-state.lateral),near=gap<3.5;state.combo=clamp(state.combo+(near?.5:.2),1,4);state.comboTime=4;const reward=Math.round((near?220:80)*state.combo);state.score+=reward;state.nitro=Math.min(100,state.nitro+(near?12:5));notify(near?'NEAR MISS':'CLEAN OVERTAKE',near?`擦身而过 ×${state.combo.toFixed(1)}`:'干净超车',`+${reward} 得分 · 氮气补充`,1.4,1);
    }t.prevDiff=diff;
    const tf=world.frame(t.s);orient(t.object,tf,t.lateral,.07);if(t.oncoming)t.object.rotateY(Math.PI);t.object.rotateY(t.impact);t.object.visible=Math.abs(diff)<400;
    t.object.traverse(o=>{if(o.name&&o.name.startsWith('wheel_'))o.rotation.x-=t.speed*dt/.34;});
  }
  const current=positionVehicle();
  if(state.drifting){skids(current);smokeAccumulator+=dt;while(smokeAccumulator>.035){smokeAccumulator-=.035;effects.cloud(carPosition.clone().addScaledVector(current.forward,-1.55).addScaledVector(current.right,(Math.random()>.5?.8:-.8)));}}
  else{lastSkid[0]=lastSkid[1]=null;smokeAccumulator=0;}
  if(state.damage>65&&Math.random()<dt*6)effects.cloud(carPosition.clone().addScaledVector(current.forward,-.8).addScaledVector(current.up,.7));
  state.impactYaw*=Math.exp(-dt*3.2);state.rollVelocity+=(-state.roll*40-state.rollVelocity*7)*dt;state.roll+=state.rollVelocity*dt;
  const bodyRoll=state.roll+state.steer*Math.min(.045,state.speed*.0006);vehicle.update(dt,state.speed,state.steer,brake,state.boosting,-Math.atan2(state.vx,Math.max(12,state.speed))*.9,bodyRoll,state.impactYaw,simTime);
}

function updateCamera(dt,instant=false){
  const f=world.frame(state.s);const intro=state.status==='showcase'||state.status==='loading';
  if(intro){const mobile=innerWidth<700,orbit=Math.sin(simTime*.1)*.3;desiredCamera.copy(carPosition).addScaledVector(f.forward,mobile?-11:-7.5).addScaledVector(f.right,-5.2+orbit).addScaledVector(f.up,mobile?3.4:2.4);desiredLook.copy(carPosition).addScaledVector(f.forward,.6).addScaledVector(f.right,mobile?0:-1.5).addScaledVector(f.up,mobile?-.5:.8);}
  else if(state.camera===1){desiredCamera.copy(carPosition).addScaledVector(f.forward,1.15).addScaledVector(f.up,1.24);desiredLook.copy(carPosition).addScaledVector(f.forward,50).addScaledVector(f.up,1.5);}
  else if(state.camera===2){desiredCamera.copy(carPosition).addScaledVector(f.forward,-6.4).addScaledVector(f.right,6.8).addScaledVector(f.up,2.7);desiredLook.copy(carPosition).addScaledVector(f.forward,4).addScaledVector(f.up,.7);}
  else{const mobile=innerWidth<700;desiredCamera.copy(carPosition).addScaledVector(f.forward,(mobile?-11:-8.6)-state.speed*.012).addScaledVector(f.right,-state.vx*.12).addScaledVector(f.up,(mobile?3.5:2.8)+state.speed*.006);desiredLook.copy(carPosition).addScaledVector(f.forward,(mobile?6:10)+state.speed*.07).addScaledVector(f.right,state.vx*.12).addScaledVector(f.up,mobile?.1:1.05);}
  if(instant){camera.position.copy(desiredCamera);cameraTarget.copy(desiredLook);}else{const damping=1-Math.exp(-dt*(state.camera===1?18:6));camera.position.lerp(desiredCamera,damping);cameraTarget.lerp(desiredLook,1-Math.exp(-dt*8));}
  if(state.shake>0){camera.position.addScaledVector(f.right,(Math.random()-.5)*state.shake*.45);camera.position.y+=(Math.random()-.5)*state.shake*.24;}
  camera.fov=lerp(camera.fov,intro?49:state.camera===1?68:(innerWidth<700?60:52)+state.speed*.13+(state.boosting?5:0),instant?1:1-Math.exp(-dt*2.5));camera.updateProjectionMatrix();camera.lookAt(cameraTarget);
}

function loop(now){
  const realDt=Math.min((now-lastFrame)/1000,.1);lastFrame=now;simTime+=realDt;
  const paused=state.status==='paused'||state.status==='finished';
  const dt=paused?0:realDt*(state.slowmo>0?.45:1);state.slowmo=Math.max(0,state.slowmo-realDt);
  if(!paused){let left=dt;while(left>0){const step=Math.min(left,1/90);physics(step);left-=step;}state.shake=Math.max(0,state.shake-realDt*1.5);effects.update(dt,carPosition.y);world.update(simTime,carPosition);if(toastTime>0){toastTime-=realDt;if(toastTime<=0)$('event-toast').classList.remove('show');}}
  updateCamera(realDt);grade.uniforms.uTime.value=simTime;grade.uniforms.uSpeed.value=state.speed/94;grade.uniforms.uImpact.value=state.shake;
  $('impact-flash').style.opacity=String(Math.min(.65,state.shake*.3));
  const gas=keys.has('w')||keys.has('arrowup')||keys.has('gas')||state.autoThrottle;audio.update(state.speed,gas,state.drifting,state.boosting,state.status==='running');
  uiAccumulator+=realDt;if(uiAccumulator>.08){uiAccumulator=0;updateUI();drawMinimap();}
  renderer.info.reset();composer.render();
}

function updateUI(){
  const kph=Math.round(state.speed*3.6),gear=kph<2?'N':Math.min(7,Math.floor(kph/43)+1);$('speed').textContent=String(kph).padStart(3,'0');$('gear').textContent=gear;
  $('nitro').textContent=Math.round(state.nitro);$('nitro-bar').style.width=state.nitro+'%';$('health').textContent=Math.max(0,Math.round(100-state.damage));$('health-bar').style.width=(100-state.damage)+'%';$('health-bar').style.background=state.damage>65?'#e59471':'#c5d6d6';
  $('timer').textContent=formatTime(state.mode==='free'?state.elapsed:state.remaining,true);$('timer').style.color=state.mode==='sprint'&&state.remaining<15?'#f1a37a':'';$('checkpoint').innerHTML=`${state.checkpoint} <em>/ 6</em>`;$('score').textContent=String(Math.floor(state.score)).padStart(5,'0');$('distance').textContent=(state.s/1000).toFixed(2)+' KM';
  const rpm=kph>1?Math.min(20,4+(kph%43)/43*16):2;document.querySelectorAll('.rpm i').forEach((el,i)=>el.classList.toggle('on',i<rpm));
}

const map=$('minimap'),mapCtx=map.getContext('2d');
function mapPoint(p){return {x:180+(p.x-40)*.32,y:140+p.z*.27};}
function drawMinimap(){if(!world)return;const c=mapCtx;c.clearRect(0,0,360,280);c.save();c.lineJoin='round';c.lineCap='round';c.beginPath();for(let i=0;i<=150;i++){const p=mapPoint(world.frame(i/150*world.length).p);i===0?c.moveTo(p.x,p.y):c.lineTo(p.x,p.y);}c.strokeStyle='#061b25aa';c.lineWidth=14;c.stroke();c.strokeStyle='#c9d4c788';c.lineWidth=5;c.stroke();
  for(let i=0;i<world.gates.length;i++){const p=mapPoint(world.frame(world.gates[i].s).p);c.beginPath();c.arc(p.x,p.y,3.4,0,Math.PI*2);c.fillStyle=i<state.checkpoint?'#d9e8a3':'#8b9b8d';c.fill();}
  traffic.forEach(t=>{const p=mapPoint(world.frame(t.s).p);c.fillStyle='#b9c3b666';c.fillRect(p.x-1.5,p.y-1.5,3,3);});
  const f=world.frame(state.s),p=mapPoint(f.p);c.translate(p.x,p.y);c.rotate(Math.atan2(f.forward.x,-f.forward.z));c.beginPath();c.moveTo(0,-7);c.lineTo(5,5);c.lineTo(0,3);c.lineTo(-5,5);c.closePath();c.fillStyle='#e5efba';c.shadowColor='#d9e8a3';c.shadowBlur=12;c.fill();c.restore();
}

function start(mode=state.mode){if(!ready)return;state.mode=mode;Object.assign(state,{status:mode==='free'?'running':'countdown',s:0,lateral:-3.35,speed:0,vx:0,steer:0,nitro:100,damage:0,score:0,combo:1,comboTime:0,elapsed:0,remaining:90,checkpoint:0,topSpeed:0,collisionCount:0,hitCooldown:0,rescueCooldown:0,impactYaw:0,shake:0,roll:0,rollVelocity:0,countdown:3.3,driftScore:0,drifting:false,boosting:false,slowmo:0});
  countBeep=4;vehicle.repair();keys.clear();lastSkid[0]=lastSkid[1]=null;skidMesh.count=0;skidCursor=0;traffic.forEach((t,i)=>{t.s=65+i*world.length/9;t.lateral=i%3===0?-3.4:3.4;t.hit=0;t.impact=0;t.prevDiff=circularDiff(t.s,state.s);});positionVehicle();updateCamera(1,true);audio.start();
  $('welcome').classList.add('leaving');document.body.classList.remove('showcase');document.body.classList.add('racing');$('finish-screen').classList.add('hidden');$('pause-screen').classList.add('hidden');$('settings').classList.add('hidden');$('session-label').textContent=mode==='free'?'自由驾驶':'海岸冲刺';$('timer-label').textContent=mode==='free'?'驾驶时间':'剩余时间';$('countdown').textContent=mode==='free'?'':'3';updateUI();if(mode==='free')notify('FREE DRIVE','去喜欢的方向。','空格漂移 · Shift 氮气 · R 道路救援',3,2);
}
function rescue(){if(state.status!=='running'||state.rescueCooldown>0)return;state.lateral=-3.35;state.vx=0;state.speed=Math.min(8,state.speed);state.damage=0;state.impactYaw=0;state.roll=state.rollVelocity=0;state.rescueCooldown=3;vehicle.repair();if(state.mode==='sprint'){state.remaining-=5;state.score=Math.max(0,state.score-150);}notify('ROADSIDE ASSIST','车辆已修复',state.mode==='sprint'?'救援费用：时间 −5 秒 · 积分 −150':'车况已恢复，可以继续旅程',2,3);positionVehicle();}
let previousStatus='running';
function pause(){if(!ready)return;if(state.status==='paused'){state.status=previousStatus;$('pause-screen').classList.add('hidden');}else if(state.status==='running'||state.status==='countdown'){previousStatus=state.status;state.status='paused';keys.clear();$('pause-screen').classList.remove('hidden');}}
function finish(success,reason=''){state.status='finished';keys.clear();$('finish-tag').textContent=success?'COASTLINE COMPLETE':'ONE MORE RUN';$('finish-title').textContent=success?'山海，尽在身后。':'下次，跑得更远。';$('finish-detail').textContent=reason||`完成 ${(world.length/1000).toFixed(1)} 公里环岛公路，累计 ${state.collisionCount} 次碰撞。`;$('finish-score').textContent=Math.floor(state.score);$('finish-time').textContent=formatTime(state.elapsed,true);$('finish-speed').textContent=Math.round(state.topSpeed)+' KM/H';$('finish-screen').classList.remove('hidden');if(success&&(!best||state.elapsed<best)){best=state.elapsed;try{localStorage.setItem('apex-coastline-best',String(best));}catch{}$('best').textContent=`最佳 ${formatTime(best)}`;}}
function changeCamera(){state.camera=(state.camera+1)%3;$('camera-label').textContent=['追逐镜头','引擎盖镜头','侧后方镜头'][state.camera];}
function setQuality(quality){state.quality=quality;const ratio=quality==='ultra'?Math.min(devicePixelRatio,1.7):quality==='high'?Math.min(devicePixelRatio,1.25):Math.min(devicePixelRatio,.8);renderer.setPixelRatio(ratio);composer.setPixelRatio(ratio);renderer.shadowMap.enabled=quality!=='performance';bloom.enabled=quality!=='performance';smaa.enabled=quality==='ultra';$('quality-label').textContent=quality.toUpperCase();$('quality').value=quality;}

$('start').addEventListener('click',()=>start());$('again').addEventListener('click',()=>start());$('explore').addEventListener('click',()=>start('free'));$('resume').addEventListener('click',pause);$('restart').addEventListener('click',()=>start());$('pause-button').addEventListener('click',pause);$('camera-button').addEventListener('click',changeCamera);
$('audio-button').addEventListener('click',()=>{$('audio-button').setAttribute('aria-pressed',String(audio.toggle()));});
$('settings-button').addEventListener('click',()=>{$('settings').classList.toggle('hidden');});$('close-settings').addEventListener('click',()=>$('settings').classList.add('hidden'));
$('quality').addEventListener('change',e=>setQuality(e.target.value));$('paint').addEventListener('change',e=>{if(vehicle)vehicle.paint.color.set(e.target.value);});$('auto-throttle').addEventListener('change',e=>state.autoThrottle=e.target.checked);
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{state.mode=b.dataset.mode;document.querySelectorAll('[data-mode]').forEach(x=>x.classList.toggle('active',x===b));$('session-label').textContent=state.mode==='sprint'?'海岸冲刺':'自由驾驶';}));
document.addEventListener('keydown',e=>{if(e.target instanceof HTMLSelectElement||e.target instanceof HTMLInputElement)return;const k=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k))e.preventDefault();keys.add(k);if(e.repeat)return;if(k==='c')changeCamera();if(k==='r')rescue();if(k==='escape')pause();if(k==='enter'&&state.status==='showcase')start();});document.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
window.addEventListener('blur',()=>{keys.clear();if(state.status==='running'||state.status==='countdown')pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();if(state.status==='running'||state.status==='countdown')pause();}});
document.querySelectorAll('[data-key]').forEach(b=>{b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);keys.add(b.dataset.key);b.style.background='#d9e8a388';});for(const name of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(name,()=>{keys.delete(b.dataset.key);b.style.background='';});});
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight);});

// Diagnostics are read-only in regular play; deterministic controls exist only for local acceptance runs.
window.__APEX={get diagnostics(){return {ready,status:state.status,trackLength:world?.length,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,speed:state.speed*3.6,collisions:state.collisionCount,damage:state.damage,checkpoint:state.checkpoint,score:state.score,quality:state.quality,s:state.s,lateral:state.lateral,particles:effects?.activeParticles(),vehicleMeshes:vehicle?(()=>{let n=0;vehicle.template.traverse(o=>{if(o.isMesh)n++;});return n;})():0};}};
if(testing)Object.assign(window.__APEX,{
  start,
  step(seconds,input){
    if(input){keys.clear();input.forEach(k=>keys.add(k));}
    for(let t=0;t<seconds;t+=1/90){simTime+=1/90;physics(1/90);effects.update(1/90,carPosition.y);state.shake=Math.max(0,state.shake-1/90*1.5);if(toastTime>0)toastTime-=1/90;}
    if(toastTime<=0)$('event-toast').classList.remove('show');
    keys.clear();updateCamera(1,true);world.update(simTime,carPosition);updateUI();drawMinimap();grade.uniforms.uImpact.value=state.shake;grade.uniforms.uSpeed.value=state.speed/94;$('impact-flash').style.opacity=String(Math.min(.65,state.shake*.3));renderer.info.reset();composer.render();
  },
  set(patch){for(const key of ['s','lateral','speed','nitro','damage','hitCooldown','vx','remaining'])if(key in patch)state[key]=patch[key];positionVehicle();},
  crash(side=1,strength=1){crash(side,strength);positionVehicle();updateUI();composer.render();},pause,quality:setQuality,rescue,
  render(){updateCamera(1,true);world.update(simTime,carPosition);renderer.info.reset();composer.render();},
  stopLoop(){renderer.setAnimationLoop(null);},get state(){return state;},
  traffic:()=>traffic.map(t=>({s:t.s,lateral:t.lateral,speed:t.speed})),
  gates:()=>world.gates.map(g=>g.s)
});
init();
