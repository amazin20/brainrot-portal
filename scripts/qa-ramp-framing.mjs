import * as THREE from 'three';
import {createHeadlessGame} from './lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {runRampExploration} from '../src/game/LabRampExplorationJourney.js';
const g=await createHeadlessGame();g.chamberEdition='open';await g.selectLevel(29,false);
let samples=0,outside=0,worst=0,first;
const report=await runV8Journey(g,{scenario:d=>runRampExploration(d,mark=>{
 samples++;let error=0;
 for(const y of [-.4,1.2,2.9]){const v=g.playerPosition.clone().add(new THREE.Vector3(0,y,0)).project(g.camera);error=Math.max(error,Math.abs(v.x)-1,Math.abs(v.y)-1,v.z>1?1:0);}
 if(error>0){outside++;first??={...mark,camera:g.camera.position.toArray(),rampFraming:g.cameraRig.rampFraming,distance:g.cameraRig.distance,avoid:g.cameraRig.avoidance.toArray(),desired:g.cameraRig.desired.toArray(),desiredPenalty:g.cameraRig.framingPenalty(g.cameraRig.desired),cameraPenalty:g.cameraRig.framingPenalty(g.camera.position),error};}worst=Math.max(worst,error);
})});
console.log(JSON.stringify({pass:report.pass,samples,outside,worst,first},null,2));
if(!report.pass||outside)process.exitCode=1;
