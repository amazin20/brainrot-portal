import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runRoom17UnsupportedAttempt} from '../scripts/qa-room17-unsupported.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {InputController} from '../src/game/InputController.js';
import {support17Service,support17Departure} from '../src/game/LabCreativeRoom17Journey.js';
import {installPreciseLateAim,aimLateSurface} from '../src/game/LabLateCampaignAim.js';
import {uprightCapsuleFitsPortal,orientedBoxFitsPortal} from '../src/game/LabPortals.js';
import {LabPreferences,CREATIVE_CAMPAIGN_REVISION} from '../src/game/LabPreferences.js';
import {foundationStorage} from '../src/game/LabFoundationEdition.js';
const V=(...p)=>new THREE.Vector3(...p),g=await createHeadlessGame();g.chamberEdition='foundation';
after(()=>{g.firstLevel.dispose?.();g.physics.dispose();g.portals.dispose();});
for(const options of [{},{route:'lower-branch'},{swapColours:true},{recovery:true}])test('17 ordinary-input live architectural support '+JSON.stringify(options),async()=>{
 await g.selectLevel(16,false);const cargo=g.cargo,body=g.physics.cargoBody,events=[];
 const report=await runV8Journey(g,{journeyOptions:options,onMilestone:m=>{events.push({name:m.name,angle:g.firstLevel.beam.angle,tension:g.firstLevel.beam.tension,grounded:g.playerGrounded});}});
 assert.equal(report.pass,true);assert.equal(g.state,'won');assert.equal(report.resets+report.respawns,0);assert.equal(report.teleports,0);assert.equal(g.physics.portalTransports,2);assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody,body);
 assert.equal(g.firstLevel.creativeEarly,17);assert.equal(g.firstLevel.id,'foundation-cable-supported-architecture');
 const support=events.find(e=>e.name.includes(options.route?'current lower branch':'current upper branch'));assert.ok(support?.tension>30);
 if(options.route){assert.ok(support.angle<-.10&&support.angle>-.62,JSON.stringify(support));assert.equal(events.some(e=>e.name.includes('current upper branch')),false,'Lower plan must not borrow the high support first');assert.ok(events.some(e=>e.name.includes('permanent lower gallery')&&e.grounded));}
 else assert.ok(events.some(e=>e.name.includes('permanent upper ground')&&e.grounded));
 assert.ok(events.some(e=>e.name.includes('unsupported floor falls')&&e.angle<-.62&&e.tension===0),'Current pair removal must actually drop the floor');
 if(options.recovery)assert.ok(events.some(e=>e.name.includes('dry floor without resetting')));
 console.log('ROOM17',JSON.stringify({options,frames:report.frames,playerPortals:report.teleports,cargoPortals:g.physics.portalTransports,resets:report.resets,respawns:report.respawns,events}));
});
for(const held of [false,true])test('17 real upright body cannot use the ready early freight floor pair, carrying='+held,async()=>{
 await g.selectLevel(16,false);await runV8Journey(g,{scenario:d=>{
  installPreciseLateAim(d);d.walk(-12,12);aimLateSurface(d,1,d.level.cargoReceiver);aimLateSurface(d,0,d.level.feed.surface,V(-13.8,d.level.feed.surface.getFrame().center.y,12));
  assert.ok(g.portals.ready);assert.equal(uprightCapsuleFitsPortal(g.portals.portals[1],2.4,.43),false);assert.ok(orientedBoxFitsPortal(g.portals.portals[1],g.portals.portals[1].position,new THREE.Quaternion(),.39));
  if(held){d.walk(g.cargo.position.x-1.3,g.cargo.position.z);d.pickup();}d.walk(-13.8,12);
  for(let f=0;f<300;f++){d.worldMove(0,f%120<60?1:-1);if(f%45===0)g.input.jumpQueued=true;d.frame();}d.stop();
  assert.equal(g.teleportCount,0);assert.equal(g.firstLevel.beam.tension,0);assert.equal(g.firstLevel.beam.angle,-.67);assert.equal(g.state,'playing');if(held)assert.ok(g.heldCube);
 }});
});
test('17 a connected high cable with original body still on departure cannot supply architectural support',async()=>{
 await g.selectLevel(16,false);await runV8Journey(g,{scenario:d=>{installPreciseLateAim(d);support17Service(d);d.walk(-18,3);aimLateSurface(d,1,d.level.anchor);support17Departure(d);d.walk(-12,12);aimLateSurface(d,0,d.level.highLead);d.wait(6);assert.ok(g.portals.ready);assert.equal(d.level.beam.tension,0);assert.equal(d.level.beam.angle,-.67);assert.equal(g.physics.portalTransports,0);assert.equal(g.state,'playing');}});
});
test('17 new-room revision invalidates only its actual old completion and hints, preserving all other saved fields and classic namespace',()=>{
 const key='brainrot-foundation-v1:brainrot-portal.preferences.v24',classic='brainrot-portal.preferences.v24',completed=Array.from({length:52},(_,i)=>i),original={campaignRevision:CREATIVE_CAMPAIGN_REVISION,roomRevisions:{32:'siphon-observatory-v1',50:'echo-horizon-v1'},completed,hints:Object.fromEntries(completed.map(i=>[i,2])),quality:'high',volume:.2,muted:true,tutorial:false,resumeLevel:16};
 const records=new Map([[key,JSON.stringify(original)],[classic,'classic-archive-record']]),storage={getItem:k=>records.get(k),setItem:(k,v)=>records.set(k,v)},options={campaignRevision:CREATIVE_CAMPAIGN_REVISION,roomRevisions:{16:'cable-supported-architecture-v1',32:'siphon-observatory-v1',50:'echo-horizon-v1'}};
 let p=new LabPreferences(foundationStorage(storage),options);assert.deepEqual(p.value.completed,completed.filter(i=>i!==16));assert.deepEqual(p.value.hints,Object.fromEntries(completed.filter(i=>i!==16).map(i=>[i,2])));for(const field of ['quality','volume','muted','tutorial','resumeLevel'])assert.equal(p.value[field],original[field]);assert.equal(records.get(classic),'classic-archive-record');
 p.complete(16);p.unlockHint(16);const once=records.get(key);p=new LabPreferences(foundationStorage(storage),options);assert.ok(p.value.completed.includes(16));assert.equal(p.value.hints[16],1);assert.equal(records.get(key),once);
});

