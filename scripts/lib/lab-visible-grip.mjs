import * as THREE from 'three';
import {LAB_PLAYER_BONE} from '../../src/game/LabPlayerAnimator.js';

const V=()=>new THREE.Vector3();
const weight=(geometry,index,bone)=>{
  const ids=geometry.getAttribute('skinIndex'),weights=geometry.getAttribute('skinWeight');
  let total=0;for(let slot=0;slot<4;slot++)if(ids.array[index*4+slot]===bone)total+=weights.array[index*4+slot];
  return total;
};
function triangles(mesh,accept){
  const ids=mesh.geometry.index?.array??Array.from({length:mesh.geometry.getAttribute('position').count},(_,i)=>i),out=[];
  for(let i=0;i<ids.length;i+=3){const tri=[ids[i],ids[i+1],ids[i+2]];if(tri.every(accept))out.push(tri);}
  return out;
}

/** Diagnostic only. Cargo anchors are fixed barycentric points on the source
 * Body mesh nearest the authored grip addresses in bind pose. They never move
 * to whichever cargo surface would favour a tested glove. Glove triangles are
 * selected by >=80% Hand weights at every corner, excluding cuffs/forearms.
 * Each sample evaluates actual skin deformation and world transforms. */
export class LabVisibleGripProbe {
  constructor(game){
    this.game=game;this.player=game.animator.rig.mesh;this.cargo=game.companionRig.mesh;
    this.glove={};this.anchors={};
    const bodyFaces=triangles(this.cargo,i=>weight(this.cargo.geometry,i,0)>=.8);
    game.scene.updateMatrixWorld(true);
    for(const [side,bone,x]of [['left',LAB_PLAYER_BONE.HandL,-.2],['right',LAB_PLAYER_BONE.HandR,.2]]){
      this.glove[side]=triangles(this.player,i=>weight(this.player.geometry,i,bone)>=.8);
      const target=game.cargo.visual.localToWorld(new THREE.Vector3(x,-.015,-.20)),triangle=new THREE.Triangle();
      let best=Infinity,anchor=null;
      for(const ids of bodyFaces){
        for(const [point,i]of [[triangle.a,ids[0]],[triangle.b,ids[1]],[triangle.c,ids[2]]])
          point.fromBufferAttribute(this.cargo.geometry.getAttribute('position'),i).applyMatrix4(this.cargo.matrixWorld);
        const point=triangle.closestPointToPoint(target,V()),distance=point.distanceToSquared(target);
        if(distance<best){best=distance;anchor={indices:ids.slice(),barycentric:triangle.getBarycoord(point,V()).toArray(),authoredAddressDistance:Math.sqrt(distance)};}
      }
      if(!anchor||!this.glove[side].length)throw Error('Source glove/cargo contact regions could not be identified');
      this.anchors[side]=anchor;
    }
  }
  sample(){
    const all={};this.game.scene.updateMatrixWorld(true);this.player.skeleton.update();this.cargo.skeleton.update();
    const cache=new Map();
    const playerVertex=i=>{
      if(!cache.has(i))cache.set(i,this.player.getVertexPosition(i,V()).applyMatrix4(this.player.matrixWorld));
      return cache.get(i);
    };
    for(const side of ['left','right']){
      const anchor=this.anchors[side],cargoPoint=V();
      for(let n=0;n<3;n++)cargoPoint.addScaledVector(this.cargo.getVertexPosition(anchor.indices[n],V()).applyMatrix4(this.cargo.matrixWorld),anchor.barycentric[n]);
      const triangle=new THREE.Triangle();let best=Infinity,closest=null,closestFace=null;
      for(const ids of this.glove[side]){
        triangle.set(...ids.map(playerVertex));
        const point=triangle.closestPointToPoint(cargoPoint,V()),distance=point.distanceToSquared(cargoPoint);
        if(distance<best){best=distance;closest=point;closestFace=ids;}
      }
      all[side]={distance:Math.sqrt(best),cargoPoint:cargoPoint.toArray(),glovePoint:closest.toArray(),gloveTriangle:closestFace,
        cargoTriangle:anchor.indices,gloveTriangles:this.glove[side].length,authoredAddressToCargoSurface:anchor.authoredAddressDistance,
        clamped:this.game.animator.carryReach[side+'Clamped'],reachBlend:this.game.animator.carryReach.blend};
    }
    return all;
  }
}
