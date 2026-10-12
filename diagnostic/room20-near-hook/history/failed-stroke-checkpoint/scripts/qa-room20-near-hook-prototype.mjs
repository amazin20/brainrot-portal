import fs from 'node:fs';
import {createHookFixture} from '../tests/helpers/room20-hook-prototype-fixture.js';
const f=createHookFixture({strokeDrive:process.env.STROKE_DRIVE==='1'}),marks=[];
function mark(name){marks.push({name,...f.cell.diagnostics()});console.log(name,JSON.stringify(marks.at(-1)));}
let failure=null;
try{
 f.step(240);mark('initial real spring-bearing load');f.cell.hand();f.step(240);mark('same hand under initial bearing load');
 f.releaseTray();f.step(600);mark('original free cargo support removed with finite tray impulse; captured pretravel');
 f.cell.hand();f.step(480);mark('same hand under relieved bearing load');
 f.cell.cutCable();f.step(960);mark('actual cable cut returns unretained train');
}catch(e){failure={name:e.name,message:e.message,stack:e.stack};console.error(e);}
finally{const output=process.env.OUT||'/workspace/scratch/1949b02c22bb/room20-preparation/hook-probe-attempt1.json';fs.writeFileSync(output,JSON.stringify({scope:f.cell.scope,sourceAccepted:false,ordinaryAccepted:false,runtimeObserved:true,failure,marks,raw:{...f.raw,forceSteps:[...f.cell.forceApplications.keys()]},trace:f.trace},null,2));f.dispose();}
