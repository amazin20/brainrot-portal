import * as THREE from 'three';
import {Body,Box,Vec3,Material} from 'cannon-es';
import {ResearchChamber} from './LabResearchArt.js';
const V=(...p)=>new THREE.Vector3(...p),Q=()=>new THREE.Quaternion();
export const CREATIVE_ROOM18_SPEC=Object.freeze({
 id:'conductive-cargo-circuit',title:'Замкнутая цепь',accent:0xefbc76,assets:[1,2,11,22,23,24],
 concept:'Две настоящие пружинные клеммы касаются противоположных граней свободного друга. Замкнутый последовательный ток вращает самотормозящийся винт; полярность меняет направление двери.',
 description:'Отправь свободного друга в закрытую контактную ячейку и сожми клеммы рычагом. Две клеммы должны касаться его одновременно. Замкни рубильник: двигатель отведёт дверь и откроет крышу ячейки. Отпусти клеммы, забери друга и пройди общей дверью.',
 hints:['Смотровая щель пропускает выстрел, но уже минимального размера корпуса друга. Белый пол и внутренняя белая стенка соединяют загрузку с контактной ячейкой.',
 'Рычаг рядом с ячейкой сжимает настоящие пружинные клеммы. Одна клемма не замыкает цепь. Два индикатора показывают контакты; амперметр показывает ток. Рубильник: выключено → открыть → закрыть.',
 'Винтовая передача удерживает достигнутое положение без питания. Обратный ток возвращает дверь: это восстановление, а не сброс попытки.'],
});

/** A geometric contact pair closes a real series circuit. No receiver distance,
 * portal history, weight predicate or completed-objective flag drives it. */
