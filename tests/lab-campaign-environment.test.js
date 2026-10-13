import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {CAMPAIGN_THEMES} from '../src/game/LabCampaignThemes.js';
import {CAMPAIGN_ORNAMENTS,campaignOrnamentSites,installCampaignEnvironment} from '../src/game/LabCampaignEnvironment.js';
import {architecturalRectOverlapsPortal} from '../src/game/LabArchitecturalModels.js';

const V=(...v)=>new THREE.Vector3(...v);
function fixture(){
 const scene=new THREE.Scene(),root=new THREE.Group();scene.add(root);
 const portal=new THREE.Mesh(new THREE.BoxGeometry(8,6,.2),new THREE.MeshStandardMaterial({name:'Portal porcelain',color:0xf8f4dd}));
 portal.position.set(-10,8,-18.25);root.add(portal);
 const frame={center:portal.position.clone(),normal:V(0,0,1),right:V(1,0,0),up:V(0,1,0),halfWidth:4,halfHeight:3};
 const box=new THREE.Box3().setFromObject(portal),registries={colliders:[{mesh:portal,box}],portalPanels:[portal],floors:[{minX:-20,maxX:20,minZ:-20,maxZ:20,y:0}],cameraBlockers:[portal],aimBlockers:[portal]};
 const game={scene,quality:{shadows:true},...registries};
 let updates=0,renders=0,resets=0,disposals=0;
 const level={structure:root,world:{root,surfaces:[]},panels:{target:{mesh:portal,getFrame:()=>frame}},
  workshop:{roomEnvelope:{minX:-20,maxX:20,minZ:-20,maxZ:20,base:0,roof:18}},
  update(){updates++;return 'updated';},renderUpdate(){renders++;return 'rendered';},reset(){resets++;return 'reset';},dispose(){disposals++;}};
 return {game,level,portal,frame,registries,counts:()=>({updates,renders,resets,disposals})};
}

for(const theme of CAMPAIGN_THEMES)test(`${theme.id} relief reserves full portal aperture and adds bounded instanced art only`,()=>{
 const {game,level,portal,frame,registries}=fixture(),before=portal.matrix.toArray(),material=portal.material;
 const sites=campaignOrnamentSites(game,level);assert.ok(sites.length>0);
 installCampaignEnvironment(game,level,theme);const {root,diagnostics}=level.campaignEnvironment;
 assert.equal(diagnostics.motif,CAMPAIGN_ORNAMENTS[theme.id]);assert.ok(diagnostics.batches<=5);assert.ok(diagnostics.instances<=150);
 assert.ok(diagnostics.triangles<=11000);assert.equal(diagnostics.extraLights,0);assert.equal(diagnostics.extraColliders,0);
 assert.equal(root.children.length,diagnostics.batches);assert.ok(root.children.every(mesh=>mesh.isInstancedMesh));
 for(const site of sites){
  const projected={...frame,center:frame.center.clone().setZ(site.center.z)};
  if(Math.abs(site.normal.dot(frame.normal))>.985&&Math.abs(site.center.z-frame.center.z)<3.2)
   assert.equal(architecturalRectOverlapsPortal(site,projected,.45),false);
 }
 for(const [key,value]of Object.entries(registries))assert.equal(game[key],value,'art changed physical registry '+key);
 assert.deepEqual(portal.matrix.toArray(),before);assert.equal(portal.material,material);assert.equal(material.color.getHex(),0xf8f4dd);
 // The model's entire transformed vertex envelope remains inside a reserved
 // wall field. The real structural ribs already project farther than this.
 const local=new THREE.Vector3(),position=V(),matrix=new THREE.Matrix4();
 for(const mesh of root.children){
  for(let i=0;i<mesh.count;i++){
   mesh.getMatrixAt(i,matrix);position.setFromMatrixPosition(matrix);
   const site=sites.reduce((a,b)=>a.center.distanceToSquared(position)<b.center.distanceToSquared(position)?a:b);
   const vertices=mesh.geometry.attributes.position;
   for(let n=0;n<vertices.count;n++){
    local.fromBufferAttribute(vertices,n).applyMatrix4(matrix).sub(site.center);
    assert.ok(Math.abs(local.dot(site.right))<=site.halfWidth+.001,`${theme.id} relief exceeded reserved width`);
    assert.ok(Math.abs(local.dot(site.up))<=site.halfHeight+.001,`${theme.id} relief exceeded reserved height`);
    assert.ok(local.dot(site.normal)<=diagnostics.maxReliefDepth+.001,`${theme.id} relief became a ledge`);
   }
  }
 }
 const count=root.children.length;installCampaignEnvironment(game,level,theme);assert.equal(root.children.length,count,'install is idempotent');
 level.dispose();
});

