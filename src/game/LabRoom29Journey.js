const check=(condition,message)=>{if(!condition)throw new Error(message);};
export async function runRoom29(d,{carryRoute=false,recover=false}={}){
 const {game,level,walk,look,aim,wait,until,pickup,enter,mark}=d,p=level.panels,s=level.state.gravity;
 const promenade=()=>{walk(-14,4);walk(-18,4);walk(-18,18);walk(-8,18);walk(-8,6);walk(15,6);};
 if(carryRoute){walk(game.cargo.position.x+1,game.cargo.position.z);pickup();promenade();walk(12,5.5);look(p['observatory-return'].getFrame().center);game.interact();wait(1);mark('the long ground path keeps both travellers together');}
 else{
  walk(game.cargo.position.x+1,game.cargo.position.z);pickup();walk(-12,11.5);look(p['root-ceiling'].getFrame().center.clone().setY(2));walk(-12,9.4);game.interact();wait(1);
  walk(-5,11);game.interact();wait(.3);check(s.source.up,'The visible source crystal did not reverse');
  walk(0,12);aim(0,p['root-ceiling'].getFrame().center);promenade();
  walk(9,5);aim(1,p['crown-ceiling'].getFrame().center);
  until(()=>game.cargo.position.x>14.8&&game.cargo.position.y>15,18,'Friend did not cross the inverted ceiling garden');mark('the companion crosses a passage too low for its observer');
  if(recover){walk(16,5.5);game.interact();until(()=>game.cargo.position.y<10,8,'Reversal did not return friend to its receiving floor');game.interact();until(()=>game.cargo.position.y>15,8,'The same body could not revisit the ceiling');mark('reversing twice is recoverable without resetting either traveller');}
 }
 walk(15,5);aim(1,p['garden-return'].getFrame().center);walk(-8,6.5);aim(0,p['observatory-return'].getFrame().center);
 if(carryRoute){walk(game.cargo.position.x+1,game.cargo.position.z);pickup();}
 enter(p['observatory-return']);until(()=>game.playerGrounded&&game.playerPosition.y>8.8,5,'Observer did not reach receiving garden');mark('borrow the pair for the independent grounded route');
 if(!carryRoute){walk(18,-9.5);game.interact();until(()=>game.cargo.position.y<10,8,'The crown did not release its traveller');walk(game.cargo.position.x+1,game.cargo.position.z);if(game.state==='playing')pickup();}
 walk(17,-13);until(()=>game.state==='won',5,'The two garden routes did not meet');mark('the two versions of the garden meet at the same physical exit');
}
