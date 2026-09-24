import * as THREE from 'three';
import {SolidAssembly,createGuideRing,createPlanter,createPontoon,placeSolidModel} from './LabSolidModels.js';
import {labInstrument} from './LabHumanLab.js';
import {sign} from './LabOpenStationArt.js';
import {room28FlowStatus} from './LabRoom28Tides.js';

const V=(...p)=>new THREE.Vector3(...p);

/** Each aperture has a visible pipe to its own basin. The shallow pipes run
 * behind the ceramics and the coral wall, clear of the shot and walking lanes. */
function buildCollectorManifolds(k,labels){
 const pipes=new SolidAssembly('Connected tide collector manifolds','lagoon');
 const path=points=>{for(let i=1;i<points.length;i++)pipes.beam(points[i-1],points[i],.17,1);};
 path([[-14,2.2,6.45],[-21,2.2,6.45],[-21,2.2,-7.1],[-14,2.2,-7.1]]);
 path([[-14,9.6,5.5],[-21,9.6,5.5],[-21,9.6,-7.1],[-14,9.6,-7.1]]);
 path([[-14,2.2,-7.1],[-14,9.6,-7.1],[-14,9.6,-6.35]]);
 path([[14,2.2,-6.35],[14,2.2,-7.1],[14,9.6,-7.1],[14,9.6,-6.35]]);
 for(const x of [-14,14])for(const y of [2.2,9.6]){
  pipes.turned([[0,-.13],[.30,-.13],[.33,-.07],[.33,.07],[.30,.13],[0,.13]],2,[x,y,-7.1],new THREE.Quaternion().setFromAxisAngle(V(1,0,0),Math.PI/2),false);
 }
 const binding=placeSolidModel(k,pipes.finish());
 for(const [name,label,x,y,z] of [
  ['coral-low','А / НИЖНЕЕ УСТЬЕ',-14,5.8,8.38],
  ['lagoon-low','Б / НИЖНЕЕ УСТЬЕ',14,5.8,-4.28],
  ['coral-fall','А / ВЕРХНИЙ СЛИВ',-14,13.25,-5.25],
  ['lagoon-fall','Б / ВЕРХНИЙ СЛИВ',14,13.25,-5.25],
  ['coral-overflow','А / ВОЗВРАТ',-14,13.25,6.65],
 ]){
  sign(labels,label,[x,y,z],[0,0,1],name==='coral-overflow'?7:8,.66);
 }
 return binding;
}

/** Solid freestanding housings, engraved datum marks and live fill columns.
 * Readings are duplicated on the nearby apparatus so looking at a basin is
 * enough to infer why a portal experiment stopped. */
function buildTideGauges(k,tide,labels){
 const {game,world:w}=k,fillMat=new THREE.MeshBasicMaterial({color:0x5df3dd,toneMapped:false});
 const material={dark:w.materials.trim,metal:w.materials.wall,white:w.materials.lamp};
 const block=(position,size,finish='dark',solid=true)=>w.box(position,size,material[finish],solid);
 const columns=[],gauges=[];
 for(const [i,x] of [[0,-24.2],[1,24.2]]){
  const meterX=i?21.8:-21.8;
  block([x,3.3,12],[1.6,6.8,.50]);
  block([x,3.3,12.29],[.63,6.20,.12],'metal',false);
  const fill=game.box(x,.35,12.39,.43,1,.10,fillMat,{parent:w.root,solid:false,camera:false,aim:false});
  fill.name=`Basin ${i?'B':'A'} real water height`;fill.userData.keepMaterial=true;fill.castShadow=false;columns.push(fill);
  for(const [height,label] of [[0,'0'],[3,'3'],[5.3,'5.3']]){
   block([x,height+.28,12.42],[.82,.10,.06],'white',false);
   sign(labels,label,[x+(i?-1.30:1.30),height+.30,12.55],[0,0,1],1.05,.65);
  }
  // The wall is at x=±26. The seven-metre readout sits inboard, linked to
  // its narrow water column by a solid bracket, with its full face visible.
  block([(x+meterX)/2,7.13,12.02],[Math.abs(x-meterX)+.42,1.02,.5]);
  const backing=block([meterX,8.38,12.02],[7.4,2.1,.5]);
  backing.name=`Basin ${i?'B':'A'} gauge backing`;
  const display=labInstrument(labels,[meterX,8.40,12.31],{
   width:7.1,height:1.84,name:`Basin ${i?'B':'A'} live water-level gauge`,
   read:()=>`${i?'Б':'А'} / ${tide.levels[i].toFixed(1)} м\n${i?'ПРИЛИВНОЙ ПОНТОН':'КОРАЛЛОВЫЙ КОЛОДЕЦ'}`,
  });gauges.push(display);
 }
 // The shared meter is suspended from a real gantry. A return walk passes
 // beneath it and remains clear even when the water is drained.
 for(const x of [-9.5,9.5])block([x,4.5,12],[.44,9,.62]);
 block([0,9.05,12],[19.5,.5,.75],'metal');
 block([0,7.25,12.12],[18.4,2.95,.46]);
 const status=labInstrument(labels,[0,7.25,12.39],{
  width:17.7,height:2.55,name:'Conserved tidal circuit and live flow status',
  read:()=>`${room28FlowStatus(tide.levels,tide.connection,tide.flow)}\nА + Б = ${tide.total.toFixed(1)} м ВОДЫ`,
 });
 const updateColumns=()=>columns.forEach((bar,i)=>{const h=Math.max(.015,tide.levels[i]);bar.scale.y=h;bar.position.y=.35+h/2;});
 k.ticks.push(updateColumns);k.renders.push(updateColumns);updateColumns();
 return {gauges,status,columns};
}

