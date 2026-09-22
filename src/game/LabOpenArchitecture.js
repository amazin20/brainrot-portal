import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {Workshop} from './LabWorkshopKit.js';
import {SolidAssembly,placeSolidModel} from './LabSolidModels.js';
import {cargoLoadsPlate} from './LabPlateContact.js';

const V=(...v)=>new THREE.Vector3(...v),Q=()=>new THREE.Quaternion(),UP=V(0,1,0),Z=V(0,0,1);
export const OPEN_METRICS=Object.freeze({walkway:8,landing:12,headroom:7,carriage:12,portalWidth:7.6,portalHeight:5.8});
export const OPEN_PALETTES=Object.freeze({
 orbital:{paint:0x167f89,accent:0xf6ad49,secondary:0xde6c4d,floor:0x7caaa9,sky:0xaacedd},
 optical:{paint:0xe09b44,accent:0x70e4ed,secondary:0x2c7882,floor:0xcfd1ba,sky:0xb1d7e6},
 current:{paint:0x376ab2,accent:0xffc26b,secondary:0x259a91,floor:0xbacacd,sky:0xaacbdc},
 kinetic:{paint:0xc85156,accent:0xf5c863,secondary:0x357eaa,floor:0xc5cecb,sky:0xb3d9e6},
 tidal:{paint:0x24948b,accent:0xffb47a,secondary:0xcd694a,floor:0x78b3b3,sky:0xa9d8e4},
 gravity:{paint:0x635caf,accent:0xedd276,secondary:0x328995,floor:0xc2c6d1,sky:0xbacbe5},
 launch:{paint:0xca6b35,accent:0x87e1e6,secondary:0x34699d,floor:0x9caab2,sky:0xb8d9e6},
});

function reflectionTexture(){
 const width=256,height=128,data=new Uint8Array(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const v=y/height,u=x/width,sky=Math.max(0,Math.sin((v-.5)*Math.PI));
  const window=Math.exp(-(((u-.30)/.075)**2)-(((v-.72)/.19)**4));
  const other=Math.exp(-(((u-.78)/.12)**4)-(((v-.61)/.16)**4));
  const i=(y*width+x)*4,t=.16+.48*sky+.35*window+.18*other;
  data[i]=Math.min(255,255*t*.94);data[i+1]=Math.min(255,255*t);data[i+2]=Math.min(255,255*t*1.04);data[i+3]=255;
 }
 const t=new THREE.DataTexture(data,width,height);t.mapping=THREE.EquirectangularReflectionMapping;
 t.colorSpace=THREE.LinearSRGBColorSpace;t.magFilter=t.minFilter=THREE.LinearFilter;t.needsUpdate=true;return t;
}

/** Authored construction kit for the spatial reboot. Walkable extents and
 * physical volumes are explicit. All world coordinates remain unscaled. */
