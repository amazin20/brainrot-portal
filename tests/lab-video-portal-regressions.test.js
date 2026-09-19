import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createHeadlessGame } from '../scripts/lab-headless.mjs';
import { runV8Journey } from '../src/game/LabV8Journey.js';
import { installRoom21Aim } from '../src/game/LabRoom21Journey.js';
import { resolvePortalPlacement, pointInsidePortal } from '../src/game/LabPortals.js';
const V=THREE.Vector3;

// Isolated reproduction of the first user-video symptom. Only this fixture
// places the actor; the separate wall test below uses a complete input route.
function floorFixture(g, angle=0, orientation=0) {
  g.resetRun(true);g.yaw=orientation;
  const panel=g.firstLevel.panels['shared-well'];
  for(const [index,z] of [[0,-1],[1,7]]) assert.ok(g.placeOnPanel(index,panel.mesh,new V(0,.025,z)));
  const entry=g.portals.portals[1];
  const local=new V(.75*1.09*Math.cos(angle),1.15*1.09*Math.sin(angle),0);
  const feet=local.applyQuaternion(entry.quaternion).add(entry.position);
  g.playerPosition.copy(feet);g.previousPlayerPosition.copy(feet);g.playerGroup.position.copy(feet);
  g.playerVelocity.set(0,0,0);g.playerGrounded=true;g.cameraRig.reset(feet,g.yaw,-.5);
  assert.ok(pointInsidePortal(entry,feet,0));assert.ok(!pointInsidePortal(entry,feet,.43));
  return entry;
}

test('a resting rounded foot at the visible floor opening drops through instead of standing on a hidden disc',async()=>{
  const g=await createHeadlessGame();await g.selectLevel(20,false);
  try {
    const cargoId=g.physics.cargoBody.id;
    for(const hz of [30,60,120]) for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5]) {
      floorFixture(g,angle);let minY=0,maxStep=0,ticks=0;
      for(let frame=0;frame<hz*2&&!g.teleportCount;frame++){
        for(let j=0;j<120/hz&&!g.teleportCount;j++){
          const before=g.playerPosition.clone();g.updatePlaying(1/120);ticks++;
          if(!g.teleportCount){maxStep=Math.max(maxStep,before.distanceTo(g.playerPosition));minY=Math.min(minY,g.playerPosition.y);}
        }
        g.updateVisuals(1/hz,1);
      }
      assert.equal(g.teleportCount,1,`hz${hz},angle${angle}`);
      assert.ok(minY> -1.23);assert.ok(maxStep<.1,'No snap to the aperture centre');
      assert.ok(ticks<240);assert.equal(g.portalFootContact,null);
      assert.equal(g.physics.cargoBody.id,cargoId);
    }
  } finally {g.physics.dispose();g.portals.dispose();}
});

test('rotated floor apertures, long display intervals and rim escape retain finite bounded contact',async()=>{
  const g=await createHeadlessGame();await g.selectLevel(20,false);
  try{
    for(const orientation of [-.7,.9]){
      const entry=floorFixture(g,0,orientation);let ticks=0;
      // One 250 ms display gap groups the same 120 Hz physics steps. This is
      // a simulation grouping test, not measured device FPS or animate's cap.
      for(const dt of [.25,...Array(90).fill(1/60)]){
        for(let n=0;n<Math.round(dt*120)&&!g.teleportCount;n++){g.updatePlaying(1/120);ticks++;}
        g.updateVisuals(dt,1);if(g.teleportCount)break;
      }
      assert.equal(g.teleportCount,1);assert.ok(ticks<240);assert.ok(g.playerPosition.toArray().every(Number.isFinite));
      assert.notEqual(g.portalFootContact,entry);
    }
    floorFixture(g);g.updatePlaying(1/120);assert.ok(g.portalFootContact);
    g.clearPortals();assert.equal(g.portalFootContact,null);
    floorFixture(g);g.updatePlaying(1/120);const old=g.portalFootContact;
    assert.ok(g.placeOnPanel(1,g.firstLevel.panels['shared-well'].mesh,new V(0,.025,3.5)));
    g.updatePlaying(1/120);assert.notEqual(g.portalFootContact,old);
    g.resetRun(true);assert.equal(g.portalFootContact,null);assert.equal(g.portalFootExit,null);
    // Explicit exit-footprint fixture supplements the unchanged ordinary
    // room18 return route: passive contact rearms after leaving the exit.
    const exit=floorFixture(g);g.portalFootExit=exit;
    g.updatePlaying(1/120);assert.equal(g.portalFootContact,null);
    g.playerPosition.set(4,.025,7);g.previousPlayerPosition.copy(g.playerPosition);
    g.updatePlaying(1/120);assert.equal(g.portalFootExit,null);
  }finally{g.physics.dispose();g.portals.dispose();}
});

