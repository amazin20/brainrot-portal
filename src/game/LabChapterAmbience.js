import {campaignTheme} from './LabCampaignThemes.js';

// Original, deliberately quiet room textures. The same graph becomes ceramic
// ventilation, a copper power hum, airy greenhouse circulation, thin night
// air, a mineral shimmer or the castle's slow stone resonance. These are room
// tones, not musical progress cues or a timer telling the player what to do.
const PROFILES=Object.freeze({
  discovery:{frequencies:[58.8,117.6,353],gains:[.0032,.0015,.0014],noise:.006,band:400,cutoff:800,swell:.061,drift:.026,spread:110},
  dynamo:{frequencies:[48,96.35,192.7],gains:[.0065,.0028,.0013],noise:.003,band:220,cutoff:1100,swell:.09,drift:.013,spread:85},
  biosphere:{frequencies:[74.1,148.8,299.4],gains:[.0022,.0013,.0009],noise:.009,band:1300,cutoff:2700,swell:.073,drift:.041,spread:580},
  observatory:{frequencies:[38,152.4,610.6],gains:[.0037,.0012,.0011],noise:.005,band:1900,cutoff:3300,swell:.028,drift:.017,spread:650},
  fracture:{frequencies:[53,159.45,478.35],gains:[.0043,.0015,.0016],noise:.0066,band:940,cutoff:2600,swell:.046,drift:.032,spread:330},
  castle:{frequencies:[33,66.16,132.5],gains:[.0065,.0026,.0011],noise:.006,band:310,cutoff:850,swell:.022,drift:.012,spread:170},
});

export function chapterAmbienceProfile(index){
  const id=campaignTheme(index).id;
  return {id,...PROFILES[id]};
}

/** Six fixed sources share the existing noise buffer. Slow WebAudio control
 * oscillators vary the air continuously, without timers, frame callbacks,
 * new event voices, downloads or a second AudioContext. */
export class LabChapterAmbience {
  constructor(context,noise,output,index=0){
    this.context=context;this.nodes=[];this.sources=[];this.id=null;
    const own=node=>{this.nodes.push(node);return node;};
    const source=node=>{own(node);this.sources.push(node);return node;};
    this.tones=Array.from({length:3},(_,index)=>{
      const oscillator=source(context.createOscillator()),gain=own(context.createGain());
      oscillator.type=index===2?'triangle':'sine';gain.gain.value=0;
      oscillator.connect(gain);
      // A small static spread gives the room width on headphones. Mono-only
      // WebAudio implementations retain the same gain and lifecycle behavior.
      if(index>0&&typeof context.createStereoPanner==='function'){
        const pan=own(context.createStereoPanner());pan.pan.value=index===1?-.32:.32;
        gain.connect(pan).connect(output);
      }else gain.connect(output);
      return {oscillator,gain};
    });
    this.air=source(context.createBufferSource());this.air.buffer=noise;this.air.loop=true;
    this.band=own(context.createBiquadFilter());this.band.type='bandpass';this.band.Q.value=.45;
    this.lowpass=own(context.createBiquadFilter());this.lowpass.type='lowpass';this.lowpass.Q.value=.5;
    this.airGain=own(context.createGain());this.airGain.gain.value=0;
    this.air.connect(this.band).connect(this.lowpass).connect(this.airGain).connect(output);
    this.swell=source(context.createOscillator());this.swell.type='sine';
    this.swellGain=own(context.createGain());this.swellGain.gain.value=0;
    this.swell.connect(this.swellGain).connect(this.airGain.gain);
    this.drift=source(context.createOscillator());this.drift.type='sine';
    this.driftGain=own(context.createGain());this.driftGain.gain.value=0;
    this.drift.connect(this.driftGain).connect(this.band.frequency);
    this.setChapter(index,true);
    for(const node of this.sources)node.start();
  }

  setChapter(index,initial=false){
    const profile=chapterAmbienceProfile(index);
    if(this.id===profile.id)return;
    this.id=profile.id;
    const time=this.context.currentTime;
    const move=(parameter,value)=>{
      const current=parameter.value;
      parameter.cancelScheduledValues(time);
      // AudioParam.value contains its current rendered value, including an
      // unfinished transition. Preserve that point when switching chapters.
      if(initial)parameter.setValueAtTime(value,time);
      else {parameter.setValueAtTime(current,time);parameter.setTargetAtTime(value,time,.6);}
    };
    this.tones.forEach(({oscillator,gain},index)=>{
      move(oscillator.frequency,profile.frequencies[index]);move(gain.gain,profile.gains[index]);
    });
    move(this.airGain.gain,profile.noise);move(this.band.frequency,profile.band);move(this.lowpass.frequency,profile.cutoff);
    move(this.swell.frequency,profile.swell);move(this.swellGain.gain,profile.noise*.3);
    move(this.drift.frequency,profile.drift);move(this.driftGain.gain,profile.spread);
  }

  dispose(){
    for(const source of this.sources)source.stop();
    for(const node of this.nodes)node.disconnect();
    this.sources=[];this.nodes=[];this.context=null;
  }
}
