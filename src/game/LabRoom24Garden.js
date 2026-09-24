import * as THREE from 'three';
import {SolidAssembly,placeSolidModel} from './LabSolidModels.js';
const segmentedBeam=(assembly,start,end,segments,radius,material)=>{
 const a=new THREE.Vector3(...start),b=new THREE.Vector3(...end);
 for(let i=0;i<segments;i++)assembly.beam(a.clone().lerp(b,i/segments).toArray(),a.clone().lerp(b,(i+1)/segments).toArray(),radius,material);
};
/** A reversible weighted door. The angle is the actual architectural pose,
 * and its ceramic retains the same portal frame throughout the turn. */
export function buildGardenDoor(k,pad){
 const w=k.world,game=k.game,group=new THREE.Group();group.position.set(4,6,-4);w.root.add(group);
 const panel=k.panel('revolving-door',[-4,2.1,4],[0,0,1],6.4,5,group,true);
 // surface() creates a second static backing proxy. A moving architectural
 // slab has one collider; remove the immobile duplicate from the registry.
 const duplicate=game.colliders.find(c=>c.mesh===panel.backing);if(duplicate)game.colliders.splice(game.colliders.indexOf(duplicate),1);
 // The back of the ceramic is a closed, manufactured cassette. Its shallow
 // ribs stay inside the ceramic's own moving collision envelope (z=3.8..4)
 // and turn with that envelope. The front remains the clear portal face.
 const rear=new SolidAssembly('Garden door / reverse cassette','garden');
 rear.materials[0].color.setHex(0x9c695e);
 rear.materials[1].color.setHex(0x26464b);
 rear.materials[2].color.setHex(0xd9b777);
 rear.materials[3].color.setHex(0x628578);
 rear.box([-4,2.1,3.847],[6.12,4.79,.016],1,.005,false);
 for(const x of [-5.94,-4,-2.06]){
  rear.box([x,2.10,3.831],[1.77,4.36,.012],0,.004,false);
  rear.box([x,2.10,3.818],[1.40,3.82,.010],3,.003,false);
  for(const y of [.86,1.93,3.00])rear.box([x,y,3.807],[1.44,.08,.010],1,.003,false);
 }
 for(const x of [-7.01,-4.97,-3.03,-.99])rear.box([x,2.1,3.807],[.10,4.48,.010],1,.003,false);
 for(const y of [-.28,4.48])rear.box([-4,y,3.807],[6.08,.09,.010],1,.003,false);
 rear.arc(.49,.10,.016,2,[-4,2.10,3.808],new THREE.Quaternion(),0,Math.PI*2,false);
 rear.box([-4,2.10,3.808],[.25,.25,.016],1,.003,false);
 const reverseCassette=rear.finish();reverseCassette.userData.visualOnly=true;reverseCassette.userData.solidModel=false;delete reverseCassette.userData.collisionParts;group.add(reverseCassette);
 const arm=new SolidAssembly('Garden door cantilever','garden');
 // The dark segmented collar belongs to the turning assembly and has its
 // own short collision envelopes. The empty middle remains a real opening;
 // neither a decorative full-box proxy nor a fixed ring may cover the portal.
 arm.arc(4.43,.25,.48,1,[-4,2.1,3.88]);
 arm.arc(4.70,.075,.14,2,[-4,2.1,4.20],new THREE.Quaternion(),0,Math.PI*2,false);
 arm.box([-4,5.4,3.9],[7,.55,.65],1,.09);
 arm.box([-4,5.09,4.28],[6.65,.08,.09],2,.025,false);
 // Short collision envelopes follow the diagonals instead of filling the
 // empty triangle between the rotor hub and the door with one huge AABB.
 segmentedBeam(arm,[0,5.4,0],[-4,5.4,4],6,.19,1);
 segmentedBeam(arm,[0,6.25,0],[-4,5.55,4],6,.09,1);
 arm.turned([[0,5.20],[.46,5.20],[.54,5.30],[.54,5.90],[.46,6],[0,6]],1);
 for(const x of [-7.45,-.55]){
  arm.box([x,2.12,3.87],[.32,5.30,.38],1,.055);
  arm.box([x,2.12,4.125],[.075,4.95,.055],2,.018,false);
 }
 for(const x of [-6.6,-4,-1.4])arm.box([x,5.68,3.9],[.26,.22,.78],0,.055);
 const armBinding=placeSolidModel(k,arm.finish(),[0,0,0],{parent:group,kinematic:true});
 // The ceramic and the collision proxy share the fixed-step group. Render a
 // copy of the non-interactive cantilever between ticks, never that group:
 // its frame is also the raycast target and the mounted portal's anchor.
 const visualArm=armBinding.model.clone(true);visualArm.name='Garden door interpolated cantilever';
 visualArm.userData.solidModel=false;delete visualArm.userData.collisionParts;
 visualArm.position.copy(group.position);w.root.add(visualArm);armBinding.model.visible=false;
 // The original column's support volume is retained; its flat shell is replaced.
 const column=new SolidAssembly('Garden door pedestal','garden');
 column.turned([[0,0],[.48,0],[.55,.25],[.35,.55],[.35,10.9],[.50,11],[.50,11.4],[0,11.4]],1);
 for(const y of [5.45,6.2,10.95])column.turned([[.36,y-.13],[.68,y-.13],[.73,y-.04],[.73,y+.07],[.64,y+.13],[.36,y+.13]],0);
 for(let i=0;i<8;i++){
  const a=i*Math.PI/4;
  column.box([Math.cos(a)*.51,6.43,Math.sin(a)*.51],[.09,.25,.09],2,.02,false);
 }
 placeSolidModel(k,column.finish(),[4,0,-4]);
 const arc=[];for(let i=0;i<=24;i++){const a=Math.PI*.75+i*Math.PI/48;arc.push(new THREE.Vector3(4+Math.cos(a)*Math.sqrt(32),.027,-4+Math.sin(a)*Math.sqrt(32)));}
 const guide=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(arc),24,.035,4,false),w.materials.accent);guide.name='Inlaid orbit of the garden door';w.root.add(guide);
 let previous=0;
 const door={group,panel,reverseCassette,visualArm,angle:0,target:0,braked:false,loaded:false,manualTurn:false,rate:Math.PI/6,
  update(dt){previous=this.angle;this.loaded=pad.loaded();this.target=this.loaded||this.manualTurn?-Math.PI/2:0;if(!this.braked)this.angle+=THREE.MathUtils.clamp(this.target-this.angle,-this.rate*dt,this.rate*dt);group.rotation.y=this.angle;group.updateWorldMatrix(true,true);panel.collider.box.setFromObject(panel.mesh);game.physics?.updateStaticBox(panel.mesh.uuid,panel.collider.box,dt);armBinding.sync(dt);},
  reset(){this.angle=previous=0;this.braked=false;this.loaded=false;this.manualTurn=false;visualArm.rotation.y=0;this.update(0);},
  render(alpha){visualArm.rotation.y=THREE.MathUtils.lerp(previous,this.angle,alpha);},
 };
 k.state.gardenDoor=door;k.ticks.push(dt=>door.update(dt));k.renders.push(a=>door.render(a));k.resets.push(()=>door.reset());
 k.control('garden-home',[7,0,15],()=>{door.manualTurn=false;door.braked=false;},'E — отпустить привод и тормоз двери');
 k.control('garden-crank',[5,6,5],()=>{door.manualTurn=!door.manualTurn;},'E — повернуть дверь ручным приводом');
 k.control('garden-brake',[-10,6,-5.8],()=>{door.braked=!door.braked;},'E — зажать / отпустить поворотную дверь');
 k.wire([[-15.35,.08,12],[-15.35,.08,7],[4,.08,7],[4,.08,-4],[4,6,-4]],()=>door.loaded);
 k.wire([[-10,6.2,-5.8],[-10,6.2,-8],[0,6.2,-8]],()=>door.braked);
 return door;
}
