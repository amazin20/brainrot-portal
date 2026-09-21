const check=(yes,message)=>{if(!yes)throw Error(message);};
export async function runRoom27(d,{inspectEastFirst=false,gravityReturn=false,recoverFirst=false}={}){
 const {game,level,walk,aim,look,wait,until,pickup,mark,worldMove,frame,stop}=d,p=level.panels,s=level.state.conveyors;
 if(inspectEastFirst){walk(4,19);walk(4,14);aim(1,p['sky-well'].getFrame().center);walk(10,16);walk(10,19);walk(-19,19);mark('the eastern loop reveals the sky well before the motor');}
 walk(-19,16);game.interact();wait(.3);check(!s.reversed,'Lower reversing drum did not reverse the belt');
 walk(-7,16);aim(0,p['ground-intake'].getFrame().center);walk(4,14);aim(1,p['sky-well'].getFrame().center);
 walk(-7,19);walk(game.cargo.position.x+1,game.cargo.position.z);pickup();
 walk(-7,17);walk(-13,17);
 mark('ready to ride the saffron belt into the sky well');
 const before=game.teleportCount;
 for(let n=0;n<400&&game.teleportCount===before;n++){worldMove(0,-1);frame();}stop();check(game.teleportCount>before,'Ground belt did not carry the travellers into the portal');
 mark('the ground belt turns horizontal speed into height');
 for(let n=0;n<200&&game.playerPosition.x<8.8;n++){worldMove(1,0);frame();}stop();
 until(()=>game.playerGrounded&&game.playerPosition.y>7.9,5,'Permanent balcony landing');
 mark('height is retained on the side street');
 if(recoverFirst){
  walk(8,12);walk(5,12);until(()=>game.playerGrounded&&game.playerPosition.y<.2,5,'Side street recovery plaza');mark('a missed side street returns to the shared plaza');
  walk(-7,17);walk(-13,17);const retry=game.teleportCount;
  for(let n=0;n<400&&game.teleportCount===retry;n++){worldMove(0,-1);frame();}stop();check(game.teleportCount>retry,'Recovery belt did not relaunch');
  for(let n=0;n<200&&game.playerPosition.x<8.8;n++){worldMove(1,0);frame();}stop();
  until(()=>game.playerGrounded&&game.playerPosition.y>7.9,5,'Recovered permanent balcony');mark('the original pair remains usable after a fall');
 }
 if(!gravityReturn){walk(10,7);look(game.playerPosition.clone().add({x:0,y:1,z:-4}));game.interact();wait(1);}
 walk(10,12);walk(20.5,12);walk(21,-8);
 walk(21,-23.5);check(game.playerPosition.y>15.9,'The folded observation stair was not climbed');
 if(gravityReturn){walk(12,-23.5);game.interact();wait(1);}
 walk(8,-23.5);walk(8,-7);walk(9.2,-7);walk(9.2,0);walk(6,0);
 aim(1,p['reverse-outlet'].getFrame().center);mark('the upper return reveals the reverse side of the high outlet');
 if(gravityReturn){
  walk(9.2,0);walk(9.2,-7);walk(8,-7);walk(8,-23.5);walk(3.2,-23.5);walk(3.2,-22.3);aim(0,p['gravity-post'].getFrame().center);
  walk(12,-23.5);walk(game.cargo.position.x+1,game.cargo.position.z);pickup();walk(7,-23.5);walk(7,-10);walk(1,-10);mark('ready to borrow gravity from the observation spur');
  const gravityBefore=game.teleportCount;
  for(let n=0;n<240&&game.playerPosition.x>-.65;n++){worldMove(-1,0);frame();}stop();
  until(()=>game.teleportCount>gravityBefore,6,'Gravity return did not address the high outlet');
  until(()=>game.playerGrounded&&game.playerPosition.x<-9,6,'Gravity return landing');mark('the observation loop supplies an alternative gravity-powered bridge');
  walk(-18,0);until(()=>game.state==='won',4,'Gravity route joint arrival');return;
 }
 walk(9.2,0);walk(9.2,-7);walk(8,-7);walk(8,-23.5);walk(21,-23.5);walk(21,-8);walk(21,11);
 walk(15.3,11);aim(0,p['upper-intake'].getFrame().center);walk(10,11);walk(10,7);walk(game.cargo.position.x+1,game.cargo.position.z);pickup();walk(10,11);walk(15.3,11);
 const high=game.teleportCount;
 mark('ready for the upper conveyor crossing');
 for(let n=0;n<400&&game.teleportCount===high;n++){worldMove(0,-1);frame();}stop();check(game.teleportCount>high,'Upper belt did not enter the readdressed pair: '+JSON.stringify({player:game.playerPosition.toArray(),portals:game.portals.portals.map(a=>a?.position.toArray())}));
 until(()=>game.playerGrounded&&game.playerPosition.x<-9,6,'Far island landing');mark('belt momentum becomes the final bridge');
 walk(-18,0);until(()=>game.state==='won',4,'Conveyor city joint arrival');
}
