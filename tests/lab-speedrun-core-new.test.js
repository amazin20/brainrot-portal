import test from 'node:test';
import {newCoreCases} from '../scripts/qa-speedrun-core-new.mjs';
for(const c of newCoreCases)test(c.id,c.run);
