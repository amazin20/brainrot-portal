import {installPreciseLateAim,aimLateSurface} from './LabLateCampaignAim.js';
const check=(v,m)=>{if(!v)throw Error(m);};
function control(d){d.walk(-4,7.65);check(d.game.interact(),'Electrical knife switch is unreachable');d.wait(.25);}
export function runCreative18(d,{route='contact-then-power',alternate=false,recover=false,stopBeforeFeed=false,stopBeforePower=false,stopBeforeRetrieval=false}={}){
 if(alternate)route='power-before-contact';if(recover)route='reverse-partial-stroke';
 check(['contact-then-power','power-before-contact','reverse-partial-stroke'].includes(route),'Unknown electrical circuit route: '+route);
 installPreciseLateAim(d);const{game:g,level:l,walk,wait,until,mark}=d,s=l.circuit;check(s,'Missing electrical circuit');
 if(route==='power-before-contact'){control(d);wait(2);check(s.current===0&&s.stroke===0,'The open circuit cannot power its motor');mark('A powered empty cell remains an electrically open circuit');}
 walk(-8,0);walk(-14,.4);aimLateSurface(d,1,l.mouth);walk(-8,.4);walk(-8,19);walk(-7,19);
 if(stopBeforeFeed)return;
 aimLateSurface(d,0,l.feed.surface);const source=g.portals.portals[0].position;
 walk(g.cargo.position.x+1.15,g.cargo.position.z);d.pickup();walk(source.x,source.z+2);walk(source.x,source.z+.70);d.stop();wait(.45);check(g.interact()&&!g.heldCube,'The original conductor was not released');
 wait(.5);walk(-3,16);until(()=>g.physics.portalTransports>0,8,'The original free conductor did not enter the contact cell');wait(.8);
 walk(-9,3.65);check(g.interact()&&s.clamped,'The real spring contact lever did not close');
 until(()=>s.contacts.every(Boolean),8,'The original body did not close both real spring contacts');
 mark('Two opposed Cannon contacts close the series circuit through the original free body');
 if(stopBeforePower)return;
 if(s.mode===0)control(d);check(s.mode===1&&s.current>0,'Closed circuit did not supply forward current');
 if(route==='reverse-partial-stroke'){
  until(()=>s.stroke>2.6,6,'Forward motor failed to make a partial stroke');control(d);check(s.mode===2,'Polarity did not reverse');until(()=>s.stroke<.001,6,'Reverse current failed to close the actual partial stroke');
  mark('Reversed current returns the real partial screw stroke without resetting the original body');control(d);control(d);
 }
 until(()=>s.stroke>6.49,12,'The current failed to move the physical screw door');mark('Electrical work opens the actual partition and its mechanically linked service hatch');
 if(stopBeforeRetrieval)return;
 walk(-9,3.65);check(g.interact()&&!s.clamped,'Contact lever did not release the original conductor');wait(1);
 walk(-7,3.65);walk(-7,0);walk(-14,0);walk(-14,3.35);
 g.input.jumpQueued=true;for(let n=0;n<110&&g.playerPosition.z<5.4;n++){d.worldMove(0,1);d.frame();}d.stop();until(()=>g.playerGrounded,3,'The observer did not land beyond the visible cargo stop');
 walk(-14,6.1);check(g.playerPosition.distanceTo(g.cargo.position)<2.25,'Original conductor is not reachable through the open service mouth');d.pickup();
 wait(.5);check(s.current===0&&!s.contacts.some(Boolean),'Retrieval must break the actual series circuit');check(s.stroke>6.49,'Self-locking screw must retain its actual position without current');
 mark('The same conductor is retrieved; removing both contacts cuts current while thread friction holds the door');
 walk(-14,5.25);g.input.jumpQueued=true;for(let n=0;n<110&&g.playerPosition.z>3;n++){d.worldMove(0,-1);d.frame();}d.stop();until(()=>g.playerGrounded,3,'The original pair did not clear the visible cargo stop');
 walk(-14,0);walk(-8,0);walk(0,1);walk(0,-12);walk(0,-20);until(()=>g.state==='won',3,'The original pair did not cross the screw-controlled passage');
}
