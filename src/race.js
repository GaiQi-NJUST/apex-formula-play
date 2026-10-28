import * as THREE from '../vendor/build/three.module.js';
import {createPhysics} from './physics.js?v=school1';
import {TEAMS,COMPOUNDS,DEFAULTS,POINTS,clamp,wrap} from './config.js?v=school1';
import {contactDamage,assistDriver} from './driving-assist.js?v=school1';

const up=new THREE.Vector3(0,1,0);
function fresh(id,team){return {id,team,name:id===0?'YOU':TEAMS[team].drivers[id%2],number:27+id*3,compound:'M',temperature:58,wear:0,battery:100,damage:0,wingDamage:0,penalty:0,collisions:0,hitCooldown:0,lap:0,nextGate:0,startedLap:false,lapStart:0,bestLap:Infinity,lastLap:0,sectors:[],sectorStart:0,sectorTimes:[],progress:-20,finished:false,retired:false,finishTime:Infinity,invalidLap:false,offtrackTime:0,offtrackWarned:false,stuck:0,lastSafeS:0,steerAngle:0,brake:0,boosting:false,activeAero:false,gear:'N',speed:0,pitStops:0,control:{throttle:0,brake:1,steer:0},pit:{state:'track',requested:false,compound:'M',fixWing:true,fixDamage:true,remaining:0,stage:null,stageProgress:0,completed:[],box:0,clock:0},lapTrace:[],traceClock:0,rank:id+1};}