test('ornamental motion follows elapsed simulation time, freezes at zero dt and resets without changing delegated behavior',()=>{
 const a=fixture(),b=fixture(),theme=CAMPAIGN_THEMES[0];installCampaignEnvironment(a.game,a.level,theme);installCampaignEnvironment(b.game,b.level,theme);
 const beads=f=>f.level.campaignEnvironment.root.getObjectByName('Chapter ambient motion / ornamental beads');
 const initial=Array.from(beads(a).instanceMatrix.array);
 for(let i=0;i<120;i++)assert.equal(a.level.update(1/60),'updated');
 for(let i=0;i<240;i++)b.level.update(1/120);
 assert.equal(a.level.renderUpdate(1),'rendered');b.level.renderUpdate(1);
 const first=Array.from(beads(a).instanceMatrix.array),second=Array.from(beads(b).instanceMatrix.array);
 assert.notDeepEqual(first,initial);first.forEach((n,i)=>assert.ok(Math.abs(n-second[i])<1e-6,'motion depends on tick frequency'));
 for(let i=0;i<10;i++)a.level.update(0);a.level.renderUpdate(1);assert.deepEqual(Array.from(beads(a).instanceMatrix.array),first,'zero dt advanced decoration');
 a.game.epicOptions={reducedMotion:true};a.level.renderUpdate(1);assert.deepEqual(Array.from(beads(a).instanceMatrix.array),initial);
 a.game.epicOptions={reducedMotion:false};assert.equal(a.level.reset(),'reset');assert.equal(a.level.campaignEnvironment.elapsed,0);
 assert.deepEqual(Array.from(beads(a).instanceMatrix.array),initial);
 assert.deepEqual(a.counts(),{updates:130,renders:3,resets:1,disposals:0});a.level.dispose();b.level.dispose();
});

test('level disposal releases every generated resource exactly once and stops later decoration updates',()=>{
 const f=fixture();installCampaignEnvironment(f.game,f.level,CAMPAIGN_THEMES[2]);const env=f.level.campaignEnvironment;
 const geometries=new Set(),materials=new Set();env.root.traverse(n=>{if(n.geometry)geometries.add(n.geometry);if(n.material)materials.add(n.material);});
 let releasedGeometry=0,releasedMaterial=0;for(const g of geometries)g.addEventListener('dispose',()=>releasedGeometry++);for(const m of materials)m.addEventListener('dispose',()=>releasedMaterial++);
 const beads=env.root.getObjectByName('Chapter ambient motion / ornamental beads'),initial=Array.from(beads.instanceMatrix.array);
 f.level.dispose();f.level.dispose();assert.equal(env.root.parent,null);assert.equal(env.disposed,true);
 assert.equal(releasedGeometry,geometries.size);assert.equal(releasedMaterial,materials.size);assert.equal(f.counts().disposals,1);
 f.level.update(1);f.level.renderUpdate(1);assert.deepEqual(Array.from(beads.instanceMatrix.array),initial);
});

test('absence of a genuine wall support creates no floating ornament or update wrapper',()=>{
 const f=fixture();delete f.level.workshop;const update=f.level.update;installCampaignEnvironment(f.game,f.level,CAMPAIGN_THEMES[0]);
 assert.equal(f.level.campaignEnvironment,undefined);assert.equal(f.level.update,update);
});

test('a small detail budget covers every wall before repeating one bay',()=>{
 const f=fixture(),sites=campaignOrnamentSites(f.game,f.level,{limit:4});
 assert.equal(sites.length,4);assert.equal(new Set(sites.map(s=>s.normal.toArray().join('/'))).size,4);
});

test('discovery calibrations use offset open arcs and copper rather than closed porcelain-like portal targets',()=>{
 const f=fixture();installCampaignEnvironment(f.game,f.level,CAMPAIGN_THEMES[0]);const {root,diagnostics}=f.level.campaignEnvironment;
 const arcs=root.children.filter(mesh=>mesh.name.startsWith('Chapter ornament / arc /'));
 assert.equal(arcs.length,2);assert.ok(root.children.every(mesh=>!mesh.name.startsWith('Chapter ornament / ring /')));
 for(const arc of arcs){assert.equal(arc.geometry.type,'TorusGeometry');assert.ok(arc.geometry.parameters.arc<Math.PI,'calibration became a closed portal-like rim');}
 const a=new THREE.Matrix4(),b=new THREE.Matrix4();arcs[0].getMatrixAt(0,a);arcs[1].getMatrixAt(0,b);
 assert.ok(new THREE.Vector3().setFromMatrixPosition(a).distanceTo(new THREE.Vector3().setFromMatrixPosition(b))>.3,'arcs are concentric');
 const copper=arcs.find(mesh=>mesh.name.endsWith('/ paint')).material;
 assert.equal(copper.color.getHex(),0x8c6a48);assert.ok(diagnostics.batches<=5,'open arcs added draw submissions');
 const centerMesh=root.children.find(mesh=>/porcelain|ceramic|centre|center/i.test(mesh.name));assert.equal(centerMesh,undefined);
 f.level.dispose();
});

