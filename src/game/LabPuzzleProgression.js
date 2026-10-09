import {PILOT43_SPEC,buildPuzzlePilot43} from './LabPuzzlePilot43.js';
import {PROGRESSION44_SPEC,buildPuzzleProgression44} from './LabPuzzleProgression44.js';
import {PROGRESSION45_SPEC,buildPuzzleProgression45} from './LabPuzzleProgression45.js';
import {PROGRESSION46_SPEC,buildPuzzleProgression46} from './LabPuzzleProgression46.js';

export const PROGRESSION_INDICES=Object.freeze([42,43,44,45]);
const specs=new Map([[42,PILOT43_SPEC],[43,PROGRESSION44_SPEC],[44,PROGRESSION45_SPEC],[45,PROGRESSION46_SPEC]]);
const builders=new Map([[42,buildPuzzlePilot43],[43,buildPuzzleProgression44],[44,buildPuzzleProgression45],[45,buildPuzzleProgression46]]);

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
