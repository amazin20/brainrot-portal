import * as THREE from 'three';
import {Body,Box,Vec3,Material,HingeConstraint,LockConstraint} from 'cannon-es';
import {ResearchChamber} from './LabResearchArt.js';
import {dressPuzzleProgression50} from './LabPuzzleProgression50Art.js';
const V=(...p)=>new THREE.Vector3(...p),Q=()=>new THREE.Quaternion();
export const PROGRESSION50_SPEC=Object.freeze({id:'puzzle-progression50-folded-rift',title:'Складной разлом',accent:0xf2bf8a,assets:[1,2,11],concept:'Живой вес в двух противоположных подвесных чашах вращает общую раму с двумя порталами. Извлечение того же груза возвращает настоящий шарнир и поворачивает уже установленный выход из стены в пол.',description:'Две противоположные чаши, один общий шарнир и неподвижные галереи. Портал остаётся на своей створке, когда вес меняет её ориентацию.',hints:['Подвесные чаши сохраняют горизонт под собственным весом. Нагруженная чаша поворачивает общую раму до настоящего упора.','Постоянная галерея сохраняет достигнутый ракурс, пока рама возвращается. Установленный портал следует за своей створкой.','Когда груз покидает вторую чашу, тот же выход возвращается из стены в верхний пол.']});
function proxy(k,mesh,name){mesh.updateWorldMatrix(true,false);const c={mesh,box:new THREE.Box3().setFromObject(mesh),enabled:true,kinematic:true};mesh.name=name;k.game.colliders.push(c);k.game.cameraBlockers.push(mesh);k.game.aimBlockers.push(mesh);return c;}
/** Keep the production opening ID, but solve cargo against the actual OBB.
 * Axis-aligned player/ray broadphase remains separate from Cannon contact. */
function syncPortalObbs(g,surface,parent,dt){
 const quaternion=surface.group.getWorldQuaternion(Q());
 surface.mesh.geometry.computeBoundingBox();surface.mesh.updateMatrix();
 const skin=surface.mesh.geometry.boundingBox.clone().applyMatrix4(surface.mesh.matrix);
 for(const c of [surface.collider,...surface.frameColliders]){
  const item=g.physics.solids.get(c.mesh.uuid);if(!item)continue;
  const local=c===surface.collider?skin:c.local,half=local.getSize(V()).multiplyScalar(.5),center=local.getCenter(V()).applyMatrix4(surface.group.matrixWorld),b=item.body;
  const shape=b.shapes[0];shape.halfExtents.set(half.x,half.y,half.z);shape.updateConvexPolyhedronRepresentation();shape.updateBoundingSphereRadius();b.updateBoundingRadius();
  b.position.copy(center);b.quaternion.copy(quaternion);b.angularVelocity.copy(parent.angularVelocity);
  const offset=new Vec3(center.x-parent.position.x,center.y-parent.position.y,center.z-parent.position.z),velocity=parent.angularVelocity.cross(offset);velocity.vadd(parent.velocity,velocity);
  b.velocity.copy(velocity);item.target.set(center.x+velocity.x*dt,center.y+velocity.y*dt,center.z+velocity.z*dt);item.remaining=dt;b.aabbNeedsUpdate=true;
 }
 g.physics.world.broadphase.dirty=true;
}
/** One true dynamic rotor, two gravity-levelled pendulum cups, three hinges.
 * The only actuator is a torsional spring. Weight reaches the real stop by
 * cargo/cup contact; no target angle, latch, clamp or motor drives the rotor. */
