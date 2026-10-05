import fs from 'node:fs';
import {createHeadlessGame} from './lab-headless.mjs';
import {runAnimationJourney} from '../src/game/LabAnimationJourney.js';
import {LabVisibleGripProbe} from './lib/lab-visible-grip.mjs';
import {LabCarrySurfaceContact} from '../src/game/LabCarrySurfaceContact.js';

const game=await createHeadlessGame();
const report={scope:'Actual optimized production player/cargo skin meshes. Ordinary room 9 pickup/carry/run/jump/stop route. Fixed barycentric cargo Body anchors nearest the authored grip addresses; actual Hand-dominant glove triangles. Numerical mesh test, not rendered evidence.',samples:[],max:{left:0,right:0},sourceAssets:{player:'public/models/runtime/model-01-player.glb',cargo:'public/models/runtime/model-02-cargo.glb'}};
try{
  await game.selectLevel(8,false);
  const probe=new LabVisibleGripProbe(game);
  if(process.env.CORRECT_GRIP==='1'){
    const surface=new LabCarrySurfaceContact({playerRig:game.animator.rig,companionRig:game.companionRig,visual:game.cargo.visual});
    report.surfaceAnchors=surface.anchors;
    const update=game.animator.update.bind(game.animator);
    game.animator.update=input=>update({...input,carrySurfaceContact:surface});
  }
  report.anchors=probe.anchors;
  report.route=await runAnimationJourney(game,{fps:30,carrying:true,onFrame:frame=>{
    if(frame.frame%3)return;
    const grip=probe.sample();report.samples.push({...frame,grip,surface:{...game.animator.carrySurfaceContact?.diagnostics},reach:{...game.animator.carryReach}});
    for(const side of ['left','right'])if(grip[side].reachBlend>.999&&!grip[side].clamped)report.max[side]=Math.max(report.max[side],grip[side].distance);
  }});
  report.pass=Object.values(report.max).every(gap=>gap<=.02);
}finally{
  game.physics.dispose();game.portals.dispose();
  const out=process.env.EVIDENCE_OUT||'/workspace/scratch/24e9b8a79859/visible-glove-mesh.json';fs.writeFileSync(out,JSON.stringify(report,null,2));
  console.log(JSON.stringify({pass:report.pass,max:report.max,anchors:report.anchors,samples:report.samples.length}));
}
