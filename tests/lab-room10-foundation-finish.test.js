import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {disposeLabLevel} from '../src/game/LabLevelLifecycle.js';
import {LabPhysics} from '../src/game/LabPhysics.js';
import {buildWorkshopCampaign} from '../src/game/LabWorkshopCampaign.js';
import {finishBrowserArt} from '../src/game/LabCampaignLevels.js';
import {finishVisualAuditEarly} from '../src/game/LabVisualAuditEarly.js';
import {freightBankFoundationGeometry} from '../src/game/LabEarlyMachineConstruction.js';
import {gameplayContract} from './helpers/lab-art-contract.js';

const V=(...v)=>new THREE.Vector3(...v);
const banks=[[-8.375,.81,2,6.45,1.62,7.6],[-3.2,.81,4.46,3.9,1.62,2.68],[5.55,.81,1.55,6.5,1.62,6.7]];

async function fixture(){
 const game=await createHeadlessGame();game.chamberEdition='foundation';disposeLabLevel(game);game.levelIndex=9;
 const roots=new Set(game.scene.children),level=finishBrowserArt(buildWorkshopCampaign(game,9));game.firstLevel=level;
 game.levelRoots=game.scene.children.filter(root=>!roots.has(root));
 game.playerPosition.fromArray(level.spawn);game.previousPlayerPosition.copy(game.playerPosition);game.cargo.position.fromArray(level.cargoSpawn);
 game.physics=new LabPhysics();for(const c of game.colliders)game.physics.addStaticBox(c.mesh.uuid,c.box,{kinematic:!!c.kinematic,enabled:c.enabled!==false});
 game.physics.createCargo({position:game.cargo.position,size:.78,mass:3.2});
 const sources=banks.map(([x,y,z,w,h,d])=>{
  const c=game.colliders.find(c=>{const p=c.mesh.geometry?.parameters;return p&&Math.abs(p.width-w)<1e-6&&Math.abs(p.height-h)<1e-6&&Math.abs(p.depth-d)<1e-6&&c.mesh.getWorldPosition(V()).distanceTo(V(x,y,z))<1e-6;});
  assert.ok(c,'The actual bank source must exist');return{collider:c,mesh:c.mesh,geometry:c.mesh.geometry,children:[...c.mesh.children],body:game.physics.solids.get(c.mesh.uuid).body,bounds:c.box.clone()};
 });
 const before=gameplayContract(game),body=game.physics.cargoBody,shape=body.shapes[0];finishVisualAuditEarly(game,level,9);game.levelRoots.push(level.visualAuditEarly.root);level.renderUpdate(1);game.scene.updateMatrixWorld(true);
 return{game,level,sources,before,body,shape,dispose(){disposeLabLevel(game);}};
}

test('the real three dock-bank drawings preserve original owners, exact contact bounds and all interaction frames',async()=>{
 const f=await fixture();try{
  assert.deepEqual(gameplayContract(f.game),f.before);
  for(const source of f.sources){
   assert.equal(source.mesh.geometry,source.geometry);assert.deepEqual(source.mesh.children,source.children);
   assert.equal(f.game.physics.solids.get(source.mesh.uuid).body,source.body);assert.ok(source.collider.box.equals(source.bounds));
   const drawings=[];f.level.visualAuditEarly.root.traverse(n=>{if(n.userData.physicalSourceId===source.mesh.uuid)drawings.push(n);});
   assert.equal(drawings.length,1,'One source receives one dedicated drawing, without stacked skins');
   const drawing=drawings[0];assert.match(drawing.geometry.name,/Freight dock foundation/);
   const actual=new THREE.Box3().setFromObject(drawing);assert.ok(actual.min.distanceTo(source.bounds.min)<2e-6&&actual.max.distanceTo(source.bounds.max)<2e-6,'The integral casting retains all six source extrema');
  }
  assert.equal(f.game.physics.cargoBody,f.body);assert.equal(f.body.shapes[0],f.shape);
 }finally{f.dispose();}
});

test('closed dock castings have founded lower edges and an upper shoulder behind the actual overlapping deck skirt',()=>{
 for(const [,,,w,h,d]of banks){
  const g=freightBankFoundationGeometry(w,h,d),material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),mesh=new THREE.Mesh(g,material);mesh.updateMatrixWorld(true);
  try{
   assert.ok(g.attributes.position.array.every(Number.isFinite));assert.ok(g.attributes.normal.array.every(Number.isFinite));
   const hit=(p,v)=>new THREE.Raycaster(V(...p),V(...v)).intersectObject(mesh)[0];
   for(const sign of [-1,1]){
    // The old bank skirt starts at local y=.61. Its exterior plane must not
    // coincide with the new casting at any sampled height inside that band.
    for(const y of [.64,.70,.79]){
     const z=hit([0,y,sign*(d/2+1)],[0,0,-sign]);assert.ok(z,'The recessed upper side remains closed');
     assert.ok(sign*z.point.z<d/2-.01,'The drawing must clear the overlapping deck side, not duplicate its plane');
     const x=hit([sign*(w/2+1),y,0],[-sign,0,0]);assert.ok(x);assert.ok(sign*x.point.x<w/2-.01);
    }
    const base=hit([0,-h/2+.04,sign*(d/2+1)],[0,0,-sign]);assert.ok(base);assert.ok(Math.abs(base.point.z-sign*d/2)<1e-6,'The founded foot still meets the authored outside plane');
   }
   const roof=hit([0,h/2+1,0],[0,-1,0]);assert.ok(roof);assert.ok(Math.abs(roof.point.y-h/2)<1e-6,'The concealed upper closure retains its original height');
   const down=hit([0,-h/2-1,0],[0,1,0]);assert.ok(down);assert.ok(Math.abs(down.point.y+h/2)<1e-6,'The bottom is a closed grounded face');
  }finally{g.dispose();material.dispose();}
 }
});

test('prepared contact fixture: original companion still rests on the same real room10 bank floor',async()=>{
 const f=await fixture();try{
  // The cassette occupies the inner half of this bank. Use its clear outer
  // corner, away from both imported machine envelopes and white addresses.
  const body=f.body;body.position.set(-10.5,2.8,-.8);body.previousPosition.copy(body.position);body.interpolatedPosition.copy(body.position);body.velocity.setZero();body.angularVelocity.setZero();body.quaternion.set(0,0,0,1);body.aabbNeedsUpdate=true;body.wakeUp();
  for(let i=0;i<240;i++)f.game.physics.step(1/120);
  // Sleeping bodies may no longer emit active contact equations. Wake the
  // same settled body and sample a fresh physical support solve.
  body.wakeUp();f.game.physics.step(1/120);
  assert.equal(f.game.physics.cargoBody,body);assert.equal(body.shapes[0],f.shape);
  assert.ok(Math.abs(body.position.y-(1.82+.39))<.01,'Visual construction must retain the actual original bank-floor contact: '+JSON.stringify(body.position.toArray()));
  const contacts=f.game.physics.world.contacts.filter(c=>c.enabled!==false&&c.multiplier>1e-6&&[c.bi,c.bj].includes(body)&&(c.bi===body?-c.ni.y:c.ni.y)>.65);
  assert.ok(contacts.length>0,'The unchanged floor, rather than the casting drawing, supports the original body');
  assert.ok(contacts.every(c=>f.sources.every(s=>![c.bi,c.bj].includes(s.body))),'The concealed bank foundation must not replace its walking floor');
 }finally{f.dispose();}
});
