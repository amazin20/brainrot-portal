import {installPreciseLateAim,aimLateSurface} from './LabLateCampaignAim.js';
const check=(c,m)=>{if(!c)throw Error(m);};
function collect(d){for(let i=0;i<8;i++){const c=d.game.cargo.position;d.walk(c.x-1.3,c.z);if(d.game.playerPosition.distanceTo(c)<2.2){d.pickup();return;}}throw Error('Original companion could not be collected');}
export function runPuzzleProgression44(d,{stopAfter=null,recover=false,bridgeOffset=0}={}){
 installPreciseLateAim(d);const {game:g,level:l}=d;check(l.progression44,'Wrong progression44 room');
 const bridgeShot=(color,s)=>{const f=s.getFrame();aimLateSurface(d,color,s,f.center.clone().addScaledVector(f.right,bridgeOffset));};
 if(recover){d.walk(-18.1,26);for(let i=0;i<180&&g.playerGrounded;i++){d.worldMove(1,0);d.frame();}d.stop();d.until(()=>g.playerGrounded&&g.playerPosition.y<-3.8,5,'Service floor missed');d.walk(-17,0);d.walk(-25,0);d.walk(-25,24);d.mark('A real fall and west service ramp recover the player');}
 d.walk(-24,27);bridgeShot(0,l.source);d.walk(-24,16);bridgeShot(1,l.first);
 d.walk(0,16);d.mark('The first real light bridge reaches a stable central island');if(stopAfter==='middle')return;
 d.walk(0,27);bridgeShot(0,l.source);d.walk(0,21);bridgeShot(1,l.second);d.walk(0,21);d.walk(0,-5);d.mark('A second bridge direction reaches the northern inspection gallery');if(stopAfter==='north')return;
 d.walk(-5,-16);d.mark('The northern walkway reveals two aligned freight observation windows');if(stopAfter==='observation')return;aimLateSurface(d,1,l.returned);aimLateSurface(d,0,l.load.surface);
 d.until(()=>g.cargo.position.x>-6&&g.cargo.position.z<-20,8,'The new northern view failed to return the original cargo');
 d.until(()=>g.physics.grounded,5,'Returned cargo did not settle');d.mark('The northern view retrieves original cargo and leaves its enclosed freight pocket');if(stopAfter==='returned')return;
 d.walk(5,-21);bridgeShot(0,l.source);bridgeShot(1,l.final);collect(d);d.walk(5,-21);d.walk(24,-21);
 d.until(()=>g.state==='won',3,'Both original travellers did not reach the physical exit');d.mark('A third real light bridge brings both original travellers to the visible exit');
}
