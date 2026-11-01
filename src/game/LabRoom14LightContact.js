import * as THREE from 'three';
import {Body, Box, Vec3, Material,Quaternion} from 'cannon-es';
import {transformPortalDirection,transformPortalPoint,pointInsidePortal} from './LabPortals.js';
import {clipPortalRibbon} from './LabLightBridge.js';
import {createOrientedBoxContact, syncOrientedBoxContact} from './LabOrientedBoxContact.js';
import {compoundCargoBoxPose,compoundCargoBoxSeparation} from './LabCompoundCargoSweep.js';

const V=(...p)=>new THREE.Vector3(...p),THICKNESS=.14;

/** A new field cannot acquire energy by being born inside the real original
 * cargo. This is only queried when a ray is newly addressed or still growing
 * around an existing obstruction; an established contact face stays solid. */
function availableMaterialization(game,segment,center,quaternion,half){
 const cargo=game.physics?.cargoBody;if(!cargo?.shapes[0])return segment.length;
 const q=new Quaternion(quaternion.x,quaternion.y,quaternion.z,quaternion.w);
 const proposed={center:new Vec3(center.x,center.y,center.z),half:new Vec3(half.x,half.y,half.z),
  axes:[new Vec3(1,0,0),new Vec3(0,1,0),new Vec3(0,0,1)].map(a=>q.vmult(a))};
 const original=compoundCargoBoxPose(cargo,0);
 if(compoundCargoBoxSeparation(original,proposed).gap>=-1e-7)return segment.length;
 const direction=new Vec3(segment.direction.x,segment.direction.y,segment.direction.z);
 const extent=original.half.x*Math.abs(original.axes[0].dot(direction))
  +original.half.y*Math.abs(original.axes[1].dot(direction))+original.half.z*Math.abs(original.axes[2].dot(direction));
 const along=original.center.vsub(new Vec3(segment.a.x,segment.a.y,segment.a.z)).dot(direction);
 return Math.max(0,Math.min(segment.length,along-extent-.001));
}

export function traceRoom14Light(game,origin,direction,{length=45}={}){
 const segments=[];let o=origin.clone(),d=direction.clone().normalize(),remaining=length;
 for(let i=0;i<6&&remaining>.03;i++){
  let distance=remaining,kind='end',target=null;
  for(const c of game.colliders){
   if(c.enabled===false||c.ignorePropagation)continue;
   const box=c.orientedBox,frame=box?.current;
   const inverse=frame?.quaternion.clone().invert();
   const localOrigin=frame?o.clone().sub(frame.center).applyQuaternion(inverse):o;
   const localDirection=frame?d.clone().applyQuaternion(inverse):d;
   const ray=new THREE.Ray(localOrigin,localDirection);
   const bounds=box?new THREE.Box3(box.half.clone().negate(),box.half):c.box;
   const hit=ray.intersectBox(bounds,V());if(!hit)continue;
   const t=hit.sub(localOrigin).dot(localDirection);if(t>.012&&t<distance){distance=t;kind='wall';}
  }
  if(game.portals?.ready)for(let k=0;k<2;k++){
   const p=game.portals.portals[k],den=d.dot(p.normal);if(den>=-.0001)continue;
   const t=p.position.clone().sub(o).dot(p.normal)/den,at=o.clone().addScaledVector(d,t);
   if(t>.012&&t<distance+.075&&pointInsidePortal(p,at,.03)){distance=t;kind='portal';target=k;}
  }
  const end=o.clone().addScaledVector(d,distance);segments.push({a:o.clone(),b:end,direction:d.clone(),length:distance,kind});remaining-=distance;
  if(kind!=='portal')break;
  const a=game.portals.portals[target],b=game.portals.portals[1-target];o=transformPortalPoint(end,a,b).addScaledVector(b.normal,.07);d=transformPortalDirection(d,a,b).normalize();
 }
 return segments;
}

/** Room fourteen's vertical sheet owns one actual Box per finite ray segment.
 * It never converts an oblique sheet to its broadphase AABB. Existing bridge
 * rooms keep their original authoring, collision and floor-support behavior. */
