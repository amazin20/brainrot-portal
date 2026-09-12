const check=(ok,message)=>{if(!ok)throw Error(message);};
export async function runRoom16(d,{order='cargo-first',supportPause=0}={}){
 const {game,level,walk,wait,aim,until,pickup,enter,mark}=d,p=level.panels;
 check(['cargo-first','scout-first'].includes(order),'Unknown room16 order');
 aim(0,p.arrival.getFrame().center);aim(1,p['first-address'].getFrame().center);
 if(order==='scout-first'){
  enter(p.arrival);walk(-17,2);mark('first inspection above the well');
  walk(-17,4.5);until(()=>game.playerGrounded&&game.playerPosition.y<.1,3,'Scouting fall must return to the lower court');walk(-17,15);
 }
 walk(game.cargo.position.x-1,game.cargo.position.z);pickup();enter(p.arrival);
 walk(-17,2);game.interact();wait(.8);aim(0,p.source.getFrame().center);
 walk(game.cargo.position.x-1,game.cargo.position.z);pickup();mark('borrowed floor crossing');
 walk(-16,1.75);wait(.15);game.input.jumpQueued=true;walk(-16,0);wait(.4);
 walk(-1.2,0);wait(.3);game.interact();wait(.6);mark('companion waits on borrowed support');if(supportPause>0)wait(supportPause);
 walk(6,0);walk(7,2.7);walk(7,13);wait(.5);walk(12,13);walk(12,0);wait(.4);
 check(Math.abs(game.playerPosition.y-2)<.25,'Player must prepare below the first crossing');
 walk(12,1.9);wait(.3);mark('counterweight descent');aim(1,p.arrival.getFrame().center);
 until(()=>level.state['counterweight-lift'].position.y>13.3,14,'Counterweight did not lift the waiting traveller');
 walk(12,3.2);walk(6,5.8);walk(0,4.25);mark('permanent gallery above the spent support');
 aim(0,p['upper-rest'].getFrame().center);aim(1,p.counterweight.getFrame().center);
 until(()=>game.cargo.position.y>13&&game.playerPosition.distanceTo(game.cargo.position)<2,6,'Weight was not released beside the upper observer');pickup();walk(-3,5.8);game.interact();wait(.8);
 walk(-3,4.6);walk(-15,4.6);walk(-15,5.8);aim(1,p['last-address'].getFrame().center.clone().add({x:0,y:.6,z:0}));aim(0,p.source.getFrame().center.clone().add({x:0,y:0,z:.4}));
 walk(game.cargo.position.x-1,game.cargo.position.z);pickup();walk(20.4,5.8);walk(20.4,-7.4);walk(18,-7.4);
 mark('light returns above the well');walk(18,-8.45);wait(.2);game.input.jumpQueued=true;walk(18,-10);wait(.4);
 walk(-16,-10);walk(-16,-8);until(()=>game.state==='won',4,'Both travellers must reach the far return destination');mark('false floor understood');
}
