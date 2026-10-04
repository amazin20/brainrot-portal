import * as THREE from 'three';

const UP=new THREE.Vector3(0,1,0),Z=new THREE.Vector3(0,0,1),IDENTITY=new THREE.Quaternion();
const PIPE_X=new THREE.Quaternion().setFromUnitVectors(UP,new THREE.Vector3(1,0,0));
const vec=p=>new THREE.Vector3().fromArray(p);
const corners=()=>Array.from({length:8},(_,i)=>new THREE.Vector3(
 (i&1?1:-1)*Math.SQRT1_2,(i&2?1:-1)*.5,(i&4?1:-1)*Math.SQRT1_2));

/** Connected fittings for the castle's existing machines. Static construction
 * enters the kit's spatial batches; five small instance clouds own all moving
 * detail. Only the real volumes, wall poses and hoist height are read. */
export function buildCastleMechanismDetails({game,k,rooms,machines}){
 const m=k.m,solids=[],batches=[],links=[];
 const label=mesh=>{mesh.name='Castle mechanism / '+mesh.name;return mesh;};
 function solid(p,size,material=m.steel,name='supported fitting'){
  const mesh=k.box(p,size,material);mesh.name=name;label(mesh);solids.push(mesh.userData.collider);return mesh;
 }
 function decor(p,size,material=m.copper,name='attached face'){
  const mesh=k.decor(p,size,material);mesh.name=name;return label(mesh);
 }
 // One inscribed contact core follows each narrow pipe. It adds neither a
 // traveller-sized bounding drum nor a separate proxy for every round slice.
 function pipe(a,b,r=.18,material=m.copper,name='connected pipe'){
  const delta=vec(b).sub(vec(a)),length=delta.length();
  const mesh=k.drum(vec(a).add(vec(b)).multiplyScalar(.5).toArray(),r,length,material,{solid:false});
  mesh.quaternion.setFromUnitVectors(UP,delta.normalize());mesh.name=name;label(mesh);
  k.compound(mesh,[corners()]);
  for(const part of mesh.userData.compound.parts)solids.push(part.collider);
  links.push({name,a:[...a],b:[...b],radius:r});return mesh;
 }
 function collar(p,axis,r=.29,h=.14,material=m.steel){
  const mesh=k.drum(p,r,h,material,{solid:false});mesh.quaternion.setFromUnitVectors(UP,vec(axis).normalize());
  mesh.name='bolted pipe union';return label(mesh);
 }
 function cloud(geometry,material,count,name){
  const mesh=new THREE.InstancedMesh(geometry,material,count);mesh.name='Castle mechanism / '+name;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.receiveShadow=true;
  k.root.add(mesh);k.batches.push(mesh);batches.push(mesh);
  return mesh;
 }
 const torus=k.geo(new THREE.TorusGeometry(1,.15,8,24));
 const ropes=cloud(k.cylinder,m.ivory,2,'two tension legs');
 const shoes=cloud(k.cube,m.steel,9,'moving guide shoes and rope eyes');
 const wheels=cloud(torus,m.copper,4,'paired sheaves and two routing wheels');
 const spokes=cloud(k.cube,m.ivory,4,'readable spindle orientation');
 const flowBand=cloud(k.cylinder,m.cyan,1,'actual transfer pulse');
 const matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),p=new THREE.Vector3(),scale=new THREE.Vector3();
 const rodDelta=new THREE.Vector3(),rodMid=new THREE.Vector3(),rodRotation=new THREE.Quaternion(),spin=new THREE.Quaternion();
 function instance(batch,index,position,size,rotation=null){
  p.fromArray(position);scale.fromArray(size);q.copy(rotation??IDENTITY);
  matrix.compose(p,q,scale);batch.setMatrixAt(index,matrix);
 }
 function rod(batch,index,a,b,r=.085){
  rodDelta.fromArray(b);rodMid.fromArray(a);rodDelta.sub(rodMid);
  const length=Math.max(.001,rodDelta.length());rodRotation.setFromUnitVectors(UP,rodDelta.normalize());
  rodMid.add(p.fromArray(b)).multiplyScalar(.5);
  instance(batch,index,rodMid.toArray(),[r,length,r],rodRotation);
 }
 // Zero-sized instances keep a subset fixture honest; absent wings add no
 // floating default machine at the origin.
 for(const batch of batches)for(let i=0;i<batch.count;i++)instance(batch,i,[0,0,0],[0,0,0]);

 const sluice=rooms.get('sluice'),hoist=rooms.get('hoist'),archive=rooms.get('archive'),flywheel=rooms.get('flywheel');
 if(sluice){
  const P=sluice.P;
  // A rear service header physically joins all three lower tank ports. Its
  // two three-way routers select the outgoing and receiving vessel; the six
  // existing transfer consoles remain the player's real controls.
  pipe(P(-14,-14.1,1.45),P(14,-14.1,1.45),.20,m.copper,'three-vessel transfer header');
  for(const x of [-14,0,14]){
   pipe(P(x,-13,1.45),P(x,-14.1,1.45),.18,m.copper,'tank outlet to common header');
   collar(P(x,-13.04,1.45),[0,0,1],.34,.16);
   collar(P(x,-14.1,1.45),[0,0,1],.29,.16);
   solid(P(x,-14.1,.62),[.5,1.24,.55],m.dark,'header saddle bolted to floor');
   decor(P(x,-14.1,.065),[1.05,.13,1.05],m.copper,'saddle sole plate');
  }
  for(const x of [-7,7]){
   const body=pipe(P(x,-14.55,1.45),P(x,-13.87,1.45),.55,m.steel,'three-way valve bearing');
   body.userData.castleFlowRouter=true;
   collar(P(x,-13.83,1.45),[0,0,1],.59,.12,m.copper);
   solid(P(x,-14.15,.58),[.5,1.16,.58],m.dark,'valve pedestal');
  }
  // The main readout is carried by a gantry, rather than hovering above the
  // shorter middle tank. Every arm terminates in a founded rear column.
  for(const x of [-19.5,19.5]){
   solid(P(x,-13.9,6.75),[.58,13.5,.62],m.steel,'tank readout gantry post');
   decor(P(x,-13.9,.09),[1.15,.18,1.2],m.copper,'readout foundation shoe');
  }
  solid(P(0,-13.9,13.35),[39.6,.58,.62],m.steel,'tank readout gantry header');
  for(const x of [-4.25,4.25]){
   solid(P(x,-10.4,12.85),[.22,.3,7.1],m.steel,'readout suspension arm');
   solid(P(x,-13.9,13.1),[.32,.55,.44],m.copper,'suspension bearing');
   decor(P(x,-6.91,12.68),[.3,.7,.14],m.steel,'main gauge mounting jaw');
  }
  solid(P(0,-6.84,12.7),[9.4,1.9,.26],m.dark,'main gauge mounted enclosure');
  for(const x of [-14,0,14]){
   solid(P(x,-10.45,11.68),[.15,.24,6.9],m.steel,'capacity plate arm');
   solid(P(x,-13.9,12.4),[.18,1.5,.25],m.steel,'capacity arm hanger');
   decor(P(x,-6.99,11.53),[.16,.55,.12],m.copper,'capacity plate neck');
   decor(P(x,-6.93,11.4),[2.7,.60,.14],m.dark,'capacity plate attached enclosure');
  }
  for(let j=0;j<6;j++){
   const x=-15+(j%3)*15,z=j<3?2:10;
   // These small brackets sit on the existing solid console, not in the
   // interaction ray to its casing and not across the walking approach.
   decor(P(x,z-.40,1.27),[.12,.10,.32],m.steel,'console neck return to housing');
   decor(P(x,z-.5,1.47),[.12,.55,.10],m.steel,'console label mounting neck');
   decor(P(x,z-.47,1.8),[2.35,.50,.07],m.dark,'console plate attached enclosure');
  }
 }
 if(hoist){
  const P=hoist.P;
  // The existing receiving gallery is a broad independent deck at y=18.
  // A founded perimeter frame now carries its underside; every steel member
  // ends below the walking face and stays behind the lower load/lift route.
  for(const x of [-18,16])for(const z of [6,20]){
   solid(P(x,z,8.85),[.72,17.7,.72],m.steel,'upper receiving deck founded post');
   decor(P(x,z,.09),[1.24,.18,1.24],m.copper,'receiving deck post foundation plate');
   decor(P(x,z,17.45),[.96,.30,.96],m.copper,'receiving deck post bearing collar');
  }
  for(const z of [6,20])solid(P(-.9,z,17.65),[34.2,.5,.64],m.steel,'receiving deck underside longitudinal ledger');
  for(const x of [-18,16])solid(P(x,13,17.65),[.64,.5,14],m.steel,'receiving deck underside transverse ledger');
  // The heavy weight already moves in the level. A narrow founded cage owns
  // its service volume; nothing intrudes into the central lift's swept bay.
  for(const x of [-8.4,-5.6])for(const z of [-1.45,1.45]){
   solid(P(x,z,12.2),[.24,24.4,.24],m.dark,'counterweight cage upright');
   decor(P(x,z,.10),[.7,.2,.7],m.copper,'counterweight cage footing');
  }
  for(const y of [5.5,12,18.5,24.3]){
   solid(P(-7,-1.45,y),[3,.18,.20],m.steel,'counterweight rear cross tie');
   solid(P(-7,1.45,y),[3,.18,.20],m.steel,'counterweight front cross tie');
  }
  solid(P(-2,0,24.45),[12,.48,1.2],m.steel,'hoist extended pulley bearer');
  for(const x of [-4,4])solid(P(x,0,23.65),[.56,1.9,.56],m.steel,'original guide post extension');
  for(const x of [-6.45,-3.65])solid(P(x,0,24.98),[.32,1.06,.7],m.copper,'sheave axle bearing');
  // The machine's counterweight travels 0.8 times the car height. A geared
  // compensating drum stores the unequal free length instead of depicting
  // an impossible fixed-length rope over a single one-to-one pulley.
  const drum=k.drum(P(-5.05,0,24.97),.69,.48,m.dark,{solid:false});drum.rotation.x=Math.PI/2;
  drum.name='compensating rope drum / unequal travel';label(drum);
  pipe(P(-6.45,0,25.52),P(-3.65,0,25.52),.085,m.ivory,'top tension run across paired sheaves');
  decor(P(-5.05,-.27,24.98),[.58,.18,.035],m.copper,'compensation gearbox cover');
 }
 let wallA=null,wallB=null;
 if(archive){
  const P=archive.P,y=archive.def.at[1];
  wallA=k.dynamic.find(mesh=>Math.abs(mesh.scale.x-.6)<.01&&Math.abs(mesh.scale.y-9.4)<.01&&Math.abs(mesh.scale.z-21)<.01&&Math.abs(mesh.position.y-y-4.7)<.1);
  wallB=k.dynamic.find(mesh=>Math.abs(mesh.scale.x-17)<.01&&Math.abs(mesh.scale.y-9.4)<.01&&Math.abs(mesh.scale.z-.6)<.01&&Math.abs(mesh.position.y-y-4.7)<.1);
  // Matching cut-outs in the existing shell receive these closed, wall-borne
  // slide cassettes. They have no exit or added gameplay floor. Their bottom
  // skins prevent a traveller falling through the maintenance pocket.
  for(const x of [2.1,3.9])solid(P(x,21.2,4.85),[.48,9.7,10.9],m.dark,'south sliding-wall cassette side');
  solid(P(3,26.5,4.85),[2.28,9.7,.5],m.steel,'south cassette blind end');
  solid(P(3,21.2,9.97),[2.28,.54,10.9],m.steel,'south cassette load-bearing lid');
  solid(P(3,21.2,-.23),[2.28,.46,10.9],m.dark,'south cassette closed lower skin');
  for(const z of [-3.9,-2.1])solid(P(-24.7,z,4.85),[7.9,9.7,.48],m.dark,'west sliding-wall cassette side');
  solid(P(-28.5,-3,4.85),[.5,9.7,2.28],m.steel,'west cassette blind end');
  solid(P(-24.7,-3,9.97),[7.9,.54,2.28],m.steel,'west cassette load-bearing lid');
  solid(P(-24.7,-3,-.23),[7.9,.46,2.28],m.dark,'west cassette closed lower skin');
  // Rails remain entirely above the 9.4 m wall top. Their shoes translate
  // with the real wall mesh; the protected ground route remains untouched.
  for(const x of [2.64,3.36])solid(P(x,7.5,9.68),[.12,.16,36.5],m.copper,'longitudinal archive guide rail');
  for(const z of [-3.36,-2.64])solid(P(-14.6,z,9.68),[26.5,.16,.12],m.copper,'transverse archive guide rail');
  for(const z of [-10.3,14.3])solid(P(3,z,11.3),[1.15,3.4,.55],m.steel,'longitudinal rail roof hanger');
  for(const x of [-19,2.5])solid(P(x,-3,11.3),[.55,3.4,1.15],m.steel,'transverse rail roof hanger');
  // Telescoping joints overlap the existing shell's real section openings.
  decor(P(3,15.95,9.85),[2.4,.7,.9],m.copper,'south cassette slip-joint collar');
  decor(P(-20.95,-3,9.85),[.9,.7,2.4],m.copper,'west cassette slip-joint collar');
 }
 if(flywheel){
  const P=flywheel.P;
  for(const x of [-6.1,6.1]){
   solid(P(x,-8.18,5),[.28,10,.32],m.steel,'transmission gauge founded post');
   decor(P(x,-8.18,.10),[.85,.2,.9],m.copper,'transmission gauge footing');
  }
  solid(P(0,-8.18,10.04),[12.55,.24,.3],m.steel,'transmission readout backing beam');
  solid(P(0,-8.13,10),[12.25,2.4,.24],m.dark,'transmission readout mounted enclosure');
 }

 const previousVolumes=[...(machines.get('sluice')?.state.volumes??[10,0,0])];
 let from=0,to=1,pulse=0,active=0,lastHeight=NaN;
 function update(dt=0){
  const h=Math.max(0,Math.min(18,Number(machines.get('hoist')?.state.height??0)));
  if(hoist){
   const P=hoist.P,weightTop=24.05-h*.8,liftEye=h+.25;
   rod(ropes,0,P(-7,0,weightTop),P(-7,0,24.97));
   rod(ropes,1,P(-3.1,0,liftEye),P(-3.1,0,24.97));
   instance(shoes,0,P(-7,0,weightTop+.03),[.58,.16,.55]);
   instance(shoes,1,P(-3.1,0,liftEye),[.25,.5,.55]);
   for(let i=0;i<2;i++){
    const angle=(i?h:h*.8)/.55;
    const rotation=spin.setFromAxisAngle(Z,angle);
    instance(wheels,i,P(i?-3.65:-6.45,0,24.97),[.55,.55,.55],rotation);
    instance(spokes,i,P(i?-3.65:-6.45,-.04,24.97),[.86,.075,.055],rotation);
   }
   // A separate visible cursor on the compensation gearbox reads the
   // stored differential length; it never sets the hoist's actual height.
   instance(shoes,8,P(-5.05,-.31,24.98),[.06,.42,.025],spin.setFromAxisAngle(Z,h*.2/.69));
   lastHeight=h;
  }
  if(wallA){
   for(let i=0;i<2;i++)instance(shoes,2+i,[wallA.position.x,wallA.position.y+4.92,wallA.position.z+(i?8.5:-8.5)],[.95,.44,1.1]);
  }
  if(wallB){
   for(let i=0;i<2;i++)instance(shoes,4+i,[wallB.position.x+(i?7:-7),wallB.position.y+4.92,wallB.position.z],[1.1,.44,.95]);
  }
  if(sluice){
   const values=machines.get('sluice')?.state.volumes??previousVolumes;
   const delta=values.map((v,i)=>v-previousVolumes[i]);
   const losing=delta.findIndex(v=>v<-.000001),gaining=delta.findIndex(v=>v>.000001);
   if(losing>=0&&gaining>=0){from=losing;to=gaining;pulse=(pulse+Math.abs(delta[losing])*.7)%1;active=1;}
   else active=Math.max(0,active-Math.max(0,dt)*4);
   values.forEach((v,i)=>previousVolumes[i]=v);
   const P=sluice.P;
   for(let i=0;i<2;i++){
    const x=i?7:-7,angle=(i?to:from)*Math.PI*2/3;
    const rotation=spin.setFromAxisAngle(Z,angle);
    instance(wheels,2+i,P(x,-13.55,1.45),[.68,.68,.68],rotation);
    instance(spokes,2+i,P(x,-13.49,1.45),[1.05,.09,.07],rotation);
    instance(shoes,6+i,P(x,-13.75,1.45),[.12,.12,.32]);
   }
   const x=(-14+from*14)+(to-from)*14*pulse;
   instance(flowBand,0,P(x,-14.1,1.45),[.225,.3,.225],PIPE_X);
   flowBand.visible=active>0&&Boolean(machines.get('sluice')?.state.flowing);
  }
  for(const batch of batches){batch.instanceMatrix.needsUpdate=true;batch.computeBoundingSphere();}
 }
 update(0);
 return {update,solids,batches,links,
  diagnostics:()=>({profile:'founded-gauges-tension-routes-and-closed-slide-cassettes',movingDrawCalls:batches.length,
   detailSolids:solids.length,hoistHeight:lastHeight,flowFrom:from,flowTo:to,source:'actual-machine-state-and-wall-mesh-poses',writesMachineState:false}),
  dispose(){},
 };
}