export function createRoom14LightContact(kit,{
 origin,direction,span=[0,1,0],width=.96,length=45,name='14 / portal-routed contact sheet',
}={}){
 const game=kit.game,world=kit.world;
 const material=new THREE.MeshStandardMaterial({name:'Room14 / solid light contact',
  color:0x35c8de,emissive:0x1595b6,emissiveIntensity:1.25,roughness:.28,
  metalness:.04,transparent:true,opacity:.93,depthWrite:true});
 const geometry=new THREE.BoxGeometry(1,1,1),pieces=[];
 for(let i=0;i<6;i++){
  const mesh=new THREE.Mesh(geometry,material);mesh.name=name+' / '+i;
  mesh.visible=false;mesh.position.set(0,-40,0);mesh.userData.keepMaterial=true;
  mesh.userData.portalClearance=false;
  mesh.userData.firstChapterStructuralRole='room14-light-contact';world.root.add(mesh);
  const collider={mesh,box:new THREE.Box3().setFromObject(mesh),enabled:false,ignorePropagation:true};
  game.colliders.push(collider);game.cameraBlockers.push(mesh);game.aimBlockers.push(mesh);
  pieces.push({mesh,collider,body:null,shape:null,descriptor:null});
 }
 const owned=[...pieces];let owner=null,disposed=false,signature=null,blocked=false;
 const wakeChanged=(oldBounds,nextBounds)=>{
  const cargo=owner?.cargoBody;if(!cargo||cargo.sleepState!==Body.SLEEPING)return;
  const margin=owner.cargoSize*.87+.06;
  if(oldBounds?.clone().expandByScalar(margin).containsPoint(cargo.position)||nextBounds?.clone().expandByScalar(margin).containsPoint(cargo.position))cargo.wakeUp();
 };
 const syncHistory=()=>{
  for(const p of owned)if(p.descriptor){
   syncOrientedBoxContact(p.descriptor,p.body,owner.world.stepnumber);
   p.collider.box.copy(p.descriptor.current.bounds);
  }
 };
 const field={pieces,owned,material,geometry,segments:[],get materializationBlocked(){return blocked;},
  addSolid(mesh,collider){
   if(owner)field.releaseOwner();
   mesh.userData.firstChapterStructuralRole='room14-owned-contact';
   owned.push({mesh,collider,body:null,shape:null,descriptor:null,fixed:true});
  },
  ensure(){
   if(!game.physics||owner===game.physics)return;
   if(owner)field.releaseOwner();owner=game.physics;signature=null;
   for(const p of owned){
    owner.removeStaticBox(p.mesh.uuid);p.poseKey=null;
    const size=p.fixed?V(p.mesh.geometry.parameters.width,p.mesh.geometry.parameters.height,p.mesh.geometry.parameters.depth).multiply(p.mesh.getWorldScale(V())):V(1,1,1),half=size.multiplyScalar(.5);
    p.shape=new Box(new Vec3(half.x,half.y,half.z));
    p.body=new Body({mass:0,shape:p.shape,material:new Material({friction:.64,restitution:.08}),collisionFilterGroup:1,collisionFilterMask:2});
    p.body.position.copy(p.mesh.getWorldPosition(V()));p.body.quaternion.copy(p.mesh.getWorldQuaternion(new THREE.Quaternion()));owner.world.addBody(p.body);
    p.descriptor=createOrientedBoxContact(p.body,half,V(),owner.world.stepnumber);
    p.collider.orientedBox=p.descriptor;
    owner.registerBodyBox(p.mesh.uuid,{body:p.body,shapeIndex:0,orientedBox:p.descriptor});
    owner.registerCargoSweepBox(p.mesh.uuid,{body:p.body,shapeIndex:0});
   }
   owner.world.addEventListener('postStep',syncHistory);
  },
  releaseOwner(){
   if(!owner)return;owner.world.removeEventListener('postStep',syncHistory);
   for(const p of owned){owner.removeBodyBox(p.mesh.uuid);owner.removeCargoSweepBox(p.mesh.uuid);if(p.body)owner.world.removeBody(p.body);p.body=p.shape=p.descriptor=null;delete p.collider.orientedBox;}
   owner=null;
  },
  update(){
   if(disposed)return;field.ensure();
   const rays=traceRoom14Light(game,V(...origin),V(...direction),{length});
   const key=rays.flatMap(s=>[...s.a.toArray(),...s.b.toArray(),s.kind]).join(':')+'|'+(game.portals?.ready?game.portals.portals.map(p=>[...p.position.toArray(),...p.quaternion.toArray(),p.width,p.height].join(',')).join('|'):'off');
   const sameAddress=signature===key;
   if(sameAddress&&!blocked)return;signature=key;blocked=false;field.segments=[];
   let across=V(...span).normalize(),low=-width/2,high=width/2;
   let used=0;
   for(let i=0;i<Math.min(pieces.length,rays.length);i++){
    const s=rays[i];if(s.length<.02)break;
    const normal=V().crossVectors(s.direction,across).normalize();
    const p=pieces[i],oldBounds=p.collider.enabled?p.collider.box.clone():null;
    const quaternion=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(s.direction,across,normal));
    const center=s.a.clone().add(s.b).multiplyScalar(.5).addScaledVector(across,(low+high)/2).addScaledVector(normal,-THICKNESS/2);
    // A previously materialized prefix is already an ordinary solid. Growth
    // may wait for cargo clearance, but approach cannot erase that contact.
    const prior=sameAddress&&p.collider.enabled?p.mesh.scale.x:0;
    const available=Math.max(prior,availableMaterialization(game,s,center,quaternion,V(s.length/2,(high-low)/2,THICKNESS/2)));
    blocked=available<s.length-1e-7;
    if(available<.02)break;
    const end=s.a.clone().addScaledVector(s.direction,available),size=V(available,high-low,THICKNESS),half=size.clone().multiplyScalar(.5);
    field.segments.push({...s,b:end,length:available,kind:blocked?'cargo':s.kind});
    p.mesh.position.copy(s.a).add(end).multiplyScalar(.5).addScaledVector(across,(low+high)/2).addScaledVector(normal,-THICKNESS/2);
    p.mesh.quaternion.copy(quaternion);
    p.mesh.scale.copy(size);p.mesh.visible=p.collider.enabled=true;p.mesh.updateWorldMatrix(true,false);
    p.collider.box.setFromObject(p.mesh);used=i+1;
    const poseKey=[...p.mesh.position.toArray(),...quaternion.toArray(),...size.toArray()].join(',');
    if(p.body&&p.poseKey!==poseKey){
     p.body.position.copy(p.mesh.position);p.body.quaternion.copy(p.mesh.quaternion);p.body.collisionFilterMask=2;
     p.shape.halfExtents.copy(half);p.shape.updateConvexPolyhedronRepresentation();p.shape.updateBoundingSphereRadius();p.body.updateBoundingRadius();p.body.aabbNeedsUpdate=true;
     p.descriptor.half.copy(half);syncOrientedBoxContact(p.descriptor,p.body,owner.world.stepnumber,true);p.collider.box.copy(p.descriptor.current.bounds);
     wakeChanged(oldBounds,p.collider.box);
    }
    p.poseKey=poseKey;if(blocked)break;
    if(s.kind==='portal'&&game.portals.ready){
     const ps=game.portals.portals,j=ps[0].position.distanceTo(s.b)<ps[1].position.distanceTo(s.b)?0:1;
     for(const offset of [0,-THICKNESS]){
      const interval=clipPortalRibbon(ps[j],s.b.clone().addScaledVector(normal,offset),across,low,high);
      if(!interval){used=i+1;i=pieces.length;break;}[low,high]=interval;
     }
     across=transformPortalDirection(across,ps[j],ps[1-j]).normalize();
     const next=rays[i+1];if(next){
      const nn=V().crossVectors(next.direction,across).normalize();
      for(const offset of [0,-THICKNESS]){
       const interval=clipPortalRibbon(ps[1-j],next.a.clone().addScaledVector(nn,offset),across,low,high);
       if(!interval){i=pieces.length;break;}[low,high]=interval;
      }
     }
    }
   }
   for(let i=used;i<pieces.length;i++){
    const p=pieces[i];if(p.collider.enabled)wakeChanged(p.collider.box,null);p.mesh.visible=p.collider.enabled=false;p.poseKey=null;if(p.body)p.body.collisionFilterMask=0;
   }
   if(owner)owner.world.broadphase.dirty=true;
  },
  dispose(){
   if(disposed)return;disposed=true;field.releaseOwner();
   for(const p of owned){
    for(const list of [game.colliders,game.cameraBlockers,game.aimBlockers]){const item=list===game.colliders?p.collider:p.mesh,n=list.indexOf(item);if(n>=0)list.splice(n,1);}
    p.mesh.removeFromParent();if(p.fixed)p.mesh.geometry.dispose();
   }
   geometry.dispose();material.dispose();
  },
 };
 kit.ticks.push(()=>field.update());kit.resets.push(()=>{signature=null;field.update();});
 kit.state.lightContact=field;field.update();return field;
}
