import * as THREE from 'three';
import {V,tracePortalRay,rayTouches,beamDrawing,ringDevice} from './LabPuzzleMechanics.js';
/** A heavy rim, viscous bearing and geared load share one angular velocity. */
export class Room19Flywheel {
 constructor(){this.inertia=20;this.drag=.32;this.reset();}
 reset(){this.omega=0;this.angle=0;this.work=0;}
 get energy(){return .5*this.inertia*this.omega*this.omega;}
 step(torque,load,dt){
  if(![torque,load,dt].every(Number.isFinite)||load<0||dt<0)throw new RangeError('Invalid flywheel force');
  if(!dt)return 0;
  const rate=this.drag/this.inertia,eq=(torque-load)/this.drag,old=this.omega;
  const h=eq<0?Math.min(dt,Math.max(0,-Math.log(-eq/(old-eq))/rate)):dt;
  const e=Math.exp(-rate*h),angle=Math.max(0,eq*h+(old-eq)*(1-e)/rate);
  this.omega=Math.max(0,eq+(old-eq)*e);this.angle+=angle;this.work+=angle*load;return angle*load;
 }
}
export function createRoom19Optics(k,{origin,direction,receiver,lift}){
 const drawing=beamDrawing(k.world,0xffdaa0,.033),lamp=ringDevice(k.world,receiver,[-1,0,0],0x80765e,.95);
 const light={origin:V(...origin),direction:V(...direction),receiver:V(...receiver),segments:[],lit:false};
 k.ticks.push(()=>{light.segments=tracePortalRay(k.game,light.origin,light.direction,{medium:'light',length:100});light.lit=rayTouches(light.segments,light.receiver,.8);lift.powered=light.lit;lamp.glow.material.color.setHex(light.lit?0xffe8a6:0x695b43);drawing.update(light.segments);});
 k.state.optical=light;return light;
}
export function createRoom19Drive(k,fan,slider){
 const wheel=new Room19Flywheel(),art=k.fixture(35,[8,8,-8],3.7,Math.PI/2),w=k.world;
 const gauge=new THREE.Group();gauge.position.set(11.5,10,-8);w.root.add(gauge);
 const disk=new THREE.Mesh(new THREE.CylinderGeometry(.65,.65,.10,32),w.materials.trim);disk.rotation.x=Math.PI/2;gauge.add(disk);
 const needle=w.box([0,.27,.09],[.045,.55,.035],w.materials.accent,false,gauge);const dialPivot=new THREE.Group();gauge.add(dialPivot);dialPivot.attach(needle);
 const shaft=w.box([8,8.45,-5],[.18,.18,6],w.materials.trim,false);shaft.userData.gameplayRole='Visible flywheel gearbox shaft';
 const state={wheel,art,position:V(8,10.3,-8),power:false,gear:0,travelWork:0,lastLoad:0,indicator:needle,
  loaded:()=>slider.loaded(),reset(){wheel.reset();state.power=false;state.gear=0;state.travelWork=0;state.lastLoad=0;}};
 k.ticks.unshift(dt=>{
  state.power=fan.enabled&&rayTouches(fan.segments,state.position,1.6);
  const occupied=k.game.playerGrounded&&Math.abs(k.game.playerPosition.y-slider.floor.y)<.22&&Math.abs(k.game.playerPosition.x-slider.position.x)<2.2&&Math.abs(k.game.playerPosition.z-slider.position.z)<2.2;
  const end=state.gear>0?1:0,moving=state.gear!==0&&Math.abs(slider.progress-end)>.002;
  const load=moving?(2.2+(occupied?1.1:0)+((slider.loaded()||(k.game.heldCube&&occupied))?.9:0)):0;
  state.lastLoad=load;state.travelWork+=wheel.step(state.power?48:0,load,dt);
  slider.target=state.gear===0?slider.progress:end;slider.rate=Math.min(.09,wheel.omega*.0045);
  art.spin(wheel.angle);dialPivot.rotation.z=-Math.min(1,wheel.omega/35)*Math.PI*1.5;
 });
 k.resets.push(()=>state.reset());k.state.inertia=state;
 k.control('gear',[11.2,8,-5.6],()=>{state.gear=state.gear===0?1:state.gear===1?-1:0;},'Муфта: вперёд / назад / свободный ход');
 return state;
}
