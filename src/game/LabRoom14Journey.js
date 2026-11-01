import {Vector3} from 'three';

/** Test/recording controls issue ordinary walking, aim and E only. */
export function room14InputControls(d){
 const {game,level,walk,wait,aim}=d,p=level.panels;
 const shot=(i,name)=>{
  const point=p[name].getFrame().center.clone();
  if(name.startsWith('contact-'))point.y=1.25;
  if(name==='passenger-departure')point.y=1.3;
  if(name==='passenger-arrival')point.y=.9;
  aim(i,point);
  const mesh=p[name].mesh;
  if(game.portalSurfaceIds[i]!== (mesh.userData.portalColliderId??mesh.uuid))throw Error('Charged shot acquired a different room14 address: '+name);
 };
 const north=()=>{walk(-11,3);walk(-9,3);walk(-9,4.75);walk(-7.5,4.75);};
 const west=()=>{
  if(game.playerPosition.x< -8.2&&game.playerPosition.y<-.4){walk(-12,3);return;}
  if(game.playerPosition.z<3.8){walk(-5.8,1.5);walk(-5.8,4.75);}
  walk(-7.5,4.75);walk(-9,4.75);walk(-9,3);walk(-12,3);
 };
 const passengerPair=()=>{
  west();shot(0,'passenger-departure');north();walk(12,5);walk(12,-7);
  shot(1,'passenger-arrival');walk(12,5);west();
 };
 const useFan=()=>{
  walk(-7.6,1.5);wait(.15);
  if(level.nearbyInteraction()?.kind!=='deflector-fan')throw Error('Loading control is not accessible');
  game.interact();
 };
 return {shot,north,west,passengerPair,useFan};
}

/** Reusable ordinary setup for positive routes and explicitly incomplete
 * negative scenarios. A setup return does not mark a won room. */
export async function prepareRoom14Freight(d,{light='oblique'}={}){
 if(!['oblique','none','wrong-target'].includes(light))throw new RangeError('Unknown optical setup');
 const {game,level,walk,wait,mark}=d;
 const t=room14InputControls(d);
 walk(-15,4);t.shot(0,'contact-intake');
 if(light==='oblique'){
  t.north();walk(2,5);t.shot(1,'contact-turn');
  if(level.state.lightContact.segments.length<2)throw Error('The real light did not traverse the small aperture');
  mark('small portal pair delivers the actual oblique light face');
 }else if(light==='wrong-target'){
  t.north();walk(12,5);walk(12,-7);t.shot(1,'passenger-arrival');walk(12,5);
  mark('the alternate actual address does not create the required turning face');
 }
 t.west();
 await loadRoom14Freight(d,t);
 return t;
}

/** Carry a recovered original from the service court to the same low mouth. */
export async function loadRoom14Freight(d,t=room14InputControls(d)){
 const {game,walk,wait,mark,frame,worldMove,stop}=d;
 for(let attempt=0;attempt<4&&!game.heldCube;attempt++){
  walk(game.cargo.position.x,game.cargo.position.z+1.2);
  game.interact();if(game.heldCube)wait(.55);else wait(.15);
 }
 if(!game.heldCube)throw Error('The original companion could not be picked up');
 t.north();walk(-7,1.5);walk(-7.6,0);
 for(let i=0;i<30;i++){worldMove(.18,0);frame();}
 stop();wait(.5);game.interact();wait(.35);
 if(game.heldCube)throw Error('The freight friend was not released');
 mark('original free companion waits at the low freight entrance');
}

/** Read only actual free-body support and motion; entering a target in midair
 * is not a stable delivery before the player spends time changing addresses. */
export function room14CargoSettled(game,level=game.firstLevel){
 return level.readability.cargoTarget.containsPoint(game.cargo.position)
  &&game.physics.grounded&&game.physics.cargoBody.velocity.length()<.8;
}

export async function runRoom14(d,{order='freight-first'}={}){
 if(!['freight-first','cargo-first','scout-first'].includes(order))throw new RangeError('Unknown room14 action order');
 const {game,level,walk,until,enter,mark,look}=d,p=level.panels;
 if(order==='scout-first'){
  const t=room14InputControls(d);t.passengerPair();enter(p['passenger-departure']);
  walk(3,-3.1);if(level.isWon())throw Error('Empty passenger arrival cannot complete freight');
  mark('player scouts the separate glass-side travel bay');enter(p['passenger-arrival']);
 }
 const t=await prepareRoom14Freight(d);
 // Ordinary mouse/touch look lets the traveller inspect the actual glazed
 // elbow before starting it. This never sets or bypasses the camera rig.
 look(new Vector3(.55,.55,-.2));t.useFan();
 until(()=>room14CargoSettled(game,level),12,'The contact sheet did not land the original free body in the freight bay');
 mark('light contact carries the original companion across the unsupported turn');
 t.passengerPair();enter(p['passenger-departure']);look(game.cargo.position.clone());walk(2.65,-3.1);
 until(()=>game.state==='won',4,'The two real travel bays did not reunite the original actors');
 mark('both travellers reach adjacent visible exit lanes');
}
