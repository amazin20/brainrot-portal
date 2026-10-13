import test from 'node:test';
import assert from 'node:assert/strict';
import {AudioController} from '../src/game/AudioController.js';

class Parameter {
  value=0;events=[];
  cancelScheduledValues(time){this.events=this.events.filter(event=>event.time<time);}
  setValueAtTime(value,time){this.value=value;this.events.push({kind:'set',value,time});}
  setTargetAtTime(value,time,constant){this.events.push({kind:'target',value,time,constant});}
  exponentialRampToValueAtTime(value,time){this.events.push({kind:'ramp',value,time});}
}
class Node {
  gain=new Parameter();frequency=new Parameter();Q=new Parameter();pan=new Parameter();connections=[];
  connect(node){this.connections.push(node);return node;}
  disconnect(){this.connections=[];this.disconnected=true;}
  start(){this.starts=(this.starts??0)+1;}
  stop(){this.stops=(this.stops??0)+1;}
}
class Context {
  currentTime=0;sampleRate=8000;state='suspended';destination=new Node();nodes=[];buffers=[];
  node(){const node=new Node();this.nodes.push(node);return node;}
  createOscillator(){return this.node();}createGain(){return this.node();}
  createBufferSource(){return this.node();}createBiquadFilter(){return this.node();}
  createStereoPanner(){return this.node();}
  createBuffer(channels,length){const data=new Float32Array(length),buffer={getChannelData:()=>data};this.buffers.push(buffer);return buffer;}
  resume(){this.state='running';return Promise.resolve();}
  suspend(){this.state='suspended';return Promise.resolve();}
  close(){this.state='closed';return Promise.resolve();}
}
const target=parameter=>parameter.events.at(-1)?.value??parameter.value;
function fixture(t,index=0){
  const original=globalThis.AudioContext;globalThis.AudioContext=Context;
  const audio=new AudioController();audio.setChapter(index);audio.unlock();
  t.after(()=>{audio.dispose();if(original===undefined)delete globalThis.AudioContext;else globalThis.AudioContext=original;});
  return audio;
}

test('chapter selection follows ten-room display groups and the permanent castle bookmark before any gesture',()=>{
  const audio=new AudioController();
  for(const index of [9,10,19,20,29,30,39,41,50,40]){
    audio.setChapter(index);assert.equal(audio.context,null,'selecting a level must not bypass the user gesture');
    assert.equal(audio.chapterIndex,index);
  }
  for(const index of [-1,51,1.5,NaN,Infinity,'40'])assert.throws(()=>audio.setChapter(index),RangeError);
  assert.equal(audio.chapterIndex,40,'a rejected selection must preserve the castle selection');
});

test('campaign boundaries change the actual quiet graph, without new buffers, sources or voices',t=>{
  const audio=fixture(t),context=audio.context,ambience=audio.ambience;
  const nodes=context.nodes.length,sources=[...ambience.sources];
  const expect=(index,id)=>{audio.setChapter(index);assert.equal(ambience.id,id);};
  const signatures=new Set();
  for(const [index,id] of [[0,'discovery'],[10,'dynamo'],[20,'biosphere'],[30,'observatory'],[41,'fracture'],[40,'castle']]){
    expect(index,id);
    signatures.add(JSON.stringify([...ambience.tones.map(tone=>target(tone.oscillator.frequency)),target(ambience.band.frequency),target(ambience.lowpass.frequency)]));
    const loudest=ambience.tones.reduce((sum,tone)=>sum+target(tone.gain.gain),0)+
      (target(ambience.airGain.gain)+target(ambience.swellGain.gain))*.5;
    assert.ok(loudest<.025,'even simultaneous maximum carriers/noise must stay below a quiet room-tone peak');
    assert.ok(target(ambience.band.frequency)>target(ambience.driftGain.gain),'slow drift cannot pass through a negative filter frequency');
    assert.ok(ambience.band.Q.value<.707&&ambience.lowpass.Q.value<.707,'air filters must not produce resonant whistles');
  }
  assert.equal(signatures.size,6,'each chapter must change its actual spectral controls');
  for(let pass=0;pass<40;pass++){
    for(let index=0;index<40;index++)expect(index,['discovery','dynamo','biosphere','observatory'][Math.floor(index/10)]);
    for(let index=41;index<=50;index++)expect(index,'fracture');
    expect(40,'castle');
  }
  assert.equal(context.nodes.length,nodes);assert.equal(context.buffers.length,1);
  assert.equal(ambience.air.buffer,audio.noise,'room air and flight must share the same original noise buffer');
  assert.deepEqual(ambience.sources,sources);assert.ok(sources.every(source=>source.starts===1));
  assert.equal(audio.voices,0,'room variation must not consume the bounded event voice pool');
  const events=ambience.tones[0].oscillator.frequency.events.map(event=>({...event}));
  for(let frame=0;frame<1000;frame++)audio.setChapter(40);
  assert.deepEqual(ambience.tones[0].oscillator.frequency.events,events,'repeated selection must not queue automation');
});

test('changing chapters under menu, pause, hidden, mute and zero volume cannot resume or bypass the master',t=>{
  const audio=fixture(t,40),context=audio.context,ambience=audio.ambience,nodes=context.nodes.length;
  assert.equal(context.state,'suspended');assert.equal(target(audio.master.gain),0);
  assert.ok(audio.room.connections.includes(audio.master));
  audio.setChapter(20);assert.equal(context.state,'suspended');
  audio.block('menu',false);assert.equal(context.state,'running');
  for(const [hold,release] of [
    [()=>audio.block('pause',true),()=>audio.block('pause',false)],
    [()=>audio.block('hidden',true),()=>audio.block('hidden',false)],
    [()=>audio.configure({muted:true}),()=>audio.configure({muted:false})],
    [()=>audio.configure({volume:0}),()=>audio.configure({volume:.37})],
  ]){
    hold();audio.setChapter(10);audio.unlock();
    assert.equal(context.state,'suspended');assert.equal(target(audio.master.gain),0);assert.equal(audio.audible,false);
    release();assert.equal(context.state,'running');assert.equal(audio.audible,true);
    assert.equal(audio.ambience,ambience);assert.equal(context.nodes.length,nodes);
    audio.setChapter(30);
  }
  assert.equal(target(audio.master.gain),.37);assert.ok(ambience.sources.every(source=>source.starts===1));
});

test('a rapid chapter change glides from current levels and disposal stops every persistent source',t=>{
  const audio=fixture(t),context=audio.context,ambience=audio.ambience;
  audio.block('menu',false);context.currentTime=3.25;
  const gain=ambience.tones[0].gain.gain;
  gain.value=.0041;audio.setChapter(40);
  assert.equal(gain.events.find(event=>event.time===context.currentTime&&event.kind==='set').value,.0041,'the fade must begin at the rendered level rather than resetting gain');
  assert.ok(gain.events.at(-1).kind==='target'&&gain.events.at(-1).constant>=.5);
  const sources=[...ambience.sources],nodes=[...ambience.nodes];
  audio.dispose();audio.dispose();
  assert.equal(context.state,'closed');assert.equal(audio.context,null);assert.equal(audio.ambience,null);
  assert.ok(sources.every(source=>source.stops===1));assert.ok(nodes.every(node=>node.disconnected));
  assert.equal(ambience.context,null);assert.equal(ambience.sources.length,0);assert.equal(ambience.nodes.length,0);
  audio.unlock();assert.notEqual(audio.context,context);assert.equal(audio.ambience.id,'castle');
});
