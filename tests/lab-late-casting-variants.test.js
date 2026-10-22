import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {dressVisualAuditLate} from '../src/game/LabVisualAuditLate.js';

test('legacy late-room builders retain their own mechanics without requiring canonical replacement castings',async()=>{
 const g=await createHeadlessGame();g.chamberEdition='foundation';g.puzzleProgression=false;
 try{
  for(const room of [35,36,37,38,39,40,42,43,44,45,46,47,48,49,50,51]){
   await g.selectLevel(room-1,false);const l=g.firstLevel,k=l.workshop;
   assert.ok(k.visualAuditLate,`Legacy room ${room} must finish normally`);
   assert.equal(k.visualAuditLateTargetBindings?.length??0,0,`Legacy room ${room} acquired a casting for another physical mechanism`);
   if(room===44)assert.ok(l.governor&&!l.progression44,'The legacy governor must remain the actual room-44 mechanism');
   if(room===49)assert.ok(l.head&&!l.carriage,'The legacy mirror head must remain the actual room-49 mechanism');
   if(room===50)assert.ok(l.top&&!l.rotor,'The legacy hinged wall must remain the actual room-50 mechanism');
  }
 }finally{g.firstLevel?.dispose?.();g.physics?.dispose();g.portals?.dispose();}
});

test('canonical replacement rooms still bind every real rear casing, freight field and suspended cup',async()=>{
 const g=await createHeadlessGame();g.chamberEdition='foundation';g.puzzleProgression=true;
 try{
  for(const [room,counts]of [[44,[5,0,0,0]],[49,[0,1,0,0]],[50,[0,0,11,3]]]){
   await g.selectLevel(room-1,false);const l=g.firstLevel,k=l.workshop,s=k.visualAuditLate;
   assert.equal(l.puzzleProgression,room);
   assert.deepEqual([s.portalBackCasings,s.freightFieldCasings,s.suspendedCupCasings,s.freightHoodCasings],counts);
   assert.equal(k.visualAuditLateTargetBindings.length,counts.reduce((sum,n)=>sum+n,0));
   for(const b of k.visualAuditLateTargetBindings){
    assert.equal(b.source.parent,b.visual.parent);assert.equal(b.source.children.length,0);
    assert.equal(g.portalPanels.includes(b.source),false,'A casing must never replace the genuine portal face');
    assert.ok(new THREE.Box3().setFromObject(b.source).expandByScalar(1e-5).containsBox(new THREE.Box3().setFromObject(b.visual)));
   }
   if(room===49)assert.equal(k.visualAuditLateTargetBindings[0].source,l.field.housing);
  }
 }finally{g.firstLevel?.dispose?.();g.physics?.dispose();g.portals?.dispose();}
});

test('a canonical casting variant with a missing actual mechanism still fails construction explicitly',()=>{
 const variants=[
  [44,'puzzle-progression44-rearrange-the-path',/Missing actual low portal back casing/],
  [49,'puzzle-progression49-optical-transfer',/Missing actual 49 freight field backplate/],
  [50,'puzzle-progression50-folded-rift',/Missing actual 50 folding rotor/],
 ];
 for(const [room,id,message]of variants){
  const material=new THREE.MeshStandardMaterial(),k={index:room-1,spec:{id},world:{root:new THREE.Group()},m:{shell:material},artBins:new Map(),state:{},panels:{},decks:[]};
  try{assert.throws(()=>dressVisualAuditLate(k,room),message);}finally{material.dispose();}
 }
});
