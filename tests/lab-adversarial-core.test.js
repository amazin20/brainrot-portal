import test from 'node:test';
import {coreCases} from '../scripts/lib/adversarial-core-cases.mjs';
for(const c of coreCases)test(c.id,c.run);
