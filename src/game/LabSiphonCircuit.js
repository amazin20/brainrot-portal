/** A small lumped-volume hydraulic model, not a full fluid solver.
 * Source, crest tube and ram share one conserved volume. The wet crest is
 * reversible physical state: air at the intake drains it back to the header.
 * The visible service pump supplies external work when returning ram water.
 */
export class SiphonCircuit {
 constructor(options={}) {
  Object.assign(this,{area:2.56,base:12,initialDepth:1.2,crest:13.30,intake:12.06,
   tubeCapacity:.03,ramArea:.16,maxHeight:10.2,loadHead:.65,conductance:.048,pumpRate:.14},options);
  for(const key of ['area','initialDepth','tubeCapacity','ramArea','maxHeight','conductance','pumpRate'])
   if(!(Number.isFinite(this[key])&&this[key]>0))throw new RangeError('Invalid hydraulic '+key);
  if(!(this.crest>this.base+this.initialDepth&&this.intake>this.base&&this.intake<this.crest))throw new RangeError('Invalid siphon levels');
  this.total=this.area*this.initialDepth;this.reset();
 }
 reset(){this.source=this.total;this.tube=0;this.ram=0;this.displacement=0;this.flow=0;this.returning=false;this.delivered=0;}
 get surface(){return this.base+(this.source+this.displacement)/this.area;}
 get height(){return this.ram/this.ramArea;}
 get primed(){return this.tube>=this.tubeCapacity-1e-9;}
 get volume(){return this.source+this.tube+this.ram;}
 step(dt,displacement=0){
  if(!(Number.isFinite(dt)&&dt>=0&&dt<=.1))throw new RangeError('Hydraulic dt must be finite and at most .1');
  if(!(Number.isFinite(displacement)&&displacement>=0))throw new RangeError('Invalid displaced volume');
  this.displacement=displacement;this.flow=0;if(!dt)return;
  if(this.returning){
   const v=Math.min(this.ram,this.pumpRate*dt);this.ram-=v;this.source+=v;
   // Service valve vents the crest while the motor sends water uphill.
   const vent=Math.min(this.tube,this.tubeCapacity*dt*3);this.tube-=vent;this.source+=vent;return;
  }
  if(this.surface<=this.intake){const v=Math.min(this.tube,.07*dt);this.tube-=v;this.source+=v;return;}
  if(!this.primed){
   if(this.surface<this.crest){const drain=Math.min(this.tube,.04*dt);this.tube-=drain;this.source+=drain;return;}
   const available=Math.max(0,this.source+displacement-this.area*(this.crest-this.base));
   const v=Math.min(available,this.tubeCapacity-this.tube,.065*dt);this.source-=v;this.tube+=v;
   if(!this.primed)return;
  }
  // A non-return valve prevents the loaded ram from expelling water backwards.
  const head=Math.max(0,this.surface-this.height-this.loadHead);
  const available=Math.max(0,this.source-this.area*(this.intake-this.base)+displacement);
  const v=Math.min(available,this.source,this.ramArea*this.maxHeight-this.ram,this.conductance*Math.sqrt(head)*dt);
  this.source-=v;this.ram+=v;this.flow=v/dt;this.delivered+=v;
 }
}
