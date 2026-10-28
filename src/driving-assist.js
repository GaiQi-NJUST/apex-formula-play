import {clamp} from './config.js?v=school1';

export function contactDamage(impact, beginner=false, tutorial=false) {
 if(tutorial || beginner && impact < 6) return 0;
 return clamp((impact-2.5)*1.5,2,32)*(beginner?.15:1);
}

// The driver still chooses the line and throttle. This only brakes for an
// approaching bend or an unsafe speed, using distance available to slow down.
export function assistDriver(car,control,circuit,dt,grip,tutorial=false) {
 car.assistClock=(car.assistClock||0)-dt;
 if(car.assistClock<=0 || !Number.isFinite(car.assistSpeed)) {
  car.assistClock=1/30;
  let limit=tutorial?27.8:55.6;
  for(const distance of [8,22,45,75,110,150]) {
   const a=circuit.frame(car.s+distance-6).forward,b=circuit.frame(car.s+distance+6).forward;
   const curvature=Math.acos(clamp(a.dot(b),-1,1))/12;
   const corner=Math.sqrt(6.5*grip/(curvature+.0002));
   limit=Math.min(limit,Math.sqrt(corner*corner+14*Math.max(0,distance-12)));
  }
  if(car.near.distance>7)limit=Math.min(limit,12);
  car.assistSpeed=clamp(limit,7,tutorial?27.8:55.6);
 }
 const automatic=clamp((car.speed-car.assistSpeed)*.22,0,.9);
 car.brakeAssist=automatic>.04;
 if(car.brakeAssist){control.brake=Math.max(control.brake||0,automatic);control.throttle=0;control.boost=false;}
 return control;
}
