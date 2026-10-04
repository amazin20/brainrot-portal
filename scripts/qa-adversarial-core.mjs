import fs from 'node:fs';
import {runCoreCases} from './lib/adversarial-core-cases.mjs';
const report=await runCoreCases();
fs.mkdirSync('qa',{recursive:true});
fs.writeFileSync(process.env.OUT||'qa/adversarial-core.json',JSON.stringify(report,null,2)+'\n');
for(const r of report.results)console.log(r.pass?'PASS':'FAIL',r.id,r.error||'');
if(!report.pass)process.exitCode=1;
