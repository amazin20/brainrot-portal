import * as THREE from 'three';
import {OpenChamber} from './LabOpenArchitecture.js';
import {encloseLab,labInstrument} from './LabHumanLab.js';
import {applyDeckFinish,sign} from './LabOpenStationArt.js';
const V=(...p)=>new THREE.Vector3(...p),Q=()=>new THREE.Quaternion();

/** A compact, enclosed extension of the existing manufactured laboratory kit.
 * Only structural parts get collision. Every floor has its own closed chassis. */
export class ResearchChamber extends OpenChamber {
 constructor(game,spec,index,theme,bounds,base,roof){
  super(game,spec,index,theme);this.bounds=bounds;this.ceiling=roof;this.base=base;
  encloseLab(this,{base,roof});
  const foundation=this.envelopes[0];
  const service=this.deck('Continuous service and recovery floor',bounds.minX+1,bounds.maxX-1,bounds.minZ+1,bounds.maxZ-1,base,{color:'dark'});
  service.record.portalBackingColliders.push(foundation);
  game.scene.fog=new THREE.Fog(0x344954,90,160);
  this.m.shell.color.lerp(new THREE.Color(0xd2e0df),.14);
 }
 panel(name,p,n,w=8,h=5.8,parent=this.world.root,moving=false){
  const s=super.panel(name,p,n,w,h,parent,moving);
  // Wide light sheets have real wide apertures, not collision beyond the rim.
  s.mesh.userData.portalSize={width:2.8,height:2.1};return s;
 }
 display(p,read,width=12,height=1.8,normal=[0,0,1]){
  const n=V(...normal);this.block(V(...p).addScaledVector(n,-.19).toArray(),normal[0]?[.28,height+.3,width+.3]:[width+.3,height+.3,.28],'dark');
  return labInstrument(this,p,{read,width,height,normal});
 }
 label(text,p,n=[0,0,1],w=7,h=.8){sign(this,text,p,n,w,h);}
 projector(p,normal,{radius=1.05,rotating=false}={}){
  const n=V(...normal),q=Q().setFromUnitVectors(V(0,0,1),n),root=new THREE.Group();root.position.fromArray(p);root.quaternion.copy(q);this.world.root.add(root);
  const cylQ=Q().setFromAxisAngle(V(1,0,0),Math.PI/2);
  // Recessed lens, stepped barrel, isolation feet and bolted annular guard.
  for(const [r,d,z,mat] of [[radius*1.25,1.7,-1.25,'shell'],[radius*1.38,.25,-.55,'dark'],[radius, .28,-.31,'metal'],[radius*.76,.12,-.12,'dark']])
   this.geometry(new THREE.CylinderGeometry(r,r,d,32),mat,[0,0,z],cylQ,{parent:root,batch:false});
  this.geometry(new THREE.TorusGeometry(radius*1.04,.085,8,40),'metal',[0,0,-.08],Q(),{parent:root,batch:false});
  this.geometry(new THREE.TorusGeometry(radius*.87,.035,6,32),'light',[0,0,.02],Q(),{parent:root,batch:false});
  for(let i=0;i<8;i++){const t=i*Math.PI/4;this.geometry(new THREE.CylinderGeometry(.07,.07,.08,6),'metal',[Math.cos(t)*radius*1.19,Math.sin(t)*radius*1.19,-.39],cylQ,{parent:root,batch:false});}
  const rotor=new THREE.Group();root.add(rotor);
  for(let i=0;i<6;i++){const t=i*Math.PI/3;this.geometry(new THREE.BoxGeometry(radius*.86,.14,.10),'metal',[Math.cos(t)*radius*.47,Math.sin(t)*radius*.47,-.12],Q().setFromAxisAngle(V(0,0,1),t+.18),{parent:rotor,batch:false});}
  const backing=this.game.collisionProxy(new THREE.Box3().setFromCenterAndSize(V(...p).addScaledVector(n,-1.25),V(radius*2.8,radius*2.8,radius*2.8)));
  // Tight bounds behind the emitting plane, not a cube extending into its ray.
  const size=V(2*radius*1.4,2*radius*1.4,1.7),box=new THREE.Box3().setFromCenterAndSize(V(0,0,-1.25),size);
  root.updateWorldMatrix(true,true);this.game.syncCollision(backing,box.applyMatrix4(root.matrixWorld),0);
  if(rotating)this.renders.push(()=>{rotor.rotation.z=this.time*3;});
  return {root,rotor,position:V(...p),normal:n};
 }
 support(x,z,top,radius=.55){return this.column(x,z,this.base,top,radius);}
 finishResearch(spawn,cargo,goal,extra={}){
  for(const d of this.decks.filter(d=>d.y>this.base+.5)){
   // Supports sit under the back corners, never in the intended approach.
   for(const x of [d.minX+1,d.maxX-1]){
    let z=d.maxZ-1;
    if(this.pads.some(p=>Math.abs(p.position.x-x)<p.surface.width/2+1&&Math.abs(p.position.z-z)<p.surface.height/2+1))z=d.minZ+1;
    this.support(x,z,d.y-1.42,.45);
   }
  }
  applyDeckFinish(this);
  const level=this.finishOpen(spawn,cargo,goal,{researchChamber:true,...extra});
  level.clearance.minimumWalkway=8;
  return level;
 }
}
