import * as THREE from '../vendor/build/three.module.js';
import {TRACKS,clamp,wrap} from './config.js';
export function createTrack(id='coast'){
 const track=typeof id==='string'?TRACKS[id]:id,up=new THREE.Vector3(0,1,0);
 const curve=new THREE.CatmullRomCurve3(track.points.map(p=>new THREE.Vector3(...p)),true,'catmullrom',.32);curve.arcLengthDivisions=2500;curve.updateArcLengths();const length=curve.getLength();
 function frame(s){const t=wrap(s,length)/length,p=curve.getPointAt(t),forward=curve.getTangentAt(t).normalize(),right=new THREE.Vector3().crossVectors(forward,up).normalize(),normal=new THREE.Vector3().crossVectors(right,forward).normalize();return {p,forward,right,up:normal};}
 const samples=Array.from({length:700},(_,i)=>frame(i/700*length));
 function nearest(x,z,hint=-1){let best=Infinity,index=0,t=0;const count=samples.length;const search=(a,b)=>{for(let j=a;j<b;j++){const i=wrap(j,count),p=samples[i].p,q=samples[(i+1)%count].p,dx=q.x-p.x,dz=q.z-p.z,u=clamp(((x-p.x)*dx+(z-p.z)*dz)/(dx*dx+dz*dz),0,1),d=(x-p.x-dx*u)**2+(z-p.z-dz*u)**2;if(d<best){best=d;index=i;t=u;}}};if(hint>=0){search(hint-9,hint+10);if(best>900)search(0,count);}else search(0,count);const a=samples[index],b=samples[(index+1)%count],point=a.p.clone().lerp(b.p,t);return {s:(index+t)/count*length,index,point,distance:Math.sqrt(best),y:point.y,signed:(x-point.x)*a.right.x+(z-point.z)*a.right.z,forward:a.forward,right:a.right};}
 const pitPoints=[[-180,0],[-145,12],[-110,25],[-25,25],[65,25],[120,25],[165,12],[195,0]].map(([s,o])=>{const f=frame(s);return f.p.clone().addScaledVector(f.right,o).addScaledVector(f.up,.08);}),pitCurve=new THREE.CatmullRomCurve3(pitPoints,false,'centripetal');pitCurve.arcLengthDivisions=700;pitCurve.updateArcLengths();const pitLength=pitCurve.getLength();
 function pitFrame(s){const t=clamp(s/pitLength,0,1),p=pitCurve.getPointAt(t),forward=pitCurve.getTangentAt(t).normalize(),right=new THREE.Vector3().crossVectors(forward,up).normalize();return {p,forward,right,up:new THREE.Vector3().crossVectors(right,forward).normalize()};}
 const ps=Array.from({length:151},(_,i)=>pitFrame(i/150*pitLength));
 function pitNearest(x,z){let d=Infinity,index=0,t=0;for(let i=0;i<150;i++){const p=ps[i].p,q=ps[i+1].p,dx=q.x-p.x,dz=q.z-p.z,u=clamp(((x-p.x)*dx+(z-p.z)*dz)/(dx*dx+dz*dz),0,1),v=(x-p.x-u*dx)**2+(z-p.z-u*dz)**2;if(v<d){d=v;index=i;t=u;}}return {s:(index+t)/150*pitLength,distance:Math.sqrt(d)};}
 const pit={curve:pitCurve,length:pitLength,frame:pitFrame,nearest:pitNearest,boxes:Array.from({length:12},(_,i)=>{const s=pitLength*.35+i*8;return {s,...pitFrame(s)};}),entryS:length-180,exitS:195};
 function roadGeometry(halfWidth=7.2){const positions=[],indices=[];for(let i=0;i<=1000;i++){const f=frame(i/1000*length);for(const x of [-halfWidth,halfWidth]){const p=f.p.clone().addScaledVector(f.right,x).addScaledVector(f.up,.055);positions.push(p.x,p.y,p.z);}if(i<1000){const k=i*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}}return {positions:Float32Array.from(positions),indices:Uint32Array.from(indices)};}
 return {track,curve,length,frame,nearest,samples,pit,roadGeometry,gates:Array.from({length:12},(_,i)=>({s:i/12*length,...frame(i/12*length)}))};
}
