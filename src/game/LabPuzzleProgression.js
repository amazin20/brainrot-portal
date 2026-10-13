import {PILOT43_SPEC,buildPuzzlePilot43} from './LabPuzzlePilot43.js';
import {PROGRESSION44_SPEC,buildPuzzleProgression44} from './LabPuzzleProgression44.js';
import {PROGRESSION45_SPEC,buildPuzzleProgression45} from './LabPuzzleProgression45.js';
import {PROGRESSION46_SPEC,buildPuzzleProgression46} from './LabPuzzleProgression46.js';
import {PROGRESSION47_SPEC,buildPuzzleProgression47} from './LabPuzzleProgression47.js';
import {PROGRESSION48_SPEC,buildPuzzleProgression48} from './LabPuzzleProgression48.js';
import {PROGRESSION49_SPEC,buildPuzzleProgression49} from './LabPuzzleProgression49.js';
import {PROGRESSION50_SPEC,buildPuzzleProgression50} from './LabPuzzleProgression50.js';
import {PROGRESSION51_SPEC,buildPuzzleProgression51} from './LabPuzzleProgression51.js';

export const PROGRESSION_INDICES=Object.freeze([42,43,44,45,46,47,48,49,50]);
const specs=new Map([[42,PILOT43_SPEC],[43,PROGRESSION44_SPEC],[44,PROGRESSION45_SPEC],[45,PROGRESSION46_SPEC],[46,PROGRESSION47_SPEC],[47,PROGRESSION48_SPEC],[48,PROGRESSION49_SPEC],[49,PROGRESSION50_SPEC],[50,PROGRESSION51_SPEC]]);
const builders=new Map([[42,buildPuzzlePilot43],[43,buildPuzzleProgression44],[44,buildPuzzleProgression45],[45,buildPuzzleProgression46],[46,buildPuzzleProgression47],[47,buildPuzzleProgression48],[48,buildPuzzleProgression49],[49,buildPuzzleProgression50],[50,buildPuzzleProgression51]]);

export function progressionSpec(index){return specs.get(index);}
export function buildPuzzleProgression(game,index){
 const build=builders.get(index);
 if(!build)throw new RangeError('Unknown spatial progression room');
 return build(game,index);
}
export function nextProgressionLevel(index){
 const at=PROGRESSION_INDICES.indexOf(index);
 return PROGRESSION_INDICES[(at+1)%PROGRESSION_INDICES.length];
}
