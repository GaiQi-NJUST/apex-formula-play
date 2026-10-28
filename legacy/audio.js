export class DrivingAudio {
  constructor(){this.muted=false;this.ready=false;}
  start(){
    if(this.ready){this.ctx.resume();return;}
    const AudioContext=window.AudioContext||window.webkitAudioContext;if(!AudioContext)return;
    this.ctx=new AudioContext();const ctx=this.ctx;this.master=ctx.createGain();this.master.gain.value=.19;this.master.connect(ctx.destination);
    this.filter=ctx.createBiquadFilter();this.filter.type='lowpass';this.filter.frequency.value=950;this.filter.Q.value=.7;this.filter.connect(this.master);
    this.engineGain=ctx.createGain();this.engineGain.gain.value=.15;this.engineGain.connect(this.filter);this.oscillators=[];
    for(let i=0;i<3;i++){const o=ctx.createOscillator();o.type=i===0?'sawtooth':'triangle';o.frequency.value=40+i*3;o.detune.value=(i-1)*9;o.connect(this.engineGain);o.start();this.oscillators.push(o);}
    const buffer=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*.5;
    this.noiseBuffer=buffer;this.wind=ctx.createBufferSource();this.wind.buffer=buffer;this.wind.loop=true;this.windFilter=ctx.createBiquadFilter();this.windFilter.type='lowpass';this.windFilter.frequency.value=450;this.windGain=ctx.createGain();this.windGain.gain.value=0;this.wind.connect(this.windFilter).connect(this.windGain).connect(this.master);this.wind.start();
    this.squeal=ctx.createOscillator();this.squeal.type='triangle';this.squeal.frequency.value=730;this.squealGain=ctx.createGain();this.squealGain.gain.value=0;this.squeal.connect(this.squealGain).connect(this.master);this.squeal.start();this.ready=true;
  }
  update(speed,gas,drift,boost,running){if(!this.ready)return;const t=this.ctx.currentTime,gear=Math.min(6,Math.floor(speed*3.6/43)+1),rpm=(speed*3.6%43)/43;const hz=32+rpm*55+gear*5;this.oscillators.forEach((o,i)=>o.frequency.setTargetAtTime(hz*(i===2?2:1)+i*2,t,.08));this.filter.frequency.setTargetAtTime(gas?1200+rpm*1300:650,t,.12);this.engineGain.gain.setTargetAtTime(running?(gas?.19:.085):.035,t,.09);this.windGain.gain.setTargetAtTime(running?(speed/80)**2*.22+(boost?.14:0):0,t,.2);this.squealGain.gain.setTargetAtTime(drift&&running?.05:0,t,.08);}
  hit(strength){if(!this.ready)return;const c=this.ctx,t=c.currentTime,n=c.createBufferSource();n.buffer=this.noiseBuffer;const f=c.createBiquadFilter();f.type='lowpass';f.frequency.value=1200;const g=c.createGain();g.gain.setValueAtTime(Math.min(.9,strength*.55),t);g.gain.exponentialRampToValueAtTime(.001,t+.4);n.connect(f).connect(g).connect(this.master);n.start();n.stop(t+.45);const o=c.createOscillator(),a=c.createGain();o.frequency.setValueAtTime(100,t);o.frequency.exponentialRampToValueAtTime(30,t+.23);a.gain.setValueAtTime(.6,t);a.gain.exponentialRampToValueAtTime(.001,t+.25);o.connect(a).connect(this.master);o.start();o.stop(t+.3);}
  beep(high=false){if(!this.ready)return;const c=this.ctx,t=c.currentTime,o=c.createOscillator(),g=c.createGain();o.frequency.value=high?880:440;g.gain.setValueAtTime(.09,t);g.gain.exponentialRampToValueAtTime(.001,t+.18);o.connect(g).connect(this.master);o.start();o.stop(t+.2);}
  toggle(){this.muted=!this.muted;if(this.ready)this.master.gain.setTargetAtTime(this.muted?0:.19,this.ctx.currentTime,.1);return this.muted;}
}