export async function createRace(circuit,options={},onEvent=()=>{}){
 const profiling={control:0,physics:0,after:0};
 const config={...DEFAULTS,...options},physics=await createPhysics(circuit),roster=[];
 for(let i=0;i<12;i++){const team=i<2?config.team:(config.team+Math.floor(i/2))%6,c=fresh(i,team);c.compound=config.compound;c.pit.compound=config.compound;physics.spawn(c,-12-Math.floor(i/2)*8,i%2?3:-3);roster.push(c);}
 const race={config,circuit,physics,roster,player:roster[0],phase:'showcase',time:0,sessionElapsed:0,countdown:6,sessionRemaining:90,wetness:config.weather==='rain'?.68:0,weather:config.weather,vscUntil:0,yellowUntil:0,yellowS:0,flag:'GREEN',order:roster.slice(),qualifying:[],gridOrder:roster.slice(),replay:[],replayClock:0,ghost:[],bestGhost:null,bestGhostTime:Infinity,sessionResult:null,paused:false,autopilot:false,lastVSC:0,finishedRace:false,weatherChange:0,events:[]};
 const event=(type,title,detail='',priority=1)=>{const e={type,title,detail,priority,time:race.time};race.events.push(e);if(race.events.length>60)race.events.shift();onEvent(e);};
 const circularDiff=(a,b)=>wrap(a-b+circuit.length/2,circuit.length)-circuit.length/2;
 function resetCar(c,index){const team=c.team;Object.assign(c,fresh(c.id,team));c.compound=config.compound;c.pit.compound=config.compound;c.progress=-12-Math.floor(index/2)*8;c.lastSafeS=c.progress;physics.hold(c,false);physics.placeOnTrack(c,c.progress,index%2?3:-3);c.aiClock=0;c.aiControl=null;c.passTarget=undefined;c.passLane=undefined;c.raceLane=index%2?2.1:-2.1;}
 function resetSession(){race.time=0;race.sessionElapsed=0;race.sessionRemaining=90;race.vscUntil=0;race.yellowUntil=0;race.flag='GREEN';race.sessionResult=null;race.finishedRace=false;race.replay=[];race.replayClock=0;race.events=[];roster.forEach((c,i)=>resetCar(c,i));}
 function begin(session='practice'){
  resetSession();race.tutorial=session==='tutorial';race.phase=race.tutorial?'practice':session;race.neutralOrder=null;if(session==='qualifying')race.sessionRemaining=180;
  if(session==='grid'){
   race.countdown=6.3;const ordered=race.qualifying.length?race.qualifying.map(id=>roster[id]):[...roster.slice(1),roster[0]];race.gridOrder=ordered;ordered.forEach((c,i)=>resetCar(c,i));event('LIGHTS','五灯熄灭后出发','抢跑将受到 5 秒处罚',3);
  }else if(session==='qualifying')event('QUALIFYING','排位赛开始','180 秒内争取最快有效圈；可在菜单跳过',3);
  else if(session==='trial')event('TIME ATTACK','计时赛开始','完整有效圈将保存为最佳圈幽灵',2);
  else event('PRACTICE','练习赛道','熟悉刹车点；B 预约进站，R 呼叫救援',2);
  if(session==='trial'||race.tutorial){roster.slice(1).forEach(c=>{c.retired=true;physics.hold(c,true);physics.placeOnTrack(c,circuit.length*.45+c.id*9,30);});}
  if(race.tutorial){race.sessionRemaining=Infinity;resetTutorialCar();}
 }
 function nextSession(){if(race.phase==='practice'||race.sessionResult?.kind==='practice')begin('qualifying');else if(race.phase==='qualifying'||race.sessionResult?.kind==='qualifying')begin('grid');}
 function skipToRace(){race.qualifying=[...roster.slice(1).sort((a,b)=>a.id-b.id),roster[0]].map(c=>c.id);begin('grid');}
 function bookPit(c=race.player,choices={}){Object.assign(c.pit,{requested:true,compound:choices.compound||c.pit.compound,fixWing:choices.fixWing??true,fixDamage:choices.fixDamage??true});event('BOX BOX','进站已预约',`${COMPOUNDS[c.pit.compound].name} · 到入口后自动接管，维修时比赛继续`,2);}
 function resetTutorialCar(){if(!race.tutorial)return false;const c=race.player;physics.hold(c,false);Object.assign(c,{damage:0,wingDamage:0,temperature:88,wear:0,battery:100,retired:false,finished:false,hitCooldown:1.5,assistClock:0,invalidLap:true});c.pit.state='track';c.pit.requested=false;c.control={throttle:0,brake:1,steer:0};physics.placeOnTrack(c,60,0);return true;}
 function rescue(c=race.player){if(race.tutorial&&c.id===0)return resetTutorialCar();if(c.retired||c.finished||['service','rescue'].includes(c.pit.state)||!['race','practice','qualifying','trial'].includes(race.phase))return false;c.pit.state='rescue';c.pit.stuck=0;c.pit.remaining=18;c.pit.clock=0;c.pit.requested=true;c.control={throttle:0,brake:1,steer:0};c.invalidLap=true;physics.hold(c,true);race.vscUntil=Math.max(race.vscUntil,race.time+18);if(c.id===0)event('RECOVERY','救援正在赶来','等待 18 秒；比赛继续，随后在维修区处理车损',3);return true;}
 function retire(c,reason){if(c.retired)return;c.retired=true;c.control={throttle:0,brake:1,steer:0};physics.hold(c,true);race.yellowUntil=race.time+15;race.yellowS=c.s;if(c.id===0)event('DNF','赛车退赛',reason,4);}
 function collision(a,b,impact,normal){
  if(a.hitCooldown>0||a.retired||a.kinematic)return;for(const c of b?[a,b]:[a]){if(c.hitCooldown>0||c.retired||c.finished||c.kinematic)continue;const protectedCar=c.id===0&&(config.beginner||race.tutorial),damage=contactDamage(impact,protectedCar,race.tutorial);c.damage=clamp(c.damage+damage,0,protectedCar?85:100);c.wingDamage=clamp(c.wingDamage+damage*.014,0,protectedCar?.5:1);c.collisions++;c.hitCooldown=protectedCar?1.35:.65;if(damage>0)c.invalidLap=true;if(c.damage>=100)retire(c,'悬挂或动力系统损坏过重');}
  if(race.tutorial){onEvent({type:'collision',car:a,other:b,impact,normal,position:a.position.clone(),time:race.time});return;}
  race.yellowUntil=race.time+9;race.yellowS=a.s;if(impact>17&&race.time-race.lastVSC>25){race.vscUntil=race.time+18;race.lastVSC=race.time;event('VIRTUAL SAFETY CAR','虚拟安全车','全场限速，禁止超车；事故处理后恢复绿旗',3);}
  onEvent({type:'collision',car:a,other:b,impact,normal,position:a.position.clone(),time:race.time});if(a.id===0||b?.id===0)event('CONTACT','发生接触',`车损 ${Math.round(race.player.damage)}% · 前翼 ${Math.round(race.player.wingDamage*100)}%`,3);
 }
 function aim(c,target,targetSpeed,boost=false){const delta=target.clone().sub(c.position),distance=Math.max(1,Math.hypot(delta.x,delta.z)),angle=Math.atan2(delta.dot(c.right),delta.dot(c.forward)),desired=Math.atan2(6.4*Math.sin(angle),distance),limit=Math.max(.02,c.steerLimit||.12);const error=targetSpeed-c.speed;return {steer:clamp(desired/limit,-1,1),throttle:clamp(error*.3+.12,0,1),brake:clamp(-error*.13,0,1),boost};}
 function aiInput(c){
  const pace=config.difficulty==='pro'?1.04:config.difficulty==='rookie'?.72:.94,s=c.s,g=physics.grip(c,race.wetness);let speedLimit=(77+c.id%3)*pace;
  for(const d of [0,8,18,30,48,70,100,140,190]){const a=circuit.frame(s+d-4).forward,b=circuit.frame(s+d+4).forward,k=Math.acos(clamp(a.dot(b),-1,1))/8,corner=Math.sqrt((8.8*g*pace)/(k+.0002));speedLimit=Math.min(speedLimit,Math.sqrt(corner*corner+2*11*g*Math.max(0,d-15)));}
  if(c.passTarget!==undefined){const passed=roster[c.passTarget];if(!passed||circularDiff(c.s,passed.s)>9||race.time>c.passUntil){c.raceLane=c.passLane??c.raceLane;c.passTarget=undefined;c.passLane=undefined;}}
  let lane=race.time<4?c.near.signed:(c.passLane??c.raceLane??(c.id%2?2.1:-2.1));
  const front=roster.filter(o=>o!==c&&o.pit.state==='track'&&o.near.distance<8.5).map(o=>({car:o,d:circularDiff(o.s,s)})).filter(o=>o.d>0&&o.d<60&&Math.abs(o.car.near.signed-c.near.signed)<2.9).sort((a,b)=>a.d-b.d)[0];
  if(front){
   const side=front.car.near.signed>0?-3.35:3.35;
   const blocked=roster.some(o=>o!==c&&o!==front.car&&o.pit.state==='track'&&circularDiff(o.s,s)>-9&&circularDiff(o.s,s)<Math.max(20,front.d+9)&&Math.abs(o.near.signed-side)<2.9);
   if(c.passTarget===undefined&&race.flag==='GREEN'&&race.time>5&&!blocked&&front.d>12&&speedLimit>front.car.speed+1.5){c.passLane=side;c.passTarget=front.car.id;c.passUntil=race.time+7;lane=side;}
   if(c.passTarget!==undefined)lane=c.passLane;
   const movingAside=c.passTarget!==undefined&&Math.abs(c.near.signed-c.passLane)>1.3;
   if(c.passTarget===undefined||movingAside)speedLimit=Math.min(speedLimit,Math.max(0,front.car.speed+(front.d-(7+c.speed*.18))*.8));
  }
  if(race.vscUntil>race.time)speedLimit=Math.min(speedLimit,21);if(race.yellowUntil>race.time&&Math.abs(circularDiff(s,race.yellowS))<70)speedLimit=Math.min(speedLimit,24);
  if(c.near.distance>8)speedLimit=Math.min(speedLimit,15);const look=clamp(10+c.speed*.5,10,45),f=circuit.frame(s+look),target=f.p.clone().addScaledVector(f.right,lane);return aim(c,target,speedLimit,c.battery>55&&speedLimit-c.speed>5&&Math.abs(c.steerAngle)<.025);
 }
 function beginService(c){const p=c.pit;p.state='service';p.stuck=0;p.clock=0;p.completed=[];p.liftRemaining=.65;p.lowerRemaining=.65;p.tasks=[{kind:'tires',duration:4,remaining:4,done:false}];if(p.fixWing&&c.wingDamage>.02)p.tasks.push({kind:'wing',duration:10,remaining:10,done:false});if(p.fixDamage&&c.damage>1){const t=15+c.damage*.12;p.tasks.push({kind:'repair',duration:t,remaining:t,done:false});}p.remaining=.65+Math.max(...p.tasks.map(t=>t.duration))+.65;p.stage={kind:'lift'};p.stageProgress=0;physics.hold(c,true);if(c.id===0)event('PIT SERVICE','车组开始服务',`预计 ${p.remaining.toFixed(1)} 秒；维修期间名次照常变化`,3);}
 function service(c,dt,input){const p=c.pit;p.clock+=dt;
  if(input.cancelPit){p.state='release';p.remaining=0;physics.hold(c,false);if(c.id===0)event('SERVICE CANCELLED','已中止未完成工序','已完成项目保留；驶出时注意快车道',3);return;}
  if(p.liftRemaining>0){p.liftRemaining=Math.max(0,p.liftRemaining-dt);p.stage={kind:'lift'};p.stageProgress=1-p.liftRemaining/.65;}
  else if(p.tasks.some(t=>!t.done)){
   for(const task of p.tasks){if(task.done)continue;task.remaining-=dt;if(task.remaining<=0){task.remaining=0;task.done=true;p.completed.push(task.kind);if(task.kind==='tires'){c.compound=p.compound;c.temperature=race.weather==='rain'?60:68;c.wear=0;}if(task.kind==='wing')c.wingDamage=0;if(task.kind==='repair')c.damage=0;}}
   const active=p.tasks.find(t=>!t.done)||p.tasks.at(-1);p.stage={kind:active.kind};p.stageProgress=1-active.remaining/active.duration;
  }else if(p.lowerRemaining>0){p.lowerRemaining=Math.max(0,p.lowerRemaining-dt);p.stage={kind:'lower'};p.stageProgress=1-p.lowerRemaining/.65;}
  else{p.state='release';p.remaining=0;c.pitStops++;if(c.id===0)event('SERVICE COMPLETE','维修完成，等待放行','检查快车道，准备回到赛道',2);}
  p.remaining=p.liftRemaining+Math.max(0,...p.tasks.map(t=>t.remaining))+p.lowerRemaining;
 }
 function pitUpdate(c,dt,originalInput){const p=c.pit,pit=circuit.facilities?.pit||circuit.pit;
  if(p.state==='rescue'){
   p.remaining=Math.max(0,p.remaining-dt);if(p.remaining===0){const b=pit.boxes[c.id],point=b.p.clone().addScaledVector(b.right,2.4).addScaledVector(b.up,.64),q=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(b.right,b.up,b.forward.clone().negate()));physics.place(c,point,q);beginService(c);}return {throttle:0,brake:1,steer:0};
  }
  if(p.state==='service'){service(c,dt,originalInput);return {throttle:0,brake:1,steer:0};}
  if(p.state==='release'){
   const blocked=roster.some(o=>o!==c&&!o.retired&&['lane','exit'].includes(o.pit.state)&&o.position.distanceTo(c.position)<9&&o.speed>1);if(blocked){p.remaining=.1;return {throttle:0,brake:1,steer:0};}physics.hold(c,false);p.stuck=0;p.state='exit';p.requested=false;
  }
  if(p.state==='track'&&p.requested){const entryDelta=circularDiff(pit.entryS,c.s);if(entryDelta<35&&entryDelta>-30){const busy=roster.find(o=>o!==c&&!o.retired&&['entry','lane'].includes(o.pit.state)&&o.position.distanceTo(c.position)<16);if(busy){const f=circuit.frame(c.s+15);return aim(c,f.p.clone().addScaledVector(f.right,3.8),Math.max(4,Math.min(12,busy.speed)),false);}p.state='entry';if(c.id===0)event('PIT ENTRY','进入维修区','自动定位 · 维修区限速 60 KM/H',2);}}
  if(p.state==='track')return null;
  const near=pit.nearest(c.position.x,c.position.z),box=pit.boxes[c.id];p.s=near.s;
  if(p.state==='entry'&&near.s>45)p.state='lane';if(p.state==='exit'&&near.s>pit.length-18&&c.near.distance<6){p.state='track';p.requested=false;return null;}
  let targetS=Math.min(pit.length,near.s+clamp(5+c.speed*.5,5,15)),target=pit.frame(targetS),offset=-1.7,targetSpeed=16.2;
  if(p.state!=='exit'){
   const dist=box.s-near.s;if(dist<42){offset=2.4;targetSpeed=Math.min(13,Math.sqrt(Math.max(0,2*5*(dist-.8))));targetS=Math.min(box.s-.15,near.s+7);target=pit.frame(targetS);if(Math.abs(dist)<2&&c.speed<1.4&&c.position.distanceTo(box.p.clone().addScaledVector(box.right,2.4).addScaledVector(box.up,.6))<2.7){beginService(c);return {throttle:0,brake:1,steer:0};}}
  }
  if(near.s>55&&near.s<pit.length-40&&c.speed>17.3){p.speeding=(p.speeding||0)+dt;if(p.speeding>1&&!p.speedPenalty){c.penalty+=5;p.speedPenalty=true;if(c.id===0)event('PENALTY','维修区超速 +5 秒','处罚将在最终成绩中计入',3);}}
  const targetPoint=target.p.clone().addScaledVector(target.right,offset);for(const o of roster){if(o===c||o.retired||!['entry','lane','exit','service','release'].includes(o.pit.state))continue;const d=pit.nearest(o.position.x,o.position.z).s-near.s,lateral=Math.abs(o.position.clone().sub(c.position).dot(target.right));if(d>0&&d<30&&lateral<2.9)targetSpeed=Math.min(targetSpeed,Math.max(0,o.speed+(d-8)*.9));}p.stuck=c.speed<.5?(p.stuck||0)+dt:0;if(p.stuck>12){rescue(c);return {throttle:0,brake:1,steer:0};}return aim(c,targetPoint,targetSpeed,false);
 }
 function crossGate(c,dt){
  const f=circuit.frame(c.nextGate/12*circuit.length),a=c.previousPosition.clone().sub(f.p).dot(f.forward),b=c.position.clone().sub(f.p).dot(f.forward),width=c.nextGate===0&&c.pit.state!=='track'?35:10.3;
  if(a<-.0001&&b>=0&&Math.abs(c.position.clone().sub(f.p).dot(f.right))<width){
   const crossTime=race.time-dt+dt*clamp(-a/(b-a),0,1),gate=c.nextGate;c.nextGate=(gate+1)%12;
   if(gate===0){if(c.startedLap){const t=crossTime-c.lapStart;c.lastLap=t;c.lap++;if(!race.tutorial&&!c.invalidLap&&t>8){c.bestLap=Math.min(c.bestLap,t);if(c.id===0&&t<race.bestGhostTime){race.bestGhostTime=t;race.bestGhost=c.lapTrace.map(v=>v.slice());onEvent({type:'bestLap',time:t,ghost:race.bestGhost,track:config.track});event('FASTEST LAP','新的个人最快圈',t.toFixed(3)+' 秒',3);}}c.sectors[2]=crossTime-c.sectorStart;c.lapTrace=[];c.invalidLap=false;if(race.phase==='race'&&c.lap>=config.laps)finishCar(c,crossTime);}
    else c.startedLap=true;c.lapStart=crossTime;c.sectorStart=crossTime;c.sectorTimes=[];
   }else if(gate===4||gate===8){c.sectors[gate===4?0:1]=crossTime-c.sectorStart;c.sectorStart=crossTime;}
  }
  const span=circuit.length/12;if(!c.startedLap)c.progress=-Math.max(0,circuit.length-c.s);else{const last=wrap(c.nextGate-1,12),along=wrap(c.s-last*span,circuit.length);c.progress=c.lap*circuit.length+last*span+clamp(along,0,span);}
 }
 function finishCar(c,time){if(c.finished)return;if(config.requirePit&&config.mode!=='trial'&&c.pitStops===0)c.penalty+=20;c.finished=true;c.pit.requested=false;c.finishTime=time+c.penalty;if(c.pit.state!=='track'){c.pit.state='exit';c.pit.requested=false;}c.control={throttle:0,brake:.5,steer:0};if(c.id===0){event('CHEQUERED FLAG','冲线！',c.penalty?`完赛，累计处罚 ${c.penalty.toFixed(0)} 秒`:'完成比赛，正在结算成绩',4);race.finishedRace=true;race.finishDeadline=race.time+8;}}
 function rank(){race.order=roster.slice().sort((a,b)=>{if(a.retired!==b.retired)return a.retired?1:-1;if(a.finished&&b.finished)return a.finishTime-b.finishTime;if(a.finished!==b.finished)return a.finished?-1:1;return b.progress-a.progress;});race.order.forEach((c,i)=>c.rank=i+1);}
 function endSession(kind){rank();if(kind==='qualifying'){race.order.sort((a,b)=>a.bestLap-b.bestLap||b.progress-a.progress);race.order.forEach((c,i)=>c.rank=i+1);}race.phase='result';race.sessionResult={kind,time:race.time,results:race.order.map(c=>({id:c.id,name:c.name,team:c.team,rank:c.rank,lap:c.lap,bestLap:c.bestLap,penalty:c.penalty,pitStops:c.pitStops,finished:c.finished,retired:c.retired,time:c.finishTime,points:c.retired?0:POINTS[c.rank-1]}))};onEvent({type:'result',result:race.sessionResult});}
 function updateResources(c,dt){if(c.retired||c.finished)return;const compound=COMPOUNDS[c.compound],slip=Math.abs(c.velocity.dot(c.right))/Math.max(8,c.speed),activity=c.speed/65+Math.abs(c.steerAngle)*4+c.brake*.4;const target=compound.target+activity*8+(c.compound==='I'||c.compound==='W'?22*(1-race.wetness):0)-race.wetness*12;c.temperature+=(target-c.temperature)*dt*.035;if(c.speed>3)c.wear=clamp(c.wear+dt*(.00048+slip*.003+c.brake*.00015)*compound.wear,0,1);c.battery=clamp(c.battery+dt*(c.boosting?-9.5:c.energyMode==='attack'&&c.control.throttle>.4?-1.7:c.brake*4.5+(c.control.throttle<.2?1.5:.25)+(c.energyMode==='recharge'?2:0)),0,100);c.hitCooldown=Math.max(0,c.hitCooldown-dt);if(c.damage>87)c.damage+=dt*.025;if(c.damage>=100)retire(c,'车辆已不适合继续比赛');}
 function step(dt,input={throttle:0,brake:0,steer:0}){const stamp=performance.now();
  if(race.paused||['result','replay'].includes(race.phase))return;
  if(race.phase==='showcase'){for(const c of roster)c.control={throttle:0,brake:1,steer:0};physics.step(dt,race.wetness,config.assist);return;}
  const grid=race.phase==='grid';if(grid){race.countdown-=dt;if(race.countdown<=0){race.phase='race';race.time=0;race.sessionElapsed=0;event('GREEN FLAG','比赛开始','管理轮胎和电量，记得预约进站',3);}}
  if(!grid){race.time+=dt;race.sessionElapsed+=dt;}
  if(['practice','qualifying'].includes(race.phase)&&config.mode!=='practice')race.sessionRemaining-=dt;
  if(config.weather==='rain'){const raining=race.time%240<150,nextWeather=raining?'rain':'sunny';if(race.weather!==nextWeather){race.weather=nextWeather;event('WEATHER',raining?'雨势重新增强':'雨停，赛道正在变干',raining?'注意湿地刹车距离，可预约半雨胎或全雨胎':'赛车线先恢复抓地，关注胎温与换干胎时机',3);}const desired=raining?.64:.04;race.wetness+=(desired-race.wetness)*dt*.014;}else race.wetness=Math.max(0,race.wetness-dt*.0003);
  race.flag=race.vscUntil>race.time?'VSC':race.yellowUntil>race.time?'YELLOW':'GREEN';if(race.flag==='GREEN'){race.neutralOrder=null;race.neutralPenalties=new Set();}else if(!race.neutralOrder){race.neutralOrder=new Map(roster.map(c=>[c.id,c.progress]));race.neutralPenalties=new Set();}
  for(const c of roster){
   c.beginner=c.id===0&&(!!config.beginner||!!race.tutorial);
   let control;if(c.retired||c.finished)control={throttle:0,brake:1,steer:0};else if(c.id===0&&!race.autopilot)control={...input};else{c.aiClock=(c.aiClock||0)-dt;if(c.aiClock<=0||!c.aiControl){c.aiClock=1/30;c.aiControl=aiInput(c);}control={...c.aiControl};}
   if(grid&&(c.id!==0||race.autopilot))control={throttle:0,brake:1,steer:0};
   if(c.retired)control={throttle:0,brake:1,steer:0};else if(c.finished){control=aiInput(c);control.boost=false;if(c.speed>30){control.throttle=0;control.brake=Math.max(control.brake,.45);}}
   if(c.id>0&&!c.finished&&!c.retired&&race.phase==='race'&&c.pit.state==='track'&&!c.pit.requested&&(c.wear>.48||c.damage>43||c.wingDamage>.5||config.requirePit&&c.lap>=Math.max(1,Math.floor(config.laps*.45))&&c.pitStops===0)){c.pit.requested=true;c.pit.compound=race.wetness>.4?'I':c.compound==='S'?'M':'H';}
   if(c.id===0&&c.beginner&&!race.autopilot&&!grid&&!c.retired&&!c.finished&&c.pit.state==='track'&&!c.pit.requested)control=assistDriver(c,control,circuit,dt,physics.grip(c,race.wetness),race.tutorial);
   else c.brakeAssist=false;
   if(c.pit.state!=='track'||c.pit.requested)control=pitUpdate(c,dt,control)||control;
   if(race.flag==='VSC'&&c.speed>22){control.throttle=0;control.brake=Math.max(control.brake,.6);}
   c.overtakeReady=c.pit.state==='track'&&Math.abs(c.steerAngle)<.035&&roster.some(o=>o!==c&&!o.retired&&o.progress>c.progress&&o.progress-c.progress<Math.max(15,c.speed));c.control=control;
  }
  const beforePhysics=performance.now();physics.step(dt,race.wetness,config.assist,collision);const afterPhysics=performance.now();
  for(const c of roster){
   if(c.retired||c.finished)continue;
   if(grid&&c.id===0&&c.speed>1.3&&!c.jumpPenalty){c.jumpPenalty=true;c.penalty+=5;event('FALSE START','抢跑 +5 秒','处罚将在最终成绩中计入',3);}
   crossGate(c,dt);updateResources(c,dt);
   if(c.pit.state==='track'&&!c.finished){
    if(c.near.distance>8.4){c.offtrackTime+=dt;c.invalidLap=true;if(!race.tutorial&&c.offtrackTime>2.5&&!c.offtrackWarned){c.offtrackWarned=true;c.penalty+=5;if(c.id===0)event('TRACK LIMITS','超出赛道边界 +5 秒','本圈不计入最快圈；请返回赛道',3);}}
    else{c.offtrackTime=0;c.offtrackWarned=false;c.lastSafeS=c.s;}
    if(c.speed<2)c.stuck+=dt;else c.stuck=0;if(c.id>0&&c.stuck>10||c.position.y<-15)rescue(c);
   }
   if(c.id===0&&c.startedLap){c.traceClock+=dt;if(c.traceClock>.1){c.traceClock=0;c.lapTrace.push([race.time-c.lapStart,c.position.x,c.position.y,c.position.z,c.rotation.x,c.rotation.y,c.rotation.z,c.rotation.w]);}}
  }
  rank();if(race.neutralOrder){for(const c of roster){if(c.retired||c.finished||c.pit.state!=='track'||c.near.distance>8.4)continue;for(const o of roster){if(o===c||o.retired||o.pit.state!=='track'||o.near.distance>8.4||o.speed<2)continue;const key=c.id+':'+o.id,local=race.flag==='VSC'||Math.abs(circularDiff(c.s,race.yellowS))<70&&Math.abs(circularDiff(o.s,race.yellowS))<70;if(local&&race.neutralOrder.get(c.id)<race.neutralOrder.get(o.id)-8&&c.progress>o.progress+5&&!race.neutralPenalties.has(key)){c.penalty+=5;race.neutralPenalties.add(key);if(c.id===0)event('PENALTY','黄旗区超车 +5 秒','事故区内保持顺序，处罚计入完赛时间',3);}}}}race.replayClock+=dt;if(race.phase==='race'&&race.replayClock>.2){race.replayClock=0;race.replay.push({time:race.time,cars:roster.map(c=>[c.position.x,c.position.y,c.position.z,c.rotation.x,c.rotation.y,c.rotation.z,c.rotation.w,c.speed])});if(race.replay.length>6000)race.replay.shift();}
  if(['practice','qualifying'].includes(race.phase)&&race.sessionRemaining<=0){const kind=race.phase;if(kind==='qualifying')race.qualifying=roster.slice().sort((a,b)=>a.bestLap-b.bestLap||b.progress-a.progress).map(c=>c.id);endSession(kind);}
  profiling.control+=(beforePhysics-stamp-profiling.control)*.03;profiling.physics+=(afterPhysics-beforePhysics-profiling.physics)*.03;profiling.after+=(performance.now()-afterPhysics-profiling.after)*.03;
  if(race.phase==='race'&&(roster.every(c=>c.finished||c.retired)||race.finishedRace&&race.time>race.finishDeadline||race.player.retired&&race.time-race.lastVSC>5))endSession('race');
 }
 return Object.assign(race,{profiling,begin,nextSession,skipToRace,bookPit,rescue,resetTutorialCar,step,rank,endSession,aiInput,finishCar,retire,dispose(){physics.dispose();}});
}
