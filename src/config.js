export const TEAMS=[
 {id:'apex',name:'APEX WORKS',color:0xd7e781,accent:0x162b29,drivers:['YOU','N. RIVAS']},
 {id:'orbit',name:'ORBIT RACING',color:0xf17c4b,accent:0x242d40,drivers:['L. HART','J. SATO']},
 {id:'vela',name:'VELA MOTORSPORT',color:0x65b2c5,accent:0xe5ece1,drivers:['A. MOREAU','M. NOVAK']},
 {id:'titan',name:'TITAN GRAND PRIX',color:0xb84243,accent:0x202b34,drivers:['E. ROSSI','D. KIM']},
 {id:'pulse',name:'PULSE PERFORMANCE',color:0x8770bb,accent:0x1b2132,drivers:['S. COSTA','K. WILLIAMS']},
 {id:'nova',name:'NOVA FORMULA',color:0xc4cbd0,accent:0x365c55,drivers:['V. LUND','T. OKADA']}
];
export const TRACKS={
 coast:{id:'coast',name:'蔚蓝海岸大奖赛',subtitle:'COASTLINE GRAND PRIX',round:1,weather:'sunset',points:[[0,2,180],[0,2,-160],[100,5,-330],[300,8,-350],[390,12,-190],[280,14,-85],[200,11,-155],[135,10,-65],[215,8,100],[390,5,215],[350,3,360],[120,2,400],[0,2,355]]},
 forest:{id:'forest',name:'松林山谷大奖赛',subtitle:'ALPINE FOREST GRAND PRIX',round:2,weather:'rain',points:[[0,6,160],[0,6,-160],[70,9,-335],[270,17,-420],[440,24,-280],[390,28,-80],[260,23,-105],[230,19,80],[410,12,235],[300,8,405],[80,6,430],[0,6,330]]},
 harbor:{id:'harbor',name:'港湾之夜大奖赛',subtitle:'HARBOR NIGHT GRAND PRIX',round:3,weather:'night',points:[[0,2,160],[0,2,-190],[100,2,-300],[315,2,-300],[315,2,-80],[210,2,-80],[210,2,25],[400,2,25],[400,2,240],[265,2,240],[265,2,400],[70,2,400],[0,2,310]]}
};
export const COMPOUNDS={
 S:{name:'软胎',color:'#ed645b',grip:1.07,wear:1.65,target:92},
 M:{name:'中性干胎',color:'#e8d475',grip:1,wear:1,target:88},
 H:{name:'硬胎',color:'#e3e5da',grip:.94,wear:.69,target:84},
 I:{name:'半雨胎',color:'#79bc8b',grip:.91,wear:1.2,target:72},
 W:{name:'全雨胎',color:'#78a7da',grip:.85,wear:1.4,target:64}
};
export const POINTS=[25,18,15,12,10,8,6,4,2,1,0,0];
export const DEFAULTS={mode:'weekend',track:'coast',weather:'sunset',difficulty:'rookie',laps:5,team:0,compound:'M',requirePit:true,assist:true,beginner:true,quality:'high'};
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const wrap=(v,l)=>((v%l)+l)%l;
export const angleDelta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
export function timeText(t,millis=true){if(!Number.isFinite(t)||t<0)return '—';const m=Math.floor(t/60),s=Math.floor(t%60);return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}${millis?'.'+String(Math.floor(t%1*1000)).padStart(3,'0'):''}`;}
