import test from 'node:test';
import assert from 'node:assert/strict';
import {hydraulicConnectionText} from '../src/game/LabOpenHydraulics.js';
test('hydraulic instruments explain disconnected, self-loop, dry and balanced attempts',()=>{
 assert.equal(hydraulicConnectionText([8,0],[null,null]),'НЕТ СОЕДИНЕНИЯ');
 assert.match(hydraulicConnectionText([8,0],[{basin:0,sill:0},{basin:0,sill:8}]),/РЕЗЕРВУАРЕ А/);
 assert.match(hydraulicConnectionText([4,4],[{basin:0,sill:8},{basin:1,sill:8}]),/НИЖЕ ОБОИХ/);
 assert.match(hydraulicConnectionText([4,4],[{basin:0,sill:0},{basin:1,sill:0}]),/ВЫРОВНЕНО/);
 for(const ends of [[{basin:0,sill:0},{basin:1,sill:8}],[{basin:1,sill:8},{basin:0,sill:0}]]){
  assert.equal(hydraulicConnectionText([8,0],ends,.1),'ВОДА: А → Б');
  assert.equal(hydraulicConnectionText([0,8],ends,-.1),'ВОДА: Б → А');
 }
});
