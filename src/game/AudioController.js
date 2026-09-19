/** Original procedural sound design. No Portal/Valve samples or recordings.
 * One shared noise buffer, bounded voices, quiet room tone and a lift motor. */
const flightIntensity=speed=>{
  const t=Number.isFinite(speed)?Math.min(1,Math.max(0,(speed-10)/22)):0;
  return t*t*(3-2*t);
};

export class AudioController {
  shot(index=0){
    this.hush(.12,.028,3200);
    this.tone(index?220:330,.13,'triangle',.032,0,index?460:680);
    this.tone(index?860:1150,.19,'sine',.014,.025,index?280:410);
  }
  rejectShot(index=0){this.hush(.10,.018,1100);this.tone(index?230:310,.14,'triangle',.016,0,100);}

  constructor(){this.context=null;this.enabled=true;this.volume=.65;this.muted=false;this.blocks=new Set(['menu']);this.voices=0;this.motorOn=false;this.flightAmount=0;this.epicPhase=0;this.epicBpm=0;this.epicActive=false;this.epicVoices=new Set();}
  unlock(){
    if(!this.context){
      const AC=globalThis.AudioContext||globalThis.webkitAudioContext;if(!AC)return;
      try{
        const c=this.context=new AC();this.master=c.createGain();this.master.gain.value=0;this.master.connect(c.destination);
        this.fx=c.createGain();this.fx.gain.value=.8;this.fx.connect(this.master);
        this.room=c.createGain();this.room.gain.value=.014;this.room.connect(this.master);
        this.motorGain=c.createGain();this.motorGain.gain.value=0;this.motorGain.connect(this.master);
        this.loops=[];
        for(const [f,output] of [[59,this.room],[89.3,this.room],[112,this.motorGain]]){
          const o=c.createOscillator();o.type='sine';o.frequency.value=f;o.connect(output);o.start();this.loops.push(o);
        }
        const length=c.sampleRate;this.noise=c.createBuffer(1,length,c.sampleRate);const data=this.noise.getChannelData(0);
        let seed=71473;for(let i=0;i<length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=((seed/4294967296)*2-1)*.5;}
        // One reusable air layer, driven by physical speed. Ordinary jumps stay quiet.
        this.flightGain=c.createGain();this.flightGain.gain.value=0;
        this.flightFilter=c.createBiquadFilter();this.flightFilter.type='lowpass';this.flightFilter.Q.value=.5;this.flightFilter.frequency.value=600;
        const air=c.createBufferSource();air.buffer=this.noise;air.loop=true;
        air.connect(this.flightFilter).connect(this.flightGain).connect(this.fx);air.start();this.loops.push(air);
      }catch(error){this.enabled=false;console.warn('WebAudio unavailable',error);return;}
    }
    this.sync();
  }
  configure({volume=this.volume,muted=this.muted}={}){this.volume=Math.min(1,Math.max(0,Number.isFinite(volume)?volume:.65));this.muted=!!muted;this.sync();}
  block(reason,value){value?this.blocks.add(reason):this.blocks.delete(reason);this.sync();}
  sync(){
    const c=this.context;if(!c)return;
    const active=this.enabled&&!this.muted&&!this.blocks.size&&this.volume>0;
    this.master.gain.cancelScheduledValues(c.currentTime);this.master.gain.setValueAtTime(active?this.volume:0,c.currentTime);
    if(!active&&this.flightGain){this.flightAmount=0;this.flightGain.gain.cancelScheduledValues(c.currentTime);this.flightGain.gain.setValueAtTime(0,c.currentTime);}
    if(!active)this.resetEpicMotion();
    if(active&&c.state==='suspended')c.resume().catch(()=>{});
    else if(!active&&c.state==='running')c.suspend().catch(()=>{});
  }
  get audible(){return this.enabled&&this.context?.state==='running'&&!this.muted&&!this.blocks.size&&this.volume>0;}
  tone(frequency,duration=.1,type='sine',volume=.045,offset=0,endFrequency=frequency,epic=false){
    if(!this.audible||this.voices>=24)return;
    const c=this.context,t=c.currentTime+offset,o=c.createOscillator(),g=c.createGain();this.voices++;
    o.type=type;o.frequency.setValueAtTime(Math.max(20,frequency),t);o.frequency.exponentialRampToValueAtTime(Math.max(20,endFrequency),t+duration);
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0002,volume),t+.007);g.gain.exponentialRampToValueAtTime(.0001,t+duration);
    o.connect(g).connect(this.fx);if(epic)this.epicVoices.add(o);
    o.onended=()=>{o.disconnect();g.disconnect();this.epicVoices.delete(o);this.voices--;};o.start(t);o.stop(t+duration+.01);
  }
  hush(duration=.15,volume=.025,cutoff=800){
    if(!this.audible||this.voices>=24)return;
    const c=this.context,t=c.currentTime,s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();this.voices++;
    s.buffer=this.noise;f.type='lowpass';f.frequency.setValueAtTime(cutoff,t);f.frequency.exponentialRampToValueAtTime(160,t+duration);
    g.gain.setValueAtTime(volume,t);g.gain.exponentialRampToValueAtTime(.0001,t+duration);
    s.connect(f).connect(g).connect(this.fx);s.onended=()=>{s.disconnect();f.disconnect();g.disconnect();this.voices--;};s.start(t);s.stop(t+duration);
  }
  portal(index=0){this.hush(.21,.026,2400);this.tone(index?420:590,.24,'sine',.035,0,index?680:910);this.tone(index?841:1181,.30,'sine',.007,.03,520);}
  travel(speed=0){const rush=flightIntensity(speed);this.hush(.38+rush*.08,.045+rush*.012,1900+rush*650);this.tone(130,.34,'sine',.045,0,420+rush*110);this.tone(310,.28,'sine',.016,.07,170);}
  flight(speed=0,grounded=true){
    if(!this.context||!this.flightGain)return;
    const amount=this.audible&&!grounded?flightIntensity(speed):0;
    if(amount===this.flightAmount)return;
    this.flightAmount=amount;
    const t=this.context.currentTime;
    this.flightGain.gain.cancelScheduledValues(t);this.flightGain.gain.setTargetAtTime(amount*.06,t,amount>0?.09:.045);
    this.flightFilter.frequency.cancelScheduledValues(t);this.flightFilter.frequency.setTargetAtTime(600+amount*1800,t,.12);
  }
  // Built only after a gesture has unlocked an audible context and the epic
  // course actually moves. The wind also feeds a quiet filtered offbeat layer:
  // one shared noise buffer and two persistent loops, without per-frame voices.
  createEpicGraph(){
    if(this.epicWindGain||!this.audible)return;
    const c=this.context;
    this.epicBus=c.createGain();this.epicBus.gain.value=1;this.epicBus.connect(this.fx);
    this.epicWindGain=c.createGain();this.epicWindGain.gain.value=0;
    this.epicPulseGain=c.createGain();this.epicPulseGain.gain.value=0;
    this.epicHatGain=c.createGain();this.epicHatGain.gain.value=0;
    this.epicHatFilter=c.createBiquadFilter();this.epicHatFilter.type='highpass';this.epicHatFilter.Q.value=.5;this.epicHatFilter.frequency.value=5600;
    this.epicFilter=c.createBiquadFilter();this.epicFilter.type='bandpass';this.epicFilter.Q.value=.45;this.epicFilter.frequency.value=900;
    const wind=c.createBufferSource();wind.buffer=this.noise;wind.loop=true;
    wind.connect(this.epicFilter).connect(this.epicWindGain).connect(this.epicBus);
    wind.connect(this.epicHatFilter).connect(this.epicHatGain).connect(this.epicBus);
    this.epicPulse=c.createOscillator();this.epicPulse.type='sine';this.epicPulse.frequency.value=56;
    this.epicPulse.connect(this.epicPulseGain).connect(this.epicBus);
    wind.start();this.epicPulse.start();this.loops.push(wind,this.epicPulse);
  }
  epicMotion(speed=0,{enabled=true,active=true,grounded=true,dt=1/60}={}){
    if(!enabled||!active||!this.audible){this.resetEpicMotion();return;}
    const amount=flightIntensity(speed);
    if(!amount){if(this.epicActive)this.resetEpicMotion();return;}
    this.createEpicGraph();if(!this.epicWindGain)return;
    if(!this.epicActive)this.epicBus.gain.setValueAtTime(1,this.context.currentTime);
    this.epicActive=true;
    const step=Number.isFinite(dt)?Math.max(0,Math.min(.1,dt)):0;
    this.epicBpm=104+amount*70;
    this.epicPhase=(this.epicPhase+step*this.epicBpm/60)%4;
    const beat=this.epicPhase%1,kick=Math.exp(-beat*13),t=this.context.currentTime;
    const accent=[1,.65,.88,.7][Math.floor(this.epicPhase)];
    const hat=Math.exp(-((this.epicPhase*(grounded?1:2)+.5)%1)*24);
    for(const [parameter,value,release] of [
      [this.epicWindGain.gain,amount*(grounded?.022:.042),.055],
      [this.epicPulseGain.gain,amount*.032*kick*accent,.009],
      [this.epicHatGain.gain,amount*(grounded?.009:.015)*hat,.005],
      [this.epicFilter.frequency,900+amount*2100,.06],
      [this.epicPulse.frequency,43+amount*8+kick*42,.012],
    ]){parameter.cancelScheduledValues(t);parameter.setTargetAtTime(value,t,release);}
  }
  epicPassage(speed=0,chain=0){
    if(!this.epicActive||!this.audible)return;
    const amount=flightIntensity(speed),link=Number.isFinite(chain)?Math.min(3,Math.max(0,chain)):0,t=this.context.currentTime;
    // A short vacuum in the rhythm gives the real crossing a distinct impact.
    // The bus envelope is independent of per-frame speed smoothing.
    this.epicBus.gain.cancelScheduledValues(t);this.epicBus.gain.setValueAtTime(1,t);
    this.epicBus.gain.exponentialRampToValueAtTime(.16,t+.012);
    this.epicBus.gain.exponentialRampToValueAtTime(1,t+.14);
    this.epicPhase=0;
    this.tone(92+link*4,.28,'sine',.028,.025,42,true);
    this.tone(470+amount*230+link*55,.16,'triangle',.008,.045,1150+amount*230+link*90,true);
  }
  resetEpicMotion(){
    this.epicPhase=0;this.epicBpm=0;this.epicActive=false;
    if(!this.context)return;
    for(const voice of this.epicVoices)voice.stop(this.context.currentTime);
    this.epicVoices.clear();
    for(const node of [this.epicWindGain,this.epicPulseGain,this.epicHatGain,this.epicBus])if(node){
      node.gain.cancelScheduledValues(this.context.currentTime);node.gain.setValueAtTime(0,this.context.currentTime);
    }
  }
  pickup(){this.tone(370,.12,'triangle',.018,0,470);this.tone(630,.16,'sine',.018,.07);}
  checkpoint(){this.mechanism('switch');}
  mechanism(kind){this.hush(.12,.023,kind==='switch'?1200:600);this.tone(kind==='close'?150:220,.23,'triangle',.017,0,kind==='close'?95:350);}
  motor(on){if(this.motorOn===on)return;this.motorOn=on;if(!this.context)return;this.motorGain.gain.setTargetAtTime(on ? .015 : 0,this.context.currentTime,.08);}
  jump(){this.tone(155,.13,'sine',.014,0,285);}
  step(side,strength=.5){this.hush(.055,.018+Math.min(1,strength)*.018,680);this.tone(side==='L'?83:93,.075,'triangle',.009+Math.min(1,strength)*.007);this.tone(480,.026,'sine',.003,.021);}
  land(strength=1){this.hush(.16,.025+Math.min(1,strength/12)*.035,400);this.tone(67,.19,'triangle',.018);}
  hit(){this.hush(.12,.04,750);this.tone(91,.12,'triangle',.023);}
  win(){[392,494,587,784].forEach((f,i)=>this.tone(f,.36,'sine',.032,i*.11));}
  dispose(){this.resetEpicMotion();this.loops?.forEach(o=>{o.stop();o.disconnect();});this.loops=[];this.context?.close().catch(()=>{});this.context=null;this.flightAmount=0;this.flightGain=null;this.flightFilter=null;this.epicWindGain=null;this.epicPulseGain=null;this.epicFilter=null;this.epicPulse=null;this.epicHatGain=null;this.epicHatFilter=null;this.epicBus=null;}
}
