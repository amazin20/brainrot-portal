/** The numbered campaign uses rebuilt opening rooms and the existing rooms 6–30.
 * Explicit archive links and unqualified later bookmarks retain their old meaning. */
export const FOUNDATION_INDICES=Object.freeze(Array.from({length:30},(_,index)=>index));
export function readFoundationEdition(query){
 const p=new URLSearchParams(query),edition=p.get('edition'),level=Number(p.get('level')||1);
 const enabled=edition==='foundation'||(!edition&&p.get('mode')!=='velocity'&&!(level>5));
 return {enabled,levelIndex:Number.isInteger(level)&&level>=1&&level<=FOUNDATION_INDICES.length?level-1:0};
}
export function foundationStorage(storage){
 if(!storage)return undefined;
 return {getItem:key=>storage.getItem('brainrot-foundation-v1:'+key),setItem:(key,value)=>storage.setItem('brainrot-foundation-v1:'+key,value)};
}
export const nextFoundationLevel=index=>index>=0&&index<FOUNDATION_INDICES.length-1?index+1:0;