test('solid floor outside an opening and an unlinked portal do not pull the player in',async()=>{
  const g=await createHeadlessGame();await g.selectLevel(20,false);
  try{
    floorFixture(g);g.playerPosition.set(1.4,.025,7);g.previousPlayerPosition.copy(g.playerPosition);
    const start=g.playerPosition.clone();
    for(let i=0;i<240;i++)g.updatePlaying(1/120);
    assert.equal(g.teleportCount,0);assert.ok(g.playerGrounded);assert.ok(Math.abs(g.playerPosition.x-start.x)<1e-10);
    floorFixture(g);g.portals._remove(0);
    for(let i=0;i<240;i++)g.updatePlaying(1/120);
    assert.equal(g.teleportCount,0);assert.ok(g.playerGrounded);assert.equal(g.portalFootContact,null);
  }finally{g.physics.dispose();g.portals.dispose();}
});

function panelFixture(){
  const panel=new THREE.Mesh(new THREE.BoxGeometry(5.6,4.6,.2),new THREE.MeshBasicMaterial());
  panel.position.set(0,2,0);panel.updateMatrixWorld(true);
  Object.assign(panel.userData,{portalable:true,center:new V(0,2,.1),normal:new V(0,0,1),portalBounds:{halfWidth:2.8,halfHeight:2.3}});
  const floor={enabled:true,box:new THREE.Box3(new V(-10,-.3,-10),new V(10,0,10))};
  return{panel,floor};
}

test('low shots fit above the adjacent floor on the same white wall without hiding a collision',()=>{
  const {panel,floor}=panelFixture();
  try{
    for(const y of [.1,.5,1,1.5])for(const x of [-.6,0,.6]){
      const result=resolvePortalPlacement(panel,new V(x,y,.1),{blockers:[floor]});
      assert.ok(result.ok);assert.ok(result.adjusted&&result.fittedToFloor);
      assert.ok(result.position.y-result.frame.height*1.1>.02);
      assert.ok(Math.abs(result.position.x-x)<1e-9);assert.equal(result.position.z,.1);
      assert.ok(result.position.y<=2.542);
    }
    const centre=resolvePortalPlacement(panel,new V(0,2,.1),{blockers:[floor]});
    assert.ok(centre.ok);assert.equal(centre.adjusted,false);assert.deepEqual(centre.position.toArray(),[0,2,.1]);
    assert.equal(resolvePortalPlacement(panel,new V(0,1.5,.1),{blockers:[floor],clampToFit:false}).reason,'obstructed');
  }finally{panel.geometry.dispose();panel.material.dispose();}
});

test('floor fitting cannot evade a pillar, jump to another panel, overlap an existing portal or leave its rim outside',()=>{
  const {panel,floor}=panelFixture();
  try{
    const pillar={box:new THREE.Box3(new V(-1,0,.2),new V(1,3,.8))};
    assert.equal(resolvePortalPlacement(panel,new V(0,.5,.1),{blockers:[floor,pillar]}).ok,false);
    assert.equal(resolvePortalPlacement(panel,new V(8,.5,.1),{blockers:[floor]}).reason,'outside');
    const a=resolvePortalPlacement(panel,new V(0,2,.1));
    assert.equal(resolvePortalPlacement(panel,new V(0,.5,.1),{blockers:[floor],otherPortal:a.frame}).ok,false);
    panel.userData.portalBounds.halfHeight=1.7;
    assert.equal(resolvePortalPlacement(panel,new V(0,.5,.1),{blockers:[floor]}).ok,false);
  }finally{panel.geometry.dispose();panel.material.dispose();}
});

test('the low wall shot from the user-video location is fired and traversed by normal input without jumping',async()=>{
  const g=await createHeadlessGame();await g.selectLevel(20,false);
  try{
    const result=await runV8Journey(g,{scenario:async d=>{
      installRoom21Aim(d);d.walk(-10,14);d.aim(0,new V(-14.8,10.5,14));
      assert.ok(g.portals.portals[0].position.y<11.77);
      d.walk(-14,13);d.aim(1,d.level.panels['brake-bay'].getFrame().center);
      d.enter(d.level.panels['departure-entry']);
      assert.equal(g.teleportCount,1);assert.ok(g.playerPosition.y>3.9&&g.playerPosition.y<4.1);
      d.mark('low shot fits and player crosses without a jump');
    }});
    assert.ok(result.pass);assert.equal(result.respawns+result.resets,0);
  }finally{g.physics.dispose();g.portals.dispose();}
});


test('resting rim contact does not pin position and accumulate kinetic energy before transfer',async()=>{
  const g=await createHeadlessGame();await g.selectLevel(20,false);
  try{
    for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
      floorFixture(g,angle);
      const initial=19.5*g.playerPosition.y;let previous=g.playerPosition.clone(),stuck=0;
      for(let tick=0;tick<240&&!g.teleportCount;tick++){
        g.updatePlaying(1/120);if(g.teleportCount)break;
        const energy=19.5*g.playerPosition.y+.5*g.playerVelocity.lengthSq();
        assert.ok(energy<=initial+1e-6,`contact injected energy ${energy-initial}`);
        if(g.portalFootContact&&g.playerVelocity.length()>.3&&g.playerPosition.distanceTo(previous)<1e-6)stuck++;
        previous.copy(g.playerPosition);
      }
      assert.equal(g.teleportCount,1);assert.equal(stuck,0,'Tangent speed must not charge behind an immobile position');
    }
  }finally{g.physics.dispose();g.portals.dispose();}
});
