const check=(ok,msg)=>{if(!ok)throw Error(msg);};
export function room20Light(d){const p=d.level.panels;d.aim(0,p['light-intake'].getFrame().center);d.aim(1,p['light-output'].getFrame().center);d.wait(2);}
export async function runRoom20(d,{order='cargo-first',interruptPower=false}={}){
 const {game,level,walk,aim,wait,pickup,until,mark,frame,worldMove,stop}=d,p=level.panels,s=level.state;
 check(['cargo-first','scout-first'].includes(order),'Unknown exchange exploration order');
 if(order==='scout-first'){
  walk(-18,10);walk(-18,-10);room20Light(d);check(s.optical.receivers[0]&&!s.optical.receivers[1],'Unloaded reflector must choose the middle route');mark('unloaded exchange seen from the court');aim(1,p['light-output'].getFrame().center.clone().add({x:0,y:0,z:2}));wait(1);walk(-18,17);
 }
 walk(-17,17);pickup();walk(-18,6);walk(-12,6);d.look(p['mirror-cradle'].getFrame().center.clone().add({x:0,y:2,z:0}));walk(-12,.8);wait(.6);game.interact();wait(2);check(s.optical.loaded,'Original cargo must load the cradle');
 walk(-12,-3);walk(-16,-3);walk(-16,-16);aim(0,p['light-intake'].getFrame().center);walk(-16,11);walk(-10.7,12);aim(1,p['light-output'].getFrame().center);wait(2);check(s.optical.receivers[1],'Loaded branch not reached');mark('loaded mirror raises the first crossing');
 if(interruptPower){aim(1,p['light-output'].getFrame().center.clone().add({x:0,y:0,z:2}));wait(2);check(!s.optical.receivers[1],'Misaligned physical ray must release loaded motor');until(()=>s['first-cage'].position.y<.1,8,'First cage recovery');mark('occupied exchange car loses the real ray');aim(1,p['light-output'].getFrame().center);wait(2);}
 until(()=>game.playerPosition.y>7.98,12,'First exchange ascent');walk(-12,16);walk(-19,16);walk(-21,9);walk(-21,4);
 aim(1,p['upper-pocket'].getFrame().center.clone().add({x:0,y:0,z:-1}));walk(-21,-4);walk(-15.99,-4);aim(0,p['mirror-cradle'].getFrame().center);until(()=>game.cargo.position.y>8.4,5,'Cargo leaves the live mirror');
 mark('cargo exchange changes the live optical branch');until(()=>game.cargo.position.z>5.6,4,'Flywheel offloads the arriving cargo');
 // Restore the optical output after the coasting field clears the receiving aperture.
 aim(1,p['light-output'].getFrame().center);wait(3);check(!s.optical.loaded,'Upper pocket must release the loaded branch');
 walk(-21,4);walk(-21,-16);walk(-12,-16);walk(-12,-12);aim(0,p['light-intake'].getFrame().center);wait(2);check(s.optical.receivers[0],'Free mirror must power the second car');until(()=>game.playerPosition.y>15.98,12,'Second exchange ascent');
 walk(-12,-17);walk(-7,-17);walk(-5,-14.3);mark('a new view of the original counterweight');
 aim(0,p['gravity-return'].getFrame().center);aim(1,p['upper-pocket'].getFrame().center.clone().add({x:0,y:0,z:3}));until(()=>game.cargo.position.y<2&&Math.abs(game.cargo.position.x+12)<2,6,'Cargo reloads its original cradle');
 walk(-7,-14.3);aim(1,p['light-output'].getFrame().center);walk(-2,-17);walk(-.7,-12);aim(0,p['light-intake'].getFrame().center);wait(2);check(s.optical.loaded&&s.optical.receivers[1],'Reloaded cargo must restore loaded optical branch');
 until(()=>game.playerPosition.y>21.98,12,'Return exchange ascent');walk(-2,-17);walk(-15.2,-18);
 aim(1,p['final-pocket'].getFrame().center.clone().add({x:0,y:0,z:-1}));walk(-15.2,-14.7);aim(0,game.cargo.position.clone().setY(p['mirror-cradle'].getFrame().center.y));until(()=>game.cargo.position.y>22.3,6,'Final retrieval of original counterweight');
 until(()=>game.cargo.position.z>-16.9,4,'Final offloader clears the portal');mark('original load rests in the final pocket');aim(1,p['light-output'].getFrame().center);wait(1);walk(-15.2,-17.6);walk(-12,-17.6);pickup();
 walk(-10.2,-18);mark('final field transfer over the shared hub');for(let n=0;n<180;n++){worldMove(1,0);frame();if(game.playerPosition.x>-8.5)break;}stop();
 until(()=>game.playerPosition.z>-9,12,'Upper suspended transfer');mark('steering across the suspended return');
 for(let n=0;n<160;n++){worldMove(1,0);frame();if(game.playerPosition.x>-4.5)break;}stop();until(()=>game.playerGrounded&&Math.abs(game.playerPosition.y-20)<.2,6,'Offset receiving bay');walk(2,3);until(()=>game.state==='won',5,'Braided exchange reunion');mark('the original companion crosses the whole exchange');
}
