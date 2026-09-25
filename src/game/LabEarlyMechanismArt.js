import * as THREE from 'three';
import {createMachinedProjector, createMachinedChassis, createMachinedGimbal} from './LabMachinedModels.js';

const V=(...values)=>new THREE.Vector3(...values);
const SOURCE='src/game/LabMachinedModels.js';
const FORWARD=V(0,0,1);

// Reuse the exported, bevelled bearing master: its bore stays genuinely open.
// No new rotor is added to either accepted fan or to the stationary receiver.
function bearing(radius,accent,name){
  const master=createMachinedGimbal({accent});
  const ring=master.getObjectByName('optical-ring');ring.removeFromParent();
  ring.scale.setScalar(radius/1.94);ring.name=name;
  ring.userData={...ring.userData,visualOnly:true,source:SOURCE,authoredAsset:'optical-trunnion-gimbal',reusedPart:'optical-ring'};
  return ring;
}

function finishMaterials(art,cache){
  art?.traverse(node=>{
    if(!node.isMesh||node.userData?.collisionProxy||node.userData?.portalTile||node.userData?.portalable)return;
    const finish=material=>{
      if(!material?.isMeshStandardMaterial)return material;
      if(!cache.has(material)){
        const copy=material.clone();
        // Keep the supplied colours, maps and vertex paint. The old all-matte
        // response concealed the sculpted housing and its real bevel normals.
        copy.roughness=Math.min(material.roughness??1,.48);
        copy.metalness=Math.max(material.metalness??0,.24);
        copy.envMapIntensity=.7;cache.set(material,copy);
      }
      return cache.get(material);
    };
    node.material=Array.isArray(node.material)?node.material.map(finish):finish(node.material);
  });
}

/** Render-only restoration of the first eleven accepted mechanisms.
 * Some early controllers derive collision boxes by traversing their art.
 * Following a pivot in a separate visual subtree therefore matters: attaching
 * decoration inside the physical subtree could silently change the puzzle. */
