import * as THREE from 'three';
/** Whole mint/clay machines reveal the force path. Decoration never closes a
 * freight aperture or adds an invisible gameplay support. */
export function dressPuzzleProgression48(k,{entry,gallery,goal,arm,machine}){
 k.m.shell.color.setHex(0x65a197);k.m.secondary.color.setHex(0xca8c71);
 const band=(p,s,mat='secondary',parent=k.world.root)=>k.block(p,s,mat,false,parent,.09);
 for(const deck of [entry,gallery,goal,arm]){const d=deck.record;band([(d.minX+d.maxX)/2,d.y-.85,d.maxZ-.2],[d.maxX-d.minX-.8,.32,.18],deck===goal?'secondary':'shell');}
 for(const z of [-16.5,-10.95])band([6,4.1,z],[28,.24,.3],'metal');
 for(const x of [-8,0,8,16]){band([x,3.1,-16.8],[1.1,1.2,.9],'shell');band([x,3.1,-10.7],[1.1,1.2,.9],'secondary');}
 // Copper winding and broad flared shell sit at the far end of the freight
 // channel, not across the actual original cargo path.
 const coil=new THREE.Group();coil.position.set(18.7,4.6,-13.65);coil.rotation.y=Math.PI/2;k.world.root.add(coil);
 for(const z of [-.65,-.32,0,.32,.65])k.geometry(new THREE.TorusGeometry(1.25,.1,8,24),'metal',[0,0,z],new THREE.Quaternion(),{parent:coil,batch:false,name:'48 / permanent magnetic copper winding'});
 for(const x of [-25.8,28.8])for(const z of [-20,1,21])band([x,14,z],[.25,6.5,8],x<0?'shell':'secondary');
 // Compression follows actual shoe displacement; the visible spring does
 // not independently animate to an invented target or indicate solved state.
 const spring=new THREE.Group();k.world.root.add(spring);spring.position.set(-2.3,4.6,-15.1);
 for(let i=0;i<18;i++)k.geometry(new THREE.TorusGeometry(.34,.055,5,10),'metal',[i*.22,0,0],new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI/2),{parent:spring,batch:false,name:'48 / actual spring extension winding'});
 const linkage=k.geometry(new THREE.CylinderGeometry(.07,.07,1,8),'metal',[0,0,0],new THREE.Quaternion(),{batch:false,name:'48 / transverse pin to freight lid mechanical linkage'});
 k.renders.push(()=>{spring.scale.x=(machine.x+2.3)/3.96;const a=machine.pinGroup.position.clone().add(new THREE.Vector3(0,.75,0)),b=machine.roofGroup.position.clone().add(new THREE.Vector3(0,.3,0)),v=b.clone().sub(a);linkage.position.copy(a).add(b).multiplyScalar(.5);linkage.scale.y=v.length();linkage.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());});
 k.wire([[-20,8.25,17],[-20,.25,17],[-25,.25,17],[-25,.25,-24],[23,.25,-24],[23,8.25,-24],[23,8.25,-20],[18.7,8.25,-20],[18.7,8.25,-13.65],[18.7,6,-13.65]],()=>machine.magnet);
 k.label('48 / РАЗОМКНУТЫЙ РЕЛЬС',[-26.4,13.5,18],[1,0,0],12,.9);
 k.label('ПОПЕРЕЧНЫЙ ШТИФТ',[17,12,-24.6],[0,0,1],9,.7);
 k.label('ГРУЗОВОЙ УПОР',[3.8,9.5,-15.9],[0,0,1],8,.65);
 k.label('СЛУЖЕБНЫЙ ВОЗВРАТ',[-24.4,2.6,2],[1,0,0],9,.7);
}
