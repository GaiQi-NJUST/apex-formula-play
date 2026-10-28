const prefix='apex-formula-v3:';
export function readSave(key,fallback=null){try{return JSON.parse(localStorage.getItem(prefix+key))??fallback;}catch{return fallback;}}
export function writeSave(key,value){try{localStorage.setItem(prefix+key,JSON.stringify(value));return true;}catch{return false;}}
export function newSeason(settings){return {round:0,scores:Array(12).fill(0),teamPoints:Array(6).fill(0),results:[],settings,complete:false};}
export function scoreSeason(season,result){for(const c of result.results){season.scores[c.id]+=c.points;season.teamPoints[c.team]+=c.points;}season.results.push({track:season.round,winner:result.results[0]?.name,playerRank:result.results.find(x=>x.id===0)?.rank,time:result.time});season.round++;season.complete=season.round>=3;writeSave('season',season);return season;}
