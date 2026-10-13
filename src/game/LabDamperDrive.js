const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));

/** Unit-mass spring linkage, a friction shoe loaded by the original body,
 * and a vibration-operated relief valve on the powered bridge actuator.
 * The gauge rectifies ACTUAL bed travel, including its physical end stops;
 * its damped mean square is not a progression timer or a contact permission.
 */
export class DamperDrive {
 constructor(){this.reset();}
 reset(){
  this.x=.48;this.v=0;this.phase=0;this.frequency=5.2;this.loaded=false;
  this.bedVelocity=0;this.meanSquareVelocity=0;this.stroke=0;this.flow=0;
 }
 get rmsVelocity(){return Math.sqrt(this.meanSquareVelocity);}
 step(dt,loaded,powered){
  if(!Number.isFinite(dt)||dt<0)throw new RangeError('Damper time must be finite and nonnegative');
  this.loaded=loaded;
  for(let rest=dt;rest>1e-10;){const h=Math.min(rest,1/120);this.advance(h,loaded,powered);rest-=h;}
 }
 advance(dt,loaded,powered){
  this.phase+=this.frequency*dt;
  const before=this.x,force=16*Math.sin(this.phase)-26*this.x;
  // Viscous loss plus a dry-friction impulse. When the available impulse is
  // below the shoe's static friction, the bed sticks instead of creeping.
  const freeVelocity=this.v+dt*(force-(loaded?8:1)*this.v);
  this.v=Math.sign(freeVelocity)*Math.max(0,Math.abs(freeVelocity)-(loaded?8:0)*dt);
  this.x=clamp(this.x+this.v*dt,-.55,.55);
  if((this.x===.55&&this.v>0)||(this.x===-.55&&this.v<0))this.v=0;
  this.bedVelocity=(this.x-before)*.15/dt;
  this.meanSquareVelocity+=(this.bedVelocity**2-this.meanSquareVelocity)*(1-Math.exp(-dt/3));
  // Optical drive fills the actuator. Bed motion opens its relief valve:
  // flow changes continuously with motion energy, with no cargo permission.
  // At 0.04 m/s weighted RMS the powered flows balance; no light returns it.
  this.flow=powered?2.5*(1-this.meanSquareVelocity/.04**2):-2.5;
  this.stroke=clamp(this.stroke+this.flow*dt,0,1);
 }
}
