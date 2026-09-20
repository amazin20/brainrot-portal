const check=(ok,message)=>{if(!ok)throw Error(message);};
export async function runRoom26(d,{inspectFirst=false,reverse=false,firstFall=false}={}){
 const {game,level,walk,aim,look,wait,until,pickup,mark}=d,p=level.panels,s=level.state;
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
 walk(12,-14);walk(7,-14);aim(1,p['freight-receiver'].getFrame().center);walk(12,-14);walk(12,-21);walk(-22,-21);walk(-22,11.85);walk(-20.25,11.85);aim(0,p['valve-load'].getFrame().center);
 until(()=>game.cargo.position.y>16,8,'Borrowed portals did not retrieve the original load');wait(1);
 check(!s.load.loaded(),'Retrieval must unload the real lower plate');mark('borrow the lift portals to recover their own power source');
 walk(-22,11);walk(-22,-21);walk(12,-21);walk(12,-14);walk(17,-14.8);game.interact();wait(.25);check(!s.crossingFlow.reversed,'Upper valve must reverse the return stream');if(reverse){game.interact();wait(.25);check(s.crossingFlow.reversed,'Reverse control did not change force');game.interact();wait(.25);}
 walk(12,-14);walk(7,-14);walk(6,game.cargo.position.z);pickup();walk(7,-14);walk(16,-14);
 walk(12,-14);game.input.jumpQueued=true;until(()=>game.playerPosition.z>14,12,'Upper stream did not transport both travellers');
 for(let n=0;n<300&&game.playerPosition.x<16.3;n++){d.worldMove(1,0);d.frame();}d.stop();walk(17,18);until(()=>game.playerGrounded,6,'Far dock landing');walk(17,19);until(()=>game.state==='won',5,'Foundry joint arrival');mark('both travellers cross the independent return stream');
}
