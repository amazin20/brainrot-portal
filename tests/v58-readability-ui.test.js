import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readCausalUiPlay} from '../scripts/lib/v58-readability-capture.mjs';

function game(spawn){return {playerPosition:new THREE.Vector3(-7,0,9),firstLevel:{spawn},physics:{world:{stepnumber:0}},portals:{ready:false},levelIndex:24,state:'playing',chamberEdition:'foundation'};}
test('native Play spawn comparison supports actual array and Vector3 shapes without changing either',()=>{
 for(const spawn of [[-7,0,9],new THREE.Vector3(-7,0,9)]){const g=game(spawn),player=g.playerPosition.clone(),actual=spawn.toArray?.()??[...spawn],r=readCausalUiPlay(g);assert.equal(r.normalSpawn,true);assert.deepEqual(r.player,[-7,0,9]);assert.deepEqual(r.spawn,[-7,0,9]);assert.equal(r.worldStep,0);assert.equal(r.portalsReady,false);assert.equal(r.level,25);assert.deepEqual(g.playerPosition,player);assert.deepEqual(spawn.toArray?.()??spawn,actual);assert.notEqual(r.player,g.playerPosition);assert.notEqual(r.spawn,spawn);}
});
test('a displaced actor remains outside the exact normal-spawn gate',()=>{
 const g=game([-7,0,9]);g.playerPosition.x+=1e-6;assert.equal(readCausalUiPlay(g).normalSpawn,false);
});
test('nonfinite or malformed actual actor/spawn tuples fail closed',()=>{
 for(const spawn of [[-7,NaN,9],[-7,0],{x:-7,y:0,z:9},null])assert.throws(()=>readCausalUiPlay(game(spawn)),/finite actual position\/spawn/);
 const g=game([-7,0,9]);g.playerPosition.x=Infinity;assert.throws(()=>readCausalUiPlay(g),/finite actual position\/spawn/);
});
test('UI snapshot preserves actual nonzero clock, placed portals and edition instead of normalizing them',()=>{
 const g=game([-7,0,9]);g.physics.world.stepnumber=17;g.portals.ready=true;g.chamberEdition='campaign';g.levelIndex=40;const r=readCausalUiPlay(g);assert.equal(r.worldStep,17);assert.equal(r.portalsReady,true);assert.equal(r.edition,'campaign');assert.equal(r.level,41);
});