/** A small visible current at the receiving portal. The stream exists only
 * while the actual conserved water is moving, and has no collision or aim box. */
function buildCurrent(k,tide){
 const mat=new THREE.MeshBasicMaterial({name:'Visible receiving tide',color:0x80ffee,transparent:true,opacity:.57,depthWrite:false,side:THREE.DoubleSide});
 const jet=new THREE.Mesh(new THREE.CylinderGeometry(.20,.36,1,12,1,true),mat);
 jet.name='Current emerging from the receiving tide portal';jet.userData.keepMaterial=true;jet.visible=false;k.world.root.add(jet);
 const ring=new THREE.Mesh(new THREE.TorusGeometry(.55,.055,6,24),mat);
 ring.name='Hydraulic current at active receiving aperture';ring.userData.keepMaterial=true;ring.visible=false;k.world.root.add(ring);
 const up=V(0,1,0),middle=V(),end=V(),forward=V(),direction=V();let spin=0;
 const update=dt=>{
  const ends=tide.connection;if(!ends||Math.abs(tide.flow)<.006){jet.visible=ring.visible=false;return;}
  const receiving=tide.flow>0?ends[1]:ends[0],portal=receiving.portal;
  if(!portal){jet.visible=ring.visible=false;return;}
  forward.set(0,0,1).applyQuaternion(portal.quaternion);
  ring.visible=true;ring.position.copy(portal.position).addScaledVector(forward,.40);ring.quaternion.copy(portal.quaternion);
  spin+=dt*4;ring.scale.setScalar(1+.065*Math.sin(spin));
  const level=tide.levels[receiving.basin];
  jet.visible=portal.position.y>level+1;
  if(!jet.visible)return;
  end.set(receiving.basin?14:-14,level+.12,receiving.basin?-3.9:0);
  direction.copy(end).sub(ring.position);
  const length=direction.length();if(length<.1){jet.visible=false;return;}
  middle.copy(end).add(ring.position).multiplyScalar(.5);jet.position.copy(middle);
  jet.scale.y=length;jet.quaternion.setFromUnitVectors(up,direction.multiplyScalar(1/length));
 };
 k.ticks.push(update);k.resets.push(()=>{jet.visible=ring.visible=false;spin=0;});
 return {jet,ring};
}

/** Sealed pontoon hulls and anchored observation equipment. Fixed-step hull
 * collision follows the exact slider pose, never the interpolated picture. */
export function buildRoom28Art(k,tide){
 const w=k.world,root=new THREE.Group();root.name='Coral arches and tidal observatory';root.userData.keepMaterial=true;w.root.add(root);
 const labels={ticks:k.ticks,ownedTextures:[],geometry(geometry,material,position,quaternion,{name='Tide apparatus marking'}={}){
  const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.position.fromArray(position);mesh.quaternion.copy(quaternion);w.root.add(mesh);return mesh;
 }};
 const structural=new SolidAssembly('Tidal island foundations','lagoon');
 for(const surface of w.surfaces){
  const f=surface.floor;if(!f||f.y<2||surface.collider.kinematic)continue;
  structural.box([(f.minX+f.maxX)/2,f.y-.30,(f.minZ+f.maxZ)/2],[f.maxX-f.minX,.49,f.maxZ-f.minZ],2,.10);
 }
 for(const name of ['coral-float','lagoon-float']){
  const float=k.state[name],width=float.floor.maxX-float.floor.minX,depth=float.floor.maxZ-float.floor.minZ;
  const binding=placeSolidModel(k,createPontoon(width,depth),[0,0,0],{parent:float.group,kinematic:true});
  const update=float.update;float.update=function(dt){update.call(this,dt);binding.sync(dt);};
  // Workshop ticks resolve float.update at call time; reset follows that path.
 }
 for(const z of [-6.25,6.25])structural.arc(5.1,.37,.44,0,[-14,10.6,z],new THREE.Quaternion(),0,Math.PI);
 structural.arc(7,.24,.32,2,[0,3,8.25],new THREE.Quaternion(),0,Math.PI);
 structural.turned([[0,5.33],[1.2,5.33],[1.45,5.48],[1.1,5.65],[.30,5.85],[.24,8.25],[.50,8.40],[0,8.4]],1,[12,0,-14]);
 for(const x of [-14,14])for(let i=0;i<5;i++)structural.box([x+5.25,.3+i*1.35,0],[.16,.11,.16],2,.02,false);
 placeSolidModel(k,structural.finish(),[0,0,0],{parent:root});
 for(const [angle,radius] of [[0,2.5],[Math.PI/3,2.1],[-Math.PI/3,1.6]]){
  const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(0,angle,.4));
  placeSolidModel(k,createGuideRing(radius,'lagoon',.13,.18),[12,9.5,-14],{parent:root,quaternion:q});
 }
 for(const [x,z] of [[-22,13],[-22,-15],[22,16],[22,-17],[0,-19]])placeSolidModel(k,createPlanter('lagoon'),[x,0,z],{parent:root,scale:1.15});
 const pipes=buildCollectorManifolds(k,labels),readouts=buildTideGauges(k,tide,labels),current=buildCurrent(k,tide);
 return {root,pipes,readouts,current,dispose(){labels.ownedTextures.forEach(t=>t.dispose());}};
}
