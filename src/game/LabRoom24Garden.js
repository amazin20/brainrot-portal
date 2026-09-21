import * as THREE from 'three';
import {V} from './LabWorkshopKit.js';
/** A reversible weighted door. The angle is the actual architectural pose,
 * and its ceramic retains the same portal frame throughout the turn. */
export function buildGardenDoor(k,pad){
 const w=k.world,game=k.game,group=new THREE.Group();group.position.set(4,6,-4);w.root.add(group);
 const panel=k.panel('revolving-door',[-4,2.3,4],[0,0,1],6.4,5,group,true);
 // surface() creates a second static backing proxy. A moving architectural
 // slab has one collider; remove the immobile duplicate from the registry.
 const duplicate=game.colliders.find(c=>c.mesh===panel.backing);if(duplicate)game.colliders.splice(game.colliders.indexOf(duplicate),1);
 const crown=w.box([-4,5.4,3.9],[7,.55,.65],w.materials.accent,false,group);
 const shaft=w.box([0,6.1,0],[.4,1.1,.4],w.materials.trim,false,group);
 w.box([-2,5.4,2],[.32,.35,5.6],w.materials.trim,false,group).rotation.y=-Math.PI/4;
 let previous=0;
 const door={group,panel,angle:0,target:0,braked:false,loaded:false,manualTurn:false,rate:Math.PI/6,
  update(dt){previous=this.angle;this.loaded=pad.loaded();this.target=this.loaded||this.manualTurn?-Math.PI/2:0;if(!this.braked)this.angle+=THREE.MathUtils.clamp(this.target-this.angle,-this.rate*dt,this.rate*dt);group.rotation.y=this.angle;group.updateWorldMatrix(true,true);panel.collider.box.setFromObject(panel.mesh);game.physics?.updateStaticBox(panel.mesh.uuid,panel.collider.box,dt);},
  reset(){this.angle=previous=0;this.braked=false;this.loaded=false;this.manualTurn=false;this.update(0);},
  render(alpha){group.rotation.y=THREE.MathUtils.lerp(previous,this.angle,alpha);},
 };
 k.state.gardenDoor=door;k.ticks.push(dt=>door.update(dt));k.renders.push(a=>door.render(a));k.resets.push(()=>door.reset());
 k.control('garden-crank',[5,6,5],()=>{door.manualTurn=!door.manualTurn;},'E — повернуть дверь ручным приводом');
 k.control('garden-brake',[-10,6,-5.8],()=>{door.braked=!door.braked;},'E — зажать / отпустить поворотную дверь');
 k.wire([[-10,.3,12],[-10,.3,5],[0,.3,5],[0,6,5],[0,6,0]],()=>door.loaded);
 k.wire([[-10,6.2,-3],[-10,6.2,0],[0,6.2,0]],()=>door.braked);
 return door;
}
