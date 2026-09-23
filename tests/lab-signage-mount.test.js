import test from 'node:test';
import assert from 'node:assert/strict';
import {ResearchChamber} from '../src/game/LabResearchArt.js';

test('wall-mounted signs clear physical ribs without moving interior equipment labels',()=>{
 const k={bounds:{minX:-18,maxX:18,minZ:-20,maxZ:20}};
 const cases=[
  [[-17.25,11,0],[1,0,0],[-16.64,11,0]],
  [[17.25,11,0],[-1,0,0],[16.64,11,0]],
  [[0,11,-19.25],[0,0,1],[0,11,-18.64]],
  [[0,11,19.25],[0,0,-1],[0,11,18.64]],
  [[0,5,-3],[0,0,1],[0,5,-3]],
  [[-4,5,3],[1,0,0],[-4,5,3]],
 ];
 for(const [p,n,expected] of cases){const before=[...p];assert.deepEqual(ResearchChamber.prototype.signagePosition.call(k,p,n),expected);assert.deepEqual(p,before);}
});
