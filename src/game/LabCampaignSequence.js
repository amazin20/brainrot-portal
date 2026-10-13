/** Presentation order is separate from the permanent gameplay/save indices.
 * Existing ?level=41 bookmarks still address the castle; its campaign number
 * is now 51, after all fifty ordinary rooms. */
export const CASTLE_LEVEL_INDEX=40;
export const FOUNDATION_SEQUENCE_REVISION='fifty-rooms-then-castle-v1';
export const FOUNDATION_SEQUENCE=Object.freeze([
 ...Array.from({length:40},(_,index)=>index),
 ...Array.from({length:10},(_,index)=>index+41),
 CASTLE_LEVEL_INDEX,
]);
const positions=new Map(FOUNDATION_SEQUENCE.map((index,position)=>[index,position]));

export function foundationDisplayNumber(index){
 const position=positions.get(index);
 if(position===undefined)throw new RangeError('Unknown foundation room');
 return position+1;
}

export function foundationIndexAtNumber(number){
 if(!Number.isInteger(number)||number<1||number>FOUNDATION_SEQUENCE.length)throw new RangeError('Unknown foundation room number');
 return FOUNDATION_SEQUENCE[number-1];
}

export function isFoundationSequence(indices){
 return indices.length===FOUNDATION_SEQUENCE.length&&indices.every((index,position)=>index===FOUNDATION_SEQUENCE[position]);
}

/** Finishing the castle ends the campaign. Replays start explicitly in Menu. */
export function nextFoundationIndex(index){
 const position=positions.get(index);
 return position===undefined?FOUNDATION_SEQUENCE[0]:FOUNDATION_SEQUENCE[position+1]??null;
}
