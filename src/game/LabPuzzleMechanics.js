import * as THREE from 'three';
import {Body,Box,Vec3,Material} from 'cannon-es';
import {transformPortalPoint,transformPortalDirection,pointInsidePortal} from './LabPortals.js';
import {createArchitecturalGate} from './LabArchitecturalGate.js';
export const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const UP=V(0,1,0);
export const inRect=(p,r,margin=0)=>p.x>=r[0]-margin&&p.x<=r[1]+margin&&p.z>=r[2]-margin&&p.z<=r[3]+margin;

/** Light and air follow an actual ray, including opaque occlusion and the
 * same orthonormal portal mapping as the traveller. No receiver IDs are wired
 * to specific portal colours, coordinates or progress flags. */
export function tracePortalRay(game,origin,direction,{length=65,reflectors=[],bounces=6,medium='light'}={}){
 const segments=[];let o=origin.clone(),d=direction.clone().normalize(),remaining=length;
 for(let i=0;i<bounces&&remaining>.03;i++){
  let distance=remaining,kind='end',target=null,hitPoint=null;
  const ray=new THREE.Ray(o,d);
  for(const c of game.colliders){
   if(c.enabled===false||(c.opticallyTransparent&&medium==='light')||c.ignorePropagation)continue;
   const h=ray.intersectBox(c.box,V());if(!h)continue;
   const t=h.clone().sub(o).dot(d);if(t>.012&&t<distance){distance=t;kind='wall';}
  }
  if(game.portals?.ready)for(let k=0;k<2;k++){
   const p=game.portals.portals[k],den=d.dot(p.normal);if(den>=-.0001)continue;
   const t=p.position.clone().sub(o).dot(p.normal)/den,at=o.clone().addScaledVector(d,t);
   if(t>.012&&t<distance+.075&&pointInsidePortal(p,at,.03)){distance=t;kind='portal';target=k;hitPoint=at;}
  }
  for(const f of reflectors){
   const den=d.dot(f.normal);if(Math.abs(den)<.001)continue;
   const t=f.position.clone().sub(o).dot(f.normal)/den,at=o.clone().addScaledVector(d,t);
   if(t>.025&&t<distance&&at.distanceTo(f.position)<f.radius){distance=t;kind='mirror';target=f;hitPoint=at;}
  }
  const end=o.clone().addScaledVector(d,distance);segments.push({a:o.clone(),b:end,direction:d.clone(),length:distance,kind});remaining-=distance;
  if(kind==='portal'){
   const a=game.portals.portals[target],b=game.portals.portals[1-target];o=transformPortalPoint(hitPoint,a,b).addScaledVector(b.normal,.07);d=transformPortalDirection(d,a,b).normalize();
  }else if(kind==='mirror'){d.reflect(target.normal).normalize();o=end.clone().addScaledVector(d,.04);}else break;
 }
 return segments;
}
export function rayTouches(segments,position,radius=.46){
 return segments.some(s=>new THREE.Line3(s.a,s.b).closestPointToPoint(position,true,V()).distanceTo(position)<radius);
}
export function beamDrawing(world,color=0x79dce8,width=.025){
 const root=new THREE.Group();world.root.add(root);const lines=[];
 const geometry=new THREE.CylinderGeometry(1,1,1,8),material=new THREE.MeshBasicMaterial({color});
 for(let i=0;i<7;i++){const m=new THREE.Mesh(geometry,material);m.visible=false;root.add(m);lines.push(m);}
 return {root,update(segments){lines.forEach((m,i)=>{const s=segments[i];m.visible=!!s;if(!s)return;m.position.copy(s.a).add(s.b).multiplyScalar(.5);m.scale.set(width,s.length,width);m.quaternion.setFromUnitVectors(UP,s.direction);});}};
}
export function glass(world,position,size){
 const m=world.box(position,size,new THREE.MeshStandardMaterial({color:0x92c3cf,transparent:true,opacity:.18,roughness:.23,metalness:.12}));
 // Glass transmits light, not air, hands or portal shots.
 const c=world.game.colliders.find(c=>c.mesh===m);if(c)c.opticallyTransparent=true;
 return m;
}
export function wall(world,z,left,right,ceiling=10,gap=null){
 const blocks=gap?[[left,gap[0],0,ceiling],[gap[1],right,0,ceiling],[gap[0],gap[1],gap[2],ceiling]]:[[left,right,0,ceiling]];
 for(const [x0,x1,y0,y1]of blocks)if(x1>x0&&y1>y0)for(const sign of [-1,1])world.surface({name:'Sealed partition',position:[(x0+x1)/2,(y0+y1)/2,z+sign*.13],normal:[0,0,sign],width:x1-x0,height:y1-y0});
}
export function gate(world,z,roomWidth=24,ceiling=10){
 const game=world.game,g=createArchitecturalGate(game,{z,roomWidth,roomHeight:ceiling,constructWalls:false});wall(world,z,-roomWidth/2,roomWidth/2,ceiling,[-2.4,2.4,3.65]);
 g.mechanism.getFrameBoxes().forEach(b=>game.collisionProxy(b));const colliders=g.mechanism.getLeafBoxes().map(b=>game.collisionProxy(b,{kinematic:true}));
 return {...g,colliders,progress:0,previous:0,open:false,
  update(open,dt,time){this.open=!!open;this.previous=this.progress;
   const occupied=[game.playerPosition,game.cargo?.position].some(p=>p&&Math.abs(p.x)<2.5&&Math.abs(p.z-z)<1.6);
   this.progress=THREE.MathUtils.damp(this.progress,open||(this.progress>.8&&occupied)?1:0,5,dt);
   this.mechanism.update(this.progress,time);this.mechanism.getLeafBoxes().forEach((b,i)=>game.syncCollision(colliders[i],b,dt));},
  reset(){this.progress=this.previous=0;this.open=false;this.mechanism.update(0);},
  render(a,time){this.mechanism.update(THREE.MathUtils.lerp(this.previous,this.progress,a),time);}};
}
export function consoleNode(world,terminals,position,action,kind,lesson){
 const game=world.game,art=game.addProp(22,1.5,position,0,0);game.collisionProxy(new THREE.Box3().setFromObject(art));art.userData.gameplayRole=kind;
 const t={position:V(...position).add(V(0,.8,0)),art,action,kind,lesson};terminals.push(t);return t;
}
export function ringDevice(world,position,normal,color=0x82d9de,radius=.5){
 const g=new THREE.Group();g.position.fromArray(position);g.quaternion.setFromUnitVectors(V(0,0,1),V(...normal));world.root.add(g);
 const rim=new THREE.Mesh(new THREE.TorusGeometry(radius,.10,8,24),world.materials.trim);g.add(rim);
 const glow=new THREE.Mesh(new THREE.TorusGeometry(radius-.075,.026,6,24),new THREE.MeshBasicMaterial({color}));glow.position.z=.08;g.add(glow);
 const lens=new THREE.Mesh(new THREE.CircleGeometry(radius-.11,24),new THREE.MeshStandardMaterial({color:0x4e838e,metalness:.72,roughness:.2,side:THREE.DoubleSide}));lens.position.z=.025;g.add(lens);
 for(const s of [-1,1])world.box([s*(radius+.1),0,-.15],[.14,radius*1.3,.35],world.materials.trim,false,g);
 return {group:g,glow,lens};
}
export function rotorDevice(world,position,normal,radius=1.05){
 const device=ringDevice(world,position,normal,0xa6dfd1,radius);device.lens.visible=false;
 const rotor=new THREE.Group();device.group.add(rotor);
 for(let i=0;i<5;i++){const blade=world.box([0,radius*.48,0],[radius*.36,radius*.72,.07],world.materials.floor,false);const hub=new THREE.Group();hub.rotation.z=i*Math.PI*2/5;hub.add(blade);rotor.add(hub);}
 const cap=new THREE.Mesh(new THREE.SphereGeometry(.18,12,8),world.materials.trim);rotor.add(cap);
 return {...device,rotor};
}
/** One rotational degree of freedom with gravity moments, a restoring spring,
 * viscous damping, travel stops, and actual load positions. */
