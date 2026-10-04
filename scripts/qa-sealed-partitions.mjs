import fs from 'node:fs';
import {runSealedPartitionCases} from './lib/sealed-partition-cases.mjs';
const report=await runSealedPartitionCases();fs.mkdirSync('qa',{recursive:true});
fs.writeFileSync(process.env.OUT||'qa/sealed-partitions-adversarial.json',JSON.stringify(report,null,2)+'\n');
for(const r of report.results)console.log(r.pass?'PASS':'FAIL','sealed partition',r.room,r.error||r.report.frames);
if(!report.pass)process.exitCode=1;
