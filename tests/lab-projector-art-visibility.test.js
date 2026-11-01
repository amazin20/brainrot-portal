import test from 'node:test';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {disposeLabLevel} from '../src/game/LabLevelLifecycle.js';
import {assertRoom14ProjectorSupport} from './helpers/lab-room14-deflector-contract.js';

// The372089a GLB/cover coordinates belong to the retired elevated island.
// This checks actual current opaque triangles and founded source bodies,
// without declaring a native-render beauty pass.
test('current14 actual projector lens is exposed from frontal and raised service approaches with founded physical supports',async()=>{
 const game=await createHeadlessGame();
 try{game.chamberEdition='foundation';await game.selectLevel(13,false);assertRoom14ProjectorSupport(game);}
 finally{disposeLabLevel(game);}
});