export function applyEarlyMechanismArt(level){
  if(!level?.world||level.index<0||level.index>10||level.earlyMechanismArt)return level;
  const root=new THREE.Group();root.name='Early chamber machined mechanisms';
  root.userData={visualOnly:true,version:36};level.world.root.add(root);
  const accent=level.spec?.accent??level.world.materials.accent?.color?.getHex()??0x8bd9d2;
  const stats={projectors:0,gimbals:0,liftChassis:0,bearings:0,serviceSkins:0};
  const followers=[],renders=[],materials=new Map(),inverse=new THREE.Matrix4();
  const follow=(target,name)=>{
    const mount=new THREE.Group();mount.name=name;mount.matrixAutoUpdate=false;
    mount.userData={visualOnly:true,followsNode:target.name||name};root.add(mount);
    followers.push({target,mount});return mount;
  };
  const collar=(parent,position,radius,name,axis=FORWARD)=>{
    const ring=bearing(radius,accent,name);ring.position.copy(position);
    ring.quaternion.setFromUnitVectors(FORWARD,axis);parent.add(ring);stats.bearings++;return ring;
  };
  const chassis=(parent,{width,depth,height=.55,y=-.45,z=0,name})=>{
    const model=createMachinedChassis({width,depth,height,y,accent});model.position.z=z;
    model.name=name;parent.add(model);stats.liftChassis++;return model;
  };
  for(const fixture of level.fixtures??[]){
    // Code-authored rigs already distinguish steel, brass and rubber. Only
    // the supplied all-matte GLB instances need this material response pass.
    const art=fixture.art;
    if(art){finishMaterials(art,materials);stats.serviceSkins++;}
  }
  for(const terminal of level.terminals??[])finishMaterials(terminal.art,materials);

  // Flush corner service bearings stay outside the entire usable pressure face.
  for(const [i,pad] of (level.pads??[]).entries()){
    if(!pad.mechanism?.frame)continue;
    const box=new THREE.Box3().setFromObject(pad.art);
    const mount=follow(pad.art,`Pressure platform ${i+1} / stationary fittings`);
    pad.art.updateWorldMatrix(true,false);box.applyMatrix4(pad.art.matrixWorld.clone().invert());
    for(const sx of [-1,1])for(const sz of [-1,1])collar(mount,
      V(sx*(box.max.x-box.min.x)*.431,box.max.y-.018,sz*(box.max.z-box.min.z)*.431),
      .145,'Pressure platform / recessed service bearing',V(0,1,0));
  }
  if(level.lift){
    const mount=follow(level.lift.group,'Early lift / moving chassis mount');
    chassis(mount,{width:4.8,depth:4.0,height:.68,y:-.56,name:'Early lift / machined load chassis'});
    // Bearing shoes travel with the actual carriage, along the existing rails.
    for(const x of [-2.49,2.49])collar(mount,V(x,-.35,-1.7),.23,'Early lift / guide bearing',V(1,0,0));
  }
  if(level.receiverPanel){
    const panel=level.receiverPanel.mechanism;
    const mount=follow(panel.art,'Tilting portal / fixed bearing housings');
    for(const sign of [-1,1]){
      const p=panel.panel.position.clone();p.x+=sign*(panel.bounds.max.x-panel.bounds.min.x)*.458;
      collar(mount,p,.47,'Tilting portal / trunnion bearing',V(sign,0,0));
    }
  }

  const optics=level.mechanismArt?.earlyOptics;
  if(optics){
    // The emitter now has a recessed iris, a deep barrel and mounting jaws.
    const emitter=createMachinedProjector({radius:.66,accent:0x7ee5e9});
    emitter.name='Early optics / machined light projector';
    follow(optics.emitter.group,'Early optics / fixed projector mount').add(emitter);
    optics.emitter.group.traverse(child=>{
      if(!child.isMesh)return;
      // Existing side mounts remain in the camera/aim trees. Only their
      // drawing is replaced: Object3D.visible participates in shot tracing.
      const hide=material=>{const copy=material.clone();copy.visible=false;return copy;};
      child.material=Array.isArray(child.material)?child.material.map(hide):hide(child.material);
    });
    stats.projectors++;
    // The whole ring follows the controller's real Y-axis mirror rotation.
    const mirror=follow(optics.mirror.group,'Early optics / moving mirror mount');
    collar(mirror,V(0,0,.025),1.04,'Early optics / machined mirror bearing');
    optics.mirror.lens.userData.mechanismMirror=true;stats.gimbals++;
    const sensor=follow(optics.sensor.group,'Early optics / receiving lens mount');
    const rim=collar(sensor,V(0,0,.025),.71,'Early optics / sensor bearing');
    const signals=new Map();rim.traverse(node=>{
      if(!node.isMesh)return;
      const clone=mat=>{if(mat.name!=='Recessed signal glass')return mat;
        if(!signals.has(mat))signals.set(mat,mat.clone());return signals.get(mat);};
      node.material=Array.isArray(node.material)?node.material.map(clone):clone(node.material);
    });
    renders.push(()=>{for(const material of signals.values()){
      material.color.copy(optics.sensor.glow.material.color);material.emissive.copy(material.color);
    }});
  }

  const rig=level.state?.rig;
  if(rig){
    const mount=follow(rig.moving,'Balance rocker / moving load frame');
    for(const part of rig.deckSurfaces.slice(0,2))chassis(mount,
      {width:3.6,depth:3.98,height:.34,y:-.24,z:part.center.z,name:'Balance rocker / machined tray chassis'});
    // The fixed bearing races remain fixed while both trays and counterweight move.
    const fixed=follow(rig.fixed,'Balance rocker / stationary bearing finish');
    for(const sign of [-1,1])collar(fixed,V(sign*2.37,0,0),.29,'Balance rocker / outboard bearing',V(sign,0,0));
  }

  const sourceFan=level.state?.sourceFan??level.state?.blower?.art;
  if(sourceFan?.art){
    const mount=follow(sourceFan.art,'Air machine / stationary intake finish');
    // Source model31 is normalized to one unit and then scaled 5.27596m.
    // Its fixed rim and separate impeller retain every original triangle.
    // Include the inward mounting jaws, not only the annulus, when measuring
    // clearance from the complete swept source impeller.
    const ring=collar(mount,V(-.00096,.39807,.437),.38,'Air machine / bolted intake collar');
    ring.userData.fixedIntake=true;
  }
  if(level.index===7){
    // The room-eight entrance used to show a nearly featureless back wall:
    // the supplied blower was cropped out and the actual floor exit read as
    // an ordinary tile. Mark the source-to-wall line and the *existing* open
    // air shaft with recessed, non-colliding fittings. The column changes
    // colour only when a real traced segment climbs through its floor portal.
    const route=new THREE.Group();route.name='Wind column / source and shaft fittings';
    route.userData.visualOnly=true;root.add(route);
    const muted=0x456c75,lit=0x8de6d9;
    const trackMaterial=new THREE.MeshBasicMaterial({color:muted,side:THREE.DoubleSide});
    const shaftMaterial=new THREE.MeshBasicMaterial({color:muted,side:THREE.DoubleSide});
    const track=new THREE.InstancedMesh(new THREE.BoxGeometry(.44,.018,.055),trackMaterial,12);
    track.name='Wind column / six forward floor chevrons';track.userData.visualOnly=true;
    const matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),s=V(1,1,1);
    for(let i=0;i<6;i++)for(const sign of [-1,1]){
      q.setFromAxisAngle(V(0,1,0),sign*.65);
      matrix.compose(V(-4.2+i*2.15,.048,7+sign*.135),q,s);
      track.setMatrixAt(i*2+(sign+1)/2,matrix);
    }
    track.instanceMatrix.needsUpdate=true;route.add(track);
    const guide=new THREE.InstancedMesh(new THREE.BoxGeometry(.11,.54,.06),shaftMaterial,12);
    guide.name='Wind column / shaft edge gauges';guide.userData.visualOnly=true;
    const rail=new THREE.InstancedMesh(new THREE.BoxGeometry(.16,9,.13),
      new THREE.MeshStandardMaterial({color:0x405d66,roughness:.45,metalness:.45}),2);
    rail.name='Wind column / continuous shaft edge rails';rail.userData.visualOnly=true;
    for(const [i,sign] of [-1,1].entries()){
      matrix.compose(V(sign*3.23,5.05,2.68),new THREE.Quaternion(),s);
      rail.setMatrixAt(i,matrix);
    }
    rail.instanceMatrix.needsUpdate=true;route.add(rail);
    for(let i=0;i<6;i++)for(const sign of [-1,1]){
      matrix.compose(V(sign*3.23,1.65+i*1.43,2.79),new THREE.Quaternion(),s);
      guide.setMatrixAt(i*2+(sign+1)/2,matrix);
    }
    guide.instanceMatrix.needsUpdate=true;route.add(guide);
    renders.push(()=>{
      const segments=level.state.segments??[];
      trackMaterial.color.setHex(level.state.fanSpeed>.5?lit:muted);
      shaftMaterial.color.setHex(segments.some(part=>part.direction.y>.72)?lit:muted);
    });
  }
  const spring=level.state?.piston;
  if(level.index===8&&spring?.top){
    const mount=follow(spring.top,'Spring press / moving impact chassis');
    chassis(mount,{width:2.68,depth:2.68,height:.35,y:-.34,name:'Spring press / machined impact cradle'});
    // Four recessed corner sockets sit outside the central falling-object path.
    for(const x of [-1.15,1.15])for(const z of [-1.15,1.15])collar(mount,
      V(x,.095,z),.12,'Spring press / replaceable load socket',V(0,1,0));
  }
  const freight=level.state?.freight;
  if(freight?.model?.moving){
    const model=freight.model,mount=follow(model.moving,'Freight span / moving service frame');
    // Two narrow underside cassettes avoid the irregular source deck's top.
    for(const z of [.12,3.77])chassis(mount,{width:2.8,depth:3.45,height:.30,y:1.43,z,
      name:'Freight span / machined underside cassette'});
  }
  if(level.index===10&&level.state?.flywheel?.art?.art){
    const receiver=level.state.flywheel.art.art;
    const mount=follow(receiver,'Air receiver / stationary motor fittings');
    // Side access bearings reinforce the fixed louvred drive; its front
    // receiving grille remains unobstructed and never gains a second rotor.
    const box=new THREE.Box3().setFromObject(receiver);
    receiver.updateWorldMatrix(true,false);box.applyMatrix4(receiver.matrixWorld.clone().invert());
    const y=(box.min.y+box.max.y)*.55,z=(box.min.z+box.max.z)*.5;
    for(const sign of [-1,1])collar(mount,V(sign*(box.max.x-box.min.x)*.49,y,z),.36,
      'Air receiver / bolted access bearing',V(sign,0,0));
  }

  const sync=()=>{
    root.updateWorldMatrix(true,false);inverse.copy(root.matrixWorld).invert();
    for(const {target,mount} of followers){
      target.updateWorldMatrix(true,false);mount.matrix.multiplyMatrices(inverse,target.matrixWorld);
      mount.matrixWorldNeedsUpdate=true;
    }
    renders.forEach(render=>render());root.updateWorldMatrix(false,true);
  };
  const originalRender=level.renderUpdate,originalReset=level.reset;
  level.renderUpdate=function(...args){originalRender?.apply(this,args);sync();};
  level.reset=function(...args){originalReset?.apply(this,args);sync();};
  root.userData.stats=stats;root.userData.followers=followers.length;
  level.earlyMechanismArt=root;sync();return level;
}
