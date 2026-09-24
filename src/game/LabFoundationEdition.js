/** The new numbered opening is the human default, with its own progress.
 * Explicit archive links and later numbered bookmarks keep their old meaning. */
export const FOUNDATION_INDICES=Object.freeze([0,1,2,3,4,5,6]);
export function readFoundationEdition(query){
 const p=new URLSearchParams(query),edition=p.get('edition'),level=Number(p.get('level')||1);
 const enabled=edition==='foundation'||(!edition&&p.get('mode')!=='velocity'&&!(level>7));
 return {enabled,levelIndex:Number.isInteger(level)&&level>=1&&level<=7?level-1:0};
}
export function foundationStorage(storage){
 if(!storage)return undefined;
 return {getItem:key=>storage.getItem('brainrot-foundation-v1:'+key),setItem:(key,value)=>storage.setItem('brainrot-foundation-v1:'+key,value)};
}
export const nextFoundationLevel=index=>index>=0&&index<6?index+1:0;
