import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioController } from '../src/game/AudioController.js';

// A WebAudio scheduling fixture: tests exercise the controller's actual graph,
// event envelopes and lifetime without requiring audio hardware in CI.
class Parameter {
  value=0; events=[];
  cancelScheduledValues(time){this.events=this.events.filter(event=>event.time<time);}
  setValueAtTime(value,time){this.value=value;this.events.push({kind:'set',value,time});}
  setTargetAtTime(value,time,constant){this.events.push({kind:'target',value,time,constant});}
  exponentialRampToValueAtTime(value,time){this.events.push({kind:'ramp',value,time});}
}
class Node {
  gain=new Parameter(); frequency=new Parameter(); Q=new Parameter(); connections=[];
  connect(output){this.connections.push(output);return output;}
  disconnect(){this.connections=[];this.disconnected=true;}
  start(time){this.started=true;this.startTime=time;}
  stop(time){this.stopped=true;this.stopTime=time;}
}
class Context {
  static instances=[];
  currentTime=0; sampleRate=8000; state='suspended'; destination=new Node(); nodes=[]; buffers=[];
  constructor(){Context.instances.push(this);}
  node(){const node=new Node();this.nodes.push(node);return node;}
  createGain(){return this.node();} createOscillator(){return this.node();}
  createBufferSource(){return this.node();} createBiquadFilter(){return this.node();}
  createBuffer(channels,length){const data=new Float32Array(length);const buffer={getChannelData:()=>data};this.buffers.push(buffer);return buffer;}
  resume(){this.state='running';return Promise.resolve();}
  suspend(){this.state='suspended';return Promise.resolve();}
  close(){this.state='closed';return Promise.resolve();}
}
function fixture(t){
  const original=globalThis.AudioContext;globalThis.AudioContext=Context;
  const audio=new AudioController();audio.unlock();audio.block('menu',false);
  t.after(()=>{audio.dispose();if(original===undefined)delete globalThis.AudioContext;else globalThis.AudioContext=original;});
  return audio;
}
const target=parameter=>parameter.events.at(-1)?.value??parameter.value;

test('air sound responds to fast physical flight, leaving ground travel and ordinary jumps silent',t=>{
  const audio=fixture(t);
  for(const [speed,grounded] of [[7,true],[40,true],[9.2,false]]){
    audio.flight(speed,grounded);assert.equal(target(audio.flightGain.gain),0);
  }
  let previous=0;
  for(const speed of [12,20,26,32]){
    audio.flight(speed,false);const amount=target(audio.flightGain.gain);
    assert.ok(amount>previous&&amount<=.06);previous=amount;
    assert.equal(audio.flightGain.gain.events.at(-1).kind,'target','speed must fade, not jump gain');
    assert.ok(audio.flightFilter.Q.value<=.707,'the noise filter must not resonate');
  }
  audio.flight(200,false);assert.equal(target(audio.flightGain.gain),previous,'extreme velocities cannot get louder');
  audio.flight(0,true);const release=audio.flightGain.gain.events.at(-1);
  assert.equal(release.value,0);
  assert.ok(Math.exp(-.25/release.constant)<.005,'landing leaves less than 0.5% air gain after 250 ms');
});

test('pause, mute and zero volume erase the previous flight envelope before resuming',t=>{
  const audio=fixture(t),context=audio.context;
  for(const [stop,resume] of [
    [()=>audio.block('pause',true),()=>audio.block('pause',false)],
    [()=>audio.configure({muted:true}),()=>audio.configure({muted:false})],
    [()=>audio.configure({volume:0}),()=>audio.configure({volume:.4})],
  ]){
    audio.flight(32,false);assert.ok(target(audio.flightGain.gain)>0);
    stop();assert.equal(context.state,'suspended');assert.equal(target(audio.master.gain),0);
    assert.equal(target(audio.flightGain.gain),0);
    resume();assert.equal(context.state,'running');assert.equal(target(audio.flightGain.gain),0,'stale flight cannot return on resume');
    audio.flight(20,false);assert.ok(target(audio.flightGain.gain)>0,'live movement may rebuild its own envelope');
  }
  assert.equal(target(audio.master.gain),.4);
});

test('thousands of velocity updates reuse one shared buffer and loop, with no transient voices',t=>{
  const audio=fixture(t),context=audio.context,nodes=context.nodes.length,loops=[...audio.loops];
  for(let frame=0;frame<5000;frame++){
    context.currentTime=frame/60;audio.flight(10+(frame%50),frame%120===0);
    if(frame%60===0)audio.unlock();
  }
  assert.equal(audio.context,context);assert.equal(context.nodes.length,nodes);assert.equal(context.buffers.length,1);
  assert.equal(audio.voices,0);assert.deepEqual(audio.loops,loops);
  const air=loops.find(node=>node.loop);assert.equal(air.buffer,audio.noise);
  assert.ok(audio.flightGain.connections.includes(audio.fx),'flight must use existing effect volume routing');
  audio.dispose();assert.equal(context.state,'closed');
  assert.ok(loops.every(node=>node.stopped&&node.disconnected));
  audio.loops=[]; // Fixture cleanup can close an already disposed controller.
});

test('portal travel strengthens only the short rush at high speed and rejects invalid velocity',()=>{
  const audio=new AudioController(),events=[];
  audio.hush=(...args)=>events.push(args);audio.tone=()=>{};
  const sound=speed=>{audio.travel(speed);return events.at(-1);};
  const walking=sound(4),fast=sound(32);
  assert.ok(fast[0]>walking[0]&&fast[0]<.5);
  assert.ok(fast[1]>walking[1]&&fast[1]<=.057);
  assert.deepEqual(sound(1000),fast);
  for(const speed of [NaN,Infinity,-20,undefined])assert.deepEqual(sound(speed),walking);
});

