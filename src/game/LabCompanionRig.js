import * as THREE from 'three';
import { visualSeconds } from './LabVisualTime.js';

const smooth = (a, b, x) => { const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const JOINTS = [
  ['Body', [0, 0, -.35]], ['Head', [-.08, -.04, -.55]],
  ['Tail', [.23, -.09, -.30]], ['FinL', [-.06, -.15, -.42]], ['FinR', [-.06, .12, -.42]],
  ['FootL', [-.03, -.12, -.18]], ['FootR', [-.03, .12, -.18]],
];

/** Small anatomical motion on the uploaded shark. Spatially continuous weights
 * weld UV duplicates; the source file, topology, maps and bind pose stay intact. */
export class LabCompanionRig {
  constructor(visual) {
    let source;
    visual.traverse(o => { if (!source && o.isMesh) source = o; });
    if (!source || source.isSkinnedMesh) { this.mesh = null; return; }
    const geometry = source.geometry.clone(), p = geometry.attributes.position;
    const indices = new Uint16Array(p.count * 4), weights = new Float32Array(p.count * 4);
    for (let i = 0; i < p.count; i++) {
      const x = Math.round(p.getX(i) * 1e5) / 1e5, y = Math.round(p.getY(i) * 1e5) / 1e5;
      const h = -Math.round(p.getZ(i) * 1e5) / 1e5;
      const tail = smooth(.21, .43, x) * (1 - smooth(.59, .73, h));
      const head = smooth(.54, .68, h) * (1 - tail);
      const shoe = (1 - smooth(.16, .25, h)) * (1 - tail);
      const fin = smooth(.105, .20, Math.abs(y + .015)) * smooth(.22, .31, h)
        * (1 - smooth(.48, .59, h)) * (1 - smooth(.04, .23, x)) * (1 - head) * (1 - tail) * (1 - shoe);
      const parts = [[0, Math.max(0, 1 - tail - head - shoe - fin)], [1, head], [2, tail],
        [y < -.015 ? 3 : 4, fin], [y < -.015 ? 5 : 6, shoe]]
        .filter(([, w]) => w > 1e-7).sort((a, b) => b[1] - a[1]).slice(0, 4);
      const sum = parts.reduce((s, [, w]) => s + w, 0);
      parts.forEach(([bone, w], k) => { indices[i * 4 + k] = bone; weights[i * 4 + k] = w / sum; });
    }
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
    const mesh = new THREE.SkinnedMesh(geometry, source.material);
    mesh.position.copy(source.position); mesh.quaternion.copy(source.quaternion); mesh.scale.copy(source.scale);
    mesh.castShadow = source.castShadow; mesh.receiveShadow = source.receiveShadow; mesh.frustumCulled = false;
    mesh.name = 'Companion articulated source';
    const parent = source.parent; parent.remove(source); parent.add(mesh);
    this.bones = {};
    for (const [name, point] of JOINTS) {
      const bone = new THREE.Bone(); bone.name = `Companion${name}`; bone.position.fromArray(point);
      this.bones[name] = bone;
      if (name === 'Body') mesh.add(bone);
      else { bone.position.sub(this.bones.Body.position); this.bones.Body.add(bone); }
    }
    visual.updateWorldMatrix(true, true);
    this.skeleton = new THREE.Skeleton(Object.values(this.bones)); mesh.bind(this.skeleton);
    this.mesh = mesh;
    this.carryTravel = new THREE.Vector3(); this.carryFollow = new THREE.Vector3();
    this.carryFollowLocal = new THREE.Vector3(); this.frameQuaternion = new THREE.Quaternion();
    this.reset();
  }
  reset() {
    this.elapsed = this.phase = this.walk = this.alert = this.flightBrace = this.cueAge = this.happyBlend = this.carryBlend = 0;this.wasCarrying=false;
    if (!this.mesh) return;
    this.carryTravel.set(0,0,0); this.carryFollow.set(0,0,0); this.carryFollowLocal.set(0,0,0);
    Object.values(this.bones).forEach(b => b.quaternion.identity());
    this.mesh.updateWorldMatrix(true, true); this.skeleton.update();
  }
  update({ dt = 0, elapsed, speed = 0, velocity, grounded = true, carrying = false, recovering = false, tumbling = false, celebrating = false, reaction = null }) {
    if (!this.mesh) return;
    dt=visualSeconds(dt);if(dt===0)return;
    this.elapsed=Number.isFinite(elapsed)?elapsed:this.elapsed+dt;
    speed=Number.isFinite(speed)?Math.min(30,Math.abs(speed)):0;
    // Being held is not a free tumble: it must not suppress face/fins/tail.
    tumbling=tumbling&&!carrying;
    if(carrying!==this.wasCarrying){this.cueAge=0;this.wasCarrying=carrying;}
    this.cueAge=Math.min(2,(this.cueAge||0)+dt);
    const walk = grounded && !carrying && !tumbling ? THREE.MathUtils.clamp(speed / .32, 0, 1) : 0;
    this.walk = THREE.MathUtils.damp(this.walk, walk, 8, dt);
    this.alert = THREE.MathUtils.damp(this.alert, tumbling ? 0 : carrying ? .8 : 1, 7, dt);
    this.phase += dt * (3 + Math.min(speed, .6) * 28);
    const wave = Math.sin(this.phase), t = this.elapsed;
    const u=reaction?THREE.MathUtils.clamp(reaction.elapsed/reaction.duration,0,1):Math.min(1,this.cueAge/1.1);
    const cue=Math.sin(Math.PI*u)**2;
    this.happyBlend=THREE.MathUtils.damp(this.happyBlend||0,celebrating?1:0,7,dt);const happy=this.happyBlend;
    const nod=cue*Math.sin(u*Math.PI*2);
    // A portal can turn horizontal momentum into a vertical flight. Keep the
    // existing fin/foot brace tied to total physical speed through that turn;
    // horizontal speed above still owns the walk cycle. No grip/body offset.
    const flightSpeed = velocity && [velocity.x, velocity.y, velocity.z].every(Number.isFinite)
      ? Math.hypot(velocity.x, velocity.y, velocity.z) : speed;
    this.flightBrace=THREE.MathUtils.damp(this.flightBrace||0,carrying&&!grounded?THREE.MathUtils.clamp((flightSpeed-5)/9,0,1):0,9,dt);
    // Acceleration during carrying makes fins and the head finish the move a
    // beat after the physical item. The exact coupled solution avoids a frame
    // derivative and keeps reversals/settling the same at 15 and 144 FPS.
    // Body and boots are excluded: neither support nor hand contact is shifted.
    this.carryBlend=THREE.MathUtils.damp(this.carryBlend,carrying?1:0,16,dt);
    const followDecay=Math.exp(-8*dt);
    for(const axis of ['x','y','z']){
      const target=carrying&&Number.isFinite(velocity?.[axis])?THREE.MathUtils.clamp(velocity[axis],-30,30):0;
      const difference=target-this.carryTravel[axis];
      this.carryFollow[axis]=(this.carryFollow[axis]+8*difference*dt)*followDecay;
      this.carryTravel[axis]=target-difference*followDecay;
    }
    this.mesh.getWorldQuaternion(this.frameQuaternion).invert();
    this.carryFollowLocal.copy(this.carryFollow).applyQuaternion(this.frameQuaternion);
    // The deliberate high-speed flight brace has priority over small secondary
    // motion, preserving its stable silhouette through a portal redirection.
    const followWeight=this.carryBlend*(1-smooth(.35,.8,this.flightBrace));
    const followSide=THREE.MathUtils.clamp(this.carryFollowLocal.y*.045,-.10,.10)*followWeight;
    const followPitch=THREE.MathUtils.clamp(this.carryFollowLocal.x*.060,-.095,.095)*followWeight;
    const followRise=THREE.MathUtils.clamp(this.carryFollowLocal.z*.035,-.10,.10)*followWeight;
    this.bones.Tail.rotation.z = (Math.sin(t * 3.1) * .16 + wave * .085 * this.walk) * this.alert;
    this.bones.Head.rotation.x = (Math.sin(t * 1.2) * .045+.14*nod) * this.alert;
    this.bones.Head.rotation.y = (Math.sin(t * 2.1) * .028+.045*cue) * this.alert;
    this.bones.Head.rotation.y-=followPitch;
    this.bones.Head.rotation.x+=followSide*.4;
    this.bones.Tail.rotation.z+=Math.sin(t*4.2)*.06*this.flightBrace+happy*Math.sin(t*9)*.16;
    this.bones.Tail.rotation.z+=followSide;
    for (const [side, sign] of [['L', -1], ['R', 1]]) {
      this.bones[`Fin${side}`].rotation.x = sign * (Math.sin(t * 2.7) * .085 + wave * .12 * this.walk + .16*cue + happy*.22*Math.sin(t*8)) * this.alert*(1-.8*this.flightBrace) + sign*.18*this.flightBrace;
      this.bones[`Fin${side}`].rotation.x+=sign*(followPitch+followRise)+followSide*.6;
      this.bones[`Foot${side}`].rotation.y = sign * wave * .12 * this.walk + (recovering ? sign * Math.sin(t * 8) * .055 : 0)+sign*.07*this.flightBrace+(carrying?sign*Math.sin(t*4.3)*.038:0)+happy*sign*Math.sin(t*8)*.12;
    }
    this.mesh.updateWorldMatrix(true, true); this.skeleton.update();
  }
}