export class OpenChamber extends Workshop{
 constructor(game,spec,index,theme='orbital'){
  super(game,spec,index);this.theme=theme;this.colors=OPEN_PALETTES[theme];this.routes=[];this.decks=[];this.artBins=new Map();this.envelopes=[];
  const w=this.world,p=this.colors;w.root.name='Open chamber / '+spec.title;w.root.userData.keepMaterial=true;
  this.env=reflectionTexture();
  const material=(name,color,roughness,metalness=0)=>new THREE.MeshStandardMaterial({name,color,roughness,metalness,envMap:this.env,envMapIntensity:.75});
  this.m={shell:material('Powder-coated structural shell',p.paint,.37),secondary:material('Secondary enamel',p.secondary,.40),
   floor:material('Honed mineral walking deck',p.floor,.79),dark:material('Recessed graphite frame',0x283c48,.51,.15),
   metal:material('Brushed bearing alloy',0xa8b5b9,.29,1),ceramic:material('Portal porcelain',0xf8f4dd,.28),
   rubber:material('Rubber isolation gasket',0x172a32,.88),light:new THREE.MeshBasicMaterial({name:'Inset light source',color:p.accent}),
   white:new THREE.MeshBasicMaterial({name:'Warm service light',color:0xffefc7})};
  Object.assign(w.materials,{wall:this.m.shell,floor:this.m.floor,ceramic:this.m.ceramic,trim:this.m.dark,accent:this.m.light,lamp:this.m.white});
  // The reboot does not run the old many-layer tile art passes.
  w.surface=options=>this.surface(options);
  game.scene.background=new THREE.Color(p.sky);game.scene.fog=new THREE.Fog(p.sky,120,330);
  this.bounds={minX:-58,maxX:58,minZ:-52,maxZ:52};this.ceiling=70;
  this.setupLight();
 }
 setupLight(){
  const g=this.game,key=g.keyLight,hemis=[];
  g.scene.traverse(n=>{if(n.isHemisphereLight)hemis.push({n,intensity:n.intensity,color:n.color.clone(),ground:n.groundColor.clone()});});
  this.oldLighting={hemis,key:key&&{color:key.color.clone(),intensity:key.intensity,position:key.position.clone(),target:key.target.position.clone(),camera:Object.fromEntries(['left','right','top','bottom','near','far'].map(k=>[k,key.shadow.camera[k]]))}};
  for(const {n}of hemis){n.intensity=1.65;n.color.setHex(0xd5edff);n.groundColor.setHex(0x577481);}
  if(key){key.color.setHex(0xffe4bb);key.intensity=3.2;key.position.set(-38,74,38);key.target.position.set(0,8,0);Object.assign(key.shadow.camera,{left:-80,right:80,top:80,bottom:-80,near:1,far:200});key.shadow.camera.updateProjectionMatrix();}
 }
 restoreLight(){
  for(const {n,intensity,color,ground}of this.oldLighting.hemis){n.intensity=intensity;n.color.copy(color);n.groundColor.copy(ground);}
  const k=this.game.keyLight,o=this.oldLighting.key;if(k&&o){k.intensity=o.intensity;k.color.copy(o.color);k.position.copy(o.position);k.target.position.copy(o.target);Object.assign(k.shadow.camera,o.camera);k.shadow.camera.updateProjectionMatrix();}
  this.env.dispose();this.ownedTextures?.forEach(t=>t.dispose());
 }
 geometry(geometry,mat,p=[0,0,0],q=Q(),{parent=this.world.root,solid=false,batch=true,name='manufactured component'}={}){
  const mesh=new THREE.Mesh(geometry,typeof mat==='string'?this.m[mat]:mat);mesh.position.fromArray(p);mesh.quaternion.copy(q);mesh.name=name;
  mesh.castShadow=solid;mesh.receiveShadow=true;parent.add(mesh);mesh.updateWorldMatrix(true,false);
  if(solid){const c=this.game.collisionProxy(new THREE.Box3().setFromObject(mesh));c.mesh.name=name+' / collision';this.envelopes.push(c);}
  if(batch&&parent===this.world.root){const bin=this.artBins.get(mesh.material)||[];bin.push(mesh);this.artBins.set(mesh.material,bin);}
  return mesh;
 }
 block(p,s,mat='dark',solid=true,parent=this.world.root,bevel=.08){
  if(!s.every(x=>Number.isFinite(x)&&x>0))throw new RangeError('Positive component size required');
  return this.geometry(new RoundedBoxGeometry(...s,1,Math.min(bevel,...s.map(x=>x*.18))),mat,p,Q(),{solid,parent,name:'Folded '+mat+' casing'});
 }
 deck(name,x0,x1,z0,z1,y,{color='floor',rail=false}={}){
  if(x1-x0<OPEN_METRICS.walkway||z1-z0<OPEN_METRICS.walkway)throw new RangeError('A new walkable deck must provide at least 8 m in both axes: '+name);
  const width=x1-x0,depth=z1-z0,x=(x0+x1)/2,z=(z0+z1)/2;
  const deck=this.block([x,y-.30,z],[width,.60,depth],color,true,this.world.root,.035);
  deck.name=name;const collider=this.envelopes.at(-1);
  const f={minX:x0,maxX:x1,minZ:z0,maxZ:z1,y,mesh:collider.mesh,enabled:true};this.game.floors.push(f);this.world.floors.push(f);const record={name,...f,portalBackingColliders:[collider]};this.decks.push(record);
  // The chassis is below the running surface, not another almost-coplanar skin.
  this.block([x,y-.90,z],[width-.65,1.0,depth-.65],'dark');
  record.portalBackingColliders.push(this.envelopes.at(-1));
  for(const side of [-1,1]){
   this.block([x+side*(width/2-.20),y-.84,z],[.20,.38,depth-.8],'shell');
   this.block([x,y-.84,z+side*(depth/2-.20)],[width-.8,.38,.20],'shell');
   // A broad brass threshold catches light but does not cover the deck.
   this.block([x+side*(width/2-.11),y-.08,z],[.07,.07,depth-.45],'metal',false);
  }
  // Walking faces receive their filtered joints in the one material, not overlay meshes.
  
  for(const sx of [-1,1])for(const sz of [-1,1])this.block([x+sx*(width/2-1.1),y-.83,z+sz*(depth/2-.32)],[1.0,.08,.07],'light',false);
  if(rail)for(const side of ['north','east','west','south'])this.rail(x0,x1,z0,z1,y,side);
  return {mesh:deck,collider,floor:f,name,record};
 }
 rail(x0,x1,z0,z1,y,side){
  const alongX=side==='north'||side==='south',start=alongX?x0:z0,end=alongX?x1:z1,at=side==='north'?z0:side==='south'?z1:side==='east'?x1:x0;
  const pos=(t,h)=>alongX?[t,h,at]:[at,h,t];
  this.block(pos((start+end)/2,y+.86),alongX?[end-start,.17,.20]:[.20,.17,end-start],'dark');
  for(let t=start+.6;t<end;t+=5)this.block(pos(t,y+.43),[.22,.86,.22],'metal');
 }
 surface({name,position,normal=[0,0,1],width=8,height=6,portal=true,parent=this.world.root,moving=false,kind='wall'}){
  const group=new THREE.Group();group.name=name;group.position.fromArray(position);group.quaternion.setFromUnitVectors(Z,V(...normal).normalize());parent.add(group);
  const mesh=this.game.box(0,0,-.12,width,height,.24,this.m.dark,{parent:group,solid:false,camera:false,aim:false});mesh.visible=false;mesh.userData.collisionProxy=true;mesh.name=name+' / portal support';
  group.updateWorldMatrix(true,true);const collider={mesh,box:new THREE.Box3().setFromObject(mesh),enabled:true,kinematic:moving};
  this.game.colliders.push(collider);this.game.cameraBlockers.push(mesh);this.game.aimBlockers.push(mesh);
  this.block([0,0,-.19],[width,.0+height,.22],'dark',false,group,.04);
  // Four large porcelain panels; the seam is a recessed gasket, not a checkerboard wall.
  const material=portal?'ceramic':'shell';
  for(const sx of [-1,1])for(const sy of [-1,1])this.block([sx*width/4,sy*height/4,-.043],[width/2-.018,height/2-.018,.076],material,false,group,.018);
  const frameColliders=[];
  const frame=(p,s,m)=>{
   const part=this.block(p,s,m,false,group,.06);part.updateWorldMatrix(true,false);
   // Divide a tilted beam before transforming its bounds. A long rotated AABB
   // otherwise seals the visible aperture with a diagonal invisible wedge.
   const axis=s[0]>s[1]?0:1,tilted=normal.filter(n=>Math.abs(n)>.01).length>1,count=tilted?Math.ceil(s[axis]/.5):1;
   for(let i=0;i<count;i++){
    const centre=V(...p),size=V(...s);centre.setComponent(axis,p[axis]+s[axis]*((i+.5)/count-.5));size.setComponent(axis,s[axis]/count);
    const local=new THREE.Box3().setFromCenterAndSize(centre,size),c=this.game.collisionProxy(local.clone().applyMatrix4(group.matrixWorld),{kinematic:moving});
    c.local=local;c.mesh.name=name+' / segmented frame';frameColliders.push(c);
   }
  };
  for(const sx of [-1,1]){frame([sx*(width/2+.30),0,-.20],[.58,height+1.18,.66],'shell');this.block([sx*(width/2+.12),0,.148],[.035,height-.55,.018],'light',false,group,.003);}
  for(const sy of [-1,1])frame([0,sy*(height/2+.30),-.20],[width,.58,.66],'dark');
  for(const sx of [-1,1])for(const sy of [-1,1])this.geometry(new THREE.CylinderGeometry(.12,.12,.09,8),'metal',[sx*(width/2+.3),sy*(height/2+.26),.18],Q().setFromAxisAngle(V(1,0,0),Math.PI/2),{parent:group,batch:false});
  const getFrame=()=>{group.updateWorldMatrix(true,false);const q=group.getWorldQuaternion(Q());return{center:group.getWorldPosition(V()),normal:Z.clone().applyQuaternion(q),right:V(1,0,0).applyQuaternion(q),up:UP.clone().applyQuaternion(q),halfWidth:width/2,halfHeight:height/2};};
  if(portal){const f=getFrame();this.game.markPortalSurface(mesh,f.center,f.normal,width/2,height/2);mesh.userData.portalFrame=getFrame;mesh.userData.portalUp=f.up;mesh.userData.portalSize={width:1.8,height:2.1};}
  collider.frontPlane=getFrame;
  const record={name,group,mesh,collider,portal,width,height,normal:V(...normal),getFrame,frameColliders};this.world.surfaces.push(record);
  record.sync=(dt=0)=>{group.updateWorldMatrix(true,true);collider.box.setFromObject(mesh);this.game.physics?.updateStaticBox(mesh.uuid,collider.box,dt);for(const c of frameColliders){this.game.syncCollision(c,c.local.clone().applyMatrix4(group.matrixWorld),dt);}};
  return record;
 }
 loadPad(name,p,size=8){
  const surface=this.panel(name,[p[0],p[1]+.18,p[2]],[0,1,0],size,size);
  const f={minX:p[0]-size/2,maxX:p[0]+size/2,minZ:p[2]-size/2,maxZ:p[2]+size/2,y:p[1]+.18,mesh:surface.mesh,enabled:true};this.game.floors.push(f);
  const hostDeck=this.decks.find(d=>Math.abs(d.y-p[1])<.001&&p[0]-size/2>=d.minX&&p[0]+size/2<=d.maxX&&p[2]-size/2>=d.minZ&&p[2]+size/2<=d.maxZ);
  const pad={surface,hostDeck,position:V(...p),loaded:()=>cargoLoadsPlate(this.game.cargo,this.game.heldCube,surface.getFrame())};this.pads.push(pad);
  return pad;
 }
 ramp(name,x0,x1,z0,z1,y0,y1){
  if(x1-x0<8)throw new Error('Ramp is too narrow');
  const base=Math.min(y0,y1)-.2;
  const wedge=(left,right)=>{
   const points=[[left,base,z0],[right,base,z0],[right,y0,z0],[left,y0,z0],[left,base,z1],[right,base,z1],[right,y1,z1],[left,y1,z1]];
   const indexed=new THREE.BufferGeometry();indexed.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));indexed.setIndex([0,3,2,0,2,1,4,5,6,4,6,7,0,1,5,0,5,4,2,3,7,2,7,6,0,4,7,0,7,3,1,2,6,1,6,5]);
   const g=indexed.toNonIndexed();indexed.dispose();g.computeVertexNormals();const p=g.attributes.position,uv=[];for(let i=0;i<p.count;i++)uv.push(p.getX(i)/6,p.getZ(i)/6);g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));return g;
  };
  const mesh=this.geometry(wedge(x0,x1),'floor',[0,0,0],Q(),{batch:false,name});this.game.cameraBlockers.push(mesh);this.game.aimBlockers.push(mesh);
  const ramp={id:mesh.uuid,minX:x0,maxX:x1,minZ:z0,maxZ:z1,lowY:Math.min(y0,y1),highY:Math.max(y0,y1),highAt:y1>=y0?'maxZ':'minZ'};this.game.ramps.push(ramp);
  // One continuous skirt owns the visible side. Small invisible physical
  // slices follow the actual incline instead of casting a comb of shadows.
  for(const x of [x0-.12,x1+.12])this.geometry(wedge(x-.11,x+.11),'dark',[0,0,0],Q(),{name:'Continuous ramp cheek'});
  const n=Math.ceil((z1-z0)/.7);for(let i=0;i<n;i++){
   const z=z0+(i+.5)*(z1-z0)/n,h=THREE.MathUtils.lerp(y0,y1,(i+.5)/n);
   for(const x of [x0-.12,x1+.12]){const c=this.game.collisionProxy(new THREE.Box3().setFromCenterAndSize(V(x,(base+h)/2,z),V(.22,Math.max(.22,h-base),(z1-z0)/n)));c.mesh.name=name+' / inclined skirt';}
  }
  return ramp;
 }
 column(x,z,base,top,radius=1.1){
  const a=new SolidAssembly('Load-bearing telescopic column',this.theme==='gravity'?'inversion':'launch');
  a.turned([[0,base],[radius*1.35,base],[radius*1.35,base+.35],[radius,base+.65],[radius,top-.7],[radius*1.4,top-.4],[radius*1.4,top],[0,top]],1);
  for(const y of [base+.9,top-1.05])a.turned([[radius*.99,y-.13],[radius*1.14,y-.13],[radius*1.14,y+.13],[radius*.99,y+.13],[radius*.99,y-.13]],0,[0,0,0],Q(),false);
  const model=a.finish();this.rematerial(model);return placeSolidModel(this,model,[x,0,z]);
 }
 ring(p,radius,band=.55,depth=.85,q=Q(),angle=Math.PI*2){
  const a=new SolidAssembly('Bolted structural arch',this.theme==='gravity'?'inversion':'launch');
  a.arc(radius,band,depth,0,[0,0,0],Q(),0,angle);
  a.arc(radius-band*.45,.065,depth*.65,2,[0,0,0],Q(),0,angle,false);
  const n=Math.max(4,Math.round(angle*radius/4));for(let i=0;i<n;i++){const t=(i+.5)*angle/n,r=radius+.05;
   a.add(new RoundedBoxGeometry(band*1.6,.65,depth*1.26,1,.055),1,[Math.cos(t)*r,Math.sin(t)*r,0],Q().setFromAxisAngle(Z,t),[1,1,1],false);
  }
  const model=a.finish();this.rematerial(model);return placeSolidModel(this,model,p,{quaternion:q});
 }
 rematerial(model){model.traverse(n=>{if(n.isMesh){const name=n.material.name;n.material.dispose();n.material=name==='Enamel'?this.m.shell:name==='Accent'?this.m.light:name==='Recess'?this.m.rubber:this.m.metal;}});}
 carrier(name,stations,{width=12,depth=12,portal=true,interchange=null}={}){
  if(width<12||depth<12)throw new Error('Carrier requires a full 12 m landing');
  const group=new THREE.Group();group.name=name;this.world.root.add(group);group.position.fromArray(stations[0]);
  const body=this.block([0,-.50,depth/2],[width,1,depth],'floor',false,group,.055);
  const bodyCollider=this.game.collisionProxy(new THREE.Box3().setFromObject(body),{kinematic:true});
  const chassis=this.block([0,-1.3,depth/2],[width-.5,.7,depth-.8],'shell',false,group,.16);
  const underCollider=this.game.collisionProxy(new THREE.Box3().setFromObject(chassis),{kinematic:true});
  for(const x of [-width/2+.55,width/2-.55])this.block([x,-1.1,depth/2],[.22,.12,depth-1.2],'light',false,group,.015);
  const panel=portal?this.panel(name,[0,2.85,.30],[0,0,1],OPEN_METRICS.portalWidth,OPEN_METRICS.portalHeight,group,true):null;
  const floor={minX:0,maxX:0,minZ:0,maxZ:0,y:stations[0][1],mesh:bodyCollider.mesh,enabled:true};this.game.floors.push(floor);this.world.floors.push(floor);
  const k=this;let previous=V(...stations[0]),current=previous.clone(),lastTarget=0,path=[];
  const c={name,group,panel,floor,position:current,stations:stations.map(a=>V(...a)),target:0,braked:false,speed:10,
   update(dt){previous.copy(current);if(this.target!==lastTarget){lastTarget=this.target;path=interchange?[V(...interchange),this.stations[this.target].clone()]:[this.stations[this.target].clone()];}while(path.length&&current.distanceTo(path[0])<.001)path.shift();const destination=path[0]||this.stations[this.target];const delta=destination.clone().sub(current),dist=delta.length();const step=Math.min(dist,this.speed*dt);if(!this.braked&&dist>.00001)current.addScaledVector(delta,step/dist);const travel=current.clone().sub(previous);
    const player=k.game.playerPosition,aboard=k.game.playerGrounded&&Math.abs(player.y-floor.y)<.15&&player.x>floor.minX-.08&&player.x<floor.maxX+.08&&player.z>floor.minZ-.08&&player.z<floor.maxZ+.08;
    if(aboard&&dt){player.add(travel);k.game.previousPlayerPosition.add(travel);}
    group.position.copy(current);group.updateWorldMatrix(true,true);floor.minX=current.x-width/2;floor.maxX=current.x+width/2;floor.minZ=current.z;floor.maxZ=current.z+depth;floor.y=current.y;
    k.game.syncCollision(bodyCollider,new THREE.Box3().setFromObject(body),dt);k.game.syncCollision(underCollider,new THREE.Box3().setFromObject(chassis),dt);panel?.sync(dt);
   },render(alpha){group.position.copy(previous).lerp(current,alpha);},reset(){this.target=lastTarget=0;path=[];this.braked=false;current.copy(this.stations[0]);previous.copy(current);this.update(0);},at(i){return current.distanceTo(this.stations[i])<.025;}};
  c.update(0);this.state[name]=c;this.ticks.push(dt=>c.update(dt));this.renders.push(a=>c.render(a));this.resets.push(()=>c.reset());return c;
 }
 landmark(p,radius=13){
  const [x,y,z]=p;
  this.ring([x,y,z],radius,.85,1.5);
  this.ring([x,y,z-.85],radius-1.8,.28,.48);
  for(const dx of [-radius*.83,radius*.83])this.column(x+dx,z,-9,y-radius*.45,.70);
 }
 recovery({y=-10,z0=-46,z1=52}={}){
  this.deck('Lower recovery concourse',-54,54,z0,z1,y,{color:'dark'});
  // Wide return ramp is part of the route, never an automatic teleport/reset.
  this.ramp('Ten-metre-wide return promenade',34,44,12,42,y,0);
  this.deck('Return promenade head',28,48,42,50,0);
  this.deck('Southern return bridge',-16,28,42,50,0);
  this.routes.push({name:'recovery promenade',width:10,headroom:20});
 }
 finishOpen(spawn,cargo,goal,extra={}){
  // Pads can sit on a multi-layer deck: register its OWN skin, chassis and
  // closed hull, never nearby pillars or other platforms. The common portal
  // solver still requires the actor to fit the aperture and its throat depth.
  for(const pad of this.pads)if(pad.hostDeck)pad.surface.mesh.userData.portalBackingIds=
   pad.hostDeck.portalBackingColliders.map(c=>c.mesh.uuid);
  const level=super.finish(spawn,cargo,goal,{workshop:this,spec:this.spec,portalPuzzle:true,openChamber:true,viewDistance:380,...extra});
  level.spawnView??={yaw:0,pitch:-.02};level.clearance={minimumWalkway:8,minimumLanding:12,minimumHeadroom:7,decks:this.decks.map(({name,minX,maxX,minZ,maxZ,y})=>({name,minX,maxX,minZ,maxZ,y})),routes:this.routes};
  level.dispose=()=>this.restoreLight();
  this.flush();return level;
 }
 flush(){
  this.world.root.updateWorldMatrix(true,true);
  for(const [mat,meshes] of this.artBins){
   if(!meshes.length)continue;const gs=meshes.map(m=>{const g=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();g.applyMatrix4(m.matrixWorld);return g;});
   const g=mergeGeometries(gs,false);gs.forEach(g=>g.dispose());if(!g)throw new Error('Static assembly could not be merged');g.computeBoundingSphere();
   const mesh=new THREE.Mesh(g,mat);mesh.name='Manufactured architecture / '+mat.name;mesh.receiveShadow=true;mesh.castShadow=!mat.transparent;this.world.root.add(mesh);
   for(const m of meshes){m.removeFromParent();m.geometry.dispose();}
  }
  this.artBins.clear();
 }
}
