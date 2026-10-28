import {readSave,writeSave} from './storage.js';

const $=id=>document.getElementById(id);
const lessons=[
 {title:'先感受一下油门',text:'按住 W / ↑，让车速达到 40 km/h。手机按住右下角「油门」。',keys:['W','↑','油门'],target:['[data-key="gas"]']},
 {title:'在入弯前，先把车刹住',text:'松开油门，按住 S / ↓ / 空格，减速到 8 km/h 以下。手机按住「刹车」。',keys:['S','↓','SPACE','刹车'],target:['[data-key="brake"]']},
 {title:'低速轻点，感受方向',text:'重新轻踩油门，分别轻点左、右方向各一次。直道回正，转弯时不要一直打满。',keys:['A / ←','D / →'],target:['[data-key="left"]','[data-key="right"]']},
 {title:'直道上，再用额外动力',text:'按住油门提速，再按 Shift 使用 ERS。手机点住「ERS」。入弯前松开它。',keys:['W + SHIFT','油门 + ERS'],target:['[data-key="boost"]']},
 {title:'最后，预约一次进站',text:'按 B，或点右下角「预约进站」，再确认预约。正式比赛到达入口后自动接管；换胎与修车都需要等待。',keys:['B','预约进站'],target:['#pit-button']}
];

export function createTutorial({isBusy,startPractice,finishPractice,pauseForDialog,resumeAfterDialog,resetCar}) {
 let active=false,index=0,elapsed=0,left=0,right=0,boost=0,completed=false,starting=false;
 const modal=$('tutorial-modal'),hud=$('tutorial-hud');
 function clearTargets(){document.querySelectorAll('.tutorial-target').forEach(n=>n.classList.remove('tutorial-target'));}
 function remember(done=false){const previous=readSave('onboarding',{});writeSave('onboarding',{version:1,seen:true,completed:done||!!previous.completed});}
 function lesson(){
  clearTargets();const step=lessons[index];elapsed=0;
  $('tutorial-step').textContent=String(index+1).padStart(2,'0')+' / 05';
  $('tutorial-title').textContent=step.title;$('tutorial-text').textContent=step.text;
  $('tutorial-keys').replaceChildren(...step.keys.map(key=>{const k=document.createElement('kbd');k.textContent=key;return k;}));
  $('tutorial-progress').value=0;
  step.target.forEach(selector=>document.querySelector(selector)?.classList.add('tutorial-target'));
 }
 function open(){
  if(isBusy()||active)return;completed=false;pauseForDialog();
  $('tutorial-intro').hidden=false;$('tutorial-complete').hidden=true;modal.hidden=false;
  $('tutorial-start').focus();
 }
 async function begin(){
  if(starting)return;starting=true;$('tutorial-start').disabled=true;
  try{await startPractice();remember();active=true;index=0;left=right=boost=0;modal.hidden=true;hud.hidden=false;document.body.classList.add('tutorial');lesson();$('tutorial-start').blur();}
  finally{starting=false;$('tutorial-start').disabled=false;}
 }
 function complete(){
  completed=true;remember(true);clearTargets();hud.hidden=true;
  $('pit-panel').hidden=true;pauseForDialog();$('tutorial-intro').hidden=true;$('tutorial-complete').hidden=false;modal.hidden=false;$('tutorial-race').focus();
 }
 async function exit(race=false){
  if(starting)return;active=false;clearTargets();hud.hidden=modal.hidden=true;document.body.classList.remove('tutorial');remember(completed);await finishPractice(race);
 }
 function dismiss(){if(starting)return;if(active){void exit(false);return;}remember();modal.hidden=true;resumeAfterDialog();}
 function update(dt,car,control,paused){
  if(!active||completed||paused)return;elapsed+=dt;let progress=0,done=false;
  if(index===0){progress=car.speed/11.12;done=car.speed>=11.12&&control.throttle>.2;}
  else if(index===1){progress=1-car.speed/11.12;done=car.speed<2.22&&control.brake>.2;}
  else if(index===2){if(car.speed>1){if(control.steer<-.2)left+=dt;if(control.steer>.2)right+=dt;}progress=(Math.min(1,left/.2)+Math.min(1,right/.2))/2;done=left>=.2&&right>=.2;}
  else if(index===3){if(car.boosting)boost+=dt;progress=boost/.25;done=boost>=.25;}
  else{done=car.pit.requested||car.pit.state!=='track';progress=done?1:0;}
  $('tutorial-progress').value=Math.max(0,Math.min(1,progress));
  if(done&&elapsed>.5){if(index===lessons.length-1)complete();else{index++;lesson();}}
 }
 $('tutorial-start').onclick=()=>void begin();$('tutorial-skip').onclick=dismiss;
 $('tutorial-race').onclick=()=>void exit(true);$('tutorial-garage').onclick=()=>void exit(false);
 $('tutorial-exit').onclick=()=>void exit(false);$('tutorial-reset').onclick=resetCar;
 $('tutorial-skip-step').onclick=()=>{if(index===lessons.length-1)complete();else{index++;lesson();}};
 window.addEventListener('keydown',event=>{if(modal.hidden||event.code!=='Tab')return;const buttons=[...modal.querySelectorAll('button:not(:disabled)')].filter(n=>n.getClientRects().length);if(!buttons.length)return;const first=buttons[0],last=buttons.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}},{capture:true});
 return {open,update,dismiss,exit,get active(){return active;},get dialogOpen(){return !modal.hidden;},offer(){if(!readSave('onboarding')?.seen)open();}};
}
