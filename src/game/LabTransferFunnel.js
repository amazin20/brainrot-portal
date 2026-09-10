import * as THREE from 'three';
import {V, tracePortalRay} from './LabPuzzleMechanics.js';

const UP=V(0,1,0), FORWARD=0x7edee8, REVERSE=0xf5ad75;
const clamp=THREE.MathUtils.clamp;

/** A reversible, portal-routed suspension field. The caller applies the
 * returned acceleration to the ordinary player/cargo integrator. No traveller
 * is attached, snapped to the axis, assigned a speed, or transported here. */
export function buildTransferFunnel(k,{origin,direction,radius=2.1,speed=7}){
 const game=k.game,world=k.world;
 const source=Array.isArray(origin)?V(...origin):origin.clone();
 const axis=Array.isArray(direction)?V(...direction):direction.clone();
 if(![...source.toArray(),...axis.toArray(),radius,speed].every(Number.isFinite)
  ||axis.lengthSq()<1e-8||radius<=0||speed<=0)throw new RangeError('A finite origin, nonzero direction, positive radius and speed are required');
 axis.normalize();
 const root=new THREE.Group();root.name='Reversible transfer field';world.root.add(root);
 const housingRoot=new THREE.Group();housingRoot.position.copy(source);housingRoot.quaternion.setFromUnitVectors(UP,axis);world.root.add(housingRoot);
 // A thin, solid backplate is behind the field origin; it cannot block its own
 // emitted ray. Decorative rim pieces have no invisible gameplay collision.
 const shell=world.box([0,-.27,0],[radius*2+.35,.30,radius*2+.35],world.materials.trim,true,housingRoot);
 const rim=new THREE.Mesh(new THREE.TorusGeometry(radius+.02,.12,8,32),world.materials.trim);
 rim.rotation.x=Math.PI/2;rim.position.y=-.075;housingRoot.add(rim);
 const lampMaterial=new THREE.MeshBasicMaterial({color:FORWARD});
 const lamp=new THREE.Mesh(new THREE.TorusGeometry(radius-.11,.037,6,32),lampMaterial);
 lamp.rotation.x=Math.PI/2;lamp.position.y=-.04;housingRoot.add(lamp);

 const membraneMaterial=new THREE.MeshBasicMaterial({color:FORWARD,transparent:true,opacity:.035,depthWrite:false,side:THREE.DoubleSide});
 const helixMaterial=new THREE.LineBasicMaterial({color:FORWARD,transparent:true,opacity:.38,depthWrite:false});
 const particleMaterial=new THREE.MeshBasicMaterial({color:FORWARD,transparent:true,opacity:.8,depthWrite:false});
 const tubeGeometry=new THREE.CylinderGeometry(1,1,1,24,1,true);
 const lanes=[];
 for(let i=0;i<6;i++){
  const group=new THREE.Group();root.add(group);group.visible=false;
  const tube=new THREE.Mesh(tubeGeometry,membraneMaterial);group.add(tube);
  const helixGeometry=new THREE.BufferGeometry();
  const positions=new Float32Array(96*2*2*3);helixGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  const helix=new THREE.LineSegments(helixGeometry,helixMaterial);helix.frustumCulled=false;group.add(helix);
  lanes.push({group,tube,helix,positions,length:-1});
 }
 const particles=new THREE.InstancedMesh(new THREE.SphereGeometry(.055,5,4),particleMaterial,180);
 particles.frustumCulled=false;root.add(particles);
 const matrix=new THREE.Matrix4(),rotation=new THREE.Quaternion(),point=V();
 let time=0;

 const field={origin:source,direction:axis,radius,speed,enabled:true,reversed:false,segments:[],root,housing:shell,
  update(dt=0){
   time+=Math.max(0,dt);
   field.segments=field.enabled?tracePortalRay(game,source,axis,{medium:'air',length:100}):[];
   field.render();
  },
  acceleration(position,velocity,bodyRadius=0,{centering=18,damping=6}={}){
   if(!field.enabled)return V();
   const allowed=field.radius-Math.max(0,bodyRadius);
   if(allowed<=0)return V();
   // A body at an overlapping crossing is influenced by the closest visible
   // axis, once. Intersecting segments cannot multiply gravity cancellation.
   let nearest=null,nearestOffset=null,best=Infinity;
   for(const segment of field.segments){
    const offset=position.clone().sub(segment.a),distance=offset.dot(segment.direction);
    if(distance<0||distance>segment.length)continue;
    offset.addScaledVector(segment.direction,-distance);
    const radial=offset.length();if(radial>=allowed||radial>=best)continue;
    if(radial>.001){
     const center=position.clone().sub(offset),ray=new THREE.Ray(center,offset.clone().multiplyScalar(1/radial));
     // The traced centreline alone cannot detect a thin wall parallel to the
     // stream. Test the radial path too, so the field never reaches through it.
     if(game.colliders.some(c=>{
      if(c.enabled===false||c.ignorePropagation)return false;
      if(c.box.containsPoint(position))return true;
      const hit=ray.intersectBox(c.box,V());return hit&&hit.distanceTo(center)<radial-.002;
     }))continue;
    }
    nearest=segment;nearestOffset=offset;best=radial;
   }
   if(!nearest)return V();
   const d=nearest.direction,axial=velocity.dot(d),radialVelocity=velocity.clone().addScaledVector(d,-axial);
   const target=field.speed*(field.reversed?-1:1);
   // Free cargo uses the firm default suspension. A player can receive a
   // softer radial response, allowing ordinary air steering to leave the
   // stream without changing the common movement controller or teleporting.
   const force=d.clone().multiplyScalar(clamp((target-axial)*5,-65,65))
    .addScaledVector(nearestOffset,-centering).addScaledVector(radialVelocity,-damping).addScaledVector(UP,19.5);
   // A narrow feathered boundary lets the player deliberately leave the tube.
   // The visible radius always contains the entire affected body.
   const edge=clamp((allowed-best)/Math.min(.24,allowed*.2),0,1);
   return force.multiplyScalar(edge*edge*(3-2*edge));
  },
  render(){
   root.visible=field.enabled&&field.segments.length>0;
   const color=field.reversed?REVERSE:FORWARD;
   for(const material of [lampMaterial,membraneMaterial,helixMaterial,particleMaterial])material.color.setHex(color);
   lamp.visible=field.enabled;
   lanes.forEach((lane,index)=>{
    const s=field.segments[index];lane.group.visible=!!s;if(!s)return;
    lane.group.position.copy(s.a);lane.group.quaternion.setFromUnitVectors(UP,s.direction);
    lane.tube.position.y=s.length/2;lane.tube.scale.set(field.radius,s.length,field.radius);
    if(Math.abs(lane.length-s.length)>.001){
     lane.length=s.length;let n=0;
     for(let strand=0;strand<2;strand++)for(let step=0;step<96;step++)for(let end=0;end<2;end++){
      const y=s.length*(step+end)/96,theta=y*1.8+strand*Math.PI;
      lane.positions[n++]=Math.cos(theta)*field.radius*.88;lane.positions[n++]=y;lane.positions[n++]=Math.sin(theta)*field.radius*.88;
     }
     lane.helix.geometry.attributes.position.needsUpdate=true;
    }
    lane.helix.rotation.y=time*(field.reversed?1:-1)*1.4;
   });
   const total=field.segments.reduce((sum,s)=>sum+s.length,0);let count=0;
   if(total>0)for(let i=0;i<180;i++){
    let travel=((i/180*total+time*field.speed*(field.reversed?-1:1))%total+total)%total;
    let s=field.segments[field.segments.length-1];
    for(const part of field.segments){s=part;if(travel<=part.length)break;travel-=part.length;}
    const theta=i*2.39996323,spread=field.radius*(.18+.68*((i*37)%97)/97);
    rotation.setFromUnitVectors(UP,s.direction);
    point.set(Math.cos(theta)*spread,travel,Math.sin(theta)*spread).applyQuaternion(rotation).add(s.a);
    matrix.makeTranslation(point.x,point.y,point.z);particles.setMatrixAt(count++,matrix);
   }
   particles.count=count;particles.instanceMatrix.needsUpdate=true;
  },
  reset(){time=0;field.enabled=true;field.reversed=false;field.update(0);}
 };
 k.ticks.push(dt=>field.update(dt));k.renders.push(()=>field.render());k.resets.push(()=>field.reset());
 field.update(0);return field;
}
