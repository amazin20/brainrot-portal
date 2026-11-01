import {Body,Box,Vec3} from 'cannon-es';
import {createCastleOpticalDelayRig} from './LabCastleOpticalDelayRig.js';

const C=(x=0,y=0,z=0)=>new Vec3(x,y,z);
const fixed=(id,kind,center,normal,halfWidth=.65,halfHeight=.65,tangent)=>({id,kind,center,normal,halfWidth,halfHeight,tangent});

/** Local proof geometry, not a Level builder or an ordinary-player route.
 * Reference and measuring arms genuinely reach separate directional inputs.
 * ONE real pair redirects the measuring arm through the loaded rigid fold.
 * The fine exit is an externally prescribed kinematic boundary in this tiny
 * fixture; its eventual hand screw/work and all visible/query owners require
 * the canonical castle integration. No optical length is assigned here. */
export function createCastleOnePairOptics({world,originalCargoBody,originalCargoToken,cargoState,sourcePower=80,fine=0,entryShot=[0,0],exitShot=[0,0]}={}){
 if(!world||!Number.isFinite(fine)||Math.abs(fine)>.3+1e-8||[entryShot,exitShot].some(p=>p.length!==2||!p.every(Number.isFinite)))throw new RangeError('Finite one-pair geometry required');
 const entry=new Body({mass:0,position:C(-8,1.2,4)});entry.addShape(new Box(C(.06,1.5,.8)),C(.06,0,0));
 const exit=new Body({mass:0,type:Body.KINEMATIC,position:C(-6,1.2+fine,4),linearDamping:0,angularDamping:0});exit.addShape(new Box(C(.8,.06,1.5)),C(0,-.06,0));
 world.addBody(entry);world.addBody(exit);
 let disposed=false,layout;
 const rig=createCastleOpticalDelayRig({world,originalCargoBody,originalCargoToken,cargoState,sourcePower,fieldLayout:({tray})=>{
  const bodyPoint=(body,p)=>()=>body.pointToWorldFrame(C(...p)),bodyNormal=(body,n)=>()=>body.quaternion.vmult(C(...n));
  const mirror=(id,center,normal)=>fixed(id,'mirror',center,normal);
  const reference=[mirror('reference-turn-up',[-8,1.2,-4],[1,-1,0]),mirror('reference-high-fold',[-8,7.2,-4],[1,-1,0]),mirror('reference-turn-down',[-3.4,7.2,-4],[1,1,0])];
  const delay=[mirror('cargo-fold-up-to-right',bodyPoint(tray,[-10,1.2,3]),bodyNormal(tray,[1,-1,0])),mirror('cargo-fold-right-to-down',bodyPoint(tray,[-6,1.2,3]),bodyNormal(tray,[1,1,0]))];
  const inputs=[fixed('reference-input','input',[-3.4,1.2,-4],[0,1,0],.4,.4),fixed('delay-input','input',[-2,1.2,4],[0,1,0],.4,.4)];
  const a=fixed('one-entry','portal',bodyPoint(entry,[0,entryShot[0],entryShot[1]]),bodyNormal(entry,[-1,0,0]),.3,1.1,bodyNormal(entry,[0,0,1]));a.partnerId='one-exit';
  const b=fixed('one-exit','portal',bodyPoint(exit,[exitShot[0],0,exitShot[1]]),bodyNormal(exit,[0,1,0]),.3,1.1,bodyNormal(exit,[-1,0,0]));b.partnerId='one-entry';
  const backers=[fixed('actual-entry-backing','blocker',bodyPoint(entry,[0,0,0]),bodyNormal(entry,[-1,0,0]),.8,1.5,bodyNormal(entry,[0,0,1])),fixed('actual-exit-backing','blocker',bodyPoint(exit,[0,0,0]),bodyNormal(exit,[0,1,0]),.8,1.5,bodyNormal(exit,[-1,0,0]))];
  const faces=[...reference,...delay,...inputs,...backers,a,b],arms=[{origin:[-12,1.2,-4],direction:[1,0,0],faces,inputId:'reference-input'},{origin:[-12,1.2,4],direction:[1,0,0],faces,inputId:'delay-input'}];
  layout={faces,arms,reference,delay,inputs,portals:[a,b],backers};return layout;
 }});
 return{rig,entry,exit,layout,entryShot,exitShot,get disposed(){return disposed;},dispose(){if(disposed)return;disposed=true;rig.dispose();world.removeBody(entry);world.removeBody(exit);}};
}
