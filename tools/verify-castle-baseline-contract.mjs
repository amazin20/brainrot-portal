// Read the independently checked-out unmodified baseline, not a release toggle.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHeadlessGame} from '../baseline/scripts/lab-headless.mjs';
import {ACTIVE_FOUNDATION_RUNTIME_FLAGS} from '../baseline/src/game/ReleaseIdentity.js';
import {disposeLabLevel} from '../baseline/src/game/LabLevelLifecycle.js';
import {castleContractHash} from '../tests/helpers/castle-building-contract.js';
const game=await createHeadlessGame();Object.assign(game,{chamberEdition:'foundation',...ACTIVE_FOUNDATION_RUNTIME_FLAGS});
try{await game.selectLevel(40,true);const hash=castleContractHash(game);assert.equal(hash,'4887f49f5792fa17edc32cd049ea425002b39a47d7bb155c60f841f9be412c44');fs.mkdirSync('evidence',{recursive:true});fs.writeFileSync('evidence/baseline-contract.json',JSON.stringify({baselineCommit:'6f4b9b58a5f51efb99492e20d54349fd5fee9add',hash,pass:true},null,2)+'\n');}finally{disposeLabLevel(game);}
