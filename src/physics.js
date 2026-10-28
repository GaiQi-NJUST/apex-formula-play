import RAPIER from '../vendor/rapier/rapier.mjs';
import * as THREE from '../vendor/build/three.module.js';
import {COMPOUNDS,clamp} from './config.js';
const UP=new THREE.Vector3(0,1,0);
export async function createPhysics(circuit){
 await RAPIER.init();const world=new RAPIER.World({x:0,y:-9.81,z:0}),events=new RAPIER.EventQueue(true);world.timestep=1/120;
 const profiling={prepare:0,world:0,read:0,count:0};
 const rigidCars=[],colliderCars=new Map(),staticData=new Map();
 for(const g of circuit.colliders||[circuit.roadGeometry()]){const c=world.createCollider(RAPIER.ColliderDesc.trimesh(g.positions,g.indices).setFriction(.8).setCollisionGroups(0x00010002));staticData.set(c.handle,{kind:'ground'});}
 // A lower catch surface is only a recovery floor; it does not constrain cars to the track.
 const floor=world.createCollider(RAPIER.ColliderDesc.cuboid(1800,.5,1800).setTranslation(0,-30,0).setCollisionGroups(0x00010002));staticData.set(floor.handle,{kind:'ground'});
 for(const s of circuit.barrierSegments||[]){const q=new THREE.Quaternion().setFromAxisAngle(UP,s.yaw),c=world.createCollider(RAPIER.ColliderDesc.cuboid(.18,.75,3.6).setTranslation(s.x,s.y,s.z).setRotation(q).setFriction(.16).setRestitution(.12).setCollisionGroups(0x00040002));staticData.set(c.handle,{kind:'barrier',normal:new THREE.Vector3(Math.cos(s.yaw),0,-Math.sin(s.yaw))});}
 function spawn(car,s,lateral=0){const f=circuit.frame(s),p=f.p.clone().addScaledVector(f.right,lateral).addScaledVector(f.up,.66),m=new THREE.Matrix4().makeBasis(f.right,f.up,f.forward.clone().negate()),q=new THREE.Quaternion().setFromRotationMatrix(m);
  const body=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(p.x,p.y,p.z).setRotation(q).setAdditionalMass(800).setLinearDamping(.018).setAngularDamping(1.1).setCanSleep(false));
  const make=(desc,groups=0x00020007)=>{const c=world.createCollider(desc.setDensity(.015).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS).setCollisionGroups(groups).setFriction(.15).setRestitution(.1),body);colliderCars.set(c.handle,car);return c;};
  make(RAPIER.ColliderDesc.cuboid(.72,.18,1.8));make(RAPIER.ColliderDesc.cuboid(1.04,.045,.35).setTranslation(0,-.32,-2.4));
  for(const z of [-1.65,1.55])for(const x of [-1,1]){const d=RAPIER.ColliderDesc.cylinder(.15,.34).setTranslation(x,-.24,z).setRotation({x:0,y:0,z:Math.SQRT1_2,w:Math.SQRT1_2}).setCollisionGroups(0x00020006);make(d,0x00020006);}
  const controller=world.createVehicleController(body);controller.indexUpAxis=1;controller.setIndexForwardAxis=2;
  for(const z of [-1.65,1.55])for(const x of [-1,1]){controller.addWheel({x,y:0,z},{x:0,y:-1,z:0},{x:-1,y:0,z:0},.28,.355);const i=controller.numWheels()-1;controller.setWheelSuspensionStiffness(i,75);controller.setWheelMaxSuspensionTravel(i,.16);controller.setWheelSuspensionCompression(i,4.5);controller.setWheelSuspensionRelaxation(i,5.3);controller.setWheelMaxSuspensionForce(i,24000);controller.setWheelFrictionSlip(i,3.6);controller.setWheelSideFrictionStiffness(i,1.2);}
  Object.assign(car,{body,controller,position:p,rotation:q,velocity:new THREE.Vector3(),forward:f.forward.clone(),right:f.right.clone(),previousPosition:p.clone(),wheelRotation:[0,0,0,0],suspension:[0,0,0,0],speed:0,steerAngle:0,near:circuit.nearest(p.x,p.z),contacts:4,kinematic:false});rigidCars.push(car);return car;
 }
 function place(car,p,q,stop=true){car.body.setTranslation(p,true);car.body.setRotation(q,true);if(stop){car.body.setLinvel({x:0,y:0,z:0},true);car.body.setAngvel({x:0,y:0,z:0},true);}car.position.copy(p);car.rotation.copy(q);car.previousPosition.copy(p);car.near=circuit.nearest(p.x,p.z);car.s=car.near.s;}
 function placeOnTrack(car,s,lateral=0){const f=circuit.frame(s),p=f.p.clone().addScaledVector(f.right,lateral).addScaledVector(f.up,.66),q=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(f.right,f.up,f.forward.clone().negate()));place(car,p,q);}
 function hold(car,enabled){if(car.kinematic===enabled)return;car.kinematic=enabled;car.body.setBodyType(enabled?RAPIER.RigidBodyType.KinematicPositionBased:RAPIER.RigidBodyType.Dynamic,true);car.body.setLinvel({x:0,y:0,z:0},true);car.body.setAngvel({x:0,y:0,z:0},true);}
 function grip(car,wet){const c=COMPOUNDS[car.compound],rain=car.compound==='I'||car.compound==='W';const temp=.76+.24*Math.exp(-(((car.temperature-c.target)/40)**2)),wear=1-.46*Math.pow(car.wear,1.4);const localWet=wet*(Math.abs(car.near.signed)<1.9?.74:1);let surface=rain?(.74+localWet*.3):(1-localWet*.74);if(car.compound==='I'&&wet>.7)surface*=.85;if(car.compound==='W'&&wet<.3)surface*=.82;const road=car.pit.state!=='track'?1:car.near.distance>8.2?.48:1;return clamp(c.grip*temp*wear*surface*road,.2,1.15);}
 function prepare(car,dt,wet,assist){
  assist=assist||car.beginner;
  car.previousPosition.copy(car.position);if(car.kinematic)return;
  const control=car.control||{throttle:0,brake:1,steer:0},v=car.body.linvel(),q=car.body.rotation();car.rotation.set(q.x,q.y,q.z,q.w);car.forward.set(0,0,-1).applyQuaternion(car.rotation);car.right.set(1,0,0).applyQuaternion(car.rotation);car.velocity.set(v.x,v.y,v.z);const speed=Math.max(0,car.velocity.dot(car.forward)),g=grip(car,wet);
  const steerLimit=(assist?Math.min(.44/(1+speed*.027),Math.atan(3.2*32*g*(1+speed*speed*.00016)/Math.max(speed*speed,12))):.43/(1+speed*.028))*(car.beginner?.88:1);car.steerLimit=steerLimit;car.steerAngle+=(clamp(control.steer,-1,1)*steerLimit-car.steerAngle)*(1-Math.exp(-dt*(car.beginner?5:8)));
  const boost=control.boost&&car.battery>1&&control.throttle>.4&&speed>5&&car.pit.state==='track';car.boosting=!!boost;car.activeAero=car.pit.state==='track'&&speed>38&&Math.abs(control.steer)<.12&&control.brake<.1;
  const strategy=car.energyMode==='recharge'?.83:car.energyMode==='attack'&&car.battery>3?1.12:1;
  const damage=1-car.damage*.004,engine=(13700/(1+speed*.014))*(control.throttle||0)*damage*strategy+(boost?3400+(car.overtakeReady?1000:0):0),dragFactor=car.activeAero?.42:.63;
  if(!car.impactVelocity)car.impactVelocity=new THREE.Vector3();car.impactVelocity.copy(car.velocity);
  car.body.resetForces(true);car.body.addForce({x:-v.x*speed*dragFactor,y:-speed*speed*(car.activeAero?.9:1.7)*(1-car.wingDamage*.55),z:-v.z*speed*dragFactor},true);
  if(car.near.distance>8.3)car.body.addForce({x:-v.x*65,y:0,z:-v.z*65},true);
  if(assist){const av=car.body.angvel(),desiredYaw=-speed*Math.tan(car.steerAngle)/3.2,lateral=car.velocity.dot(car.right);car.body.addTorque({x:-av.x*280,y:Math.max(-4200,Math.min(4200,(desiredYaw-av.y)*1900)),z:-av.z*280},true);const stabilization=Math.max(-4200*g,Math.min(4200*g,-lateral*1000));car.body.addForce({x:car.right.x*stabilization,y:0,z:car.right.z*stabilization},true);}
  for(let i=0;i<4;i++){car.controller.setWheelSteering(i,i<2?-car.steerAngle:0);car.controller.setWheelEngineForce(i,i>=2?-engine*.5:0);car.controller.setWheelBrake(i,(control.brake||0)*9000*dt);car.controller.setWheelFrictionSlip(i,3.65*g);car.controller.setWheelSideFrictionStiffness(i,1.15*g);}
  car.controller.updateVehicle(dt,undefined,0x00020001);car.brake=control.brake||0;car.grip=g;
 }
 function step(dt,wetness,assist,onCollision){const start=performance.now();world.timestep=dt;for(const car of rigidCars)prepare(car,dt,wetness,assist);const beforeWorld=performance.now();world.step(events);const afterWorld=performance.now();
  for(const car of rigidCars){const p=car.body.translation(),q=car.body.rotation(),v=car.body.linvel();car.position.set(p.x,p.y,p.z);car.rotation.set(q.x,q.y,q.z,q.w);car.velocity.set(v.x,v.y,v.z);car.forward.set(0,0,-1).applyQuaternion(car.rotation);car.right.set(1,0,0).applyQuaternion(car.rotation);car.speed=Math.max(0,car.velocity.dot(car.forward));car.gear=car.speed<.4?'N':Math.min(8,Math.floor(car.speed*3.6/42)+1);car.near=circuit.nearest(p.x,p.z,car.near.index);car.s=car.near.s;car.contacts=0;for(let i=0;i<4;i++){car.wheelRotation[i]=car.controller.wheelRotation(i)||0;car.suspension[i]=.24-(car.controller.wheelSuspensionLength(i)||.24);if(car.controller.wheelIsInContact(i))car.contacts++;}}
  profiling.prepare+=(beforeWorld-start-profiling.prepare)*.03;profiling.world+=(afterWorld-beforeWorld-profiling.world)*.03;profiling.read+=(performance.now()-afterWorld-profiling.read)*.03;profiling.count++;
  events.drainCollisionEvents((a,b,started)=>{if(!started)return;const ca=colliderCars.get(a),cb=colliderCars.get(b);if(!ca&&!cb)return;const c=ca||cb,other=ca&&cb?cb:null,info=staticData.get(ca?b:a);if(info?.kind==='ground')return;const normal=other?c.position.clone().sub(other.position).setY(0).normalize():info?.normal||new THREE.Vector3(1,0,0);const relative=(c.impactVelocity||c.velocity).clone().sub(other&&!other.kinematic?(other.impactVelocity||other.velocity):new THREE.Vector3()),impact=Math.abs(relative.dot(normal));if(impact>2.8)onCollision?.(c,other,impact,normal);});
 }
 return {profiling,world,spawn,step,place,placeOnTrack,hold,grip,dispose(){events.free();world.free();}};
}
