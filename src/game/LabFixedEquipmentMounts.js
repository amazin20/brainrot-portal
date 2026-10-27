import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

const V=(...p)=>new THREE.Vector3(...p);

/** A closed casting is its own visible aim/camera owner and static body.
 * No enclosing proxy fills the space between supports. The normal level
 * lifecycle owns the geometry; materials are existing chamber materials. */
function casting(k,role,name,position,size,paint='metal'){
 const mesh=k.world.box(position,size,k.m[paint]);
 const old=mesh.geometry;
 mesh.geometry=new RoundedBoxGeometry(...size,1,Math.min(.012,...size.map(n=>n/8)));
 old.dispose();mesh.name=name;mesh.castShadow=true;
 mesh.userData.fixedEquipmentMount=role;
 mesh.updateWorldMatrix(true,false);
 return mesh;
}

/** Two separate standards bear on the actual deck/recovery floor, not a
 * shared bounding box. Their heads enter the back of the two side rims;
 * the porcelain and the central flight aperture remain unobstructed. */
export function mountLaunchPanel(k,panel){
 const frame=panel.getFrame(),normal=frame.normal,parts=[];
 if(normal.y<.8)throw new Error('The authored launch support requires an upward inclined frame');
 for(const side of [-1,1]){
  const at=panel.group.localToWorld(V(side*(panel.width/2+.30),0,-.20));
  const half=.12;
  // Highest back-face point over the square post head, plus a small real
  // overlap. Every head corner therefore meets the finite, tilted rim.
  const top=at.y-.33/normal.y+half*(Math.abs(normal.x)+Math.abs(normal.z))/normal.y+.025;
  const footHalf=.26;
  const decks=k.decks.filter(d=>at.x-footHalf>=d.minX&&at.x+footHalf<=d.maxX&&at.z-footHalf>=d.minZ&&at.z+footHalf<=d.maxZ&&d.y<top);
  if(!decks.length)throw new Error('Launch standard has no authored bearing floor');
  const base=Math.max(...decks.map(d=>d.y)),name=`Launch panel / ${side<0?'deck':'recovery'} standard`;
  parts.push(casting(k,'launch-standard',name+' foot',[at.x,base+.06,at.z],[.52,.12,.52],'dark'));
  parts.push(casting(k,'launch-standard',name+' collar',[at.x,base+.20,at.z],[.32,.20,.32],'secondary'));
  parts.push(casting(k,'launch-standard',name+' shaft',[at.x,(base+.12+top)/2,at.z],[.24,top-base-.12,.24]));
 }
 return parts;
}

/** Branch B is fixed. Twin suspension rods join its actual back casing to
 * the existing roof beam at z=34.5, whose underside is ceiling-1.1. Neither
 * rod enters the downward air aperture or the central pressure dial. */
export function hangDifferentialReceiver(k){
 const parts=[],top=k.ceiling-1.1,bottom=17.06;
 for(const side of [-1,1]){
  const x=33+side*.50,z=34.20,name=`Upper pressure receiver / ${side<0?'left':'right'} suspension`;
  parts.push(casting(k,'pressure-hanger',name+' saddle',[x,17.09,z],[.24,.12,.30],'secondary'));
  parts.push(casting(k,'pressure-hanger',name+' rod',[x,(bottom+top)/2,z],[.16,top-bottom,.20]));
  parts.push(casting(k,'pressure-hanger',name+' beam plate',[x,top-.015,z],[.34,.15,.40],'dark'));
 }
 return parts;
}
