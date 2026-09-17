import fs from 'node:fs';
import {createHeadlessGame} from './lab-headless.mjs';
import {visibleBounds,glassPlaneCrossings} from './lib/pocket-clearance.mjs';
const g=await createHeadlessGame();await g.selectLevel(20,false);
try {
 const c=g.firstLevel.cassette,glass=g.scene.getObjectByName('Counterweight inspection glass / solid');
 const report={commit:process.env.SOURCE_COMMIT??process.env.BUILD_COMMIT??null,scope:'Read-only visible triangle/plane inspection at explicit fixture heights, not a player route.',poses:[]};
 for(const height of [3.8,7.5,9.8,12,15.8]){
  c.pose(height);g.scene.updateMatrixWorld(true);
  const hits=glassPlaneCrossings(c.face.group,glass),bounds=visibleBounds(c.face.group);
  report.poses.push({height,glassX:glass.position.x,visibleBounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},glassPlaneCrossingEdges:hits.length,examples:hits.slice(0,3)});
 }
 const out=process.env.EVIDENCE_OUT??'smoke-artifacts/p03b';fs.mkdirSync(out,{recursive:true});fs.writeFileSync(out+'/clearance.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify(report.poses.map(p=>({height:p.height,glassPlaneCrossingEdges:p.glassPlaneCrossingEdges}))))
}finally{g.physics.dispose();g.portals.dispose();}
