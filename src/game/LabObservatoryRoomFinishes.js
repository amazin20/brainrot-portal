import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

export const OBSERVATORY_ROOM_FINISH_REVISION='source-bound-formed-instrument-casings-v2-reconstructed';
const PALETTES=Object.freeze({
 31:{paint:0x597b98,accent:0xb9a17c},32:{paint:0x645574,accent:0xc0a2a5},
 33:{paint:0x447f86,accent:0xb4bd9d},34:{paint:0x8b6255,accent:0xc5bc9f},
 35:{paint:0x527c83,accent:0xa2bcc0},36:{paint:0x6877a1,accent:0xb6b5c9},
 37:{paint:0x437b66,accent:0xc0a16f},38:{paint:0x456a89,accent:0xb5c4c7},
 39:{paint:0x9b6d48,accent:0xc9b59a},40:{paint:0x89947c,accent:0xc4c5ae},
});
export function observatoryMachinePalette(stable){const p=PALETTES[stable];if(!p)throw new Error('Unknown observatory casing palette '+stable);return {...p};}

/** Drawing of a CLOSED existing casing, with front and rear inspection
 * returns. No body, constraint, surface, query mesh, light or timer is owned
 * here. The caller retains its original collision dimensions and position.
 * A positive 1 mm inset keeps all vertices inside that actual closed box. */
export function closedObservatoryCasingGeometry(stable,size,{axis='z',role='paint'}={}){
 if(!Array.isArray(size)||size.length!==3||!size.every(n=>Number.isFinite(n)&&n>.008)||!['x','z'].includes(axis))throw new Error('Invalid closed observatory casing dimensions');
 const palette=observatoryMachinePalette(stable),tones={paint:palette.paint,accent:palette.accent,dark:0x263a46,metal:0xa8b9b8,ivory:0xbdc9bc};
 const [sx,sy,sz]=size,w=(axis==='x'?sz:sx)-.002,h=sy-.002,d=(axis==='x'?sx:sz)-.002,parts=[];
 const add=(x,y,z,a,b,c,tone)=>{
  if(Math.min(a,b,c)<=0)throw new Error('Invalid casing member');
  const geometry=new THREE.BoxGeometry(a,b,c).toNonIndexed(),rgb=new THREE.Color(tones[tone]??tones.paint),values=new Float32Array(geometry.attributes.position.count*3);
  for(let i=0;i<values.length;i+=3)values.set([rgb.r,rgb.g,rgb.b],i);geometry.setAttribute('color',new THREE.BufferAttribute(values,3));geometry.translate(x,y,z);parts.push(geometry);
 };
 const rim=Math.min(.22,w*.105,h*.105),innerW=w-2*rim,innerH=h-2*rim,skin=d*.09,well=d*.23;
 // Full-depth perimeter has butt joints: horizontal returns stop at the
 // side members. The central casting is recessed between those members,
 // avoiding differently coloured coplanar exterior faces.
 add(0,0,0,innerW,innerH,d*.38,'dark');
 for(const sign of[-1,1]){
  add(sign*(w-rim)/2,0,0,rim,h,d,'metal');
  add(0,sign*(h-rim)/2,0,innerW,rim,d,'dark');
 }
 for(const sign of[-1,1]){
  const face=sign*(d/2-well),faceTop=sign*(d/2-well+skin/2),gap=Math.min(.035,innerW*.025,innerH*.025);
  add(0,0,face,innerW-2*gap,innerH-2*gap,skin,role);
  // Large embedded members describe the mechanism family. Their rear
  // counterparts are real geometry and use the same enclosed source box.
  const featureDepth=Math.min(d*.055,well*.36),z=faceTop+sign*(featureDepth*.48);
  if(stable===31||stable===38){
   for(const y of[-1,1])add(0,y*innerH*.30,z,innerW*.84,Math.min(.12,innerH*.10),featureDepth,'accent');
  }else if(stable===32||stable===37){
   for(const x of[-1,1])add(x*innerW*.29,0,z,Math.min(.13,innerW*.10),innerH*.77,featureDepth,'accent');
  }else if(stable===33||stable===34){
   for(const x of[-1,1])add(x*innerW*.26,0,z,innerW*.22,innerH*.78,featureDepth,'metal');
  }else if(stable===36){
   add(0,0,z,innerW*.72,Math.min(.14,innerH*.11),featureDepth,'accent');
  }else if(stable===39){
   for(let i=0;i<4;i++)add(0,(i-1.5)*innerH*.17,z,innerW*.78,innerH*.055,featureDepth,'metal');
  }else if(stable===40){
   for(const y of[-1,1])add(0,y*innerH*.28,z,innerW*.78,Math.min(.11,innerH*.09),featureDepth,'accent');
   add(0,0,z,Math.min(.14,innerW*.10),innerH*.69,featureDepth,'dark');
  }
 }
 const geometry=mergeGeometries(parts,false);parts.forEach(g=>g.dispose());if(axis==='x')geometry.rotateY(Math.PI/2);
 geometry.name='Closed source-bound observatory casing '+stable;geometry.parameters={width:sx,height:sy,depth:sz};geometry.computeBoundingBox();geometry.computeBoundingSphere();
 geometry.userData={revision:OBSERVATORY_ROOM_FINISH_REVISION,stable,sourceSize:[...size],sourceClearance:.001,closedFrontAndRear:true,physicalOwnersAdded:0};return geometry;
}