test('epic propulsion never unlocks WebAudio itself and lazily reuses two optional loops',t=>{
  const locked=new AudioController();locked.epicMotion(40,{grounded:false});
  assert.equal(locked.context,null);
  const audio=fixture(t),context=audio.context,originalLoops=audio.loops.length;
  audio.epicMotion(40,{enabled:false});assert.equal(audio.epicWindGain,undefined);
  audio.epicMotion(7);assert.equal(audio.epicWindGain,undefined);
  audio.epicMotion(40,{grounded:false});
  assert.equal(audio.loops.length,originalLoops+2);assert.ok(target(audio.epicWindGain.gain)>0);
  const nodes=context.nodes.length;
  for(let i=0;i<5000;i++)audio.epicMotion(15+i%30,{grounded:i%2===0});
  assert.equal(context.nodes.length,nodes);assert.equal(context.buffers.length,1);assert.equal(audio.voices,0);
  assert.ok(audio.epicWindGain.connections.includes(audio.epicBus));
  assert.ok(audio.epicHatGain.connections.includes(audio.epicBus));
  assert.ok(audio.epicBus.connections.includes(audio.fx));
  audio.block('pause',true);assert.equal(target(audio.epicWindGain.gain),0);assert.equal(target(audio.epicPulseGain.gain),0);
  assert.equal(audio.epicPhase,0);
  audio.block('pause',false);assert.equal(target(audio.epicWindGain.gain),0);
  audio.epicMotion(40,{grounded:false});assert.ok(target(audio.epicWindGain.gain)>0);
  audio.epicMotion(40,{active:false});assert.equal(target(audio.epicWindGain.gain),0);
  const loops=[...audio.loops];audio.dispose();audio.dispose();
  assert.ok(loops.every(node=>node.stopped&&node.disconnected));
});

test('velocity rhythm accelerates within its ceiling and adds a quiet airborne subdivision',t=>{
  const audio=fixture(t),context=audio.context;
  audio.epicMotion(15);const sprintTempo=audio.epicBpm;
  audio.epicMotion(40);assert.ok(audio.epicBpm>sprintTempo);assert.equal(audio.epicBpm,174);
  audio.epicMotion(1000);assert.equal(audio.epicBpm,174);
  const sample=grounded=>{
    audio.resetEpicMotion();let peaks=0,previous=0,energy=0;
    for(let i=0;i<240;i++){
      context.currentTime+=1/120;audio.epicMotion(40,{grounded,dt:1/120});
      const gain=target(audio.epicHatGain.gain);energy+=gain;
      if(gain>previous*3&&gain>.002)peaks++;
      assert.ok(gain>=0&&gain<=.015);
      assert.ok(target(audio.epicPulseGain.gain)<=.032);
      previous=gain;
    }
    return {peaks,energy};
  };
  const ground=sample(true),air=sample(false);
  assert.ok(air.peaks>=ground.peaks*1.7,'airborne rhythm adds subdivisions');
  assert.ok(air.energy>ground.energy,'flight has a more present but bounded rhythm');
  const nodes=context.nodes.length;
  audio.epicMotion(40,{dt:Infinity});assert.ok(Number.isFinite(audio.epicPhase));
  audio.epicMotion(NaN);assert.equal(audio.epicActive,false);
  assert.equal(target(audio.epicHatGain.gain),0);assert.equal(context.nodes.length,nodes);
});

test('crossing accents duck only the rhythm and pending accents cannot resume after pause or mute',t=>{
  const audio=fixture(t),context=audio.context;
  for(const [stop,resume] of [
    [()=>audio.block('pause',true),()=>audio.block('pause',false)],
    [()=>audio.configure({muted:true}),()=>audio.configure({muted:false})],
    [()=>audio.configure({volume:0}),()=>audio.configure({volume:.5})],
    [()=>audio.epicMotion(40,{enabled:false}),()=>{}],
  ]){
    context.currentTime+=1;
    audio.epicMotion(40,{grounded:false});assert.equal(target(audio.epicBus.gain),1);
    audio.epicPassage(40,3);
    const accents=[...audio.epicVoices];assert.equal(accents.length,2);
    assert.ok(accents.every(voice=>voice.startTime>context.currentTime));
    const envelope=audio.epicBus.gain.events;
    assert.ok(envelope.some(event=>event.value===.16&&event.time<context.currentTime+.02));
    assert.equal(envelope.at(-1).value,1);
    context.currentTime+=.01;stop();
    assert.ok(accents.every(voice=>voice.stopTime===context.currentTime),'scheduled accents are cancelled before their delayed onset');
    assert.equal(audio.epicVoices.size,0);
    assert.equal(target(audio.epicBus.gain),0);assert.equal(target(audio.epicHatGain.gain),0);
    resume();assert.equal(target(audio.epicBus.gain),0,'unpausing does not restore an old duck envelope or beat');
    // Deliver the fixture's stopped-source notifications, as WebAudio does.
    for(const voice of accents)voice.onended();
    assert.equal(audio.voices,0);
  }
  audio.epicMotion(40);audio.epicPassage(40,Infinity);
  for(const node of context.nodes)for(const event of node.frequency.events)assert.ok(Number.isFinite(event.value));
});