test('17 formerly complete unsupported jump bypass cannot reach permanent receiving ground or joint goal',async()=>{
 await g.selectLevel(16,false);const cargo=g.cargo,body=g.physics.cargoBody;const report=await runV8Journey(g,{scenario:d=>{const row=runRoom17UnsupportedAttempt(d);assert.equal(row.unsupportedLanding,false);assert.equal(row.outcome,'blocked-before-permanent-landing');assert.ok(row.realTakeoffs>0,'Negative probe must actually jump');assert.ok(g.physics.portalTransports>0,'Original cargo really reaches the early receiver');assert.equal(d.level.beam.tension,0);assert.equal(d.level.beam.angle,-.67);assert.equal(g.state,'playing');}});assert.equal(report.resets+report.respawns,0);assert.equal(report.teleports,0);assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody,body);
});

// CPU route regression: production InputController jump consumption and camera
// aspect, with inert listener targets. The ordinary route driver supplies its
// movement vector; this is not trusted browser input or WebGL evidence.
test('17 both support routes keep the original cargo through production jump consumption at both recorded camera aspects',async()=>{
 const oldWindow=globalThis.window,oldDocument=globalThis.document;
 const target=()=>({addEventListener(){},removeEventListener(){},style:{},setAttribute(){}});
 try{
  for(const aspect of [854/480,16/9])for(const route of ['upper-branch','lower-branch']){
   const game=await createHeadlessGame();game.chamberEdition='foundation';
   try{
    await game.selectLevel(16,false);
    game.camera.aspect=aspect;game.camera.updateProjectionMatrix();
    globalThis.window=target();Object.assign(globalThis.document,target(),{hidden:false});
    const input=game.input=new InputController({joystick:target(),joystickKnob:target(),jumpButton:target(),sprintButton:target(),isActive:()=>game.state==='playing'&&!game.externalBlocked});
    const cargo=game.cargo,body=game.physics.cargoBody,requests=[];
    let actualJumpTakeoff=false,deliveryCapsuleBlocked=false,reunionCapsuleBlocked=false;
    const consumeJump=input.consumeJump;
    input.consumeJump=function(){
     const requested=this.jumpQueued,accepted=consumeJump.call(this);
     if(requested)requests.push({accepted,active:this.isActive(),disposed:this.disposed});
     return accepted;
    };
    const updatePlayer=game.updatePlayer;
    game.updatePlayer=function(dt){
     const result=updatePlayer.call(this,dt);
     if(requests.some(r=>r.accepted)&&!this.playerGrounded&&this.playerVelocity.y>5)actualJumpTakeoff=true;
     return result;
    };
    const report=await runV8Journey(game,{journeyOptions:{route},onMilestone:()=>{
     if(!game.portals.ready)return;
     for(const portal of game.portals.portals){
      if(portal.surfaceId===game.firstLevel.mouth.mesh.uuid){
       assert.equal(uprightCapsuleFitsPortal(portal,2.4,.43),false,'The actual ready delivery outlet must remain cargo-only');deliveryCapsuleBlocked=true;
      }
      if(portal.surfaceId===game.firstLevel.cargoReceiver.mesh.uuid){
       assert.equal(uprightCapsuleFitsPortal(portal,2.4,.43),false,'The actual ready reunion outlet must remain cargo-only');reunionCapsuleBlocked=true;
      }
     }
    }});
    assert.equal(report.pass,true);assert.equal(game.state,'won');
    assert.equal(report.resets,0);assert.equal(report.respawns,0);assert.equal(report.teleports,0);
    assert.equal(game.physics.portalTransports,2);assert.equal(game.cargo,cargo);assert.equal(game.physics.cargoBody,body);
    assert.equal(requests.length,route==='lower-branch'?1:0,'The lower route must consume exactly one actual jump request');
    assert.ok(requests.every(r=>r.accepted&&r.active&&!r.disposed),'Every requested jump must pass the production input lifecycle gate');
    if(route==='lower-branch')assert.ok(actualJumpTakeoff,'The accepted lower-route jump must actually leave the support');
    assert.ok(deliveryCapsuleBlocked&&reunionCapsuleBlocked,'Both actual cargo-only pairs must be observed');
    console.log('ROOM17_PRODUCTION_CONTROLLER',JSON.stringify({route,aspect,frames:report.frames,acceptedJumps:requests.filter(r=>r.accepted).length,actualJumpTakeoff,playerPortals:report.teleports,cargoPortals:game.physics.portalTransports,resets:report.resets,respawns:report.respawns,deliveryCapsuleBlocked,reunionCapsuleBlocked}));
   }finally{
    game.input.dispose?.();game.firstLevel.dispose?.();game.physics.dispose();game.portals.dispose();
   }
  }
 }finally{
  if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow;
  if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;
 }
});
