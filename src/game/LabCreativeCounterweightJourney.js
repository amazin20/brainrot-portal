import {installRoom21Aim} from './LabRoom21Journey.js';
import {aimLateSurface} from './LabLateCampaignAim.js';
const check=(ok,message)=>{if(!ok)throw Error(message);};
function collect(d){for(let i=0;i<10;i++){const c=d.game.cargo.position;d.walk(c.x+1.2,c.z);if(d.game.playerPosition.distanceTo(c)<2.2){d.pickup();return;}}throw Error('Original companion cannot be reached on the physical receiving floor');}
export function runCreative34(d,{route='charge-then-deliver',alternate=false,recover=false,stopBeforeCharge=false,stopBeforeDelivery=false,stopBeforeRetrieval=false}={}){
 if(recover)route='recover-early-discharge';else if(alternate&&route==='charge-then-deliver')route='inspect-unsealed-first';
 installRoom21Aim(d);const {game:g,level:l,walk,wait,until,mark}=d,s=l.pressureState;
 check(s,'Missing pneumatic reservoir');
 if(route==='inspect-unsealed-first'||route==='explore-service-first'){
  walk(0,-5);wait(3);check(s.pressure<3&&s.doorTravel<.1,'An exposed leak must keep the guided door shut');
  mark('Unsealed air supply cannot store useful pressure or open the partition');walk(0,12);
 }
 walk(-13,6.5);aimLateSurface(d,1,l.inlet);walk(-3,16);
 if(stopBeforeCharge)return;
 aimLateSurface(d,0,l.dispatch.surface);
 // Use the actual projectile's floor frame to centre the rigid body. A
 // recovered companion can approach from another side; the short outlet
 // admits its complete footprint only when its ordinary release is aligned.
 const feed=g.portals.portals[0].position;
 collect(d);walk(feed.x,feed.z+2);walk(feed.x,feed.z+.7);d.stop();wait(.4);
 check(g.interact()&&!g.heldCube,'Original cargo release missed');wait(.6);walk(-3,16);
 mark('Ordinary projectiles connect the loaded floor to a cargo-height pressure inlet');
 until(()=>g.physics.portalTransports>0&&s.coverage>.8,8,'Free companion did not seal the actual air aperture');
 mark('The original free body closes the geometric leak while the observer stays outside its low sleeve');
 walk(-9,8.65);until(()=>s.pressure>(route==='recover-early-discharge'?35:95),12,'The covered leak failed to charge the finite reservoir');
 mark('A continuously leaking pressure vessel stores air while the real cargo blocks its vent');
 if(stopBeforeDelivery)return;
 check(g.interact()&&s.mode===1,'Visible pneumatic distributor did not select discharge');
 if(route==='recover-early-discharge'){
  until(()=>g.cargo.position.z< -15.5,7,'Early discharge did not send the actual cargo into the receiving plenum');
  check(g.interact()&&s.mode===2,'Actual distributor did not select reverse recovery');
  until(()=>g.cargo.position.x>-14&&g.cargo.position.z>5,15,'Reverse air failed to recover the original companion through the service window');
  collect(d);walk(-9,12);walk(-9,12.5);check(g.interact()&&!g.heldCube,'Recovered companion was not placed outside the sleeve');wait(.5);walk(-9,8.65);
  check(g.interact()&&s.mode===0,'Actual distributor did not return to charging');
  mark('Early pressure discharge is recovered by reversing the actual flow and reusing the original cargo');
  return runCreative34(d,{route:'charge-then-deliver',stopBeforeRetrieval});
 }
 until(()=>s.doorTravel>5.8,5,'Stored pressure failed to move the actual guided door');
 until(()=>g.cargo.position.z< -15.5,5,'Original cargo did not leave through the physical low sleeve');
 mark('One stored pressure discharge opens the human door and drives the same original cargo across its former vent');
 if(stopBeforeRetrieval)return;
 walk(0,2);walk(0,-13);walk(-12,-18);collect(d);
 check(s.pressure<95,'Discharge must actually consume the stored pressure');
 mark('The observer takes the separate human opening and recovers the original body on the receiving floor');
 walk(-10,-21);walk(0,-21);until(()=>g.state==='won',3,'Pressure route did not admit the original pair to the joint exit');
}
