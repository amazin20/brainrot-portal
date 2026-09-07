import * as THREE from 'three';
import {Body,Box,Vec3,Material} from 'cannon-es';
import {LabTileWorld} from './LabTileWorld.js';
import {cargoLoadsPlate} from './LabPlateContact.js';
import {V,gate,wall,glass,consoleNode,terminalAccessible,tracePortalRay,rayTouches,beamDrawing} from './LabPuzzleMechanics.js';
export {V,wall,glass,tracePortalRay,rayTouches};
const UP=V(0,1,0),clamp=THREE.MathUtils.clamp;
export class Flywheel {
 constructor(){this.reset();}reset(){this.omega=this.angle=this.work=0;this.brake=false;}
 step(torque,load,dt){
  if(![torque,load,dt].every(Number.isFinite)||load<0||dt<0)throw new RangeError('Finite torque, nonnegative load and dt required');
  if(!dt)return 0;
  const rate=.32/3,equilibrium=(torque-load-(this.brake?10:0))/.32,old=this.omega;
  let h=dt;if(equilibrium<0)h=Math.min(dt,Math.max(0,-Math.log(-equilibrium/(old-equilibrium))/rate));
  const exp=Math.exp(-rate*h),turn=Math.max(0,equilibrium*h+(old-equilibrium)*(1-exp)/rate);
  this.omega=Math.max(0,equilibrium+(old-equilibrium)*exp);this.angle+=turn;
  const output=load*turn;this.work+=output;return output;
 }
 get energy(){return 1.5*this.omega*this.omega;}
}
/** All mechanisms use the production collider registry and the same cargo body.
 * Values describe actuator state, not a hidden progression/win checklist. */
