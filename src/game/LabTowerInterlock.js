import * as THREE from 'three';
import {tracePortalRay,rayTouches} from './LabPuzzleMechanics.js';

const Y=24,V=(x,y,z)=>new THREE.Vector3(x,y,z);
const freeze=p=>Object.freeze(p);

/** A side machine of the fourth hub. Its rear gallery has no walkable door
 * until the original companion crosses the same portal pair as the player.
 * The narrow observation slit admits a shot, but not a standing actor.
 * Every door has a registered collision proxy; all signals reset with the run.
 */
export function createTowerInterlock({game,floor,box,makePanel,materials:m}){
 const b=(name,position,size,material=m.shell,options)=>{
  const mesh=box(position,size,material,options);mesh.name=`Tower interlock / ${name}`;return mesh;
 };
 const f=(name,x0,x1,z0,z1)=>{
  const mesh=floor(x0,x1,z0,z1,Y);mesh.name=`Tower interlock / ${name}`;return mesh;
 };
 f('continuous lower service floor',-25,-4.9,9.75,37);
 for(const [name,p,size]of [
  ['western pressure shell',[-25.16,Y+3.8,23.4],[.32,7.6,27.4]],
  ['far bulkhead',[-15,Y+3.8,37.15],[20.4,7.6,.30]],
  ['southern enclosure',[-17,Y+3.8,9.85],[16,7.6,.30]],
  ['shaft separation',[-4.82,Y+3.8,23.4],[.28,7.6,27.4]],
  ['inner bulkhead A',[-10,Y+3.8,14.1],[.30,7.6,8.2]],
  ['inner bulkhead B',[-10,Y+3.8,29.5],[.30,7.6,15]],
  ['aperture bulkhead west',[-23.1,Y+3.8,25],[4.2,7.6,.30]],
  ['aperture bulkhead centre',[-14.75,Y+3.8,25],[.9,7.6,.30]],
  ['aperture bulkhead east',[-10.4,Y+3.8,25],[.8,7.6,.30]],
  // The 1.25 m slit is open at camera height but too short for a 1.8 m body.
  ['observation sill',[-12,Y+.57,25],[2.8,1.14,.30]],
  ['observation lintel',[-12,Y+5.03,25],[2.8,5.15,.30]],
  ['machine ceiling',[-15,Y+7.73,23.4],[20.4,.18,27.4]],
 ])b(name,p,size);
 const input=makePanel('interlock-input',[-19,Y+2.4,24.84],[0,0,-1],4.4,4.6);
 const output=makePanel('interlock-output',[-12,Y+2.4,34.84],[0,0,-1],4.2,4.6);
 const redirect=makePanel('interlock-redirect',[-24.84,Y+2.4,30],[1,0,0],4.4,4.6);
 input.userData.towerInterlock=output.userData.towerInterlock=redirect.userData.towerInterlock=true;

 function gate(name,p,size,axis,extent){
  const parts=[];
  for(const sign of [-1,1]){
   const pos=[...p];pos[axis]+=sign*extent/4;
   const scale=[...size];scale[axis]=extent/2;
   const mesh=b(`${name} moving leaf`,pos,scale,m.ivory,{solid:false,camera:false,aim:false});
   parts.push({mesh,pos,sign});
  }
  const proxy=b(`${name} physical interlock`,p,size,m.dark,{visible:false});
  const collider=game.colliders.find(c=>c.mesh===proxy);
  if(!collider)throw new Error(`Missing ${name} collider`);
  return {name,parts,proxy,collider,axis,extent,progress:0};
 }
 const entry=gate('weight access',[-10,Y+3.76,20],[.32,7.52,3.8],2,3.8);
 const returnGate=gate('rear release',[-15.55,Y+3.76,25],[2.5,7.52,.32],0,2.5);
 const dynamicMeshes=[...entry.parts,...returnGate.parts].map(part=>part.mesh);
 function setGate(g,target,dt=0){
  g.progress=dt?THREE.MathUtils.damp(g.progress,target,5,dt):target;
  if(Math.abs(g.progress-target)<.002)g.progress=target;
  for(const {mesh,pos,sign}of g.parts){mesh.position.fromArray(pos);mesh.position.setComponent(g.axis,pos[g.axis]+sign*2.2*g.progress);}
  const enabled=g.progress<.85;
  if(g.collider.enabled!==enabled){g.collider.enabled=enabled;game.physics?.setStaticEnabled(g.proxy.uuid,enabled);}
 }
 const chargePad=V(-7,Y,15.4),receiverPad=V(-21,Y,31.7);
 const charge=b('entry pressure disc',[-7,Y+.04,15.4],[2.7,.07,2.7],m.amber,{solid:false,camera:false,aim:false});
 const receiver=b('rear companion disc',[-21,Y+.04,31.7],[2.7,.07,2.7],m.amber,{solid:false,camera:false,aim:false});
 const returnCargoPad=V(-19,Y,14.0),returnPlayerPad=V(-7,Y,31.0);
 const returnCargo=b('west balance disc',[-19,Y+.04,14],[2.7,.07,2.7],m.amber,
  {solid:false,camera:false,aim:false});
 const returnPlayer=b('east balance disc',[-7,Y+.04,31],[2.7,.07,2.7],m.amber,
  {solid:false,camera:false,aim:false});
 dynamicMeshes.push(charge,receiver,returnCargo,returnPlayer);
 const source=V(-19,Y+1.9,20.5),target=V(-17,Y+1.9,30);
 b('beam source socket',[-19,Y+1.9,20.55],[.4,.4,.15],m.amber,{solid:false,camera:false,aim:false});
 const beamReceiver=b('redirected beam receiver',[-17,Y+1.9,30],[.4,.4,.15],m.amber,
  {solid:false,camera:false,aim:false});
 dynamicMeshes.push(beamReceiver);
 const emitterPoint=V(-19,Y+.9,17.2);
 b('emitter control housing',[-20.4,Y+.65,17.2],[.86,1.3,.86],m.dark);
 const emitterFace=b('emitter control indicator',[-20.4,Y+1.32,17.2],[.64,.08,.64],m.amber,
  {solid:false,camera:false,aim:false});
 dynamicMeshes.push(emitterFace);
 const beamGeometry=new THREE.CylinderGeometry(1,1,1,8),beamPieces=[];
 for(let i=0;i<4;i++){
  const mesh=new THREE.Mesh(beamGeometry,m.light);mesh.name='Tower interlock / live redirected ray';
  mesh.visible=false;game.scene.add(mesh);beamPieces.push(mesh);
 }
 const UP=V(0,1,0);
 function renderBeam(segments){beamPieces.forEach((piece,i)=>{
  const s=segments[i];piece.visible=!!s&&s.length>.02;
  if(!piece.visible)return;
  piece.position.copy(s.a).add(s.b).multiplyScalar(.5);
  piece.scale.set(.045,s.length,.045);
  piece.quaternion.setFromUnitVectors(UP,s.direction);
 });}
 const consolePoint=V(-14,Y+.9,29.7);
 b('rear control housing',[-14,Y+.62,31.2],[.92,1.24,.92],m.dark);
 const consoleFace=b('rear control indicator',[-14,Y+1.28,31.2],[.72,.07,.72],m.amber,{solid:false,camera:false,aim:false});
 dynamicMeshes.push(consoleFace);
 const state={ready:false,primed:false,crossed:false,loaded:false,emitterOn:false,
  beam:false,released:false,balanced:false,solved:false};
 function inside(p){return p.x<-5&&p.x>-25&&p.z>9.8&&p.z<37.2&&p.y>Y-.4&&p.y<Y+7.8;}
 function cargoOnAnyPad(){
  return game.cargoOnPad?.(chargePad,1.27)||game.cargoOnPad?.(receiverPad,1.27)
   ||game.cargoOnPad?.(returnCargoPad,1.26);
 }
 function update(dt,ready){
  state.ready=!!ready;
  if(state.ready&&!state.primed&&game.cargoOnPad?.(chargePad,1.27))state.primed=true;
  if(state.ready&&state.crossed&&!state.loaded&&game.cargoOnPad?.(receiverPad,1.27))state.loaded=true;
  const segments=state.emitterOn?tracePortalRay(game,source,V(0,0,1),{length:55,bounces:5}):[];
  renderBeam(segments);
  const linked=segments.some(s=>s.kind==='portal')&&rayTouches(segments,target,.4);
  if(state.loaded&&linked)state.beam=true;
  const cargo=state.released&&!game.heldCube&&!!game.cargoOnPad?.(returnCargoPad,1.26);
  const p=game.playerPosition,q=returnPlayerPad;
  const player=state.released&&game.playerGrounded&&Math.abs(p.y-q.y)<.25
   &&Math.hypot(p.x-q.x,p.z-q.z)<1.06;
  if(cargo&&player)state.balanced=state.solved=true;
  setGate(entry,state.primed?1:0,dt);setGate(returnGate,state.released?1:0,dt);
  charge.material=state.primed?m.mint:m.amber;
  receiver.material=state.loaded?m.mint:m.amber;
  returnCargo.material=cargo?m.mint:m.amber;
  returnPlayer.material=player?m.mint:m.amber;
  beamReceiver.material=state.beam?m.mint:m.amber;
  emitterFace.material=state.emitterOn?m.mint:m.amber;
  consoleFace.material=state.released?m.mint:m.amber;
 }
 function onTeleport(event){
  if(!state.primed)return;
  const a=game.portals?.portals?.[event.entryIndex]?.surfaceId;
  const b=game.portals?.portals?.[event.exitIndex]?.surfaceId;
  if(a===input.uuid&&b===output.uuid)state.crossed=true;
 }
 function interact(){
  if(!state.ready||!state.crossed||!state.loaded)return false;
  const hand=game.playerPosition.clone().add(V(0,.9,0));
  const control=hand.distanceTo(emitterPoint)<2.25?emitterPoint:state.beam?consolePoint:null;
  if(!control||hand.distanceTo(control)>2.25)return false;
  const delta=control.clone().sub(hand),distance=delta.length(),ray=new THREE.Ray(hand,delta.normalize());
  if(game.colliders.some(c=>{
   if(c.enabled===false||['Tower interlock / rear control housing','Tower interlock / emitter control housing'].includes(c.mesh.name))return false;
   const hit=ray.intersectBox(c.box,V());return hit&&hit.distanceTo(hand)<distance-.08;
  }))return false;
  if(control===emitterPoint){state.emitterOn=true;game.audio?.mechanism?.('switch');return true;}
  state.released=true;game.audio?.mechanism?.('switch');return true;
 }
 function reset(){
  state.ready=state.primed=state.crossed=state.loaded=state.emitterOn=state.beam=
   state.released=state.balanced=state.solved=false;
  setGate(entry,0);setGate(returnGate,0);
  renderBeam([]);charge.material=receiver.material=returnCargo.material=returnPlayer.material=
   consoleFace.material=emitterFace.material=beamReceiver.material=m.amber;
 }
 function dispose(){for(const piece of beamPieces)piece.removeFromParent();beamGeometry.dispose();}
 return {input,output,redirect,entry,returnGate,dynamicMeshes,inside,cargoOnAnyPad,update,onTeleport,interact,reset,dispose,
  getState:()=>({...state,entryOpen:!entry.collider.enabled,returnOpen:!returnGate.collider.enabled})};
}