function foldingRotor(k){
 const g=k.game,root=new THREE.Group();root.name='50 / common physical folding rotor';root.position.set(0,16,0);k.world.root.add(root);
 const beam=k.block([0,0,0],[20,.5,.8],'metal',false,root),stopBeam=k.block([0,0,8],[20,.3,.6],'secondary',false,root),parts=[proxy(k,beam,'50 / common rigid axle beam'),proxy(k,stopBeam,'50 / actual stop contact arm')];
 for(const x of [-8,8])k.block([x,3,0],[.25,6,.25],'metal',false,root);
 const paneA=k.panel('fold-a',[-7,6,-9],[0,1,0],7.7,5.4,root,true),paneB=k.panel('fold-b',[7,6,-12],[0,1,0],7.7,5.4,root,true);
 // Segment the long frame members before rotating. Their broadphase bounds
 // must not fill the visible opening with the diagonal wedge of one beam.
 for(const pane of [paneA,paneB]){
  for(const c of pane.frameColliders){const s=c.local.getSize(V()),axis=s.x>s.y?'x':'y',count=Math.ceil(s[axis]/.45);if(count<2)continue;
   c.enabled=false;const center=c.local.getCenter(V());for(let i=0;i<count;i++){const at=center.clone(),size=s.clone();at[axis]+=s[axis]*((i+.5)/count-.5);size[axis]/=count;const local=new THREE.Box3().setFromCenterAndSize(at,size),copy=g.collisionProxy(local.clone().applyMatrix4(pane.group.matrixWorld),{kinematic:true});copy.local=local;copy.mesh.name='50 / rotating segmented porcelain frame';pane.frameColliders.push(copy);}
  }
 }
 const cups=[];
 for(const [name,x]of [['a',-8],['b',8]]){
  const group=new THREE.Group();group.name='50 / gravity suspended cup '+name;group.position.set(x,21,0);k.world.root.add(group);
  const depth=name==='b'?8:2.4;
  const floor=k.block([0,-1,0],[3.4,.3,depth],'metal',false,group),meshes=[floor];
  for(const dx of [-1.85,1.85])meshes.push(k.block([dx,dx<0?2:-.1,0],[.3,dx<0?6:2,depth+.3],'secondary',false,group));
  meshes.push(k.block([0,-.1,name==='b'?4.15:1.35],[3.4,2,.3],'secondary',false,group));
  meshes.push(k.block([0,-.73,name==='b'?-4.15:-1.35],[3.4,.6,.3],'metal',false,group));
  // The first bowl is freight-only. Its real front lintel leaves a low E
  // inspection opening while the delivery from above stays unobstructed.
  const freightLintel=name==='a'?k.block([0,1.6,-1.35],[3.4,2.4,.3],'secondary',false,group):null;if(freightLintel)meshes.push(freightLintel);
  meshes.push(k.block([0,-7,0],[2,1.8,2],'metal',false,group));
  for(const x of [-.8,.8])meshes.push(k.block([x,-4,0],[.15,6,.15],'metal',false,group));
  const colliders=meshes.map((m,i)=>proxy(k,m,'50 / genuine '+name+' cup '+i));
  const feed=name==='a'?k.panel('cup-a-freight',[1.5,3.5,0],[-1,0,0],5,2.1,group,true):k.panel('cup-b-freight',[8,10,-1.5],[0,Math.cos(.7),-Math.sin(.7)],3.2,2.1,root,true);feed.mesh.userData.portalSize={width:name==='a'?2:.85,height:.85};
  // The freight aperture stands above the actual cup wall. A delivered cube
  // emerges inward over its rim, then gravity settles it on the real floor.
  cups.push({name,x,group,meshes,colliders,feed,freightLintel,body:null,hinge:null});
 }
 const stopMesh=k.block([0,25.8,8],[.6,1.4,1.6],'metal'),stopCollider=k.envelopes.at(-1);
 const hoodParts=[];const roof=k.geometry(new THREE.BoxGeometry(3.4,.24,3.0),'secondary',[8,12.3,-1.5],Q().setFromAxisAngle(V(1,0,0),-1.05),{parent:root,batch:false,name:'50 / true oblique rebound freight roof'});
 for(let i=0;i<12;i++){const local=new THREE.Box3().setFromCenterAndSize(V(0,0,-1.5+(i+.5)*.25),V(3.4,.24,.25)),c=g.collisionProxy(local.clone().applyMatrix4(roof.matrixWorld),{kinematic:true});c.local=local;c.mesh.name='50 / segmented low freight roof';hoodParts.push({collider:c,mesh:roof});}
 for(const x of [6.1,9.9]){const mesh=k.block([x,11.3,-1.3],[.3,2.6,3.4],'secondary',false,root);hoodParts.push({collider:proxy(k,mesh,'50 / low freight hood side'),mesh});}
 const counterweightMesh=k.block([0,-12,12],[4,3,2.4],'metal',false,root),counterweightCollider=proxy(k,counterweightMesh,'50 / rigid common lower counterweight');
 const f={owner:null,body:null,anchor:null,hinge:null,stop:null,hoodBody:null,counterweight:null,counterweightLock:null,root,parts,cups,paneA,paneB,angle:0,
  ensure(){if(!g.physics||this.owner===g.physics)return;this.owner=g.physics;
   for(const c of parts)g.physics.removeStaticBox(c.mesh.uuid);
   const material=new Material({friction:.85,restitution:0});this.material=material;
   this.anchor=new Body({mass:0,position:new Vec3(0,16,0),collisionFilterMask:0});this.body=new Body({mass:20,position:new Vec3(0,16,0),angularDamping:.05,allowSleep:false,material,collisionFilterGroup:1,collisionFilterMask:3});
   this.body.addShape(new Box(new Vec3(10,.25,.4)));this.body.addShape(new Box(new Vec3(10,.15,.3)),new Vec3(0,0,8));
   this.owner.world.addBody(this.anchor);this.owner.world.addBody(this.body);this.hinge=new HingeConstraint(this.anchor,this.body,{pivotA:new Vec3(),pivotB:new Vec3(),axisA:new Vec3(0,0,1),axisB:new Vec3(0,0,1),maxForce:1e6,collideConnected:false});this.owner.world.addConstraint(this.hinge);
   for(const p of hoodParts)g.physics.removeStaticBox(p.collider.mesh.uuid);this.hoodBody=new Body({mass:0,type:Body.KINEMATIC,allowSleep:false,material:new Material({friction:.2,restitution:.38}),collisionFilterGroup:1,collisionFilterMask:2});this.hoodBody.addShape(new Box(new Vec3(1.7,.12,1.5)),new Vec3(8,12.3,-1.5),new (this.body.quaternion.constructor)().setFromAxisAngle(new Vec3(1,0,0),-1.05));for(const x of [6.1,9.9])this.hoodBody.addShape(new Box(new Vec3(.15,1.3,1.7)),new Vec3(x,11.3,-1.3));this.owner.world.addBody(this.hoodBody);
   g.physics.removeStaticBox(counterweightCollider.mesh.uuid);this.counterweight=new Body({mass:3,position:new Vec3(0,4,12),shape:new Box(new Vec3(2,1.5,1.2)),allowSleep:false,material,collisionFilterGroup:1,collisionFilterMask:3});this.owner.world.addBody(this.counterweight);this.counterweightLock=new LockConstraint(this.body,this.counterweight,{maxForce:1e6,collideConnected:false});this.owner.world.addConstraint(this.counterweightLock);
   g.physics.removeStaticBox(stopCollider.mesh.uuid);this.stop=new Body({mass:0,position:new Vec3(0,25.8,8),shape:new Box(new Vec3(.3,.7,.8)),material,collisionFilterGroup:1,collisionFilterMask:3});this.owner.world.addBody(this.stop);
   for(const cup of cups){for(const c of cup.colliders)g.physics.removeStaticBox(c.mesh.uuid);
    const b=cup.body=new Body({mass:3,position:new Vec3(cup.x,14,0),angularDamping:.9,allowSleep:false,material,collisionFilterGroup:1,collisionFilterMask:3});
    b.addShape(new Box(new Vec3(1.7,.15,cup.name==='b'?4:1.2)),new Vec3(0,6,0));b.addShape(new Box(new Vec3(1,.9,1)),new Vec3());for(const x of [-.8,.8])b.addShape(new Box(new Vec3(.075,3,.075)),new Vec3(x,3,0));for(const dx of [-1.85,1.85])b.addShape(new Box(new Vec3(.15,dx<0?3:1,cup.name==='b'?4.15:1.35)),new Vec3(dx,dx<0?9:6.9,0));b.addShape(new Box(new Vec3(1.7,1,.15)),new Vec3(0,6.9,cup.name==='b'?4.15:1.35));b.addShape(new Box(new Vec3(1.7,.3,.15)),new Vec3(0,6.27,cup.name==='b'?-4.15:-1.35));
    if(cup.name==='a')b.addShape(new Box(new Vec3(1.7,1.2,.15)),new Vec3(0,8.6,-1.35));
    this.owner.world.addBody(b);cup.hinge=new HingeConstraint(this.body,b,{pivotA:new Vec3(cup.x,6,0),pivotB:new Vec3(0,8,0),axisA:new Vec3(0,0,1),axisB:new Vec3(0,0,1),maxForce:1e6,collideConnected:false});this.owner.world.addConstraint(cup.hinge);
   }
   this.preStep=()=>{const q=this.body.quaternion,a=Math.atan2(2*(q.w*q.z+q.x*q.y),1-2*(q.y*q.y+q.z*q.z));this.body.torque.z+=-100*a-750*this.body.angularVelocity.z;for(const c of cups)c.body.torque.z+=-700*c.body.angularVelocity.z;};
   this.owner.world.addEventListener('preStep',this.preStep);
  },forces(){this.ensure();},
  sync(dt=0){this.ensure();if(!this.body)return;root.position.copy(this.body.position);root.quaternion.copy(this.body.quaternion);root.updateWorldMatrix(true,true);this.angle=new THREE.Euler().setFromQuaternion(root.quaternion,'XYZ').z;
   for(const c of parts){c.box.setFromObject(c.mesh);g.physics.removeStaticBox(c.mesh.uuid);}for(const p of [paneA,paneB,cups[1].feed]){p.sync(dt);syncPortalObbs(g,p,this.body,dt);}this.hoodBody.position.copy(this.body.position);this.hoodBody.quaternion.copy(this.body.quaternion);this.hoodBody.velocity.copy(this.body.velocity);this.hoodBody.angularVelocity.copy(this.body.angularVelocity);this.hoodBody.aabbNeedsUpdate=true;for(const p of hoodParts){p.mesh.updateWorldMatrix(true,false);p.collider.box=p.collider.local?p.collider.local.clone().applyMatrix4(p.mesh.matrixWorld):new THREE.Box3().setFromObject(p.mesh);g.physics.removeStaticBox(p.collider.mesh.uuid);}for(const p of [cups[1].feed.collider,...cups[1].feed.frameColliders]){const s=g.physics.solids.get(p.mesh.uuid);if(s)s.body.material.friction=0;}counterweightCollider.box.setFromObject(counterweightMesh);g.physics.removeStaticBox(counterweightCollider.mesh.uuid);
   for(const cup of cups){cup.group.quaternion.copy(cup.body.quaternion);cup.group.position.set(0,7,0).applyQuaternion(cup.group.quaternion).add(V(cup.body.position.x,cup.body.position.y,cup.body.position.z));cup.group.updateWorldMatrix(true,true);for(const c of cup.colliders){c.box.setFromObject(c.mesh);g.physics.removeStaticBox(c.mesh.uuid);}if(cup.name==='a'){cup.feed.sync(dt);syncPortalObbs(g,cup.feed,cup.body,dt);}}
  },loaded(name){const c=cups.find(c=>c.name===name);return !g.heldCube&&c?.body&&this.owner.world.contacts.some(j=>(j.bi===c.body&&j.bj===g.physics.cargoBody)||(j.bj===c.body&&j.bi===g.physics.cargoBody));},
  reset(){this.ensure();this.body.position.set(0,16,0);this.body.quaternion.set(0,0,0,1);this.body.velocity.setZero();this.body.angularVelocity.setZero();this.body.force.setZero();this.body.torque.setZero();for(const c of cups){c.body.position.set(c.x,14,0);c.body.quaternion.set(0,0,0,1);c.body.velocity.setZero();c.body.angularVelocity.setZero();c.body.force.setZero();c.body.torque.setZero();}this.counterweight.position.set(0,4,12);this.counterweight.quaternion.set(0,0,0,1);this.counterweight.velocity.setZero();this.counterweight.angularVelocity.setZero();this.counterweight.force.setZero();this.counterweight.torque.setZero();this.sync(0);},
  dispose(){if(!this.owner)return;this.owner.world.removeEventListener('preStep',this.preStep);for(const h of [this.hinge,this.counterweightLock,...cups.map(c=>c.hinge)])this.owner.world.removeConstraint(h);for(const b of [this.body,this.anchor,this.stop,this.counterweight,this.hoodBody,...cups.map(c=>c.body)])this.owner.world.removeBody(b);this.owner=null;}
 };
 k.forces.push(()=>f.forces());k.ticks.push(dt=>f.sync(dt));k.renders.push(()=>f.sync(0));k.resets.push(()=>f.reset());k.state.rotor=f;return f;
}
export function buildPuzzleProgression50(game,index=49){
 const k=new ResearchChamber(game,PROGRESSION50_SPEC,index,'tidal',{minX:-42,maxX:32,minZ:-32,maxZ:34},-4,33);
 const departure=k.deck('Fold departure court',-36,-18,12,30,8),galleryA=k.deck('Permanent west cup gallery',-18,-4.3,-18,-1,6.1),galleryB=k.deck('Permanent east cup gallery',4.3,18,-18,10,6.1),goalDeck=k.deck('High returned portal court',1,17,-22,-5,22);
 k.ramp('Broad departure service return',-40,-32,-15,15,-4,8);k.deck('Service return head',-40,-24,15,25,8);
 const rotor=foldingRotor(k);

 const cargoFeed=k.loadPad('original-freight-feed',[-27,8,21],7);cargoFeed.surface.mesh.userData.portalSize={width:2,height:.85};
 const departureEntry=k.panel('departure-passenger',[-34,10.7,14],[0,0,1],7.7,5.4);
 const galleryFeed=k.loadPad('west-gallery-feed',[-12,6.1,-9],7),finalFeed=k.loadPad('east-gallery-feed',[11,6.1,-10],7);
 // The high, upward facing B throat is initially seen from its opaque back.
 // First-cup weight swings its face west; its existing address follows the
 // common frame on return. The lower divider closes the gallery jump gap.

 k.label('50 / СКЛАДНОЙ РАЗЛОМ',[-40.6,15,23],[1,0,0],12,1.0);
 k.label('ОБЩИЙ ШАРНИР',[0,29,5.9],[0,0,1],11,.9);k.label('ЗАПАДНАЯ ГАЛЕРЕЯ',[-14,6.135,-16],[0,1,0],7,.7);k.label('ВОСТОЧНАЯ ГАЛЕРЕЯ',[12,6.135,4],[0,1,0],7,.7);
 k.block([0,4.5,-7.5],[.8,17,35],'shell');
 // The west/south gallery casing hides its floor from the departure view.
 // The low inspection opening keeps the actual first cup within E reach.
 k.block([-18,7.6,-9.5],[.4,3,17],'shell');
 k.block([-13.35,7.6,-1],[9.3,3,.4],'shell');
 k.block([-4.85,7.6,-1],[1.1,3,.4],'shell');
 const art=dressPuzzleProgression50(k,{departure,galleryA,galleryB,goalDeck,rotor});
 const level=k.finishResearch([-29,8,28.5],[-30,8.6,27.5],[11,22,-18],{puzzleProgression:50,puzzleProgression50:true,rotor,cargoFeed,galleryFeed,finalFeed,departureEntry,art,spawnView:{yaw:.15,pitch:-.05},cargoOnAnyPad:()=>Math.hypot(game.cargo.position.x+30,game.cargo.position.z-27.5)<1.2&&game.cargo.position.y<9||rotor.loaded('a')||rotor.loaded('b')||cargoFeed.loaded()||galleryFeed.loaded()||finalFeed.loaded()});
 rotor.paneB.mesh.userData.portalBackingIds=goalDeck.record.portalBackingColliders.map(c=>c.mesh.uuid);
 const dispose=level.dispose;level.dispose=()=>{rotor.dispose();dispose();};
 level.getObjective=()=>PROGRESSION50_SPEC.description;
 level.getContextLesson=()=>['progression50-folded-rift','ЛКМ / ПКМ','Нагруженная подвесная чаша вращает общую раму. Портал закреплён на своей створке и поворачивается вместе с ней; постоянные галереи сохраняют опору после извлечения веса.',false];
 level.puzzleGeometry={noProgressFlags:true,phaseCount:11,recoveryFloor:-4,goalHeight:22,cargoThroatHeight:.85,dependencies:['deliver-original-cargo-into-first-pendulum-cup','weight-contact-turns-common-true-hinge-to-real-stop','rotating-first-pane-opens-fixed-west-gallery','address-opposite-freight-head-from-weight-exposed-view','prepare-gallery-floor-and-moving-freight-pair','remove-original-weight-and-let-the-actual-hinge-return','feed-original-weight-through-prepared-travelling-address','opposite-contact-weight-turns-hinge-to-second-real-stop','address-second-pane-from-opposite-service-view','prepare-final-gallery-floor-before-removing-second-weight','existing-second-aperture-rotates-into-upper-floor-and-transports-both-original-actors']};
 return level;
}
