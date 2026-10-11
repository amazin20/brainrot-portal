import * as THREE from 'three';
import {Body,Box,ConvexPolyhedron,HingeConstraint,LockConstraint,Material,Spring,Vec3} from 'cannon-es';
import {createOrientedBoxContact,syncOrientedBoxContact} from './LabOrientedBoxContact.js';

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const C=(x=0,y=0,z=0)=>new Vec3(x,y,z);
const UP=V(0,1,0);
const DT=1/120;

/** One independently qualified cargo mechanism. The rack's Y degree of freedom
 * and the pawl's Z hinge are solved by Cannon; only reset writes their poses. */
export function buildTower41RatchetCell(game,k,options={}){
 const centre=options.centre??[37,0,-50],origin=V(...centre);
 const config={pawl:options.pawl!==false,rackSpring:options.rackSpring!==false};
 const rackParts=[],stopParts=[],teeth=[],springMeshes=[];
 const m=k.m,upperY=centre[1]+1.5,pivot=C(centre[0]+1.295,centre[1]+1.2,centre[2]-1.04);
 // The mass frame is on the rear spring line. The tray remains at centre;
 // its real eccentric cargo load is reacted by the guide equations.
 const rackOrigin=C(centre[0]-.3,upperY,centre[2]-1.04),rackShift=C(-.3,0,-1.04);
 const material=new Material({friction:.12,restitution:0});
 let owner=null,disposed=false,lastForceStep=-1,onPostStep=null;
 let anchor=null,rack=null,pawl=null,stops=null,guide=null,hinge=null,rackSpring=null,pawlSpring=null;
 const bodies=[],constraints=[],springs=[];

 function boxPart(list,name,offset,size,mat=m.steel,base=V(centre[0],upperY,centre[2])){
  const mesh=k.box(base.clone().add(V(...offset)).toArray(),size,mat,{dynamic:true});mesh.name=name;
  const part={mesh,collider:mesh.userData.collider,offset:C(...offset),half:C(...size.map(v=>v/2))};list.push(part);return part;
 }
 boxPart(rackParts,'41 physical cargo tray',[0,0,0],[1.4,.2,1.4],m.copper);
 boxPart(rackParts,'41 physical rack spine',[.86,.35,-1.04],[.12,1.5,.24]);
 boxPart(rackParts,'41 physical upper stop tab',[-.85,.3,-1.04],[.24,.2,.24]);
 boxPart(rackParts,'41 physical rack spring crossbar',[.035,.3,-1.04],[1.77,.1,.24]);
 boxPart(rackParts,'41 physical tray to rack connector',[.65,0,-.76],[.30,.2,.76]);
 // Four matching triangular prisms: the lower ramp cams the pawl downwards;
 // the upper shoulder meets its underside on the spring-powered return.
 const profile=[C(0,-.05,-.12),C(.12,.05,-.12),C(0,.05,-.12),C(0,-.05,.12),C(.12,.05,.12),C(0,.05,.12)];
 const faces=[[0,2,1],[3,4,5],[0,1,4,3],[1,2,5,4],[2,0,3,5]];
 for(let i=0;i<4;i++){
  const offset=C(.92,-.4+i*.25,-1.04),vertices=profile.map(v=>v.clone());
  const shape=new ConvexPolyhedron({vertices,faces:faces.map(f=>[...f])});
  const positions=[];for(const f of faces)for(let j=1;j<f.length-1;j++)for(const index of [f[0],f[j],f[j+1]])positions.push(...profile[index].toArray());
  const geometry=k.geo(new THREE.BufferGeometry());geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();
  const mesh=k.mesh(geometry,m.copper,origin.clone().add(V(offset.x,1.5+offset.y,offset.z)).toArray(),[1,1,1],{dynamic:true});mesh.name=`41 real retaining tooth ${i+1}`;
  teeth.push({mesh,shape,offset});
 }
 for(const p of [...rackParts,...teeth])p.offset.vsub(rackShift,p.offset);
 const pawlPart=config.pawl?boxPart([], '41 hinged retaining pawl',[0,0,0],[.28,.07,.24],m.mint,V(pivot.x-.14,pivot.y,pivot.z)):null;
 // Only these stops accept SOLID mechanisms; the existing castle floor's
 // CARGO-only mask remains unchanged. Their meshes match the compound shapes.
 boxPart(stopParts,'41 physical lower rack stop',[0,.3,0],[1.4,.2,1.4],m.dark,origin);
 boxPart(stopParts,'41 physical upper rack stop',[-.85,2,-1.04],[.32,.2,.32],m.dark,origin);
 if(config.rackSpring)boxPart(stopParts,'41 fixed rack spring roof bracket',[-.3,2.745,-1.04],[.24,.11,.24],m.dark,origin);
 if(config.pawl){
  boxPart(stopParts,'41 physical pawl seat',[1.185,1.285,-1.04],[.20,.08,.24],m.dark,origin);
  boxPart(stopParts,'41 physical pawl opening stop',[1.22,.9,-1.04],[.27,.1,.24],m.dark,origin);
 }
 // The convex teeth are inside a physically closed compartment. Accessible
 // tray and pawl boxes have exact per-shape oriented contact descriptors.
 const glazing=k.mat(0x9bc5cd,.52,.05);glazing.transparent=true;glazing.opacity=.28;
 for(const [offset,size] of [
  [[-.95,1.55,-.04],[.12,3.1,1.52]],[[.95,1.55,-.04],[.12,3.1,1.52]],
  // A .35m connector slot is genuinely open, below both the .86m capsule
  // diameter and .78m cargo width. The convex teeth stay behind the right pane.
  [[-.265,1.55,-.82],[1.49,3.1,.12]],[[1.32,1.55,-.82],[.98,3.1,.12]],
  [[.4,1.55,-1.45],[2.82,3.1,.12]],
  [[1.78,1.55,-1.13],[.12,3.1,.75]],[[.4,2.925,-.375],[2.82,.25,2.15]],
 ])boxPart(stopParts,'41 fixed ratchet safety glazing',offset,size,glazing,origin);

 class Coil extends THREE.Curve{getPoint(t,target=V()){return target.set(.055*Math.cos(t*Math.PI*18),t,.055*Math.sin(t*Math.PI*18));}}
 function springVisual(name){const mesh=k.mesh(k.geo(new THREE.TubeGeometry(new Coil(),72,.009,4,false)),m.ivory,[0,0,0],[1,1,1],{dynamic:true});mesh.name=name;springMeshes.push(mesh);return mesh;}
 if(config.rackSpring)springVisual('41 rack restoring spring');if(config.pawl)springVisual('41 pawl restoring spring');

 function addBody(body,name){body.labTower41Cell=name;owner.world.addBody(body);bodies.push(body);return body;}
 function addConstraint(constraint){constraint.collideConnected=false;for(const e of constraint.equations)e.setSpookParams(1e8,4,DT);owner.world.addConstraint(constraint);constraints.push(constraint);return constraint;}
 function descriptor(part,body){part.collider.orientedBox=createOrientedBoxContact(body,V(part.half.x,part.half.y,part.half.z),V(part.offset.x,part.offset.y,part.offset.z),owner.world.stepnumber);}
 function place(body,p){body.position.copy(p);body.quaternion.set(0,0,0,1);body.velocity.setZero();body.angularVelocity.setZero();body.force.setZero();body.torque.setZero();body.previousPosition.copy(body.position);body.interpolatedPosition.copy(body.position);body.previousQuaternion.copy(body.quaternion);body.interpolatedQuaternion.copy(body.quaternion);body.aabbNeedsUpdate=true;body.wakeUp();}
 function syncPart(part,body,reset){const q=body.quaternion,p=body.quaternion.vmult(part.offset);part.mesh.position.set(body.position.x+p.x,body.position.y+p.y,body.position.z+p.z);part.mesh.quaternion.set(q.x,q.y,q.z,q.w);part.mesh.updateWorldMatrix(true,false);part.collider.box.setFromObject(part.mesh);syncOrientedBoxContact(part.collider.orientedBox,body,owner.world.stepnumber,reset);}
 const cell={
  centre:origin,rackOrigin,config,rackParts,stopParts,teeth,pawlPart,
  get owner(){return owner;},get rack(){return rack;},get pawl(){return pawl;},get stops(){return stops;},get anchor(){return anchor;},get guide(){return guide;},get hinge(){return hinge;},get springs(){return springs;},get bodies(){return bodies;},get constraints(){return constraints;},
  ensure(){
   if(disposed||!game.physics?.cargoBody)return false;if(owner===game.physics)return true;
   if(owner)throw new Error('Ratchet cell cannot change physics owner without disposal');owner=game.physics;
   cell.originalCargo=game.cargo;cell.originalCargoBody=owner.cargoBody;
   for(const p of [...rackParts,...stopParts,...(pawlPart?[pawlPart]:[])])owner.removeStaticBox(p.mesh.uuid);
   anchor=addBody(new Body({mass:0,position:rackOrigin.clone(),collisionFilterGroup:1,collisionFilterMask:0}), 'anchor');
   rack=addBody(new Body({mass:1,position:rackOrigin.clone(),allowSleep:false,linearDamping:0,angularDamping:0,material,collisionFilterGroup:1,collisionFilterMask:3}), 'rack');
   for(const p of rackParts){rack.addShape(new Box(p.half),p.offset);descriptor(p,rack);}for(const t of teeth)rack.addShape(t.shape,t.offset);
   guide=new LockConstraint(anchor,rack,{maxForce:1e6});guide.equations=guide.equations.filter(e=>e!==guide.equationY);addConstraint(guide);
   stops=addBody(new Body({mass:0,position:C(...centre),material,collisionFilterGroup:1,collisionFilterMask:3}), 'physical stops');
   for(const p of stopParts){stops.addShape(new Box(p.half),p.offset);descriptor(p,stops);}
   if(config.pawl){
    pawl=addBody(new Body({mass:.12,position:C(pivot.x-.14,pivot.y,pivot.z),allowSleep:false,linearDamping:0,angularDamping:0,material,collisionFilterGroup:1,collisionFilterMask:3}), 'pawl');pawl.addShape(new Box(pawlPart.half));descriptor(pawlPart,pawl);
    hinge=new HingeConstraint(anchor,pawl,{pivotA:pivot.vsub(anchor.position),pivotB:C(.14,0,0),axisA:C(0,0,1),axisB:C(0,0,1),maxForce:1e6,collideConnected:false});hinge.equations=hinge.equations.filter(e=>e!==hinge.motorEquation);addConstraint(hinge);
    pawlSpring=new Spring(anchor,pawl,{worldAnchorA:C(pivot.x-.16,pivot.y+.22,pivot.z),localAnchorB:C(-.12,0,0),restLength:.1,stiffness:50,damping:2});springs.push(pawlSpring);
   }
   if(config.rackSpring){rackSpring=new Spring(anchor,rack,{worldAnchorA:C(centre[0]-.3,centre[1]+2.70,centre[2]-1.04),localAnchorB:C(0,.35,0),restLength:.05,stiffness:35,damping:40});springs.unshift(rackSpring);}
   onPostStep=()=>cell.syncPose();owner.world.addEventListener('postStep',onPostStep);cell.syncPose(true);return true;
  },
  updateForces(dt){if(!(dt>0)||!cell.ensure())return;const step=owner.world.stepnumber;if(lastForceStep===step)return;lastForceStep=step;for(const s of springs)s.applyForce();},
  syncPose(reset=false){if(!cell.ensure())return;for(const p of rackParts)syncPart(p,rack,reset);for(const p of stopParts)syncPart(p,stops,reset);if(pawlPart)syncPart(pawlPart,pawl,reset);for(const t of teeth){const p=rack.quaternion.vmult(t.offset);t.mesh.position.set(rack.position.x+p.x,rack.position.y+p.y,rack.position.z+p.z);t.mesh.quaternion.copy(rack.quaternion);t.mesh.updateWorldMatrix(true,false);}springs.forEach((s,i)=>{const a=C(),b=C();s.getWorldAnchorA(a);s.getWorldAnchorB(b);const delta=V(b.x-a.x,b.y-a.y,b.z-a.z),mesh=springMeshes[i];mesh.position.set(a.x,a.y,a.z);mesh.scale.set(1,delta.length(),1);mesh.quaternion.setFromUnitVectors(UP,delta.normalize());});},
  reset(){if(!cell.ensure())return;place(rack,rackOrigin);if(pawl)place(pawl,C(pivot.x-.14,pivot.y,pivot.z));lastForceStep=-1;owner.world.broadphase.dirty=true;cell.syncPose(true);},
  diagnostics(){if(!cell.ensure())return{ready:false,disposed,config};const a=C(),b=C();return{ready:true,disposed,config,worldStep:owner.world.stepnumber,rack:{id:rack.id,y:rack.position.y,travel:upperY-rack.position.y,velocity:rack.velocity.toArray(),angularVelocity:rack.angularVelocity.toArray()},pawl:pawl?{id:pawl.id,angle:2*Math.atan2(pawl.quaternion.z,pawl.quaternion.w),omega:pawl.angularVelocity.z}:null,springs:springs.map(s=>{s.getWorldAnchorA(a);s.getWorldAnchorB(b);return{length:a.distanceTo(b),restLength:s.restLength,stiffness:s.stiffness,damping:s.damping};}),bodyIds:bodies.map(b=>b.id),constraintEquationCounts:constraints.map(c=>c.equations.length),originalCargoBodyId:cell.originalCargoBody.id};},
  dispose(){if(disposed)return;disposed=true;if(owner){if(onPostStep)owner.world.removeEventListener('postStep',onPostStep);for(const c of constraints)owner.world.removeConstraint(c);for(const b of bodies)owner.world.removeBody(b);for(const p of [...rackParts,...stopParts,...(pawlPart?[pawlPart]:[])]){p.collider.enabled=false;delete p.collider.orientedBox;}}},
 };
 return cell;
}
