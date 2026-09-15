import * as THREE from 'three';
import { V, rayTouches } from './LabWorkshopKit.js';
import { dressRoom21Bridge } from './LabRoom21BridgeArt.js';

/** Room-local composition of the existing airflow, turbine, guided deck and
 * endpoint latch. The signal comes from a traced air path, not portal names.
 * A reduced electromechanical drive lifts the bridge; no traveller impulse or
 * victory state is assigned. The pawl engages only at the physical upper stop. */
export function addRoom21SourceDrive(k) {
  const w=k.world, game=k.game;
  k.panel('drive-intake',[-5,9.5,20],[1,0,0],5.6,4.6);
  k.panel('drive-out',[-19,9.5,9.6],[1,0,0],5.6,4.6);
  const fan=k.fan('source-air',[0,9.5,20],[-1,0,0],{radius:.85});
  fan.enabled=true;k.resets.push(()=>{fan.enabled=true;});
  const turbine=k.turbine('source-turbine',[-13,9.5,9.6]);
  const bridge=k.slider('source-bridge',[-27,0,15.5],[-27,7,15.5],
    {width:12,depth:4,portal:false,asset:33,assetSize:10});
  const state={fan,turbine,bridge,latched:false,air:false};
  // Both the turbine and bridge run on the established fixed-step loop.
  k.ticks.unshift(dt=>{
    state.air=fan.enabled&&rayTouches(fan.segments,turbine.position,.85);
    turbine.power=state.air;turbine.clutch=true;
    if(bridge.progress>=.9995)state.latched=true;
    bridge.locked=state.latched;
    bridge.target=state.air?1:0;
    bridge.rate=state.air?Math.min(.22,turbine.wheel.omega*.015):.10;
  });
  k.resets.push(()=>{state.latched=false;state.air=false;});
  for(const x of [-33.3,-20.7]){
    w.box([x,4,17.9],[.34,8,.34],w.materials.trim);
    w.box([x,.14,17.9],[1.1,.28,1.1],w.materials.trim);
  }
  // Visible pawls on both bridge ends, actuated by contact at the dock.
  const pawls=[-32.7,-21.3].map(x=>w.box([x,7.05,17.6],[.60,.28,.42],w.materials.accent,false));
  k.ticks.push(()=>{pawls.forEach(p=>p.rotation.z=state.latched?0:.9);});
  k.wire([[-13,7.1,9.6],[-20,7.1,9.6],[-20,7.1,18],[-27,7.1,18]],()=>state.air||state.latched);
  k.forces.push(()=>{
    const body=game.physics?.cargoBody;if(!body||game.heldCube)return;
    const force=fan.acceleration(game.cargo.position,game.cargo.velocity).multiplyScalar(body.mass);
    body.force.x+=force.x;body.force.y+=force.y;body.force.z+=force.z;
  });
  state.presentation=dressRoom21Bridge(k,bridge);
  k.state.sourceDrive=state;return state;
}