export function buildCreative18(g,index=17){
 const k=new ResearchChamber(g,CREATIVE_ROOM18_SPEC,index,'current',{minX:-27,maxX:27,minZ:-25,maxZ:25},0,14);
 k.m.copper=new THREE.MeshStandardMaterial({name:'Circuit copper braid',color:0xb77d49,roughness:.64,metalness:.55});
 const dynamic=(name,p,size,mat='secondary')=>{const mesh=k.geometry(new THREE.BoxGeometry(...size),mat,p,Q(),{batch:false,name});const collider=g.collisionProxy(new THREE.Box3().setFromObject(mesh),{kinematic:true});return{mesh,collider,p:V(...p)};};
 const move=(part,x,dt)=>{part.mesh.position.copy(part.p);part.mesh.position.x+=x;part.mesh.updateWorldMatrix(true,false);g.syncCollision(part.collider,new THREE.Box3().setFromObject(part.mesh),dt);};
 const feed=k.loadPad('circuit-dispatch',[-7,0,17],8);
 const mouth=k.panel('circuit-contact-cell',[-14,.94,9],[0,0,-1],4,2.15);mouth.mesh.userData.portalSize={width:.95,height:.65};
 // The cargo-height cell is a complete solid housing. Its .72m sight slit
 // excludes every orientation of the .78m cube as well as the observer.
 for(const x of [-16.25,-11.75])k.block([x,.9,6.6],[.35,1.8,6.3],'shell');
 k.block([-14,1.4,9.8],[4.85,2.8,.35],'shell');
 for(const x of [-16.25,-11.75])k.block([x,2.3,9.25],[.35,1,1.5],'shell');
 k.block([-14,2.92,9.65],[5.25,.24,2.3],'shell');
 k.block([-14,.35,4.2],[3.5,.7,.25],'dark');
 const hatch=[];
 for(const [p,size]of [[[-15.95,1.25,2.425],[1.2,2.5,1.85]],[[-12.05,1.25,2.425],[1.2,2.5,1.85]],[[-14,.525,2.425],[2.7,1.05,1.85]],[[-14,2.135,2.425],[2.7,.73,1.85]]])hatch.push(dynamic('Electrical cell service hatch',p,size));
 hatch.push(dynamic('Electrical cell sliding roof',[-14,1.92,5.975],[4.85,.24,5.05],'shell'));
 for(const x of [-23.6,-10.9]){k.block([x,1.825,2.7],[.3,3.65,.3],'metal');k.block([x,3.55,3.2],[.3,.2,1.1],'metal');k.block([x,.12,2.7],[.7,.24,.7],'dark');}
 k.block([-17.25,3.55,3.53],[13,.2,.22],'metal');
 for(const x of [-15.6,-12.4])hatch.push(dynamic('Sliding roof suspended runner',[x,2.745,3.53],[.18,1.41,.14],'metal'));
 // A solid end-to-end partition gives the screw a visible job. The motor and
 // service hatch share its stroke through the authored overhead transmission.
 k.block([-14.85,7,-7],[24.3,14,.65],'shell');
 // Two continuous skins form a genuine recessed pocket for the sliding
 // leaf. Their overlapping mouths exclude a diagonal corner bypass.
 k.block([6.15,2.2,-7.5],[7.7,4.4,.2],'shell');
 // The .30m upper service slot carries the door-head bracket. The full door
 // leaf covers it, and its height excludes both the cargo and the observer.
 k.block([6.15,2.05,-6.5],[7.7,4.1,.2],'shell');
 k.block([18.5,7,-7],[17,14,1.2],'shell');
 k.block([6.35,9.2,-7],[7.3,9.6,1.2],'shell');
 k.block([0,9.2,-7],[5.4,9.6,.65],'dark');
 const door=dynamic('Self-locking screw door',[0,2.35,-7],[5.4,4.1,.65]);
 for(const y of [.16,4.65])k.block([3.4,y,-7],[13,.25,1.05],'metal');
 for(const x of [-2.95,9.6])k.block([x,2.35,-7],[.35,4.7,1.05],'metal');
 const electrodes=[-1,1].map(sign=>({...dynamic('Spring-loaded insulated electrode',[-14+sign*1.65,.53,7.1],[.18,.78,2.8],'ceramic'),sign,body:null}));
 const conductingFaces=electrodes.map(e=>({e,mesh:k.geometry(new THREE.BoxGeometry(.016,.78,2.8),'copper',[-14+e.sign*1.65-e.sign*.091,.53,7.1],Q(),{batch:false,name:'Complete inward conducting face / insulated top'})}));
 k.renders.push(()=>{for(const {e,mesh}of conductingFaces){mesh.position.copy(e.mesh.position);mesh.position.x-=e.sign*.091;}});
 const circuit={owner:null,mode:0,clamped:false,current:0,contacts:[false,false],stroke:0,shaftTurns:0,
  ensure(){if(!g.physics||this.owner===g.physics)return;this.owner=g.physics;
   for(const e of electrodes){g.physics.removeStaticBox(e.collider.mesh.uuid);e.body=new Body({mass:.8,position:new Vec3(...e.p.toArray()),shape:new Box(new Vec3(.09,.39,1.4)),linearFactor:new Vec3(1,0,0),fixedRotation:true,linearDamping:.25,material:new Material({friction:.25,restitution:0}),collisionFilterGroup:1,collisionFilterMask:2});g.physics.world.addBody(e.body);}
  },forces(){this.ensure();
   for(const e of electrodes){const b=e.body,rest=-14+e.sign*(this.clamped?.405:1.65);b.force.y+=b.mass*19.5;b.force.x+=(rest-b.position.x)*150-b.velocity.x*12;b.wakeUp();
    const a=-14+e.sign*.40,c=-14+e.sign*1.67,lo=Math.min(a,c),hi=Math.max(a,c);if(b.position.x<lo){b.position.x=lo;b.velocity.x=Math.max(0,b.velocity.x);}if(b.position.x>hi){b.position.x=hi;b.velocity.x=Math.min(0,b.velocity.x);}
   }
  },update(dt){this.ensure();const cargo=g.physics?.cargoBody;
   this.contacts=electrodes.map(e=>!g.heldCube&&g.physics.world.contacts.some(c=>{
    if(c.enabled===false||!((c.bi===cargo&&c.bj===e.body)||(c.bj===cargo&&c.bi===e.body)))return false;
    // Only the inward conducting face closes this terminal. A body resting
    // across the insulated tops of the jaws cannot bridge the series circuit.
    const inwardX=(c.bi===e.body?c.ni.x:-c.ni.x)*(-e.sign);
    if(inwardX<=.9)return false;
    // A reset or transport can leave the previous step's contact equation in
    // Cannon's list. Require its two actual contact points still to coincide.
    return c.bi.position.vadd(c.ri).distanceTo(c.bj.position.vadd(c.rj))<.05;
   }));
   this.current=this.mode!==0&&this.contacts.every(Boolean)?24/2:0;
   // I produces motor torque; the screw pitch integrates work into a physical
   // translation. The thread's self-locking friction holds any partial stroke.
   this.stroke=THREE.MathUtils.clamp(this.stroke+this.current*.075*(this.mode===2?-1:1)*dt,0,6.5);
   this.shaftTurns=this.stroke/.4;move(door,this.stroke,dt);hatch.forEach(p=>move(p,-this.stroke,dt));
   for(const e of electrodes){e.mesh.position.set(e.body.position.x,e.body.position.y,e.body.position.z);e.mesh.updateWorldMatrix(true,false);e.collider.box.setFromObject(e.mesh);e.collider.mesh.position.copy(e.mesh.position);e.collider.mesh.updateWorldMatrix(true,false);}
  },reset(){this.ensure();this.mode=this.current=this.stroke=this.shaftTurns=0;this.clamped=false;this.contacts=[false,false];
   for(const e of electrodes){e.body.position.set(...e.p.toArray());e.body.velocity.setZero();e.body.force.setZero();e.body.aabbNeedsUpdate=true;e.body.wakeUp();}
   this.update(0);
  },
 };
 k.forces.push(()=>circuit.forces());k.ticks.unshift(dt=>circuit.update(dt));k.resets.push(()=>circuit.reset());
 k.control('circuit-polarity',[-4,0,6],()=>{circuit.mode=(circuit.mode+1)%3;},'E — рубильник: выключено → открыть → закрыть. Ток требует двух контактов.');
 k.control('circuit-contact-clamp',[-9,0,2],()=>{circuit.clamped=!circuit.clamped;},'E — сжать / отпустить пружинные клеммы. Обе грани должны касаться корпуса друга.');
 // Generator architecture: founded cabinets, insulated overhead copper bus,
 // spring guides and a threaded drive with an observable current instrument.
 for(const x of [-22,19]){k.block([x,2.5,14],[4.2,5,4.4],'secondary');k.block([x,.18,14],[4.8,.36,5],'dark');
  for(let j=0;j<7;j++)k.block([x,1.1+j*.44,11.74],[3.2,.11,.18],'metal',false);
 }
 const wire=(a,b)=>{const delta=V(...b).sub(V(...a)),p=V(...a).add(V(...b)).multiplyScalar(.5);return k.geometry(new THREE.CylinderGeometry(.065,.065,delta.length(),8),'copper',p.toArray(),Q().setFromUnitVectors(V(0,1,0),delta.normalize()),{name:'Visible closed circuit braid'});};
 for(const [a,b]of [[[19,5,14],[19,6,5.35]],[[19,6,5.35],[-11.4,6,5.35]],[[-11.4,6,5.35],[-11.4,.53,5.35]],[[-17,.53,5.35],[-17,.53,.5]],[[-17,.53,.5],[-17,6,.5]],[[-17,6,.5],[-17,6,5.35]],[[-17,6,5.35],[-17,6,-7]],[[-17,6,-7],[0,6,-7]],[[0,6,-7],[22,6,-7]],[[22,6,-7],[22,6,14]],[[22,6,14],[19,5,14]]])wire(a,b);
 const braids=electrodes.map(e=>({e,anchor:V(e.sign<0?-17:-11.4,.53,5.35),mesh:k.geometry(new THREE.CylinderGeometry(.065,.065,1,8),'copper',[0,0,0],Q(),{batch:false,name:'Flexible braid follows the real contact'})}));
 k.renders.push(()=>{for(const {e,anchor,mesh}of braids){const end=e.mesh.position.clone(),delta=end.clone().sub(anchor);mesh.position.copy(anchor).add(end).multiplyScalar(.5);mesh.scale.y=delta.length();mesh.quaternion.setFromUnitVectors(V(0,1,0),delta.normalize());}});
 const contactMaterials=electrodes.map(()=>new THREE.MeshBasicMaterial({color:0x785f45}));
 for(let i=0;i<2;i++)k.geometry(new THREE.SphereGeometry(.12,12,8),contactMaterials[i],[i===0?-16.49:-11.51,1.45,5.52],Q(),{batch:false,name:'Housing-mounted contact continuity lamp'});
 k.renders.push(()=>contactMaterials.forEach((m,i)=>m.color.setHex(circuit.contacts[i]?0x79c6a1:0x785f45)));
 for(const x of [-17,19,22]){const z=x===-17?.5:5.35;k.block([x,3,z],[.2,6,.2],'metal');for(const y of [5.65,5.95])k.geometry(new THREE.CylinderGeometry(.22,.22,.15,12),'ceramic',[x,y,z],Q(),{name:'Porcelain bus insulator'});}
 const shaft=k.geometry(new THREE.CylinderGeometry(.12,.12,13,12),'metal',[3.3,4.95,-6.1],Q().setFromAxisAngle(V(0,0,1),Math.PI/2),{batch:false,name:'Motor screw shaft'});
 k.block([10.35,5.1,-6.1],[2,1.4,1.25],'secondary');
 const nut=k.geometry(new THREE.BoxGeometry(.5,.45,.6),'copper',[0,4.95,-6.1],Q(),{batch:false,name:'Travelling screw nut above the actual door'});
 const attachment=k.geometry(new THREE.BoxGeometry(.23,.8,.35),'metal',[0,4.55,-6.1],Q(),{batch:false,name:'Door-head screw attachment'});
 const doorBracket=k.geometry(new THREE.BoxGeometry(.23,.18,.9),'metal',[0,4.27,-6.42],Q(),{batch:false,name:'Door-head L bracket through upper pocket slot'});
 k.renders.push(()=>{nut.position.x=attachment.position.x=doorBracket.position.x=circuit.stroke;});
 const threadGeometry=new THREE.TorusGeometry(.16,.035,5,8),threads=new THREE.InstancedMesh(threadGeometry,k.m.copper,40),matrix=new THREE.Matrix4();threads.name='Forty physical screw turns / one draw';
 for(let n=0;n<40;n++){matrix.compose(V(0,-6.4+n*.32,0),Q().setFromAxisAngle(V(1,0,0),Math.PI/2),V(1,1,1));threads.setMatrixAt(n,matrix);}threads.computeBoundingBox();threads.computeBoundingSphere();shaft.add(threads);
 k.renders.push(()=>{shaft.quaternion.copy(Q().setFromAxisAngle(V(0,0,1),Math.PI/2)).multiply(Q().setFromAxisAngle(V(0,1,0),circuit.shaftTurns*Math.PI*2));});
 // A visible bevel drive carries the same motor rotation to the opposing
 // pitch above the cell. This is the mechanical roof connection, separate
 // from the copper electrical circuit.
 const transfer=k.geometry(new THREE.CylinderGeometry(.1,.1,9.63,10),'metal',[-2,4.95,-1.285],Q().setFromAxisAngle(V(1,0,0),Math.PI/2),{batch:false,name:'Longitudinal bevel-drive shaft'});
 const roofShaft=k.geometry(new THREE.CylinderGeometry(.1,.1,21.75,10),'metal',[-12.875,4.95,3.53],Q().setFromAxisAngle(V(0,0,1),Math.PI/2),{batch:false,name:'Reverse-pitch roof screw'});
 for(const z of [-6.1,3.53]){k.block([-2,4.95,z],[.7,.6,.7],'secondary');k.block([-2,2.325,z],[.2,4.65,.2],'metal');k.block([-2,.1,z],[.6,.2,.6],'dark');}
 k.block([-23.9,2.45,3.53],[.2,4.9,.2],'metal');k.block([-23.9,.1,3.53],[.6,.2,.6],'dark');
 const roofThreads=new THREE.InstancedMesh(threadGeometry,k.m.copper,40);roofThreads.name='Roof screw threads / one draw';
 for(let n=0;n<40;n++){matrix.compose(V(0,-10.7+n*.54,0),Q().setFromAxisAngle(V(1,0,0),Math.PI/2),V(1,1,1));roofThreads.setMatrixAt(n,matrix);}roofThreads.computeBoundingBox();roofThreads.computeBoundingSphere();roofShaft.add(roofThreads);
 const roofNut=k.geometry(new THREE.BoxGeometry(.45,.42,.6),'copper',[-12.4,4.95,3.53],Q(),{batch:false,name:'Roof travelling nut on opposite pitch'});
 const roofArm=k.geometry(new THREE.BoxGeometry(.15,1.64,.14),'metal',[-12.4,4.21,3.8],Q(),{batch:false,name:'Offset roof nut arm clears the fixed rail'});
 const roofBracket=k.geometry(new THREE.BoxGeometry(.15,.12,.4),'metal',[-12.4,3.37,3.65],Q(),{batch:false,name:'Roof arm bracket joins the real suspended runner'});
 k.renders.push(()=>{const a=circuit.shaftTurns*Math.PI*2;transfer.quaternion.copy(Q().setFromAxisAngle(V(1,0,0),Math.PI/2)).multiply(Q().setFromAxisAngle(V(0,1,0),a));roofShaft.quaternion.copy(Q().setFromAxisAngle(V(0,0,1),Math.PI/2)).multiply(Q().setFromAxisAngle(V(0,1,0),-a));roofNut.position.x=roofArm.position.x=roofBracket.position.x=-12.4-circuit.stroke;});
 k.block([-5,1.08,3],[.24,2.16,.45],'metal');k.block([-5,2.85,3],[2,1.45,.35],'shell');
 k.geometry(new THREE.CircleGeometry(.53,24),'ceramic',[-5,2.85,3.19],Q(),{name:'Analogue ammeter face'});
 const needle=k.geometry(new THREE.BoxGeometry(.035,.52,.025),'copper',[-5,2.85,3.22],Q(),{batch:false,name:'Actual current ammeter needle'});
 for(let i=0;i<7;i++){const angle=(-.75+i*.25);k.geometry(new THREE.BoxGeometry(.035,.075,.02),'dark',[-5+Math.sin(angle)*.47,2.85+Math.cos(angle)*.47,3.23],Q().setFromAxisAngle(V(0,0,1),-angle),{name:'Ammeter scale tick'});}
 k.renders.push(()=>{needle.rotation.z=.75-circuit.current/12*1.5;});
 k.display([-5,4.2,3],()=>`КОНТАКТЫ ${circuit.contacts.map(v=>v?'●':'○').join(' + ')} / ${circuit.current.toFixed(0)} A\n${['ВЫКЛЮЧЕНО','ОТКРЫТЬ','ЗАКРЫТЬ'][circuit.mode]} / ХОД ${circuit.stroke.toFixed(1)} м`,10,1.6);
 k.label('18 / ЗАМКНУТАЯ ЦЕПЬ',[0,12,23.8],[0,0,-1],22,1.1);
 k.label('ДВЕ ГРАНИ / ОДНА ЦЕПЬ',[-14,4,.95],[0,0,-1],10,.8);
 k.label('РЫЧАГ КЛЕММ',[-9,3,2],[0,0,1],6,.6);
 const l=k.finishResearch([-3,0,20],[-5,.6,19],[0,0,-20],{creativeEarly:18,researchChamber:false,circuit,electrodes,feed,mouth,door,hatch,spawnView:{yaw:.08,pitch:-.05}});
 l.puzzleGeometry={noProgressFlags:true,orders:['contact-then-power','power-before-contact','reverse-partial-stroke'],portalRoles:{'circuit-dispatch':'deliver original free conductor','circuit-contact-cell':'protected contact cell'},deductions:['two opposed physical contacts close a series circuit','current polarity reverses motor work','self-locking thread retains any actual partial door stroke','a linked hatch lets the same original conductor be retrieved']};
 const dispose=l.dispose;l.dispose=()=>{for(const e of electrodes)if(e.body&&circuit.owner?.world)circuit.owner.world.removeBody(e.body);threadGeometry.dispose();contactMaterials.forEach(m=>m.dispose());k.m.copper.dispose();dispose();};return l;
}
