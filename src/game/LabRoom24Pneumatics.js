import * as THREE from 'three';
import {V,rayTouches,ringDevice} from './LabPuzzleMechanics.js';
/** Pressure is a conserved, lossy resource. Closed cylinder valves retain
 * their existing position; they cannot create displacement or stored air. */
export class Room24Accumulator{
 constructor(){this.reset();}
 reset(){this.pressure=0;this.feed=false;this.liftValve=true;this.bridgeValve=false;this.returning=false;this.used=0;}
 step(dt,{feed=false,liftTravel=0,bridgeTravel=0}={}){
  if(!Number.isFinite(dt)||dt<0)throw new RangeError('Nonnegative finite time required');
  const spent=Math.abs(liftTravel)*2.2+Math.abs(bridgeTravel)*2.8;
  this.used+=spent;this.feed=feed;this.pressure=THREE.MathUtils.clamp(this.pressure+(feed?1.5:0)*dt-.004*dt-spent,0,10);
 }
}
export function buildRoom24Pneumatics(k,fan,lift,ferry){
 const state=new Room24Accumulator(),w=k.world,receiver=V(2,2.3,-5);
 const mouth=ringDevice(w,receiver.toArray(),[-1,0,0],0x9edec9,.8);
 const tank=w.box([3,1.4,-10.3],[2.1,2.8,2.1],w.materials.floor,false);
 const needle=w.box([3,2.8,-9.18],[.08,.85,.06],w.materials.accent,false);
 tank.userData.gameplayRole='Air accumulator';
 let lastLift=0,lastFerry=0;
 k.ticks.unshift(dt=>{
  state.step(dt,{feed:fan.enabled&&rayTouches(fan.segments,receiver,.75),liftTravel:lift.progress-lastLift,bridgeTravel:ferry.progress-lastFerry});
  lastLift=lift.progress;lastFerry=ferry.progress;
  lift.locked=!state.liftValve;lift.target=state.returning?0:state.pressure>.65?1:0;lift.rate=.12*Math.min(1,state.pressure/1.5);
  if(state.returning)lift.rate=.12;
  ferry.locked=!state.bridgeValve;ferry.target=state.pressure>.7?1:0;ferry.rate=.055*Math.min(1,state.pressure/1.5);
  mouth.glow.material.color.setHex(state.feed?0xbfffd8:0x59605e);needle.rotation.z=(.5-state.pressure/10)*2.4;
 });
 k.resets.push(()=>{state.reset();lastLift=lastFerry=0;});k.state.pneumatic=state;
 k.control('isolate',[-11,8,-14.5],()=>{state.liftValve=!state.liftValve;state.returning=false;},'E — открыть / перекрыть цилиндр подъёмника');
 k.control('transfer',[10.1,8,-6.3],()=>{state.bridgeValve=!state.bridgeValve;},'E — открыть / перекрыть подачу в тележку');
 k.control('recall',[-11,0,-6],()=>{state.liftValve=true;state.returning=!state.returning;},'E — опустить / поднять подъёмник');
 k.wire([[2,1.3,-8],[-8,1.3,-8],[-8,1.3,-10],[-14,1.3,-10]],()=>state.liftValve&&state.pressure>.7);
 k.wire([[3,2,-10],[4,2,-10],[4,8.2,-10],[8,8.2,-10],[8,8.2,-5]],()=>state.bridgeValve&&state.pressure>.7);
 return state;
}
