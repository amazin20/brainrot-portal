import * as THREE from 'three';
import {Body,Box,Vec3,Material} from 'cannon-es';
import {ResearchChamber} from './LabResearchArt.js';
import {cargoLoadsPlate} from './LabPlateContact.js';
const V=(...p)=>new THREE.Vector3(...p),Q=()=>new THREE.Quaternion(),Z=V(0,0,1);
export const CREATIVE_ROOM17_SPEC=Object.freeze({id:'foundation-cable-supported-architecture',title:'Свободный конец',accent:0xe8b775,assets:[1,2,11],
 concept:'Текущая геометрия портального троса несёт свободный конец пола. Друг нагружает настоящий скользящий упор анкера; верхняя и нижняя ветви создают мост и наклонный путь.',
 description:'У пролёта только одна постоянная опора. Верни второй конец связи в защищённый анкер и выбери форму переправы. На постоянной дальней полке можно одолжить ту же пару, забрать друга и выйти вместе.',
 hints:['Защитная щель пропускает заряд, но не тело. Свободный друг проходит через низкую боковую керамику в анкерный карман.',
 'Трос проходит через глазок щёк и щель скользящего упора. Он держит пол только пока текущая пара соединяет анкер с одной из двух высоких ветвей.',
 'Верхняя ветвь даёт прямой мост; нижняя — спуск на отдельную галерею. Сначала выйди на постоянную опору, затем верни друга из его поддерживающего пола.']});
function line(k,mat,name){const mesh=k.geometry(new THREE.CylinderGeometry(.045,.045,1,8),mat,[0,0,0],Q(),{batch:false,name});return{mesh,set(a,b,on){mesh.visible=on;if(!on)return;const d=b.clone().sub(a);mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.scale.y=d.length();mesh.quaternion.setFromUnitVectors(V(0,1,0),d.normalize());}};}
/** This is a supported floor, not a cargo-weight gate. The same tension acts
 * on the actual original body and on the beam's current lever arm. Its angle
 * is integrated from forces; no chosen panel supplies an angle target. */
