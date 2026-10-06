import {tracePortalRay} from './LabPuzzleMechanics.js';

/** A finite-speed packet, not a receiver preselected at emission time.
 * Each step traces only the distance travelled this step through the CURRENT
 * orthonormal portal frames. After leaving an aperture the packet is free:
 * erasing or moving that portal cannot recall an already departed packet.
 * Distances are in game units. This stylised pressure-pulse instrument is not
 * a real-world speed-of-sound simulation. */
export class TravellingPulseField {
 constructor(game,{speed=10,lifetime=12,maxPackets=12,onArrival=()=>{}}={}){
  if(!(speed>0&&lifetime>0&&Number.isInteger(maxPackets)&&maxPackets>0))throw new RangeError('Invalid pulse field');
  this.game=game;this.speed=speed;this.lifetime=lifetime;this.maxPackets=maxPackets;this.onArrival=onArrival;
  this.receivers=[];this.reset();
 }
 reset(){this.packets=[];this.emitted=0;this.arrivals=[];this.absorbed=[];this.clock=0;}
 emit(position,direction){
  if(this.packets.length>=this.maxPackets)return false;
  const vector=direction.clone();if(vector.lengthSq()<.99)return false;
  this.packets.push({id:++this.emitted,position:position.clone(),previous:position.clone(),direction:vector.normalize(),age:0,travel:0,portalCrossings:0});return true;
 }
 step(dt){
  if(!Number.isFinite(dt)||dt<0)throw new RangeError('Pulse time must be finite and nonnegative');
  // Bound each sweep even during a long frame, without discarding elapsed time.
  for(let rest=dt;rest>1e-10;){const h=Math.min(rest,1/120);this.advance(h);rest-=h;}
 }
 advance(dt){
  this.clock+=dt;
  const keep=[];
  for(const p of this.packets){
   p.previous.copy(p.position);p.age+=dt;
   if(p.age>this.lifetime)continue;
   // The extra lookahead only discovers the next boundary. Consume exactly
   // speed*dt, including a portal reached at the very end of a step.
   const segments=tracePortalRay(this.game,p.position,p.direction,{length:this.speed*dt+.15,bounces:4,medium:'air'});
   let remove=false,crossed=false,budget=this.speed*dt;
   for(let si=0;si<segments.length&&budget>1e-10;si++){
    const s=segments[si],distance=Math.min(s.length,budget),end=s.a.clone().addScaledVector(s.direction,distance);
    for(const sensor of this.receivers){
     if(s.direction.dot(sensor.normal)>-.8)continue;
     const at=sensor.position.clone().sub(s.a).dot(sensor.normal)/s.direction.dot(sensor.normal);
     if(at< -1e-8||at>distance+1e-8)continue;
     const point=s.a.clone().addScaledVector(s.direction,Math.max(0,at));
     if(point.distanceTo(sensor.position)>sensor.radius)continue;
     const event={packet:p.id,receiver:sensor.name,time:this.clock,travel:p.travel+s.a.distanceTo(point),portalCrossings:p.portalCrossings};
     this.arrivals.push(event);if(this.arrivals.length>64)this.arrivals.shift();this.onArrival(sensor,event);remove=true;break;
    }
    p.travel+=distance;budget-=distance;p.position.copy(end);p.direction.copy(s.direction);
    if(remove)break;
    if(distance<s.length-1e-8)break;
    if(s.kind==='wall'){this.absorbed.push({packet:p.id,position:p.position.toArray(),crossings:p.portalCrossings});if(this.absorbed.length>64)this.absorbed.shift();remove=true;break;}
    if(s.kind==='portal'){
     const next=segments[si+1];
     // Lookahead always includes a short exit segment; never leave a packet
     // stranded on the entry plane when its remaining travel is exactly zero.
     if(!next){remove=true;break;}
     p.portalCrossings++;crossed=true;p.position.copy(next.a);p.direction.copy(next.direction);
    }
   }
   if(remove||!segments.length)continue;
   if(crossed)p.previous.copy(p.position);
   keep.push(p);
  }
  this.packets=keep;
 }
}
