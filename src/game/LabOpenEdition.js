/** The rebuilt rooms and the research chapter form an explicit review edition. Neither selecting
 * this edition nor completing it reads or writes the original campaign save. */
export const OPEN_ROOM_INDICES=Object.freeze([23,27,29,30,31,32]);
export function readOpenEdition(query){
 const params=new URLSearchParams(query),enabled=params.get('edition')==='open',index=Number(params.get('level'))-1;
 return {enabled,levelIndex:OPEN_ROOM_INDICES.includes(index)?index:OPEN_ROOM_INDICES[0]};
}
export function nextOpenRoom(index){const at=OPEN_ROOM_INDICES.indexOf(index);return OPEN_ROOM_INDICES[(at+1)%OPEN_ROOM_INDICES.length];}
export function openEditionStorage(storage){
 if(!storage)return undefined;
 const prefix='brainrot-open-rebuild-v1:';
 return {getItem:key=>storage.getItem(prefix+key),setItem:(key,value)=>storage.setItem(prefix+key,value)};
}
