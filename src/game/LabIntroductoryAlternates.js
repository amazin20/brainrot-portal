const check=(value,message)=>{if(!value)throw Error(message);};

/** Archive room 1: use the existing trench as a gravity-powered portal entry. */
export function runTrenchDrop(d){
 const {game,level,walk,aim,until,frame,worldMove,stop,mark}=d,p=level.panels;
 walk(0,4.4);aim(1,p.exit.getFrame().center);aim(0,p['trench-floor'].getFrame().center);
 const before=game.teleportCount;
 for(let n=0;n<240&&game.teleportCount===before;n++){worldMove(0,-1);frame();}stop();
 check(game.teleportCount>before,'The real trench fall missed its floor portal');
 mark('falling through the trench floor reaches the opposite bank');
 until(()=>game.playerGrounded,5,'Trench exit did not land on the far bank');
 walk(0,-11.5);
}

/** Archive room 4: portal onto the low car and ride its moving destination. */
export function runRideLift(d){
 const {game,level,walk,aim,enter,pickup,until,wait,mark}=d,p=level.panels;
 aim(0,p.entry.getFrame().center);aim(1,p.lift.getFrame().center);
 walk(-1.4,9);pickup();enter(p.entry);
 check(game.playerPosition.y<.2&&game.heldCube,'The low moving portal did not receive both travellers');
 mark('entered the moving portal before raising its lift');
 walk(0,-6);check(game.interact()&&!game.heldCube,'Friend could not be placed on the real lift deck');
 wait(.5);walk(0,-4.45);check(game.interact(),'Onboard lift terminal did not respond');
 until(()=>level.lift.y>4.98,10,'Occupied lift did not rise to the far bank');
 check(game.cargo.position.y>5.3,'The same companion did not ride the physical lift');
 mark('the player and free companion ride the moving portal platform together');
 walk(game.cargo.position.x-1.1,game.cargo.position.z);pickup();walk(0,-12.5);
}
