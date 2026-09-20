const check=(p,m)=>{if(!p)throw Error(m);};
function source(d,which){
 if(d.level.state.optical.receivers[which])return;
 const panel=d.level.panels['light-intake'],target=panel.getFrame().center.clone();
 for(let n=0;n<4;n++){d.aim(0,target);d.wait(.2);if(d.level.state.optical.receivers[which])return;target.add(panel.getFrame().center.clone().sub(d.game.portals.portals[0].position));}
 check(false,'Optical source did not illuminate selected physical branch');
}
function put(d,x,z){d.walk(x,z+1.8);d.walk(x,z+.7);d.wait(.5);d.game.interact();d.wait(1.2);check(!d.game.heldCube,'Release failed');}
export async function runRoom25(d,{order='weight-first',interruptLight=false}={}){
 const {game,level,walk,aim,wait,until,pickup,enter,mark}=d,p=level.panels,s=level.state;
 async function load(){walk(-14,9);pickup();walk(-7,10);put(d,-7,12);check(s.optical.loaded,'Friend did not load the linked shutters');mark('one weight moves two opposite shadows');}
 if(order==='weight-first')await load();
 walk(-7,6);walk(17,6);walk(17,12);aim(0,p['light-intake'].getFrame().center);aim(0,p['light-intake'].getFrame().center.clone().add(p['light-intake'].getFrame().center.clone().sub(game.portals.portals[0].position)));
 if(order==='light-first')await load();
 walk(17,6);walk(-20,6);walk(-20,-10);walk(-14,-10);aim(1,p['lower-relay'].getFrame().center);wait(.2);check(s.optical.receivers[0],JSON.stringify(s.optical.segments.map(x=>({a:x.a.toArray(),b:x.b.toArray(),kind:x.kind}))));until(()=>game.playerPosition.y>8.97,18,'First shadow lift did not rise');
 walk(-14,-13);walk(-6,-13);walk(-3,-14.5);mark('permanent gallery keeps height after losing light');
 aim(1,p['freight-receiver'].getFrame().center);walk(-7,-13);walk(-14,-13);walk(-14,-10);walk(-7,-10);walk(-7,7.9);aim(0,p['shadow-counterweight'].getFrame().center);until(()=>game.cargo.position.y>9,8,'Cargo did not leave original counterweight');wait(1.6);
 check(!s.optical.loaded,'Retrieved friend must release the real shutter load');mark('cargo retrieval opens the other beam');
 walk(-7,-10);walk(-14,-10);walk(-14,-13);walk(-7,-13);walk(game.cargo.position.x-.9,game.cargo.position.z);pickup();walk(-3,-13);walk(10,-13);walk(10,-10);walk(12.5,-10);walk(16,-10);walk(16,-10);put(d,16,-10);aim(1,p['upper-relay'].getFrame().center);source(d,1);
 if(interruptLight){aim(0,p['light-intake'].getFrame().center.clone().add({x:0,y:0,z:2}));wait(.5);check(!s.optical.receivers[1],'Misaligned source must interrupt second motor');source(d,1);}
 pickup();until(()=>game.playerPosition.y>17.97,18,'Second relay lift did not rise');walk(12.5,-10);walk(12.5,-14.5);walk(16,-14.5);mark('reverse overlook reveals the starting room');
 put(d,16,-14.5);aim(1,p.home.getFrame().center);aim(0,p['return-entry'].getFrame().center);walk(game.cargo.position.x+.9,game.cargo.position.z);pickup();enter(p['return-entry']);until(()=>game.playerGrounded,5,'Home drop did not land');walk(-16,22);until(()=>game.state==='won',4,'Original companion did not reach home');
}
