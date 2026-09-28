/** The numbered campaign ends with the continuous 500-stage Tower.
 * Explicit archive links and unqualified later bookmarks retain their old meaning. */
export const FOUNDATION_INDICES=Object.freeze(Array.from({length:41},(_,index)=>index));
export function readFoundationEdition(query){
 const p=new URLSearchParams(query),edition=p.get('edition'),level=Number(p.get('level')||1);
 // Unqualified 6–33 links predate this edition and remain archive links.
 // Rooms 34–41 have never existed in the archive, so direct links open the
 // new default campaign without requiring a special query parameter.
 const enabled=edition==='foundation'||(!edition&&p.get('mode')!=='velocity'&&(!(level>5)||(level>=34&&level<=FOUNDATION_INDICES.length)));
 return {enabled,levelIndex:Number.isInteger(level)&&level>=1&&level<=FOUNDATION_INDICES.length?level-1:0};
}
export function foundationStorage(storage){
 if(!storage)return undefined;
 return {getItem:key=>storage.getItem('brainrot-foundation-v1:'+key),setItem:(key,value)=>storage.setItem('brainrot-foundation-v1:'+key,value)};
}
export const nextFoundationLevel=index=>index>=0&&index<FOUNDATION_INDICES.length-1?index+1:0;