/** A causal route, appended only once after the deck-four central keystone.
 * The first traveller scouts through portals; then both travellers cross the
 * aperture to load the far plate before the manual rear release can be used.
 */
export function towerInterlockRoute(){
 const actions=[];
 const walk=(x,z,extra={})=>actions.push(Object.freeze({kind:'walk',target:freeze([x,Y,z]),...extra}));
 const act=kind=>actions.push(Object.freeze({kind}));
 const until=field=>actions.push(Object.freeze({kind:'until',interlock:true,field,value:true,seconds:4}));
 // A standing actor's centre is 1.2 m above the floor. Place the full-size
 // apertures low enough for that centre to cross the eroded ellipse.
 const shoot=(slot,x,z)=>actions.push(Object.freeze({kind:'shoot',slot,aim:freeze([x,Y+1.9,z])}));
 const enter=(x,z)=>actions.push(Object.freeze({kind:'enter',target:freeze([x,Y,z]),normal:freeze([0,0,-1]),seconds:4}));
 walk(-6,8);walk(-7,13.1,{sprint:false});walk(-7,14.1,{sprint:false});act('drop');until('primed');
 walk(-7,20);walk(-12,20);walk(-12,22);shoot(1,-12,34.84);
 walk(-19,22);shoot(0,-19,24.84);walk(-19,23);enter(-19,24.84);until('crossed');
 // Return through the same powered pair to fetch the one original companion.
 walk(-12,32);enter(-12,34.84);walk(-7,20);walk(-7,15.4);act('pickup');
 walk(-7,20);walk(-19,20);walk(-19,23);enter(-19,24.84);
 walk(-21,29.2,{sprint:false});walk(-21,30.5,{sprint:false});act('drop');until('loaded');
 walk(-12,32);enter(-12,34.84);walk(-19,17.2);act('use');until('emitterOn');
 walk(-19,23);enter(-19,24.84);
 walk(-18,30);shoot(1,-24.84,30);until('beam');
 walk(-14,29.5);act('use');until('released');
 walk(-21,31.7);act('pickup');
 walk(-15.55,28);walk(-15.55,23);walk(-19,20);
 walk(-19,16.2,{sprint:false});walk(-19,15.1,{sprint:false});
 // Let the carried rigid body settle behind the last turn before E releases it
 // onto the west plate. The plate still tests the free body's live position.
 actions.push(Object.freeze({kind:'wait',seconds:.6}));act('drop');
 walk(-19,20);walk(-11.5,20);walk(-7,20);walk(-7,31);until('solved');
 walk(-7,20);walk(-19,20);walk(-19,14);act('pickup');
 walk(-19,20);walk(-7,20);walk(-7,12);
 return Object.freeze(actions);
}