export class Workshop {
 constructor(game,spec,index){
  this.game=game;this.spec=spec;this.index=index;this.time=0;this.panels={};this.terminals=[];this.ticks=[];this.renders=[];this.resets=[];this.forces=[];this.fixtures=[];this.state={};this.pads=[];
  this.world=new LabTileWorld(game,{wall:0x39424b,floor:0x626b75,sky:0x404b58,accent:spec.accent||0x81d4cb});
  this.world.root.userData.distinctConcept=spec.concept;
 }
 shell(bounds,ceiling=12,floor=0){this.bounds=bounds;this.world.walls(bounds,ceiling,Math.min(-1,floor-.3));this.world.floor(bounds.minX,bounds.maxX,bounds.minZ,bounds.maxZ,floor);this.ceiling=ceiling;return this;}
 panel(name,p,n,w=7,h=4.6,parent=this.world.root,moving=false){return this.panels[name]=this.world.surface({name,position:p,normal:n,width:w,height:h,portal:true,authored:false,parent,moving});}
 control(name,p,action,text){const t=consoleNode(this.world,this.terminals,p,()=>{action();this.game.audio?.mechanism?.('switch');this.game.animator?.triggerOperate?.();},name,text);this.state[name+'Control']=t;return t;}
 fixture(id,p,size=3,yaw=0){
  const art=this.game.model(id,size);art.position.fromArray(p);art.rotation.y=yaw;this.world.root.add(art);art.userData.gameplayRole=this.spec?.concept||'Physical mechanism';
  const moving=art.getObjectByName('Moving');let pivot=null;
  if(moving){art.updateWorldMatrix(true,true);const parent=moving.parent,center=parent.worldToLocal(new THREE.Box3().setFromObject(moving).getCenter(V()));pivot=new THREE.Group();pivot.position.copy(center);parent.add(pivot);pivot.add(moving);moving.position.sub(center);}
  const item={id,art,pivot,rest:pivot?.position.clone(),spin(angle,axis='z'){if(pivot)pivot.rotation[axis]=angle;},slide(v){if(pivot)pivot.position.copy(this.rest).add(v);}};this.fixtures.push(item);return item;
 }
 staticFixture(id,p,size=3,yaw=0){const f=this.fixture(id,p,size,yaw);this.game.collisionProxy(new THREE.Box3().setFromObject(f.art));return f;}
 door(z){const d=gate(this.world,z,this.bounds.maxX-this.bounds.minX,this.ceiling);this.renders.push(a=>d.render(a,this.time));this.resets.push(()=>d.reset());this.state.door=d;return d;}
 wire(points,powered=()=>false){const mat=new THREE.MeshBasicMaterial({color:0x856952});for(let i=1;i<points.length;i++){const a=V(...points[i-1]),b=V(...points[i]),d=b.clone().sub(a),m=this.world.box(a.add(b).multiplyScalar(.5).toArray(),[Math.abs(d.x)+.045,Math.abs(d.y)+.035,Math.abs(d.z)+.045],mat,false);}this.ticks.push(()=>mat.color.setHex(powered()?0x87e8c8:0x856952));}
 pad(name,p,w=3,h=3){const a=this.panel(name,[p[0],p[1]+.18,p[2]],[0,1,0],w,h,this.world.root,true),game=this.game;
  const f={minX:p[0]-w/2,maxX:p[0]+w/2,minZ:p[2]-h/2,maxZ:p[2]+h/2,y:p[1]+.18,mesh:a.mesh,enabled:true};game.floors.push(f);this.world.floors.push(f);
  const pad={surface:a,position:V(...p),pressed:false,progress:0,loaded:()=>cargoLoadsPlate(game.cargo,game.heldCube,a.getFrame()),player:()=>game.playerGrounded&&Math.abs(game.playerPosition.y-f.y)<.22&&Math.abs(game.playerPosition.x-p[0])<w/2&&Math.abs(game.playerPosition.z-p[2])<h/2};
  this.resets.push(()=>{pad.progress=0;pad.pressed=false;});this.pads.push(pad);this.ticks.push(dt=>{pad.pressed=pad.loaded()||pad.player();pad.progress=THREE.MathUtils.damp(pad.progress,pad.pressed?1:0,12,dt);a.group.position.y=p[1]+.18-.055*pad.progress;a.group.updateWorldMatrix(true,true);f.y=a.group.position.y;a.collider.box.setFromObject(a.mesh);game.physics?.updateStaticBox(a.mesh.uuid,a.collider.box,dt);});return pad;
 }
 slider(name,from,to,{width=4,depth=4,portal=true,asset=33,assetSize=3,wallSide=false}={}){
  const game=this.game,group=new THREE.Group();this.world.root.add(group);group.position.fromArray(from);
  const floor=this.world.surface({name:name+' deck',position:[0,0,0],normal:[0,1,0],width,height:depth,parent:group,moving:true});
  const f={minX:from[0]-width/2,maxX:from[0]+width/2,minZ:from[2]-depth/2,maxZ:from[2]+depth/2,y:from[1],mesh:floor.mesh,enabled:true};game.floors.push(f);this.world.floors.push(f);
  const art=this.fixture(asset,[from[0],from[1]-.5,from[2]],assetSize);art.art.updateWorldMatrix(true,true);const top=new THREE.Box3().setFromObject(art.art).max.y;art.art.position.y+=from[1]-.025-top;
  // The imported object is attached to the deck; the collision is invisible,
  // and there is no second coplanar surface to flicker.
  this.world.root.remove(art.art);group.attach(art.art);
  const panel=portal?this.panel(name,wallSide?[-width/2+.14,2,0]:[0,2,-depth/2+.08],wallSide?[1,0,0]:[0,0,1],wallSide?depth-.3:width-.3,4,group,true):null;
  const guards=[];
  if(portal){
   for(const [at,size] of [[[width/2-.08,.3,0],[.12,.60,depth]],[[0,.3,depth/2-.08],[width,.60,.12]]]){
    const mesh=this.world.box(at,size,this.world.materials.trim,false,group);
    const c={mesh,box:new THREE.Box3().setFromObject(mesh),enabled:true,kinematic:true};game.colliders.push(c);guards.push(c);
   }
  }
  const a=V(...from),b=V(...to),prev=a.clone(),delta=V();let t=0,prior=0;
  const m={name,group,floor:f,collider:floor.collider,mesh:floor.mesh,panel,art,progress:0,target:0,locked:false,rate:.16,position:a.clone(),
   update(dt){prior=t;prev.copy(m.position);if(!m.locked)t+=clamp(m.target-t,-m.rate*dt,m.rate*dt);m.progress=t;group.position.lerpVectors(a,b,t);m.position.copy(group.position);delta.copy(group.position).sub(prev);group.updateWorldMatrix(true,true);
    const p=game.playerPosition,wasOn=game.playerGrounded&&Math.abs(p.y-f.y)<.18&&p.x>f.minX-.1&&p.x<f.maxX+.1&&p.z>f.minZ-.1&&p.z<f.maxZ+.1;
    if(wasOn&&dt){p.add(delta);game.previousPlayerPosition.add(delta);}
    f.minX=group.position.x-width/2;f.maxX=group.position.x+width/2;f.minZ=group.position.z-depth/2;f.maxZ=group.position.z+depth/2;f.y=group.position.y;
    for(const s of [floor,panel].filter(Boolean)){s.collider.box.setFromObject(s.mesh);game.physics?.updateStaticBox(s.mesh.uuid,s.collider.box,dt);}
    for(const c of guards){c.box.setFromObject(c.mesh);game.physics?.updateStaticBox(c.mesh.uuid,c.box,dt);}
   },reset(){t=prior=0;m.progress=m.target=0;m.locked=false;group.position.copy(a);m.update(0);},render(alpha){group.position.lerpVectors(a,b,THREE.MathUtils.lerp(prior,t,alpha));},loaded(){return cargoLoadsPlate(game.cargo,game.heldCube,floor.getFrame());}};
  this.ticks.push(dt=>m.update(dt));this.resets.push(()=>m.reset());this.renders.push(a=>m.render(a));this.state[name]=m;return m;
 }
 fan(name,p,normal,{asset=31,radius=1.7}={}){
  const game=this.game,art=this.fixture(asset,[p[0],p[1]-1.4,p[2]],3.1,Math.atan2(-normal[0],-normal[2])),drawing=beamDrawing(this.world,0x9bcdd4,.035),origin=V(...p),direction=V(...normal).normalize();
  // Align the imported grille and give its housing a real collider.
  art.art.updateWorldMatrix(true,true);const bounds=new THREE.Box3().setFromObject(art.art),centre=art.pivot?.getWorldPosition(V())||bounds.getCenter(V());
  let edge=-Infinity;for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z])edge=Math.max(edge,V(x,y,z).dot(direction));
  const face=centre.clone().addScaledVector(direction,edge-centre.dot(direction));art.art.position.add(origin.clone().sub(face).addScaledVector(direction,-.10));art.art.updateWorldMatrix(true,true);
  const shell=new THREE.Box3().setFromObject(art.art);game.collisionProxy(shell);
  const floorY=p[1]-2.1;if(shell.min.y>floorY+.08)this.world.box([(shell.min.x+shell.max.x)/2,(shell.min.y+floorY)/2,(shell.min.z+shell.max.z)/2],[shell.max.x-shell.min.x,shell.min.y-floorY,shell.max.z-shell.min.z]);
  // Dust motes identify airflow without an abstract vector-arrow UI.
  const dust=new THREE.InstancedMesh(new THREE.SphereGeometry(.055,5,4),this.world.materials.accent,36);dust.frustumCulled=false;this.world.root.add(dust);const matrix=new THREE.Matrix4();let spin=0,spinSpeed=0;
  const fan={art,origin,direction,enabled:false,segments:[],speed:12,radius,update:dt=>{
   const targetSpin=fan.enabled?9:0,rate=fan.enabled?5:2.4;const oldSpin=spinSpeed;spinSpeed=THREE.MathUtils.damp(spinSpeed,targetSpin,rate,dt);spin+=targetSpin*dt+(oldSpin-targetSpin)*(1-Math.exp(-rate*dt))/rate;fan.rotorSpeed=spinSpeed;art.spin(spin);fan.segments=fan.enabled?tracePortalRay(game,origin,direction,{medium:'air',length:80}):[];drawing.update(fan.segments);dust.visible=fan.enabled;
   for(let i=0;i<36;i++){const s=fan.segments[i%Math.max(1,fan.segments.length)];if(!s)break;const u=(this.time*.25+i/36)%1,p=s.a.clone().addScaledVector(s.direction,s.length*u);matrix.makeTranslation(p.x+Math.sin(i*4)*.35,p.y+Math.cos(i*5)*.35,p.z);dust.setMatrixAt(i,matrix);}dust.instanceMatrix.needsUpdate=true;
  },touch:point=>rayTouches(fan.segments,point,radius),acceleration:(p,v)=>{
   for(const s of fan.segments){const off=p.clone().sub(s.a),u=off.dot(s.direction);if(u<0||u>s.length)continue;off.addScaledVector(s.direction,-u);if(off.length()>radius)continue;return s.direction.clone().multiplyScalar(clamp((fan.speed-v.dot(s.direction))*5,-30,65));}return V();
  }};this.ticks.push(fan.update);this.resets.push(()=>{fan.enabled=false;fan.segments=[];spin=spinSpeed=0;fan.rotorSpeed=0;art.spin(0);});this.state[name]=fan;return fan;
 }
 turbine(name,p){const art=this.fixture(35,[p[0],p[1]-1.1,p[2]],2.5),wheel=new Flywheel(),indicator=this.world.box([p[0]+1.2,p[1],p[2]],[.12,1.8,.10],this.world.materials.accent,false);
  const t={wheel,art,position:V(...p),power:false,clutch:false,update(dt){wheel.step(t.power?24:0,t.clutch?2.2:0,dt);art.spin(wheel.angle);indicator.scale.y=.05+.95*Math.min(1,wheel.work/60);},reset(){wheel.reset();t.power=t.clutch=false;}};this.state[name]=t;this.ticks.push(dt=>t.update(dt));this.resets.push(()=>t.reset());return t;}
 spring(name,p){
  const game=this.game,world=this.world,art=this.fixture(32,[p[0],p[1]-.1,p[2]],3.5,Math.PI/2),top=world.box([p[0],p[1]+.65,p[2]],[2.7,.22,2.7],world.materials.ceramic,false);
  const collider={mesh:top,box:new THREE.Box3().setFromObject(top),enabled:true,kinematic:true};game.colliders.push(collider);game.cameraBlockers.push(top);game.aimBlockers.push(top);
  const f={minX:p[0]-1.35,maxX:p[0]+1.35,minZ:p[2]-1.35,maxZ:p[2]+1.35,y:p[1]+.76,mesh:top,enabled:true};game.floors.push(f);
  const base=p[1]+.65,s={body:null,compression:0,latched:false,restY:base,top,mesh:top,collider,floor:f,ensure(){if(!game.physics||s.owner===game.physics)return;s.owner=game.physics;
   // Replace the initial proxy with one guided dynamic spring piston.
   game.physics.removeStaticBox(top.uuid);s.body=new Body({mass:6,position:new Vec3(p[0],base,p[2]),shape:new Box(new Vec3(1.35,.11,1.35)),fixedRotation:true,linearFactor:new Vec3(0,1,0),linearDamping:.02,material:new Material({friction:.65,restitution:.05}),collisionFilterGroup:1,collisionFilterMask:2});game.physics.world.addBody(s.body);
  },forces(){s.ensure();const b=s.body;if(!b)return;s.compression=Math.max(0,base-b.position.y);if(s.compression>.68)s.latched=true;
   if(s.latched){b.type=Body.STATIC;b.position.y=base-.72;b.velocity.setZero();}else{b.type=Body.DYNAMIC;b.force.y+=6*19.5+s.compression*190-b.velocity.y*28;if(b.position.y>base){b.position.y=base;b.velocity.y=Math.min(0,b.velocity.y);}}
  },render(){top.position.y=s.body?.position.y??base;f.y=top.position.y+.11;collider.box.setFromObject(top);art.slide(V(0,-s.compression*.15,0));},reset(){s.ensure();s.latched=false;s.compression=0;if(s.body){s.body.type=Body.DYNAMIC;s.body.position.set(p[0],base,p[2]);s.body.velocity.setZero();s.body.force.setZero();s.body.wakeUp();}s.render();}};
  this.forces.push(()=>s.forces());this.renders.push(()=>s.render());this.ticks.push(()=>s.render());this.resets.push(()=>s.reset());this.state[name]=s;return s;
 }
 finish(spawn,cargoSpawn,goalPosition,extra={}){
  const kit=this,game=this.game,goal=this.world.goal(goalPosition,[4.2,4]),near=()=>this.terminals.filter(t=>terminalAccessible(game,t)).sort((a,b)=>a.position.distanceToSquared(game.playerPosition)-b.position.distanceToSquared(game.playerPosition))[0];
  const level={id:this.spec.id,index:this.index,title:`${this.index+1} / ${this.spec.title}`,bounds:this.bounds,spawn,cargoSpawn,goal,world:this.world,structure:this.world.root,panels:this.panels,terminals:this.terminals,state:this.state,fixtures:this.fixtures,pads:this.pads,gates:[],floors:this.world.floors,explorationSurfaces:this.world.surfaces.filter(a=>a.portal&&a.width>=5.5),bridges:[],lift:null,receiverPanel:null,launchPad:null,momentum:true,hints:this.spec.hints,
   update(dt){kit.time+=dt;kit.ticks.forEach(fn=>fn(dt));},reset(){kit.time=0;kit.resets.forEach(fn=>fn());kit.ticks.forEach(fn=>fn(0));},renderUpdate(a=1){kit.renders.forEach(fn=>fn(a));},applyCargoForces(dt){kit.forces.forEach(fn=>fn(dt));},getLaunch:()=>null,
   interact(){const t=near();if(!t)return false;t.action();return true;},nearbyInteraction(){const t=near();return t?{kind:t.kind,label:'E',text:t.lesson}:null;},cargoOnAnyPad:()=>true,getObjective:()=>kit.spec.description,
   isWon:()=>game.playerGrounded&&goal.contains(game.playerPosition)&&game.cargo&&goal.contains(game.cargo.position)&&game.playerPosition.distanceTo(game.cargo.position)<3.3,
   diagnostics:()=>({level:kit.index+1,id:kit.spec.id,concept:kit.spec.concept,portalSurfaces:game.portalPanels.length,models:kit.fixtures.map(f=>f.id),noCheckpoints:true}),...extra};
  return level;
 }
}

/** Attach an uploaded, articulated derivative without creating a second room. */
export function suppliedArt(game,world,id,position,size,yaw=0){
 return Workshop.prototype.fixture.call({game,world,fixtures:[]},id,position,size,yaw);
}
