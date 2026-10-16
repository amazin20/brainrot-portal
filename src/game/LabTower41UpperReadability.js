import * as THREE from 'three';

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z),Q=()=>new THREE.Quaternion(),SKIN=.003,MAX_PROJECTION=.005;

/** Shallow machine finishes and instrument marks. Body frames are siblings of
 * physical meshes: descendants would change their setFromObject() bounds.
 * No surface, light, blocker or physics object is registered by this module. */
export function buildTower41UpperReadability({k,cell}){
 const root=new THREE.Group();root.name='Upper lift / readable pressure carriage';k.root.add(root);
 const geometry=new THREE.BoxGeometry(1,1,1),materials=[],batches=[],mounts=[],coats=[],groups=new Map(),partsByKind={lift:cell.liftParts,pawl:cell.pawlParts,fixed:cell.fixedParts};
 const bodyFor=kind=>kind==='lift'?cell.liftBody:kind==='pawl'?cell.pawlBody:cell.fixedBody;
 const material=(source,name,color=null)=>{const m=source.clone();m.name=name;if(color!==null)m.color.setHex(color);m.transparent=false;m.opacity=1;materials.push(m);return m;};
 const gold=material(k.m.copper,'Upper lift / machined brass',0xd9b778),ivory=material(k.m.ivory,'Upper lift / engraved scale',0xeee9d9),navy=material(k.m.dark,'Upper lift / recessed enamel',0x294454),rose=material(k.m.rose,'Upper lift / span edge',0xbc7e8f);
 const up=material(k.m.cyan,'Upper lift / actual ascent',0x294454),down=material(k.m.copper,'Upper lift / actual descent',0x294454),pressure=material(k.m.cyan,'Upper lift / actual pressure',0x294454),support=material(k.m.mint,'Upper lift / actual supported catch',0xc59d62);
 const deckCoat=material(k.m.ivory,'Upper lift / mineral deck',0xe5dfcc),guideCoat=material(k.m.dark,'Upper lift / guide enamel',0x314d5b),pawlCoat=material(k.m.mint,'Upper lift / retaining shelf',0xa3c8b0);
 for(const [part,coat]of [[cell.deckPart,deckCoat],...cell.fixedParts.slice(6,8).map(p=>[p,guideCoat]),[cell.pawlParts[0],pawlCoat]]){if(!part)continue;coats.push({mesh:part.mesh,original:part.mesh.material,coat});part.mesh.material=coat;}
 const definitions=new Map();
 function mark(kind,index,offset,size,finish,role,rotation=0){
  const part=partsByKind[kind][index],local=V(part.offset.x+offset[0],part.offset.y+offset[1],part.offset.z+offset[2]);
  const key=kind+'/'+finish.uuid;if(!definitions.has(key))definitions.set(key,{kind,finish,items:[]});
  const item={kind,index,local,size:V(...size),rotation,role};definitions.get(key).items.push(item);
  mounts.push(Object.freeze({kind,shapeIndex:index,role,local:local.toArray(),offset:[...offset],size:[...size],rotation,maxProjection:MAX_PROJECTION}));
 }
 // The span reads as one shallow folded slab, with its top perimeter and two
 // long enamel side faces staying within a 3 mm finish of the actual deck.
 for(const z of [-1,1]){mark('lift',0,[0,-.035,z*2.0015],[11.72,.24,SKIN],navy,'deck side enamel');mark('lift',0,[0,.2015,z*1.84],[11.6,SKIN,.065],gold,'deck top perimeter');}
 for(const x of [-1,1])mark('lift',0,[x*5.82,.2015,0],[.065,SKIN,3.74],rose,'deck end perimeter');
 for(const x of [-5.65,5.65])for(const z of [-1.62,1.62])mark('lift',0,[x,.2015,z],[.085,SKIN,.085],gold,'flush deck fastener');
 // Existing switch shoes become visibly moving guide carriages. Small arrow
 // strokes show measured world velocity; neither arrow animates on a clock.
 for(const i of [1,2]){
  mark('lift',i,[-.5515,0,0],[SKIN,.32,.57],navy,'carriage instrument backing');
  for(const side of [-1,1]){
   mark('lift',i,[-.5535,.075,side*.055],[SKIN,.12,.025],up,'actual ascent arrow',side*Math.PI/4);
   mark('lift',i,[-.5535,-.075,side*.055],[SKIN,.12,.025],down,'actual descent arrow',-side*Math.PI/4);
  }
  mark('lift',i,[0,.2015,0],[.82,SKIN,.41],gold,'flush guide carriage cap');
 }
 // Calibration is engraved on the real narrow guide faces. The moving shoe,
 // not a drawn progress bar, supplies the actual carriage position.
 for(const i of [6,7]){
  mark('fixed',i,[-.1215,0,0],[SKIN,7.1,.18],navy,'guide face inset');
  for(let n=0;n<8;n++)mark('fixed',i,[-.1235,-3.35+n,.025],[SKIN,.025,n%2?.065:.12],ivory,'guide calibration notch');
  mark('fixed',i,[-.1235,-3.5,-.045],[SKIN,.10,.065],pressure,'actual pressure lamp');
 }
 // Mark the same shelf which really rotates under the car. The outboard heel
 // remains visible from the return balcony while the contact face is covered.
 mark('pawl',0,[0,.1115,0],[1.16,SKIN,.36],rose,'retaining shelf inlay');
 mark('pawl',1,[0,.1215,0],[.34,SKIN,.39],navy,'catch heel instrument backing');
 mark('pawl',1,[0,.1235,0],[.20,SKIN,.23],support,'actual catch contact lamp');
 mark('pawl',1,[-.2515,0,0],[SKIN,.17,.39],gold,'catch heel edge');
 for(const {kind,finish,items}of definitions.values()){
  let group=groups.get(kind);if(!group){group=new THREE.Group();group.name='Upper lift finish body / '+kind;group.matrixAutoUpdate=false;root.add(group);groups.set(kind,group);}
  const batch=new THREE.InstancedMesh(geometry,finish,items.length);batch.name='Upper lift finish / '+finish.name;batch.userData.presentationOnly=true;batch.frustumCulled=false;
  const matrix=new THREE.Matrix4();for(const [index,item]of items.entries()){matrix.compose(item.local,Q().setFromAxisAngle(V(1,0,0),item.rotation),item.size);batch.setMatrixAt(index,matrix);}batch.instanceMatrix.needsUpdate=true;group.add(batch);batches.push(batch);
 }
 // Read-only references let visual evidence identify the existing load-bearing
 // parts and their embedded indicators without changing the gameplay API.
 const indicator=finish=>batches.find(batch=>batch.material===finish),visualRefs=Object.freeze({deck:cell.deckPart.mesh,shoes:Object.freeze(cell.liftParts.slice(1).map(p=>p.mesh)),shelf:cell.pawlParts[0].mesh,heel:cell.pawlParts[1].mesh,guides:Object.freeze(cell.fixedParts.slice(6,8).map(p=>p.mesh)),pressureIndicator:indicator(pressure),supportIndicator:indicator(support),ascentIndicator:indicator(up),descentIndicator:indicator(down)});
 Object.defineProperty(root,'visualRefs',{value:visualRefs});
 let disposed=false,lastState={kind:'uninitialized',step:-1,velocityY:0,pressure:false,supported:false};
 const bodyMatrix=new THREE.Matrix4(),inverseRoot=new THREE.Matrix4(),position=V(),quaternion=Q();
 function setLamp(m,on,color){m.color.setHex(on?color:0x294454);m.emissive.setHex(on?color:0x000000);m.emissiveIntensity=on?.26:0;}
 function update(){
  if(disposed)return;root.updateWorldMatrix(true,false);inverseRoot.copy(root.matrixWorld).invert();
  for(const [kind,group]of groups){const body=bodyFor(kind),part=partsByKind[kind][0];
   if(body){position.copy(body.position);quaternion.copy(body.quaternion);}else{part.mesh.getWorldPosition(position);part.mesh.getWorldQuaternion(quaternion);position.sub(V(part.offset.x,part.offset.y,part.offset.z).applyQuaternion(quaternion));}
   bodyMatrix.compose(position,quaternion,V(1,1,1));group.matrix.copy(inverseRoot).multiply(bodyMatrix);group.matrixWorldNeedsUpdate=true;
  }
  const owner=cell.owner,world=owner?.world,body=cell.liftBody,live=Boolean(world&&body?.world===world&&cell.pawlBody?.world===world&&world.bodies.includes(body)&&world.bodies.includes(cell.pawlBody));
  const step=live?world.stepnumber:-1,velocityY=live?body.velocity.y:0,d=live?cell.diagnostics():null,supported=Boolean(d?.latched),balance=d?.forceBalance;
  const pressurized=Boolean(live&&cell.powered&&balance?.contactStep===step&&balance.liftBodyId===body.id&&balance.appliedPressure>0),rising=live&&velocityY>.04,falling=live&&velocityY<-.04;
  setLamp(up,rising,0x75d4d7);setLamp(down,falling,0xe3b373);setLamp(pressure,pressurized,0x75d4d7);setLamp(support,supported,0x91d6af);
  lastState={kind:!live?'uninitialized':supported?'supported':rising?'rising':falling?'descending':'rest',step,velocityY,pressure:pressurized,supported:Boolean(supported)};
 }
 function dispose(){if(disposed)return;disposed=true;for(const entry of coats)if(entry.mesh.material===entry.coat)entry.mesh.material=entry.original;root.removeFromParent();for(const batch of batches)batch.dispose();geometry.dispose();for(const m of materials)m.dispose();}
 update();
 return{root,batches,mounts:Object.freeze(mounts),materials,visualRefs,update,dispose,get disposed(){return disposed;},diagnostics:()=>({...lastState,meshes:batches.length,instances:mounts.length,maxProjection:MAX_PROJECTION,addsPhysicalSurfaces:false,writesPhysics:false}),profile:'body-linked-hydraulic-car-and-contact-shelf'};
}
