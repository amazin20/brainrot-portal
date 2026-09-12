import * as THREE from 'three';
import {createMachinedProjector,createMachinedTurbine,createMachinedChassis,createMachinedGimbal} from './LabMachinedModels.js';

const V=(value)=>Array.isArray(value)?new THREE.Vector3(...value):value.clone();
const UP=new THREE.Vector3(0,1,0),FORWARD=new THREE.Vector3(0,0,1);
const SOURCE='src/game/LabMachinedModels.js';

function hideLegacyMaterial(mesh){
  if(!mesh?.isMesh)return;
  const hide=material=>{const copy=material.clone();copy.visible=false;return copy;};
  mesh.material=Array.isArray(mesh.material)?mesh.material.map(hide):hide(mesh.material);
}

function placeEmitter(parent,model,position,direction){
  model.position.copy(V(position));
  model.quaternion.setFromUnitVectors(FORWARD,V(direction).normalize());
  parent.add(model);return model;
}

function animateTurbine(workshop,field,housing){
  const rotor=housing.getObjectByName('transfer-rotor'),signals=new Map();
  // The authored master cache is shared between rooms. Animated signal glass
  // belongs to this emitter, just as its later reflected alloy materials do.
  housing.traverse(node=>{
    if(!node.isMesh)return;
    const clone=material=>{
      if(material?.name!=='Recessed signal glass')return material;
      if(!signals.has(material))signals.set(material,material.clone());
      return signals.get(material);
    };
    node.material=Array.isArray(node.material)?node.material.map(clone):clone(node.material);
  });
  let angle=0,previous=0,speed=0;
  workshop.ticks.push(dt=>{
    previous=angle;
    const step=Math.max(0,dt),target=field.enabled!==false?(field.reversed?-2.4:2.4):0,decay=Math.exp(-step*3.5);
    angle+=target*step+(speed-target)*(1-decay)/3.5;
    speed=target+(speed-target)*decay;
  });
  const render=(alpha=1)=>{
    if(rotor)rotor.rotation.z=THREE.MathUtils.lerp(previous,angle,alpha);
    const color=field.reversed?0xf5ad75:0x7edee8;
    for(const material of signals.values()){
      material.color.setHex(color);material.emissive?.setHex(color);
      material.emissiveIntensity=field.enabled===false?.08:.65;
    }
  };
  workshop.renders.push(render);
  workshop.resets.push(()=>{angle=previous=speed=0;render(1);});
  render(1);
}

/** Room authors expose existing mechanism poses after Workshop.finish().
 * Rendering only: no new body, blocker, floor, target or actuator state. */
export function applyAdvancedMechanismArt(level){
  if(!level?.world||level.index<15||level.index>19||level.advancedMechanismArt)return level;
  const contract=level.mechanismArt??{},world=level.world,workshop=level.workshop;
  const root=new THREE.Group();root.name='Advanced chamber machined mechanisms';root.userData.visualOnly=true;world.root.add(root);
  const accent=level.spec?.accent??workshop?.spec?.accent??0x7edee8;
  const stats={projectors:0,turbines:0,liftChassis:0,gimbals:0};
  for(const item of contract.projectors??[]){
    const model=createMachinedProjector({radius:item.radius??.6,accent:item.accent??accent});
    model.name='Browser 3D hard-light projector';
    placeEmitter(root,model,item.position,item.direction??[0,0,-1]);
    hideLegacyMaterial(item.housing);stats.projectors++;
  }
  for(const field of contract.turbines??[]){
    // Workshop fan already carries an imported complete housing and impeller.
    if(!field||field.skipMachinedArt||field.art?.art)continue;
    const model=createMachinedTurbine({radius:field.radius??2.15,accent});
    model.name='Browser 3D transfer-field turbine';
    placeEmitter(root,model,field.origin,field.direction);
    hideLegacyMaterial(field.housing);
    if(workshop)animateTurbine(workshop,field,model);
    stats.turbines++;
  }
  const mounted=new Set();
  for(const entry of contract.liftSurfaces??[]){
    const surface=typeof entry==='string'?world.surfaces.find(s=>s.name===entry):entry;
    if(!surface?.group||mounted.has(surface)||Math.min(surface.width,surface.height)<1.5)continue;
    mounted.add(surface);
    const model=createMachinedChassis({width:surface.width,depth:surface.height,height:.62,y:0,accent});
    model.name='Browser 3D machine chassis';
    // Measure the real master, then put its entire Y-up body behind the local
    // +Z deck plane. This also follows decks whose parent translates/rotates.
    const top=new THREE.Box3().setFromObject(model).max.y;
    model.quaternion.setFromUnitVectors(UP,FORWARD);model.position.set(0,0,-top-.08);
    surface.group.add(model);stats.liftChassis++;
  }
  for(const item of contract.gimbals??[]){
    const pivot=item.pivot;if(!pivot?.isObject3D)continue;
    const model=createMachinedGimbal({accent:item.accent??accent});model.name='Browser 3D optical gimbal';
    const axis=item.normalAxis??'x';
    const align=new THREE.Quaternion().setFromUnitVectors(FORWARD,axis==='z'?FORWARD:new THREE.Vector3(1,0,0));
    root.updateWorldMatrix(true,false);pivot.updateWorldMatrix(true,false);
    const parentOrientation=pivot.parent?.getWorldQuaternion(new THREE.Quaternion())??new THREE.Quaternion();
    root.add(model);
    model.position.copy(root.worldToLocal(pivot.getWorldPosition(new THREE.Vector3())));
    model.quaternion.copy(root.getWorldQuaternion(new THREE.Quaternion()).invert()).multiply(parentOrientation).multiply(align);
    const ring=model.getObjectByName('optical-ring');
    if(ring){ring.removeFromParent();ring.userData.source=SOURCE;ring.quaternion.copy(align);pivot.add(ring);}
    if(item.mirror)item.mirror.userData.mechanismMirror=true;
    stats.gimbals++;
  }
  root.userData.stats=stats;level.advancedMechanismArt=root;return level;
}
