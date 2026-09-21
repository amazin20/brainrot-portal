import * as THREE from 'three';
import {SolidAssembly,createGuideRing,createPlanter,createPontoon,placeSolidModel} from './LabSolidModels.js';

/** Sealed pontoon hulls and anchored observation equipment. Fixed-step hull
 * collision follows the exact slider pose, never the interpolated picture. */
export function buildRoom28Art(k){
 const w=k.world,root=new THREE.Group();root.name='Coral arches and tidal observatory';root.userData.keepMaterial=true;w.root.add(root);
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
 return root;
}
