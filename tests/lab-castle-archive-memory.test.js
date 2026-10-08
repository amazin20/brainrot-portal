import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createArchiveRatchet,buildCastleArchiveMemory} from '../src/game/LabCastleArchiveMemory.js';
import {SingularityKit,V} from '../src/game/LabSingularityKit.js';
import {SINGULARITY_ROOMS} from '../src/game/LabSingularityLayout.js';

test('a rack spring rejects a pulse before a tooth and retains a captured stroke after complete power loss',()=>{
 const rack=createArchiveRatchet();rack.update(1,.2);assert.ok(rack.position>0&&rack.position<.25);
 rack.update(0,1);assert.equal(rack.position,0);
 rack.update(1,.5);assert.equal(rack.stop,.25);rack.update(0,5);assert.equal(rack.position,.25);
 rack.update(1,3);assert.equal(rack.position,1);rack.update(0,60);assert.equal(rack.position,1);
 rack.reset();assert.deepEqual(rack.snapshot(),{position:0,retainingNotch:0,power:0});
});

// Explicit source samples in a geometry fixture; this is not an ordinary-input
// solution. The separate three complete routes and E counterfactual use the
// actual fluid/ray mechanism and retain the original actors.
function fixture(){
 const game={scene:new THREE.Scene(),colliders:[],floors:[],cameraBlockers:[],aimBlockers:[],portalPanels:[],playerPosition:V(2,18,54),cargo:{position:V(4,18.4,54)}};
 const k=new SingularityKit(game),rooms=new Map();
 for(const def of SINGULARITY_ROOMS){const[x,y,z]=def.at;rooms.set(def.id,{def,door:[x+def.w/2,y,z],P:(a,c=0,h=0)=>[x+a,y+h,z+c]});}
 let powered=false,waterOn=false;const volumes=[10,0,0],gate={progress:0};
 const water={volumes,get flowing(){return false;},get height(){return waterOn?0:-5;}};
 const light={get beamPowered(){return powered;}};
 const machines=new Map([['sluice',{state:water}],['optics',{state:light}]]);
 const memory=buildCastleArchiveMemory({k,rooms,machines,gate});
 return{game,k,rooms,gate,memory,setWater(on){waterOn=on;volumes.splice(0,3,...(on?[5,5,0]:[10,0,0]));},setLight(on){powered=on;},dispose(){k.dispose();}};
}

test('one true source retracts only its own lock rack and leaves the common doorway constrained',()=>{
 for(const key of ['hydraulic','optical']){
  const f=fixture();try{
   if(key==='hydraulic')f.setWater(true);else f.setLight(true);
   f.memory.update(4);const d=f.memory.diagnostics();
   assert.equal(d[key].position,1);assert.equal(d[key==='hydraulic'?'optical':'hydraulic'].position,0);
   assert.equal(f.memory.released(),false);assert.ok(d.boltClearance.some(g=>g<0));
   assert.equal(d.readsAchievements,false);
  }finally{f.dispose();}
 }
});

test('the actual visible racks, pawls and door arms retain earned clearance after both raw inputs disappear',()=>{
 const f=fixture();try{
  f.setWater(true);f.setLight(true);f.memory.update(4);assert.equal(f.memory.released(),true);
  const positions=f.memory.assemblies.map(a=>a.bolt.position.toArray());
  f.setWater(false);f.setLight(false);f.memory.update(30);assert.equal(f.memory.released(),true);
  assert.deepEqual(f.memory.assemblies.map(a=>a.bolt.position.toArray()),positions);
  for(const a of f.memory.assemblies){assert.equal(a.drive.stop,1);assert.equal(a.pawl.rotation.z,0);assert.ok(a.bolt.parent===f.k.root);assert.ok(a.bolt.userData.collider.kinematic);}
  f.gate.progress=.7;f.memory.syncDoorYoke(1/120);
  for(const a of f.memory.assemblies){assert.ok(Math.abs(a.shoe.position.z-f.rooms.get('archive').door[2]-a.sign*(3.4+3.5*.7))<1e-8);}
  f.memory.reset();assert.equal(f.memory.released(),false);assert.ok(f.memory.diagnostics().boltClearance.every(g=>g<0));
 }finally{f.dispose();}
});

test('a nearly complete uncaptured stroke releases transiently, then springs back and blocks the yoke',()=>{
 const f=fixture();try{
  f.setWater(true);f.setLight(true);f.memory.update(.95/.65);
  assert.equal(f.memory.released(),true);
  assert.equal(f.memory.diagnostics().hydraulic.retainingNotch,.75);
  f.setWater(false);f.setLight(false);f.memory.update(2);
  assert.equal(f.memory.released(),false);
  assert.equal(f.memory.diagnostics().hydraulic.position,.75);
 }finally{f.dispose();}
});

test('each captured tooth rests by its lower shoulder on the founded pawl and door arms clear static guides over their stroke',()=>{
 const f=fixture(),matrix=new THREE.Matrix4(),position=new THREE.Vector3();try{
  f.setWater(true);f.setLight(true);
  for(let notch=1;notch<=4;notch++){
   f.memory.update(.25/.65);
   for(const [index,a]of f.memory.assemblies.entries()){
    f.memory.teeth.getMatrixAt(index*4+4-notch,matrix);position.setFromMatrixPosition(matrix);
    assert.ok(Math.abs(position.y-.07-(a.pawl.position.y+.07))<1e-5,'Lower tooth shoulder must support the returning rack on the pawl top (Float32 instance matrix)');
    assert.equal(a.pawl.rotation.z,0);
   }
  }
  const guides=f.memory.solids.filter(c=>c.mesh.name.endsWith('open rack guide'));
  for(const progress of [0,.25,.5,.75,1]){
   f.gate.progress=progress;f.memory.syncDoorYoke(1/120);
   for(const a of f.memory.assemblies)for(const guide of guides)assert.equal(a.shoe.userData.collider.box.intersectsBox(guide.box),false,'The translating door arm must clear each fixed guide');
  }
 }finally{f.dispose();}
});

test('archive memory is mounted outside the standing entry and keeps original actor and source state untouched',()=>{
 const f=fixture();try{
  const r=f.rooms.get('archive'),p=r.door;
  const entrance=new THREE.Box3(V(p[0]-.4,p[1]+.01,p[2]-3.3),V(p[0]+.8,p[1]+2.9,p[2]+3.3));
  for(const c of f.memory.solids)assert.equal(c.box.intersectsBox(entrance),false,c.mesh.name+' occupies the standing entry');
  assert.equal(f.game.floors.length,0,'No new step or gameplay deck may bypass a wing');
  const actors=JSON.stringify({player:f.game.playerPosition.toArray(),cargo:f.game.cargo.position.toArray()});
  f.setWater(true);f.setLight(true);f.memory.update(4);f.gate.progress=1;f.memory.syncDoorYoke(1/120);
  assert.equal(JSON.stringify({player:f.game.playerPosition.toArray(),cargo:f.game.cargo.position.toArray()}),actors);
  assert.deepEqual(f.memory.diagnostics().inputs,{hydraulic:1,optical:1});
 }finally{f.dispose();}
});