test('observed return-sluice wall fields receive eye-height relief while moving and portal surfaces remain excluded',()=>{
 const f=fixture(),frame={center:V(-15.2,8,9.13),normal:V(0,0,1),right:V(1,0,0),up:V(0,1,0)};
 f.level.id='post-air-switch';f.level.spawn=[-5,0,19];
 const group=new THREE.Group();f.level.world.root.add(group);
 const surface={name:'Sealed partition',group,width:25.6,height:16,portal:false,collider:{kinematic:false},getFrame:()=>frame};
 f.level.world.surfaces=[surface,{...surface,collider:{kinematic:true},getFrame:()=>({...frame,center:V(-15.2,8,3)})},
  {...surface,portal:true,getFrame:()=>({...frame,center:V(-15.2,8,-3)})}];
 const sites=campaignOrnamentSites(f.game,f.level,{limit:8}),near=sites.filter(s=>Math.abs(s.center.z-9.13)<.001);
 assert.ok(near.length>0);assert.ok(Math.abs(near[0].center.y-3.4)<1e-9);assert.ok(Math.abs(near[0].center.x+5)<3);
 assert.ok(sites.every(s=>Math.abs(s.center.z-3)>.001&&Math.abs(s.center.z+3)>.001));
 installCampaignEnvironment(f.game,f.level,CAMPAIGN_THEMES[3]);
 assert.ok(f.level.campaignEnvironment.diagnostics.triangles<=10896);
 assert.ok(f.level.campaignEnvironment.diagnostics.instances<=144);f.level.dispose();
});

test('observed archive screen relief needs its full footprint inside the authored fixed shell slab',()=>{
 const f=fixture(),box=new THREE.Box3(V(-29,0,-4.33),V(-3.3,27,-3.67));
 const mesh=new THREE.Mesh();mesh.name='Folded shell casing / collision';
 f.level.id='puzzle-progression47-impact-archive';f.level.spawn=[-23,12,19];
 f.level.workshop.envelopes=[{mesh,box,kinematic:false,enabled:true}];
 const sites=campaignOrnamentSites(f.game,f.level,{limit:8}),near=sites.filter(s=>Math.abs(s.center.z+3.645)<.001);
 assert.ok(near.length>0);assert.equal(near[0].center.y,15.4);
 for(const site of near)for(const x of [-1,1])for(const y of [-1,1])assert.ok(box.containsPoint(site.center.clone()
  .addScaledVector(site.right,x*site.halfWidth).addScaledVector(site.up,y*site.halfHeight).addScaledVector(site.normal,-.1)));
 f.level.workshop.envelopes[0].kinematic=true;
 assert.ok(campaignOrnamentSites(f.game,f.level,{limit:8}).every(s=>Math.abs(s.center.z+3.645)>.001));
});

test('castle lancets face the atrium on complete fixed piers and reserve actual portal openings',()=>{
 const f=fixture();delete f.level.workshop;f.level.tower=true;
 f.level.rooms=new Map([['wing',{b:{x0:-20,x1:-4,z0:-10,z1:10},def:{id:'wing',at:[-12,0,0]}}]]);
 const material=new THREE.MeshStandardMaterial({name:'Castle wing wall / wing'});
 for(const z of [-6,6]){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(.5,6.8,8),material);mesh.position.set(-4,3.4,z);f.level.structure.add(mesh);
  f.game.colliders.push({mesh,box:new THREE.Box3().setFromObject(mesh),kinematic:false,enabled:true});
 }
 const frame={center:V(-3.75,3.3,5),normal:V(1,0,0),right:V(0,0,-1),up:V(0,1,0),halfWidth:1.2,halfHeight:2};
 f.level.panels.atrium={getFrame:()=>frame};
 const sites=campaignOrnamentSites(f.game,f.level);
 assert.equal(sites.length,1);assert.ok(sites[0].center.z<0);assert.equal(sites[0].normal.x,1);
 assert.equal(sites[0].height,3.8);assert.equal(sites[0].center.y,3.3);
 const projection={...frame,center:frame.center.clone().setX(sites[0].center.x)};
 assert.equal(architecturalRectOverlapsPortal(sites[0],projection,.45),false);
 f.game.colliders.filter(c=>c.mesh.material===material).forEach(c=>c.kinematic=true);
 assert.equal(campaignOrnamentSites(f.game,f.level).length,0,'a moving or missing pier gained a floating ornament');
});
