import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

const V=(...p)=>new THREE.Vector3(...p);
function visibleOpaque(hit){
 for(let parent=hit.object;parent;parent=parent.parent)if(!parent.visible)return false;
 const material=Array.isArray(hit.object.material)?hit.object.material[hit.face?.materialIndex??0]:hit.object.material;
 return material?.visible!==false&&!material?.transparent&&!hit.object.userData.collisionProxy;
}

/** The two authored shaft stops keep their original size, collision and
 * position. Four narrow closed hangers join their upper faces to actual
 * rendered roof triangles, not the slightly lower logical ceiling frame.
 * Empty space between the hangers never receives an enclosing collider. */
export function installCrossflowStopHangers(k,stops){
 const w=k.world,ceiling=w.surfaces.find(s=>s.name==='Non-portal ceiling tiles');
 if(!ceiling||stops.length!==2)throw new Error('Crossflow hangers require two stops and the authored closed roof');
 w.root.updateWorldMatrix(true,true);
 const parts=[],castings=[];
 const part=(name,position,size,role,stop)=>{
  const mesh=w.box(position,size,w.materials.trim);
  const old=mesh.geometry;
  mesh.geometry=new RoundedBoxGeometry(...size,1,.01);old.dispose();
  mesh.name=name;mesh.receiveShadow=true;mesh.castShadow=true;
  mesh.userData.crossflowStopHanger={role,stop};mesh.updateWorldMatrix(true,false);parts.push(mesh);return mesh;
 };
 for(const [index,stop]of stops.entries()){
  const box=new THREE.Box3().setFromObject(stop),center=box.getCenter(V()),top=box.max.y;
  for(const side of [-1,1]){
   const x=center.x+side*2.45,z=center.z,roofHits=[];
   // Sample the whole attachment footprint. All five rays must hit finite
   // opaque roof geometry near the declared ceiling, never a hidden proxy.
   for(const [dx,dz]of [[0,0],[-.20,-.21],[-.20,.21],[.20,-.21],[.20,.21]]){
    const hit=new THREE.Raycaster(V(x+dx,k.ceiling-.5,z+dz),V(0,1,0),0,1.2).intersectObject(ceiling.group,true).find(visibleOpaque);
    if(!hit||Math.abs(hit.point.y-k.ceiling)>.6)throw new Error('Crossflow suspension plate misses the rendered roof');
    roofHits.push(hit.point.y);
   }
   const low=Math.min(...roofHits),high=Math.max(...roofHits);
   if(high-low>.06||top>=low-.2)throw new Error('Crossflow suspension needs a continuous roof bearing');
   const name=`Crossflow ${index===0?'first':'relay'} shaft stop / ${side<0?'west':'east'} hanger`;
   const bottom=top+.025,end=low-.025;
   const shoe=part(name+' stop shoe',[x,top+.035,z],[.44,.11,.46],'shoe',index);
   const rod=part(name+' closed tie',[x,(bottom+end)/2,z],[.16,end-bottom,.20],'tie',index);
   // Positive overlap at every sampled roof point; no coplanar second skin.
   const plate=part(name+' roof plate',[x,(low+high)/2-.035,z],[.44,high-low+.13,.46],'roof',index);
   castings.push({stop,side,shoe,rod,plate,roofHits});
  }
 }
 return {parts,castings};
}
