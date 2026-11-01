import fs from 'node:fs';
import crypto from 'node:crypto';
import {createRoom35CapstanCell} from '../src/game/LabRoom35CapstanCell.js';

const output=process.argv[2]??'/tmp/brainrot-room35-capstan-convergence.json';
const report={scope:'assetless prototype only; not accepted as a production room',stimulus:{settleSeconds:3,manualAtControlSeconds:14,pressedButAwaySeconds:8},source:{},cases:[]};
for(const file of ['LabRoom35CapstanGeometry.js','LabRoom35CapstanCell.js'])report.source[file]=crypto.createHash('sha256').update(fs.readFileSync(new URL('../src/game/'+file,import.meta.url))).digest('hex');
for(const denominator of [120,240,480,960])for(const theta of [.35,4.8]){
 const c=createRoom35CapstanCell({dt:1/denominator,theta}),snapshots=[];
 try{
  c.step(3*denominator);snapshots.push({phase:'slack capture, no input',...c.diagnostics()});
  c.control.pressed=true;c.step(14*denominator);snapshots.push({phase:'actual control winding',...c.diagnostics()});
  const workAtDeparture=c.ledger.manualWork;c.control.position=[20,6,22];c.step(8*denominator);
  snapshots.push({phase:'still pressed, physically away',...c.diagnostics()});
  report.cases.push({denominator,theta,workAfterDeparture:c.ledger.manualWork-workAtDeparture,snapshots});
 }catch(error){report.cases.push({denominator,theta,error:String(error.stack??error),snapshots,final:c.diagnostics()});}
 finally{c.dispose();}
 fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
}
report.peakRssBytes=process.resourceUsage().maxRSS*1024;
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
for(const row of report.cases){const d=row.snapshots.at(-1)??row.final;console.log(JSON.stringify({dt:'1/'+row.denominator,theta:row.theta,error:row.error,angle:d?.angle,
 maxResidual:d?.ledger.maxResidual,finalResidual:d?.energyResidual,maxResidualAt:d?.ledger.maxResidualAt,portalWork:d?.ledger.portalGeometryWork,workAfterDeparture:row.workAfterDeparture}));}
console.log(JSON.stringify({output,peakRssBytes:report.peakRssBytes}));
