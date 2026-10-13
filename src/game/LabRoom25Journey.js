const check=(p,m)=>{if(!p)throw Error(m);};
function source(d,which){
 if(d.level.state.optical.receivers[which])return;
 const panel=d.level.panels['light-intake'],target=panel.getFrame().center.clone();
 for(let n=0;n<4;n++){d.aim(0,target);d.wait(.2);if(d.level.state.optical.receivers[which])return;target.add(panel.getFrame().center.clone().sub(d.game.portals.portals[0].position));}
 check(false,'Optical source did not illuminate selected physical branch');
}
function put(d,x,z){d.walk(x,z+1.8);d.walk(x,z+.7);d.wait(.5);d.game.interact();d.wait(1.2);check(!d.game.heldCube,'Release failed');}
export async function runRoom25(d,{order='weight-first',interruptLight=false,interruptFreightLight=false}={}){
 const {game,level,walk,aim,wait,until,pickup,enter,mark}=d,p=level.panels,s=level.state;
 async function load(){walk(-14,9);pickup();walk(-14,8.7);walk(-7,8.7);game.input.jumpQueued=true;walk(-7,10);put(d,-7,12);check(s.optical.loaded,'Friend did not load the linked shutters');until(()=>s.optical.travel>.85,15,'Loaded physical shutters did not clear the first optical route');mark('one weight moves two opposite shadows');}
 if(order!=='light-first')await load();
 walk(-7,6);walk(17,6);walk(17,12);aim(0,p['light-intake'].getFrame().center);aim(0,p['light-intake'].getFrame().center.clone().add(p['light-intake'].getFrame().center.clone().sub(game.portals.portals[0].position)));
 if(order==='light-first')await load();
 // Sight the relay from the rear-left quarter of the actual car. From
 // its centre the shoulder muzzle can intersect the front guide column.
 walk(17,6);walk(-20,6);walk(-20,-10);walk(-14,-10);walk(-15.2,-10.7);aim(1,p['lower-relay'].getFrame().center);wait(.2);check(s.optical.motorLit,JSON.stringify(s.optical.segments.map(x=>({a:x.a.toArray(),b:x.b.toArray(),kind:x.kind}))));
 check(!s.optical.receivers[0],'Lower travelling mirror must not illuminate the raised fixed passenger receiver');
 walk(-14,-10);walk(-7,-10);walk(-7,7.9);
 check(game.interact(),'Could not switch the real optical freight motor from the lower floor');
 mark('ground switch supplies the continuously illuminated moving freight mirror');
 walk(-7,-10);walk(-14,-10);
 until(()=>game.playerPosition.y>8.97,25,'Raised actual freight mirror did not power the first passenger lift');
 walk(-14,-13);walk(-6,-13);walk(-3,-14.5);mark('permanent gallery keeps height after losing light');
 if(interruptFreightLight){
  const height=s.counterweightHoist.height;
  aim(1,p['freight-receiver'].getFrame().center);
  until(()=>s.counterweightHoist.velocity<-.2,4,'Retargeted portal did not remove the actual freight motor supply');
  wait(.5);check(s.counterweightHoist.height<height,'Dark real freight carriage did not return under gravity');
  mark('retargeted portal removes current freight mirror supply and gravity returns the original support');
  wait(7);walk(-14,-13);walk(-20,-13);until(()=>game.playerGrounded,8,'Ordinary return to the lower firing court did not land');
  walk(-20,-10);walk(-14,-10);walk(-15.2,-10.7);aim(1,p['lower-relay'].getFrame().center);
  until(()=>s.counterweightHoist.velocity>.2,5,'Restored actual light did not restart the same freight carriage');
  until(()=>game.playerPosition.y>8.97,25,'Recovered moving mirror did not restore the first passenger lift');
  walk(-14,-13);walk(-6,-13);walk(-3,-14.5);
  mark('ordinary lower-floor portal restores light and raises the same original load');
 }

 {
  // Current reflected light raises the loaded freight plate. Its travelling
  // mirror then illuminates the fixed passenger receiver; cargo stays on the
  // real moving collider until the player retrieves it from the side balcony.
  check(s.optical.receivers[0]&&s.optical.loaded,'Hoist must be driven by the lit, loaded first circuit');
  walk(-7,-13);walk(-14,-13);walk(-14,-10);walk(-7,-10);walk(-7,7.9);
  until(()=>s.counterweightHoist.height>8.95&&game.cargo.position.y>9.1,15,'Loaded plate did not raise its original companion');
  mark('first optical receiver raised the loaded counterweight onto a physical balcony');
  walk(-9,7.9);walk(-9.7,10.95);game.input.jumpQueued=true;walk(-8.3,11.1);pickup();walk(-9.7,11.1);wait(1.2);
  check(!s.optical.loaded,'Taking the friend off the raised plate must reverse the two shutters');
  until(()=>s.optical.travel<.1,15,'The unloaded physical shutters did not return');
  mark('balcony retrieval reverses both linked shadows without a cargo portal');
  walk(-9.7,8);walk(-7,7.9);walk(-7,-10);walk(-14,-10);walk(-14,-13);walk(-7,-13);
 }
 walk(-3,-13);walk(10,-13);walk(10,-8.8);walk(12.5,-8.8);walk(16,-10);put(d,16,-10);aim(1,p['upper-relay'].getFrame().center);source(d,1);
 if(interruptLight){
  // The small source inset cannot hold a displaced full traveller mouth.
  // Walk to the real freight firing court and retarget the relay instead.
  pickup();walk(12.5,-8.8);walk(10,-8.8);walk(10,-13);walk(-3,-13);walk(-3,-14.5);
  put(d,-3,-14.5);walk(-3,-14.5);aim(1,p['freight-receiver'].getFrame().center);wait(.5);check(!s.optical.receivers[1],'Retargeted actual relay must interrupt the second motor');
  pickup();walk(-3,-13);walk(10,-13);walk(10,-8.8);walk(12.5,-8.8);walk(16,-10);
  put(d,16,-10);aim(1,p['upper-relay'].getFrame().center);source(d,1);
 }
 pickup();until(()=>game.playerPosition.y>17.97,18,'Second relay lift did not rise');walk(12.5,-10);walk(12.5,-14.5);walk(16,-14.5);mark('reverse overlook reveals the starting room');
 put(d,16,-14.5);walk(12.5,-14.5);walk(12.5,-6.5);aim(1,p.home.getFrame().center);walk(12.5,-14.5);walk(16,-14.5);aim(0,p['return-entry'].getFrame().center);walk(game.cargo.position.x+.9,game.cargo.position.z);pickup();enter(p['return-entry']);until(()=>game.playerGrounded,5,'Home drop did not land');walk(-16,22);until(()=>game.state==='won',4,'Original companion did not reach home');
}