export function buildCreative17(g,index=16){
 const k=new ResearchChamber(g,CREATIVE_ROOM17_SPEC,index,'kinetic',{minX:-30,maxX:30,minZ:-27,maxZ:54},-10,27);
 const start=k.deck('Founded departure gallery',-28,-8,-12,20,6);
 k.ramp('Dry sixteen-metre recovery incline',-28,-20,20,51,6,-10);
 const upperDock=k.deck('Permanent upper receiving gallery',10.1,28,-4,4,6);
 const lowerDock=k.deck('Independent lower receiving gallery',12.4,28,-4,20,-1.2);
 k.ramp('Far gallery independent ascent',20,28,4,20,6,-1.2);
 // Neither receiving dock can be climbed from the deep dry floor. Supports
 // are founded closed columns, rather than hidden stepping ledges.
 const feed=k.loadPad('support-freight-floor',[-16,6,12],8);feed.surface.mesh.userData.portalSize={width:1.15,height:1.15};
 const small=(name,p,n,w=3.2,h=1.8)=>{const a=k.panel(name,p,n,w,h);a.mesh.userData.portalSize={width:1.2,height:.75};return a;};
 const highLead=small('support-upper-branch',[-8,19,-4],[0,0,1]);
 const lowLead=small('support-lower-branch',[-8,13.4,-4],[0,0,1]);
 // Founded mast lies behind the front-facing ceramic and behind both real
 // cable branches. There is no passenger portal on the receiving shore.
 k.block([-8,8.3,-4.85],[1,36.6,1],'shell');
 const mouth=small('support-anchor-delivery',[-19.4,-9.05,-15.65],[1,0,0],3.0,1.8);mouth.mesh.userData.portalSize={width:.8,height:.75};
 const anchor=small('support-anchor-cable',[-18,-8.95,-18],[0,0,1],2.8,1.8);
 const retrieval=k.panel('support-anchor-floor',[-18,-9.98,-15.65],[0,1,0],3.2,2.0);
 retrieval.mesh.userData.portalSize={width:.8,height:.8};
 const cargoReceiver=small('support-far-receiver',[26,7.1,0],[-1,0,0],3.2,2.2);cargoReceiver.mesh.userData.portalSize.height=.95;
 // A closed low freight housing. A 65cm sight slit cannot admit the .78m
 // cube in any orientation; the portal mouth is the only body entrance.
 k.block([-20.05,-9,-16.05],[.35,2,4.1],'shell');
 k.block([-15.95,-9.75,-16.05],[.35,.5,4.1],'shell');
 k.block([-15.95,-8.325,-16.05],[.35,1.05,4.1],'shell');
 k.block([-18,-9,-18.5],[4.45,2,.35],'shell');
 k.block([-18,-7.85,-16.05],[4.45,.3,4.1],'shell');
 k.block([-18,-9.75,-14.2],[4.45,.5,.35],'shell');
 k.block([-18,-8.325,-14.2],[4.45,1.05,.35],'shell');
 // The original body is drawn against the two front faces. The cable and
 // actual portal shot pass through their .24m eye; do not ignore these solids.
 const cheeks=[];
 for(const [a,b]of [[-20,-18.12],[-17.88,-16]]){k.block([(a+b)/2,-9.3,-16.8],[b-a,1.4,.30],'metal');cheeks.push(k.envelopes.at(-1));}
 // The retrieved body's supporting skin owns exactly its own housing floor.
 retrieval.mesh.userData.portalBackingIds=k.envelopes.filter(c=>c.box.min.y<-9.99&&c.box.max.y<=-9.98).map(c=>c.mesh.uuid);
 const anchorEye=V(-18,-9.59,-16.59);
 k.geometry(new THREE.TorusGeometry(.095,.03,8,18),'metal',anchorEye.toArray(),Q(),{name:'Real thin-cable eye between anchor cheeks'});
 // A guided, full-width spring face returns the original body by contact.
 // Its cross-shaped sight/cable slot is too small for the .78m cube. The
 // central vertical slit preserves the real anchor shot; the horizontal
 // band lets the cable reach a body displaced sideways without crossing metal.
 const parts=[{x:0,y:-.82,w:3.5,h:.16},{x:-.935,y:.275,w:1.63,h:1.24},{x:.935,y:.275,w:1.63,h:1.24}];
 const head=new THREE.Group();head.position.set(-18,-9.05,-16.2);k.world.root.add(head);
 for(const a of parts){const mesh=k.geometry(new THREE.BoxGeometry(a.w,a.h,.24),'metal',[a.x,a.y,0],Q(),{parent:head,batch:false,name:'Spring-return face around real sight and cable slots'});g.aimBlockers.push(mesh);g.cameraBlockers.push(mesh);}
 const plungers=[{mesh:head,x:-18,body:null,parts}];
 const ejector={owner:null,ensure(){if(!g.physics||this.owner===g.physics)return;this.owner=g.physics;for(const p of plungers){p.body=new Body({mass:1.2,position:new Vec3(p.x,-9.05,-16.2),linearFactor:new Vec3(0,0,1),fixedRotation:true,linearDamping:.2,material:new Material({friction:.2,restitution:0}),collisionFilterGroup:1,collisionFilterMask:2});for(const a of p.parts)p.body.addShape(new Box(new Vec3(a.w/2,a.h/2,.12)),new Vec3(a.x,a.y,0));this.owner.world.addBody(p.body);}},forces(){this.ensure();for(const p of plungers){const b=p.body;b.force.y+=b.mass*19.5;b.force.z+=(-16.2-b.position.z)*400-b.velocity.z*38;b.wakeUp();if(b.position.z< -16.53){b.position.z=-16.53;b.velocity.z=Math.max(0,b.velocity.z);}if(b.position.z> -16.2){b.position.z=-16.2;b.velocity.z=Math.min(0,b.velocity.z);}}},update(){this.ensure();for(const p of plungers)p.mesh.position.set(p.body.position.x,p.body.position.y,p.body.position.z);},reset(){this.ensure();for(const p of plungers){p.body.position.set(p.x,-9.05,-16.2);p.body.velocity.setZero();p.body.force.setZero();p.body.wakeUp();}this.update();}};
 // Rear face meets the founded cheeks at -16.65. Front guide collars arrest
 // extension at the actual head face -16.08; these are prismatic-joint stops.
 for(const x of [-19.3,-16.7]){k.geometry(new THREE.CylinderGeometry(.13,.13,.70,10),'dark',[x,-9.59,-16.42],Q().setFromAxisAngle(V(1,0,0),Math.PI/2),{name:'Fixed guided return spring sleeve'});k.geometry(new THREE.TorusGeometry(.15,.035,8,16),'metal',[x,-9.59,-16.08],Q(),{name:'Fixed spring slider extension-stop collar'});}
 k.forces.push(()=>ejector.forces());k.ticks.push(()=>ejector.update());k.resets.push(()=>ejector.reset());
 const hinge=V(-8,6,0),length=18,width=8,thickness=.32;
 const beamMesh=k.geometry(new THREE.BoxGeometry(length,thickness,width),'floor',[1,5.84,0],Q(),{batch:false,name:'Continuously cable-supported walking floor'});
 g.aimBlockers.push(beamMesh);g.cameraBlockers.push(beamMesh);
 const pieces=[];
 for(let n=0;n<36;n++){const c=g.collisionProxy(new THREE.Box3().setFromCenterAndSize(V(-8+(n+.5)*.5,5.84,0),V(.5,thickness,width)),{kinematic:true});c.walkablePlane=true;c.solidUnderside=true;pieces.push(c);}
 const floor={minX:-8,maxX:10,minZ:-4,maxZ:4,y:6,mesh:beamMesh,enabled:true,
  heightAt(x,z){if(Math.abs(z)>4)return null;const cos=Math.cos(beam.angle),s=(x+8)/cos;if(s<0||s>length)return null;return 6+s*Math.sin(beam.angle);},
  normalAt:()=>V(-Math.sin(beam.angle),Math.cos(beam.angle),0)};
 g.floors.push(floor);k.world.floors.push(floor);
 for(const c of pieces)c.frontPlane=()=>({center:hinge.clone().add(V(length/2*Math.cos(beam.angle),length/2*Math.sin(beam.angle),0)),normal:floor.normalAt(),right:V(Math.cos(beam.angle),Math.sin(beam.angle),0),up:V(0,0,1),halfWidth:9,halfHeight:4});
 // The beam's lower catch is not a useful receiving pose. Its physical
 // resting tip stays more than four metres below the lower route.
 for(const z of [-4.3,4.3])k.block([-8,-2,z],[.6,16,.6],'shell');
 k.geometry(new THREE.CylinderGeometry(.45,.45,9.2,18),'metal',[-8,5.55,0],Q().setFromAxisAngle(V(1,0,0),Math.PI/2),{name:'Founded architectural hinge bearing'});
 // Two founded side jaws meet the rotating ears at zero angle. They only
 // arrest upward overtravel; the ears leave them freely when support is lost.
 for(const z of [-4.45,4.45]){k.block([-7.25,6,z],[1,.3,.65],'metal');k.geometry(new THREE.BoxGeometry(.8,.3,.65),'metal',[-8.25,-.14,z],Q(),{parent:beamMesh,batch:false,name:'Rotating upper-stop ear outside the walking width'});}
 k.block([5,-5.8286,0],[2.1,.8,8.8],'dark');
 const ropeMat=new THREE.MeshStandardMaterial({name:'Continuous braided support cable',color:0xcbad78,roughness:.74,metalness:.34});
 const near=line(k,ropeMat,'Near support branch'),far=line(k,ropeMat,'Far original-body branch'),guide=line(k,ropeMat,'Fixed anchor fairlead branch'),inlet=line(k,ropeMat,'Inlet collar'),outlet=line(k,ropeMat,'Outlet collar');
 const eye=k.geometry(new THREE.TorusGeometry(.22,.055,8,18),'metal',[0,0,0],Q(),{batch:false,name:'Free-end structural cable eye'});
 const sleeve=k.geometry(new THREE.TorusGeometry(.52,.055,8,24),ropeMat,[0,0,0],Q(),{batch:false,name:'Original cargo endpoint harness'});
 function clear(a,b,owners){const ignored=new Set(owners.flatMap(p=>[p.surfaceId,...(p.anchor?.userData?.portalBackingIds??[])])),d=b.clone().sub(a),len=d.length();if(len<.01)return true;const ray=new THREE.Ray(a.clone(),d.normalize()),hit=V();for(const c of g.colliders){if(c.enabled===false||ignored.has(c.mesh.uuid)||pieces.includes(c))continue;if(ray.intersectBox(c.box,hit)&&hit.distanceTo(a)>.06&&hit.distanceTo(a)<len-.06)return false;}for(const p of plungers)if(p.body)for(const part of p.parts){const box=new THREE.Box3().setFromCenterAndSize(V(p.body.position.x+part.x,p.body.position.y+part.y,p.body.position.z),V(part.w,part.h,.24));if(ray.intersectBox(box,hit)&&hit.distanceTo(a)>.06&&hit.distanceTo(a)<len-.06)return false;}return true;}
 for(const p of [highLead,lowLead]){const f=p.getFrame();k.geometry(new THREE.CylinderGeometry(.055,.055,1,10),'metal',f.center.clone().addScaledVector(f.normal,.5).toArray(),Q().setFromUnitVectors(V(0,1,0),f.normal),{name:'Normal support fairlead neck in the actual aperture'});k.geometry(new THREE.TorusGeometry(.13,.035,8,18),'metal',f.center.clone().addScaledVector(f.normal,1).toArray(),Q(),{name:'Founded forward support fairlead'});}
 const beam={angle:-.67,previousAngle:-.67,omega:0,mass:8,inertia:864,gravity:19.5,restLength:24.80,stiffness:4000,ropeDamping:30,angularDamping:1500,maxTension:900,maxExtension:8,tension:0,stretch:0,path:null,
  point(s,dy=0){return hinge.clone().add(V(s*Math.cos(this.angle)-dy*Math.sin(this.angle),s*Math.sin(this.angle)+dy*Math.cos(this.angle),0));},
  cablePath(){if(!g.portals.ready||!g.cargo)return null;const ps=g.portals.portals,e=ps.find(p=>p.surfaceId===highLead.mesh.uuid||p.surfaceId===lowLead.mesh.uuid),q=ps.find(p=>p.surfaceId===anchor.mesh.uuid);if(!e||!q||e===q)return null;const B=this.point(length,.55),C=g.cargo.position.clone(),P=e.position.clone().addScaledVector(e.normal,1),D=q.position.clone().addScaledVector(q.normal,.15);if(!clear(B,P,[e,q])||!clear(D,anchorEye,[e,q])||!clear(anchorEye,C,[e,q]))return null;const n=P.clone().sub(B),f=C.clone().sub(anchorEye),a=n.length(),b=f.length();if(a<.01||b<.01)return null;return{B,C,P,D,entry:e,exit:q,near:n.divideScalar(a),far:f.divideScalar(b),length:a+D.distanceTo(anchorEye)+b+1.15};},
  forces(){const b=g.physics?.cargoBody;if(!b)return;this.path=this.cablePath();this.tension=this.stretch=0;if(!this.path||this.path.length>this.restLength+this.maxExtension){this.path=null;return;}const p=this.path,r=p.B.clone().sub(hinge),eyeV=V(-this.omega*r.y,this.omega*r.x,0),cargoV=V(b.velocity.x,b.velocity.y,b.velocity.z),rate=cargoV.dot(p.far)-eyeV.dot(p.near);this.stretch=Math.max(0,p.length-this.restLength);this.tension=Math.min(this.maxTension,Math.max(0,this.stretch*this.stiffness+rate*this.ropeDamping));for(const a of ['x','y','z'])b.force[a]-=p.far[a]*this.tension;if(this.tension)b.wakeUp();},
  pose(dt){beamMesh.position.copy(this.point(length/2,-thickness/2));beamMesh.quaternion.setFromAxisAngle(Z,this.angle);beamMesh.updateWorldMatrix(true,false);const matrix=new THREE.Matrix4().compose(hinge,Q().setFromAxisAngle(Z,this.angle),V(1,1,1));for(let n=0;n<pieces.length;n++){const box=new THREE.Box3().setFromCenterAndSize(V((n+.5)*.5,-thickness/2,0),V(.5,thickness,width)).applyMatrix4(matrix);g.syncCollision(pieces[n],box,dt);}floor.minX=-8;floor.maxX=-8+length*Math.cos(this.angle);floor.y=6;eye.position.copy(this.point(length,.55));},
  update(dt){const y=floor.heightAt(g.playerPosition.x,g.playerPosition.z),aboard=g.playerGrounded&&y!==null&&Math.abs(g.playerPosition.y-y)<.22,s=aboard?Math.max(0,(g.playerPosition.x+8)/Math.cos(this.angle)):0;this.previousAngle=this.angle;const r=this.point(length,.55).sub(hinge),pull=this.path?this.tension*(r.x*this.path.near.y-r.y*this.path.near.x):0,passengerMass=3.2+(g.heldCube?(g.physics?.cargoBody?.mass??3.2):0),cargoFrame={center:this.point(length/2),normal:floor.normalAt(),right:V(Math.cos(this.angle),Math.sin(this.angle),0),up:Z,halfWidth:length/2,halfHeight:width/2},looseCargo=cargoLoadsPlate(g.cargo,g.heldCube,cargoFrame),cargoArm=looseCargo?Math.max(0,g.cargo.position.clone().sub(hinge).dot(cargoFrame.right)):0,gravityTorque=-this.gravity*(this.mass*length/2+(aboard?passengerMass*s:0)+(looseCargo?(g.physics?.cargoBody?.mass??3.2)*cargoArm:0))*Math.cos(this.angle);if(dt){this.omega+=(pull+gravityTorque-this.angularDamping*this.omega)/this.inertia*dt;this.angle=THREE.MathUtils.clamp(this.angle+this.omega*dt,-.67,0);if(this.angle===-.67&&this.omega<0||this.angle===0&&this.omega>0)this.omega=0;}this.pose(dt);if(aboard&&dt){const next=floor.heightAt(g.playerPosition.x,g.playerPosition.z);if(next!==null){g.playerPosition.y+=next-y;g.previousPlayerPosition.y+=next-y;}}const p=this.cablePath();near.set(this.point(length,.55),p?.P??hinge,!!p);guide.set(p?.D??hinge,anchorEye,!!p);far.set(anchorEye,p?.C??hinge,!!p);inlet.set(p?.entry.position??hinge,p?.P??hinge,!!p);outlet.set(p?.exit.position??hinge,p?.D??hinge,!!p);sleeve.visible=!!p;if(p)sleeve.position.copy(p.C);},
  reset(){this.angle=this.previousAngle=-.67;this.omega=this.tension=this.stretch=0;this.path=null;this.update(0);}
 };
 k.forces.push(()=>beam.forces());k.ticks.unshift(dt=>beam.update(dt));k.resets.push(()=>beam.reset());
 k.label('17 / СВОБОДНЫЙ КОНЕЦ',[-28.2,13,12],[1,0,0],18,1.0);
 k.label('ОБЗОР 65 см · ГРУЗОВАЯ ЯЧЕЙКА',[-18,-6.3,-13.85],[0,0,1],9,.7);
 k.display([-8,9.6,-3.5],()=>`ОПОРА ${beam.tension.toFixed(0)} Н\nУГОЛ ${THREE.MathUtils.radToDeg(beam.angle).toFixed(1)}°`,7,1.6,[0,0,1]);
 k.routes.push({name:'live horizontal support branch',width:8,headroom:10},{name:'live descending support branch and independent ascent',width:8,headroom:7.2},{name:'dry recovery incline',width:8,headroom:30});
 const l=k.finishResearch([-22,6,12],[-18,6.57,10],[24,6,0],{creativeEarly:17,researchChamber:false,foundationChamber:false,beam,feed,highLead,lowLead,mouth,anchor,retrieval,cargoReceiver,upperDock,lowerDock,start,cheeks,ejector,plungers,cargoOnAnyPad:()=>feed.loaded()||cargoLoadsPlate(g.cargo,g.heldCube,retrieval.getFrame()),spawnView:{yaw:.2,pitch:-.08}});
 l.puzzleGeometry={noProgressFlags:true,recoveryFloor:-10,orders:['upper-branch','lower-branch'],portalRoles:{'support-freight-floor':'original loose endpoint delivery','support-upper-branch':'high current support triangle','support-lower-branch':'lower current support triangle','support-anchor-delivery':'cargo-only side entry into real anchor','support-anchor-cable':'current cable through actual stop eye','support-anchor-floor':'reclaim the grounded original endpoint','support-far-receiver':'cargo-only reunion after permanent landing'},deductions:['the original body loads a real guided stop backed by founded cheeks','current cable direction supplies architectural torque','two continuous support geometries give independent walkable routes','reassigning the same pair removes support without a stored completion bit']};
 const dispose=l.dispose;l.dispose=()=>{ropeMat.dispose();for(const p of plungers)if(p.body&&ejector.owner?.world)ejector.owner.world.removeBody(p.body);dispose();};return l;
}
