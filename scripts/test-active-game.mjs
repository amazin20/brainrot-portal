import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

// The active finale is Singularity. The archived eighteen-wing Tower fixtures
// exercise a superseded level selection contract and remain in the repository
// for that implementation's history. All other game regressions run here.
const tests=fs.readdirSync(new URL('../tests/',import.meta.url))
 .filter(name=>name.endsWith('.test.js')&&!name.startsWith('lab-tower'))
 .sort().map(name=>'tests/'+name);
if(!tests.length)throw new Error('No active game regression tests found');
const result=spawnSync(process.execPath,['--test','--test-concurrency=2',...tests],{stdio:'inherit'});
if(result.error)throw result.error;
process.exit(result.status??1);
