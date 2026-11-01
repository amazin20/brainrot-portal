import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

export const OBSERVATORY_WALL_PROFILE_REVISION='observatory-continuous-instrument-panels-v2-reconstructed';
const C={back:0x1d2b40,field:0x40516e,rim:0xa4b5c9};
const rect=(x0,y0,x1,y1)=>[[x0,y0],[x1,y0],[x1,y1],[x0,y1]];
function roundedRect(x0,y0,x1,y1,r=.055){
 const result=[];for(const[cx,cy,start]of[[x1-r,y0+r,-Math.PI/2],[x1-r,y1-r,0],[x0+r,y1-r,Math.PI/2],[x0+r,y0+r,Math.PI]])for(let i=0;i<=4;i++){const a=start+i*Math.PI/8;result.push([cx+r*Math.cos(a),cy+r*Math.sin(a)]);}return result;
}
function radial(arms,inner=.17,outer=.46,width=.042){
 const p=[];for(let i=0;i<arms;i++){const a=i*Math.PI*2/arms;for(const[r,t]of[[inner,a-Math.PI/arms],[outer,a-width],[outer,a+width]])p.push([Math.sin(t)*r,Math.cos(t)*r]);}return p;
}
const FAMILIES={
 31:{name:'paired archive rails',regions:[roundedRect(-.45,-.46,-.055,.46),roundedRect(.055,-.46,.45,.46)]},
 32:{name:'horizontal optical bands',regions:[-.31,0,.31].map(y=>roundedRect(-.46,y-.12,.46,y+.12,.035))},
 33:{name:'paired liquid return columns',regions:[roundedRect(-.43,-.45,-.07,.45,.13),roundedRect(.07,-.45,.43,.45,.13)]},
 34:{name:'rounded pressure enclosure',regions:[roundedRect(-.455,-.455,.455,.455,.20)]},
 // Independent diagonal members have an intentional construction joint at
 // the bottom. Sharing one full-depth vertical edge made the merged drawing
 // non-manifold even though both individual extrusions were closed.
 35:{name:'sloped sluice braces',regions:[[[ -.46,.43],[-.35,.43],[-.006,-.35],[-.055,-.46]],[[.35,.43],[.46,.43],[.055,-.46],[.006,-.35]]]},
 36:{name:'straight eight spoke rotor',regions:[radial(8,.20,.46,.055)]},
 37:{name:'magnetic return lamellae',regions:[-.345,-.115,.115,.345].map(x=>roundedRect(x-.085,-.455,x+.085,.455,.025))},
 38:{name:'parallel freight guide cheeks',regions:[rect(-.455,-.455,-.26,.455),rect(.26,-.455,.455,.455),roundedRect(-.19,-.32,.19,.32,.055)]},
 39:{name:'thermal cooling rows',regions:[-.36,-.18,0,.18,.36].map(y=>roundedRect(-.46,y-.062,.46,y+.062,.025))},
 40:{name:'orthogonal differential crosshead',regions:[[[-.13,-.46],[.13,-.46],[.13,-.13],[.46,-.13],[.46,.13],[.13,.13],[.13,.46],[-.13,.46],[-.13,.13],[-.46,.13],[-.46,-.13],[-.13,-.13]]]},
};
const PALETTES={31:[0x354967,0xaab9cc],32:[0x514564,0xb8a7ba],33:[0x315d68,0x9bbcc2],34:[0x625052,0xb7aaa2],35:[0x3a5268,0xa4b7c2],36:[0x454d72,0xadafcf],37:[0x355c53,0xb8ad90],38:[0x334e65,0xa9bbc7],39:[0x665148,0xc2ae94],40:[0x555f52,0xb6bca8]};
function path(points,Type=THREE.Shape){const s=new Type();points.forEach(([x,y],i)=>s[i?'lineTo':'moveTo'](x,y));s.closePath();return s;}
function paint(geometry,color){const g=geometry.index?geometry.toNonIndexed():geometry,c=new THREE.Color(color),array=new Float32Array(g.attributes.position.count*3);for(let i=0;i<array.length;i+=3)array.set([c.r,c.g,c.b],i);g.setAttribute('color',new THREE.BufferAttribute(array,3));if(g!==geometry)geometry.dispose();return g;}
function extrude(shape,z0,z1,color){const g=new THREE.ExtrudeGeometry(shape,{depth:z1-z0,bevelEnabled:false,curveSegments:4});g.translate(0,0,z0);return paint(g,color);}
export function observatoryWallProfile(stable){
 const family=FAMILIES[stable];if(!family)throw new Error('Unknown observatory wall profile '+stable);
 const [field,rim]=PALETTES[stable],parts=[paint(new THREE.BoxGeometry(.997,.997,.014).translate(0,0,-.031),C.back)];
 // Each uninterrupted region has a closed recessed field and its own thin
 // closed perimeter. They are polygon areas, never a grid of little pixels.
 // Scaling about the authored origin is valid for the star-shaped rotor
 // and crosshead; convex rails use their individual polygon centroid.
 const rimScale=Math.sqrt(1-.1172);
 for(const outer of family.regions){
  const radialRegion=stable===36||stable===40,cx=radialRegion?0:outer.reduce((n,p)=>n+p[0],0)/outer.length,cy=radialRegion?0:outer.reduce((n,p)=>n+p[1],0)/outer.length;
  const inner=outer.map(([x,y])=>[cx+(x-cx)*rimScale,cy+(y-cy)*rimScale]);
  const ring=path(outer);ring.holes.push(path([...inner].reverse(),THREE.Path));
  parts.push(extrude(ring,.006,.036,rim));parts.push(extrude(path(inner),-.021,.001,field));
 }
 const geometry=mergeGeometries(parts,false);parts.forEach(g=>g.dispose());geometry.name='Closed continuous observatory profile / '+family.name;geometry.computeBoundingBox();geometry.computeBoundingSphere();
 geometry.userData={stable,profile:family.name,rimAreaRatio:.1172,regions:family.regions.map(p=>p.map(v=>[...v])),sourcePanelClearance:{x:.0015,y:.0015,z:.002},closedExtrusions:true};
 return {geometry,name:family.name,rimAreaRatio:.1172,regions:family.regions};
}
