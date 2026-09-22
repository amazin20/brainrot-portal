import fs from 'node:fs';
import {createHeadlessGame} from './lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {runRampExploration} from '../src/game/LabRampExplorationJourney.js';
const game=await createHeadlessGame();game.chamberEdition='open';await game.selectLevel(29,false);
let exploration;
const report=await runV8Journey(game,{scenario:d=>{exploration=runRampExploration(d);}});
const result={...report,exploration,source:process.env.BUILD_COMMIT||null,
 scope:'Ordinary-input exploration from the actual spawn, not a staged placement or a puzzle solution.'};
fs.writeFileSync(process.env.OUT||'qa-ramp-exploration.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
