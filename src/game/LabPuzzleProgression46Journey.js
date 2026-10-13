import {installPreciseLateAim,aimLateSurface} from './LabLateCampaignAim.js';
const check=(x,m)=>{if(!x)throw Error(m);};
function collect(d){for(let i=0;i<8;i++){const p=d.game.cargo.position;d.walk(p.x-1.25,p.z);if(d.game.playerPosition.distanceTo(p)<2.2){d.pickup();return;}}throw Error('The original extracted companion could not be collected');}
function toggle(d,terminal){d.walk(terminal.position.x,terminal.position.z-1.5);d.stop();d.wait(.2);check(d.game.interact(),'A visible field terminal was inaccessible');d.wait(.2);}
/** Proof uses only production movement, E and ordinary portal fire. Stops
 * describe physical states; the room neither stores nor consumes milestones. */
export function runPuzzleProgression46(d,{stopAfter=null,recover=false,noCargo=false}={}){
 installPreciseLateAim(d);const {game:g,level:l}=d,p=l.panels;
 check(l.puzzleProgression===46,'Room 46 spatial progression is required');
 if(recover){d.walk(-17.2,20);d.walk(-14,20);d.until(()=>g.playerGrounded&&g.playerPosition.y<-3.8,5,'Service fall missed');d.walk(-14,-17.4);d.walk(-26,-17.4);d.walk(-26,8);d.walk(-22,16);d.mark('A physical service floor and broad ramp recover the player');}
 aimLateSurface(d,0,p['light-source']);aimLateSurface(d,1,p['bridge-address']);
 d.until(()=>l.light.pieces.some(x=>x.floor.enabled&&x.floor.maxX>0&&x.floor.y>14.8),2,'The real light causeway did not reach the island');
 d.mark('The only pair makes a temporary light causeway');if(stopAfter==='bridge')return;
 d.walk(-22,8);d.walk(3,8);d.wait(.3);
 check(g.playerGrounded&&g.playerPosition.y>14.9&&g.cargo.position.x<-17,'The player must cross to permanent support while original cargo remains trapped');
 d.mark('The player commits to permanent support before removing the light bridge');if(stopAfter==='island')return;
 toggle(d,l.reverse);check(l.funnel.reversed,'The real reverse control did not reverse the field');
 d.walk(3,-7);aimLateSurface(d,0,p['field-intake']);
 d.walk(3,-24);d.mark('The island side view reveals the low freight extraction address');
 aimLateSurface(d,1,p['freight-extraction']);
 check(!l.light.pieces.some(x=>x.floor.enabled&&x.floor.maxX>0),'Repurposing the sole pair must remove the temporary crossing');
 if(stopAfter==='routed')return;
 toggle(d,l.power);check(l.funnel.enabled,'The real field power control did not switch on');
 const transports=g.physics.portalTransports;
 d.until(()=>g.physics.portalTransports>transports,12,'The reversed field did not extract the original cargo');
 d.until(()=>g.cargo.position.x>5&&g.cargo.position.z>5,12,'The original companion did not reach the emitter receiving shelf');
 d.mark('The reversed real field carries the original companion out of its enclosed bay');if(stopAfter==='extracted')return;
 toggle(d,l.power);check(!l.funnel.enabled,'The receiving field must release its load');
 d.until(()=>g.physics.grounded&&g.cargo.position.y>15.2&&g.cargo.position.y<15.7,5,'The original cargo did not settle on permanent support');
 d.mark('Switching off suspension parks original cargo on the real island');if(stopAfter==='settled')return;
 d.walk(-1.6,-22);aimLateSurface(d,1,p.launch);
 d.walk(9.6,-22);aimLateSurface(d,0,p.fall);
 if(!noCargo){d.walk(3,-22);d.walk(3,g.cargo.position.z);collect(d);d.walk(3,g.cargo.position.z);d.walk(3,-22);}
 d.walk(9.8,-22);const before=g.teleportCount;
 for(let n=0;n<180&&g.playerGrounded;n++){d.worldMove(1,0);d.frame();}d.stop();
 check(!g.playerGrounded,'The final crossing must begin with a real fall');
 d.until(()=>g.teleportCount>before,5,'The island fall did not enter its actual floor aperture');
 d.until(()=>g.playerGrounded,6,'The high terrace did not receive the conserved impulse');
 check(g.playerPosition.y>21.9,'The final terrace must require falling momentum');
 d.mark('The same pair converts the deep island fall into the high traversal');
 d.walk(15,15);
 if(noCargo){d.wait(1);check(g.state!=='won','The exit cannot accept the player alone');return;}
 d.until(()=>g.state==='won',3,'Both original travellers did not arrive at the joint physical goal');
 d.mark('Both original actors reach the high exit without reset');
}
