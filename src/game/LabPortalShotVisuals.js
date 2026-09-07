import * as THREE from 'three';

export const SHOT_COLORS = [0x38bfff, 0xff9a35];
const forward = new THREE.Vector3(0, 0, 1);

// Fixed pools: all geometry/materials are created with the room, never on fire.
// The coloured shell uses normal blending so energy stays legible on ivory.
export function createChargeSlot(root) {
  const group = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({color:SHOT_COLORS[0], transparent:true,
    opacity:.78, depthWrite:false, toneMapped:false});
  const glowMaterial = material.clone(); glowMaterial.blending = THREE.AdditiveBlending;
  const coreMaterial = new THREE.MeshBasicMaterial({color:0xdff8ff, transparent:true,
    opacity:.98, depthWrite:false, toneMapped:false});
  const shell = new THREE.Mesh(new THREE.SphereGeometry(.13,12,8), material);
  shell.scale.set(1,1,2.5);
  const core = new THREE.Mesh(new THREE.SphereGeometry(.055,10,6), coreMaterial);
  core.scale.z = 4.4;
  const tail = new THREE.Mesh(new THREE.ConeGeometry(.10,.82,10), glowMaterial);
  tail.rotation.x = -Math.PI/2; tail.position.z = -.53;
  const arc = new THREE.Mesh(new THREE.TorusGeometry(.145,.016,6,20,Math.PI*1.55), material);
  arc.rotation.y = .45;
  group.add(shell,core,tail,arc); group.visible = false; root.add(group);
  return {group,material,glowMaterial,coreMaterial,arc,tail};
}

export function renderCharge(slot, shot, time) {
  slot.group.quaternion.setFromUnitVectors(forward,shot.direction);
  slot.glowMaterial.color.copy(slot.material.color);
  slot.coreMaterial.color.setHex(shot.index ? 0xffefd1 : 0xdff8ff);
  slot.arc.rotation.z = time*24 + shot.sequence;
  // Keep the short tail behind the muzzle until it has actually travelled.
  slot.tail.scale.y = THREE.MathUtils.clamp(shot.travel/.85,.05,1);
  slot.tail.position.z = -.15-.4*slot.tail.scale.y;
}

export function createImpactSlot(root) {
  const mesh = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({color:SHOT_COLORS[0],transparent:true,
    opacity:0,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
  const glow = mat.clone(); glow.blending = THREE.AdditiveBlending;
  const ring = new THREE.Mesh(new THREE.RingGeometry(.12,.17,40),mat);
  const core = new THREE.Mesh(new THREE.CircleGeometry(.115,20),glow);
  const spokes = new THREE.Group();
  const geometry = new THREE.PlaneGeometry(.028,.12);
  for(let i=0;i<8;i++) {
    const spark = new THREE.Mesh(geometry,mat);
    const angle=i*Math.PI/4;
    spark.position.set(Math.sin(angle)*.18,Math.cos(angle)*.18,.006);
    spark.rotation.z=-angle; spokes.add(spark);
  }
  mesh.add(ring,core,spokes); mesh.visible=false; root.add(mesh);
  return {mesh,mat,glow,ring,core,spokes};
}

export function renderImpact(pulse) {
  const {slot,age,valid}=pulse,t=THREE.MathUtils.clamp(age/.32,0,1);
  slot.mesh.visible=true;
  // Success expands into the portal opening. Rejection breaks into inward
  // sparks and shrinks; its colour always remains the channel that was fired.
  slot.mesh.scale.setScalar(1);
  slot.ring.visible=valid;
  slot.ring.scale.setScalar(1+t*7.5);
  slot.spokes.visible=!valid;
  slot.spokes.scale.setScalar(1+(1-t)*2.8);
  slot.core.scale.setScalar(valid?1+t*1.5:Math.max(.05,1-t));
  slot.mat.opacity=(1-t)**1.5*.92;
  slot.glow.color.copy(slot.mat.color); slot.glow.opacity=(1-t)**3*.95;
}
