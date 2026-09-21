import * as THREE from 'three';
import {SolidAssembly,placeSolidModel} from './LabSolidModels.js';
/** A reversible weighted door. The angle is the actual architectural pose,
 * and its ceramic retains the same portal frame throughout the turn. */
export function buildGardenDoor(k,pad){
 const w=k.world,game=k.game,group=new THREE.Group();group.position.set(4,6,-4);w.root.add(group);
 const panel=k.panel('revolving-door',[-4,2.1,4],[0,0,1],6.4,5,group,true);
 // surface() creates a second static backing proxy. A moving architectural
 // slab has one collider; remove the immobile duplicate from the registry.
 const duplicate=game.colliders.find(c=>c.mesh===panel.backing);if(duplicate)game.colliders.splice(game.colliders.indexOf(duplicate),1);
 const arm=new SolidAssembly('Garden door cantilever','garden');
 arm.box([-4,5.4,3.9],[7,.55,.65],0,.09);
 arm.beam([0,5.4,0],[-4,5.4,4],.19,1);
 arm.beam([0,6.25,0],[-4,5.55,4],.09,1);
 arm.turned([[0,5.20],[.46,5.20],[.54,5.30],[.54,5.90],[.46,6],[0,6]],1);
 for(const x of [-7.45,-.55])arm.box([x,2.12,3.87],[.32,5.30,.38],0,.055);
 const armBinding=placeSolidModel(k,arm.finish(),[0,0,0],{parent:group,kinematic:true});
 // The original column's support volume is retained; its flat shell is replaced.
 const column=new SolidAssembly('Garden door pedestal','garden');
 column.turned([[0,0],[.48,0],[.55,.25],[.35,.55],[.35,10.9],[.50,11],[.50,11.4],[0,11.4]],1);
 placeSolidModel(k,column.finish(),[4,0,-4]);
 const arc=[];for(let i=0;i<=24;i++){const a=Math.PI*.75+i*Math.PI/48;arc.push(new THREE.Vector3(4+Math.cos(a)*Math.sqrt(32),.027,-4+Math.sin(a)*Math.sqrt(32)));}
 const guide=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(arc),24,.035,4,false),w.materials.accent);guide.name='Inlaid orbit of the garden door';w.root.add(guide);
 let previous=0;
 const door={group,panel,angle:0,target:0,braked:false,loaded:false,manualTurn:false,rate:Math.PI/6,
  update(dt){previous=this.angle;this.loaded=pad.loaded();this.target=this.loaded||this.manualTurn?-Math.PI/2:0;if(!this.braked)this.angle+=THREE.MathUtils.clamp(this.target-this.angle,-this.rate*dt,this.rate*dt);group.rotation.y=this.angle;group.updateWorldMatrix(true,true);panel.collider.box.setFromObject(panel.mesh);game.physics?.updateStaticBox(panel.mesh.uuid,panel.collider.box,dt);armBinding.sync(dt);},
  reset(){this.angle=previous=0;this.braked=false;this.loaded=false;this.manualTurn=false;this.update(0);},
  render(alpha){group.rotation.y=THREE.MathUtils.lerp(previous,this.angle,alpha);},
 };
 k.state.gardenDoor=door;k.ticks.push(dt=>door.update(dt));k.renders.push(a=>door.render(a));k.resets.push(()=>door.reset());
 k.control('garden-home',[7,0,15],()=>{door.manualTurn=false;door.braked=false;},'E — отпустить привод и тормоз двери');
 k.control('garden-crank',[5,6,5],()=>{door.manualTurn=!door.manualTurn;},'E — повернуть дверь ручным приводом');
 k.control('garden-brake',[-10,6,-5.8],()=>{door.braked=!door.braked;},'E — зажать / отпустить поворотную дверь');
 k.wire([[-15.35,.08,12],[-15.35,.08,7],[4,.08,7],[4,.08,-4],[4,6,-4]],()=>door.loaded);
 k.wire([[-10,6.2,-5.8],[-10,6.2,-8],[0,6.2,-8]],()=>door.braked);
 return door;
}