export function integrateBalance(state,torque,dt){
 if(!(dt>0))return;state.omega+=(torque-155*state.angle-165*state.omega)/280*dt;
 state.omega=THREE.MathUtils.clamp(state.omega,-.7,.7);state.angle+=state.omega*dt;
 if(Math.abs(state.angle)>.32){state.angle=THREE.MathUtils.clamp(state.angle,-.32,.32);state.omega=0;}
}
export function impactPiston(world,restZ=-8.5){
 const game=world.game,mesh=world.box([0,.85,restZ],[1.5,1.7,.4],world.materials.floor,false);
 const spring=new THREE.Mesh(new THREE.TorusGeometry(.36,.06,6,16),world.materials.accent);spring.rotation.x=Math.PI/2;spring.position.set(0,.85,restZ-1.7);world.root.add(spring);
 for(const x of [-1,1])world.box([x,.85,restZ-1.1],[.1,.1,3],world.materials.trim,false);
 const pawl=world.box([.95,1.65,restZ-.9],[.65,.12,.2],world.materials.accent,false);
 const p={body:null,latched:false,compression:0,mesh,pawl,restZ,
  ensure(){if(!game.physics)return;if(this.owner===game.physics)return;this.owner=game.physics;
   this.body=new Body({mass:4,position:new Vec3(0,.85,restZ),shape:new Box(new Vec3(.75,.85,.2)),fixedRotation:true,linearFactor:new Vec3(0,0,1),linearDamping:.05,material:new Material({friction:.08,restitution:.12}),collisionFilterGroup:1,collisionFilterMask:6});game.physics.world.addBody(this.body);
   this.collider={mesh,box:new THREE.Box3().setFromObject(mesh),enabled:true,kinematic:true};game.colliders.push(this.collider);game.cameraBlockers.push(mesh);game.aimBlockers.push(mesh);},
  reset(){this.ensure();this.latched=false;this.compression=0;if(this.body){this.body.position.set(0,.85,restZ);this.body.velocity.setZero();this.body.force.setZero();this.body.wakeUp();}this.render();},
  forces(){this.ensure();if(!this.body)return;const b=this.body;this.compression=Math.max(0,restZ-b.position.z);
   if(this.compression>1.12)this.latched=true;
   if(this.latched){b.position.z=restZ-1.2;b.velocity.setZero();b.force.setZero();b.type=Body.STATIC;}else{b.type=Body.DYNAMIC;b.force.z+=10*this.compression-2*b.velocity.z;if(b.position.z>restZ){b.position.z=restZ;b.velocity.z=Math.min(0,b.velocity.z);}}
   b.force.y+=b.mass*19.5;this.render();},
  render(){mesh.position.z=this.body?.position.z??restZ;if(this.collider)this.collider.box.setFromObject(mesh);pawl.rotation.x=this.latched?.75:0;spring.scale.y=Math.max(.25,1-this.compression*.45);}};
 return p;
}
