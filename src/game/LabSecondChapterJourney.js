import {installRoom21Aim} from './LabRoom21Journey.js';
const check=(ok,text)=>{if(!ok)throw Error(text);};
function collect(d){for(let n=0;n<12;n++){const p=d.game.cargo.position;d.walk(p.x+1.3,p.z);if(d.game.playerPosition.distanceTo(d.game.cargo.position)<2.2){d.pickup();return;}}throw Error('Cannot reach the same companion');}
function release(d){d.stop();d.wait(.25);check(d.game.interact()&&!d.game.heldCube,'Put down companion');d.wait(.7);}
export function runCounterweight(d,{alternate=false,recover=false}={}){
 const {game:g,level:l,walk,wait,until,enter,mark}=d,[a,b]=l.cabins,p=l.panels;
 d.aim(0,p['service-entry'].getFrame().center);d.aim(1,b.panel.getFrame().center);
 collect(d);enter(p['service-entry']);walk(10,14);walk(20,14);walk(20,8);release(d);
 if(alternate){
  walk(17.4,12);check(g.interact()&&!l.balance.braked,'East brake missed');
  until(()=>b.position.y<.025,35,'Loaded counterweight did not descend');
  check(g.interact()&&l.balance.braked,'East brake did not hold');
  mark('Travellers descend together, raising their destination on the other cable end');
  walk(10,16);d.aim(0,a.panel.getFrame().center);walk(20,16);collect(d);walk(20,14);walk(10,14);enter(b.panel);
 }else{
  walk(20,14);walk(10,14);enter(b.panel);walk(-20,12);walk(-20,5);walk(-17.4,5);
  check(g.interact()&&!l.balance.braked,'West brake missed');
  until(()=>a.position.y>7.975,45,'Companion counterweight did not lift the player');
  check(g.interact()&&l.balance.braked,'West brake did not hold');
  mark('The original companion acts as counterweight; the player rides the opposite cabin');
  if(recover){
   walk(-20,7);walk(-6,7);until(()=>g.playerGrounded&&g.playerPosition.y<.1,5,'Fall to service floor missed');
   walk(6,18);walk(16,18);collect(d);release(d);walk(20,17);walk(8,17);
   d.aim(0,p['service-entry'].getFrame().center);d.aim(1,a.panel.getFrame().center);
   walk(20,17);collect(d);walk(20,17);walk(-8,18);enter(p['service-entry']);
   mark('Service-floor fall retrieves the same companion and returns through the raised cabin');
  }else{
   walk(-20,7);walk(-10,7);d.aim(0,a.panel.getFrame().center);enter(a.panel);walk(10,14);walk(20,14);collect(d);walk(20,14);walk(10,14);enter(b.panel);
   mark('The brake holds the raised cabin while its counterweight is retrieved through the moving pair');
  }
 }
 walk(-10,7);walk(-22,7);walk(-22,-12);walk(-7,-15);
 until(()=>g.state==='won',3,'Counterweight joint finish missed');
}
export function runLightAddress(d,{alternate=false,recover=false}={}){
 const {game:g,level:l,walk,wait,until,enter,mark}=d,p=l.panels;
 const connect=()=>{d.aim(0,p['light-source'].getFrame().center);d.aim(1,p['light-shuttle'].getFrame().center);wait(.35);};
 connect();
 if(recover){
  walk(-20,10);walk(-8,10);g.clearPortals();until(()=>g.playerGrounded&&g.playerPosition.y<.1,5,'Light loss did not remove support');
  walk(2,18);walk(2,24);walk(-2,24);walk(-21,24);walk(-21,17);connect();mark('Extinguished bridge: real descent and service stairs back to the starting dock');
 }
 if(alternate){walk(-20,10);walk(0,10);walk(0,2);walk(11,2);walk(11,10);walk(11,2);walk(0,2);walk(0,10);walk(-21,10);mark('The back of the relay is investigated before collecting the companion');}
 collect(d);walk(-21,10);walk(0,10);walk(0,17);release(d);walk(.5,14.7);
 check(g.interact(),'Optical selector missed');until(()=>l.stage.at(1),12,'Optical panel did not reach second berth');
 mark('Panel changes address while the travellers stand on independent architecture');
 if(recover){
  // Lose both links AFTER the panel has left its first berth. A ground-level
  // recall must recover the route without moving or replacing the companion.
  walk(-7,17);g.clearPortals();until(()=>g.playerGrounded&&g.playerPosition.y<.1,5,'Post-transfer fall missed');
  walk(0,18.6);check(g.interact(),'Service selector unreachable');until(()=>l.stage.at(0),12,'Panel recall failed');
  walk(2,18);walk(2,24);walk(-2,24);walk(-21,24);walk(-21,17);connect();
  walk(-21,10);walk(0,10);walk(-1.5,16);walk(.5,14.7);check(g.interact(),'Restored selector unreachable');until(()=>l.stage.at(1),12,'Recovered panel transfer failed');
  mark('Both portals lost after transfer: physical recall and stairs return to the same waiting companion');
 }
 walk(0,2);walk(11,2);walk(11,10);d.aim(0,p['relay-return'].getFrame().center);
 walk(11,2);walk(0,2);d.aim(1,p['travel-shuttle'].getFrame().center);collect(d);walk(0,2);walk(11,2);walk(11,10);enter(p['relay-return']);
 walk(-21,-5);release(d);d.aim(0,p['light-source'].getFrame().center);d.aim(1,p['light-shuttle'].getFrame().center);wait(.35);collect(d);
 mark('The transport link is reused as an optical path from a real remote dock');
 walk(-21,-14);walk(14,-14);until(()=>g.state==='won',3,'Light-address joint finish missed');
}
export function runSecondChapter(d,options={}){installRoom21Aim(d);return [runCounterweight,runLightAddress][d.level.index-5](d,options);}
