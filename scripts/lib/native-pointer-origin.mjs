/** CDP mouse positions are absolute even under pointer lock. Locked client
 * coordinates are frozen, while raw movement still describes the native
 * cursor's displacement, including a Chromium recenter ignored by the game.
 * Infer an origin only from actual trusted mouse observations. */
export function nativePointerOrigin(events){
  if(!Array.isArray(events))throw new TypeError('Native pointer events must be an array');
  let origin=null;
  for(const [index,event] of events.entries()){
    if(event.type!=='mousemove'||event.trusted!==true)continue;
    if(event.locked===false){
      if(!Number.isFinite(event.clientX)||!Number.isFinite(event.clientY))throw new Error('Missing native unlocked cursor coordinates');
      origin={x:event.clientX,y:event.clientY,unlockedEvent:index,lockedMovementX:0,lockedMovementY:0};
    }else if(event.locked===true&&origin){
      if(!Number.isFinite(event.movementX)||!Number.isFinite(event.movementY))throw new Error('Invalid native locked mouse displacement');
      origin.x+=event.movementX;origin.y+=event.movementY;
      origin.lockedMovementX+=event.movementX;origin.lockedMovementY+=event.movementY;
    }
  }
  if(!origin)throw new Error('No observed native unlocked cursor origin');
  return origin;
}
