import * as THREE from 'three';
import {aimLateSurface,installPreciseLateAim} from './LabLateCampaignAim.js';
const check=(v,m)=>{if(!v)throw Error(m);};
export function runInverseSpring(d,{route='charge-then-load',stopBeforeRelease=false,stopBeforeCharge=false}={}){
 installPreciseLateAim(d);check(['charge-then-load','aim-before-charge','ride-then-send','friend-before-passenger'].includes(route),'Unknown inverse spring route');
 const {game:g,level:l,walk,until,mark}=d,p=l.panels;
 const aim=()=>{walk(0,10);aimLateSurface(d,1,p['spring-catcher-mouth']);const entry=p['spring-ceiling'].getFrame().center.clone();if(!g.heldCube&&l.spring.loaded()){entry.x=g.cargo.position.x;entry.z=g.cargo.position.z;}aimLateSurface(d,0,p['spring-ceiling'],entry);};
 if(route==='aim-before-charge'||route==='friend-before-passenger')aim();
 if(stopBeforeCharge)return;
 walk(-8,12.8);g.input.jumpQueued=true;for(let i=0;i<130;i++){d.worldMove(0,-.65);d.frame();if(i>10&&g.playerGrounded&&g.playerPosition.y>.6)break;}d.stop();
 walk(-2.6,6);until(()=>l.spring.compression>.65,4,'Observer weight did not compress the real spring');check(g.interact()&&l.spring.held,'The loaded spring clamp failed');
 mark('The observer stores real elastic displacement before cargo loading');
 walk(-8,14);walk(g.cargo.position.x+1.25,g.cargo.position.z);d.pickup();
 walk(-9,6);d.look(new THREE.Vector3(-6,1.2,6));d.stop();d.wait(.3);check(g.interact()&&!g.heldCube,'Original companion could not be loaded on the compressed spring');d.wait(.65);
 check(g.cargo.position.x>-10&&g.cargo.position.x<-6&&g.cargo.position.z>4&&g.cargo.position.z<8,'Original companion missed the visible bed');
 if(route!=='aim-before-charge'&&route!=='friend-before-passenger')aim();else {walk(0,10);const entry=p['spring-ceiling'].getFrame().center.clone();entry.x=g.cargo.position.x;entry.z=g.cargo.position.z;aimLateSurface(d,0,p['spring-ceiling'],entry);}
 if(stopBeforeRelease)return;
 walk(3.5,6);const sent=g.physics.portalTransports;check(g.interact()&&!l.spring.held,'Outer spring release failed');
 until(()=>g.physics.portalTransports>sent&&l.catcher.loaded(),7,'Stored spring energy did not carry the original body into its receiver');
 mark('Real spring contact launches the same original companion through the ceiling');
 until(()=>l.door.progress>.93,4,'Original cargo weight did not open the physical partition');walk(0,-12);walk(5.5,-13);check(g.interact()&&l.getSecured(),'Downstream receiver ratchet failed');
 until(()=>l.cover.progress>.94,4,'Receiver inspection cover did not lift');walk(-12,-12);walk(g.cargo.position.x+1.15,g.cargo.position.z+1.1);check(g.interact()&&g.heldCube,'Original companion could not be recovered from the real receiving floor');d.wait(.4);
 walk(-12,-12);walk(0,-15);walk(0,-21);until(()=>g.state==='won',3,'Inverse spring original pair missed the exit');mark('The observer retrieves the original actuator and crosses the retained partition');
}
