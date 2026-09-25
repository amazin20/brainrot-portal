const check=(ok,message)=>{if(!ok)throw Error(message);};
export async function runRoom26(d,{inspectFirst=false,reverse=false,firstFall=false,route='retrieve-first'}={}){
 const {game,level,walk,aim,look,wait,until,pickup,mark}=d,p=level.panels,s=level.state;
 check(['retrieve-first','reverse-first','air-freight'].includes(route),'Unknown foundry route');
 if(inspectFirst){walk(-12,12);aim(1,p['first-shaft'].getFrame().center);walk(-12,8);wait(1);check(game.playerPosition.y<1,'Unpowered well must not lift');walk(-19,10);}
 walk(game.cargo.position.x+1,game.cargo.position.z);pickup();
 walk(-17,23);look(p['valve-load'].getFrame().center.clone().add({x:0,y:2,z:0}));walk(-17,22);game.interact();wait(2);
 check(s.load.loaded(),'Original friend did not hold the foundry valve');mark('the original load opens a real air shutter');
 walk(-12,14);aim(1,p['first-shaft'].getFrame().center);walk(-12,-6);aim(0,p['pressure-intake'].getFrame().center);
 check(s.liftFlow.segments.some(a=>a.direction.y>.9),'First shaft has no routed upward stream');
 walk(-12,8);until(()=>game.playerPosition.y>10.6,12,'First stream ascent');walk(-12,2);until(()=>game.playerGrounded,6,'First retaining balcony');check(game.playerPosition.y>7.9,'First balcony was missed');mark('the first permanent gallery preserves height');
 if(firstFall){
  walk(-12,3);walk(-7,3);until(()=>game.playerGrounded&&game.playerPosition.y<.1,6,'Missed gallery must reach the recovery foundation');
  mark('a missed gallery returns to the shared foundation');
  walk(-12,8);until(()=>game.playerPosition.y>10.6,12,'Recovery ascent');walk(-12,2);until(()=>game.playerGrounded&&game.playerPosition.y>7.9,6,'Recovered retaining balcony');
 }
 walk(-22,2);walk(-22,-21);walk(12,-21);walk(12,-12);aim(1,p['relay-shaft'].getFrame().center);
 walk(12,-8);until(()=>game.playerPosition.y>17.7,12,'Relay stream ascent');for(let n=0;n<240&&game.playerPosition.x<15.4;n++){d.worldMove(1,0);d.frame();}d.stop();check(game.playerPosition.x>15,'Unable to steer out of crossing');walk(16,-14);until(()=>game.playerGrounded&&game.playerPosition.y>15.9,6,'Upper retaining dock');mark('crossing streams expose the upper retaining dock');
 const reverseCrossing=()=>{
  walk(12,-14);walk(17,-14.8);game.interact();wait(.25);
  check(!s.crossingFlow.reversed,'Upper valve must reverse the return stream');
  if(reverse){game.interact();wait(.25);check(s.crossingFlow.reversed,'Reverse control did not change force');game.interact();wait(.25);}
 };
 if(route==='reverse-first'){
  reverseCrossing();check(s.load.loaded()&&s.shutter.open,'Lower load must still power the lift while reversing the independent stream');
  mark('reverse the independent upper stream while the companion still powers the lower shutter');
 }
 walk(12,-14);walk(7,-14);aim(1,p['freight-receiver'].getFrame().center);walk(12,-14);walk(12,-21);walk(-22,-21);walk(-22,11.85);walk(-20.25,11.85);aim(0,p['valve-load'].getFrame().center);
 until(()=>game.cargo.position.y>16,8,'Borrowed portals did not retrieve the original load');wait(1);
 check(!s.load.loaded(),'Retrieval must unload the real lower plate');mark('borrow the lift portals to recover their own power source');
 walk(-22,11);walk(-22,-21);walk(12,-21);walk(12,-14);if(route!=='reverse-first')reverseCrossing();
 walk(12,-14);walk(7,-14);walk(6,game.cargo.position.z);pickup();walk(7,-14);walk(16,-14);
 if(route==='air-freight'){
  // The independent upper current can take the free companion to the far
  // receiving dock. The player then makes a separate passage through it.
  walk(12,-14);game.input.jumpQueued=true;
  until(()=>game.playerPosition.y>18.3,3,'Loaded jump did not reach the transverse current');
  check(game.interact()&&!game.heldCube,'Could not release the original companion into the transverse stream');
  until(()=>game.cargo.position.z>13&&game.physics.grounded&&game.cargo.position.y>16,15,'Free companion missed the far receiving dock');
  mark('upper air current transports the free companion ahead of the player');
  until(()=>game.playerPosition.z>14,12,'Player did not follow the companion through the upper current');
  for(let n=0;n<300&&game.playerPosition.x<16.3;n++){d.worldMove(1,0);d.frame();}d.stop();
  walk(19,19);until(()=>game.playerGrounded&&game.playerPosition.y>15.9,6,'Far service dock landing');
  walk(19,22);walk(14.2,22);walk(game.cargo.position.x+1,game.cargo.position.z);pickup();
  walk(17,22);walk(17,19);until(()=>game.state==='won',5,'Air freight reunion');
  mark('player follows and collects the original companion from the elevated air collector');
  return;
 }
 walk(12,-14);game.input.jumpQueued=true;until(()=>game.playerPosition.z>14,12,'Upper stream did not transport both travellers');
 for(let n=0;n<300&&game.playerPosition.x<16.3;n++){d.worldMove(1,0);d.frame();}d.stop();walk(17,18);until(()=>game.playerGrounded,6,'Far dock landing');walk(17,19);until(()=>game.state==='won',5,'Foundry joint arrival');mark('both travellers cross the independent return stream');
}
