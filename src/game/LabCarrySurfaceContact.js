import * as THREE from 'three';
import {LAB_PLAYER_BONE,solveLabArm} from './LabPlayerAnimatorBase.js';

const V=()=>new THREE.Vector3();
const smooth=(a,b,x)=>{const t=THREE.MathUtils.clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const influence=(geometry,index,bone)=>{
  const ids=geometry.getAttribute('skinIndex'),weights=geometry.getAttribute('skinWeight');
  let weight=0;for(let n=0;n<4;n++)if(ids.array[index*4+n]===bone)weight+=weights.array[index*4+n];return weight;
};
function faces(mesh,accept){
  const ids=mesh.geometry.index?.array??Array.from({length:mesh.geometry.getAttribute('position').count},(_,i)=>i),out=[];
  for(let n=0;n<ids.length;n+=3){const face=[ids[n],ids[n+1],ids[n+2]];if(face.every(accept))out.push(face);}return out;
}
function nearest(mesh,triangles,target,{bind=false}={}){
  const triangle=new THREE.Triangle(),point=V();let best=Infinity,contact;
  const vertices=new Map();
  const vertex=index=>{
    if(!vertices.has(index))vertices.set(index,(bind?V().fromBufferAttribute(mesh.geometry.getAttribute('position'),index):mesh.getVertexPosition(index,V())).applyMatrix4(mesh.matrixWorld));
    return vertices.get(index);
  };
  for(const indices of triangles){
    triangle.set(...indices.map(vertex));triangle.closestPointToPoint(target,point);
    const distance=point.distanceToSquared(target);
    if(distance<best){best=distance;contact={indices:indices.slice(),barycentric:triangle.getBarycoord(point,V()).toArray()};}
  }
  return contact;
}
function skinContact(mesh,contact,out=V()){
  out.set(0,0,0);
  for(let i=0;i<3;i++)out.addScaledVector(mesh.getVertexPosition(contact.indices[i],V()).applyMatrix4(mesh.matrixWorld),contact.barycentric[i]);
  return out;
}

/** Actual source-mesh surface contacts. The source cargo anchors are fixed on
 * its rigid Body skin in bind pose; the Hand-dominant glove surface is solved
 * against those fixed contacts. Neither calibration moves a source vertex,
 * cargo, root, bone position, skin weight, or scale. Only arm/hand rotations move.
 */
export class LabCarrySurfaceContact {
  constructor({playerRig,companionRig,visual}){
    this.playerRig=playerRig;this.cargoMesh=companionRig.mesh;this.visual=visual;
    this.anchors={};this.gloves={};this.contact={};this.overlay={};this.blend=0;this.diagnostics={active:false,leftGap:null,rightGap:null,leftCorrection:0,rightCorrection:0};
    if(!this.cargoMesh)return;
    this.cargoMesh.updateWorldMatrix(true,true);visual.updateWorldMatrix(true,true);
    const cargoFaces=faces(this.cargoMesh,i=>influence(this.cargoMesh.geometry,i,0)>=.8);
    for(const [side,bone,x]of [['left',LAB_PLAYER_BONE.HandL,-.2],['right',LAB_PLAYER_BONE.HandR,.2]]){
      this.anchors[side]=nearest(this.cargoMesh,cargoFaces,visual.localToWorld(new THREE.Vector3(x,-.015,-.20)),{bind:true});
      this.gloves[side]=faces(playerRig.mesh,i=>influence(playerRig.mesh.geometry,i,bone)>=.8);
    }
  }
  apply(animator,blend){
    if(!animator.hasGripTargets||blend<.995){
      this.blend=0;this.diagnostics.active=false;
      // Release the visible surface adjustment with the established reach
      // envelope. The local rotation overlay follows the player, never a cargo
      // point left behind in world space, and never delays physical release.
      if(!animator.hasGripTargets)for(const [name,rotation]of Object.entries(this.overlay))
        this.playerRig.bones[name].quaternion.multiply(new THREE.Quaternion().slerp(rotation,blend));
      return;
    }
    this.blend=Math.min(1,this.blend+(animator.presentationDelta??0)/.15);
    const weight=smooth(0,1,this.blend);
    this.diagnostics.active=weight>0;
    if(!this.cargoMesh||weight<=0)return;
    const rig=this.playerRig,mesh=rig.mesh;
    // Attached SkinnedMesh refreshes bindMatrixInverse in updateMatrixWorld,
    // unlike Object3D.updateWorldMatrix. Sample the same deformation rendered
    // after a moving root, rather than the previous frame's bind inverse.
    for(const source of [mesh,this.cargoMesh]){
      source.updateWorldMatrix(true,true);source.updateMatrixWorld(true);
    }
    for(const [side,suffix]of [['left','L'],['right','R']]){
      const anchor=this.anchors[side];if(!anchor||!this.gloves[side]?.length)continue;
      const target=skinContact(this.cargoMesh,anchor),arm=rig.bones['Arm'+suffix],forearm=rig.bones['Forearm'+suffix],hand=rig.bones['Hand'+suffix];
      const original={arm:arm.quaternion.clone(),forearm:forearm.quaternion.clone(),hand:hand.quaternion.clone()};
      this.contact[side]=nearest(mesh,this.gloves[side],target);
      const start=hand.getWorldPosition(V()),requested=start.clone(),restHand=hand.quaternion.clone();
      // Correct the actual palm surface, not the wrist landmark. Bounded
      // iterations account for the palm offset rotating with the forearm.
      let solvedTarget=requested.clone(),clamped=false;
      for(let n=0;n<8;n++){
        const palm=skinContact(mesh,this.contact[side]),error=target.clone().sub(palm);
        if(error.length()<.002)break;
        const wrist=hand.getWorldPosition(V()),offset=palm.clone().sub(wrist),desired=target.clone().sub(wrist);
        if(offset.lengthSq()>1e-8&&desired.lengthSq()>1e-8){
          const turn=new THREE.Quaternion().slerp(new THREE.Quaternion().setFromUnitVectors(offset.normalize(),desired.normalize()),weight*.6);
          const parent=hand.parent.getWorldQuaternion(new THREE.Quaternion());
          const orientation=parent.clone().invert().multiply(turn).multiply(hand.getWorldQuaternion(new THREE.Quaternion()));
          const angle=restHand.angleTo(orientation);hand.quaternion.copy(restHand).slerp(orientation,angle>.45?.45/angle:1);hand.updateWorldMatrix(true,false);
        }
        const remaining=target.clone().sub(skinContact(mesh,this.contact[side]));
        requested.addScaledVector(remaining,weight*.7);
        const delta=requested.clone().sub(start);if(delta.length()>.08)requested.copy(start).addScaledVector(delta,.08/delta.length());
        const local=arm.parent.worldToLocal(requested.clone());
        const solved=solveLabArm(arm.position,local,rig.rest['Forearm'+suffix],rig.rest['Hand'+suffix],suffix);
        solvedTarget=arm.parent.localToWorld(solved.reachableTarget.clone());clamped=solved.clamped;
        arm.quaternion.copy(solved.arm);forearm.quaternion.copy(solved.forearm);arm.updateWorldMatrix(true,true);
        if(n===2||n===5)this.contact[side]=nearest(mesh,this.gloves[side],target);
      }
      const actual=hand.getWorldPosition(V());
      for(const [name,bone,base]of [['Arm'+suffix,arm,original.arm],['Forearm'+suffix,forearm,original.forearm],['Hand'+suffix,hand,original.hand]])
        this.overlay[name]=base.invert().multiply(bone.quaternion);
      this.diagnostics[side+'Gap']=skinContact(mesh,this.contact[side]).distanceTo(target);
      this.diagnostics[side+'Correction']=actual.distanceTo(start);
      // Keep authored landmark displacement separate from solver residual and
      // the real glove-surface acceptance measurement.
      animator.carryReach[side+'OriginalTargetOffset']=actual.distanceTo(animator.gripTargets[side]);
      animator.carryReach[side+'Error']=actual.distanceTo(solvedTarget);
      animator.carryReach[side+'SurfaceGap']=this.diagnostics[side+'Gap'];
      animator.carryReach[side+'SurfaceClamped']=clamped;
    }
  }
}
