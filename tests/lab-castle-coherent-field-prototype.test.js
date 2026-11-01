import test from 'node:test';
import assert from 'node:assert/strict';
import {Body,Box,Vec3,World} from 'cannon-es';
import {balancedCastleCoupler,traceCastleCoherentArm,castleFieldPhaseSamples} from '../src/game/LabCastleCoherentField.js';
import {createCastleOpticalDelayRig} from '../src/game/LabCastleOpticalDelayRig.js';

const C=(x=0,y=0,z=0)=>new Vec3(x,y,z),DT=1/240;
const near=(a,b,tolerance=1e-7)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
function fixture({loaded=false,mass=3.2,cargoX=4}={}){
 const world=new World({gravity:C(0,-19.5,0)});world.solver.iterations=40;world.defaultContactMaterial.friction=.6;world.defaultContactMaterial.restitution=0;
 const floor=new Body({mass:0,shape:new Box(C(20,.1,20)),position:C(0,-.1,0)});world.addBody(floor);
 const cargo=new Body({mass,shape:new Box(C(.39,.39,.39)),position:loaded?C(cargoX,5.55,1):C(8,.4,1),linearDamping:0,angularDamping:0,allowSleep:false});world.addBody(cargo);
 const token={},state={body:cargo,shape:cargo.shapes[0],token,held:false,carryTarget:null};
 const rig=createCastleOpticalDelayRig({world,originalCargoBody:cargo,originalCargoToken:token,cargoState:()=>state});
 return{world,cargo,state,rig,step(count=1440){let result;for(let n=0;n<count;n++){rig.beforeStep(DT);world.step(DT);result=rig.afterStep();}return result;},dispose(){rig.dispose();}};
}

test('balanced coupler conserves all unequal/absent input powers and swaps outputs after a half wavelength',()=>{
 for(const [a,b] of [[0,0],[80,0],[0,80],[40,40],[.001,70],[3,7]])for(let n=0;n<80;n++){
  const q=balancedCastleCoupler(a,b,n*.137,1.3,4),r=balancedCastleCoupler(a,b,n*.137+2,1.3,4);
  assert.ok(q.outputPlus>=0&&q.outputMinus>=0);near(q.outputPlus+q.outputMinus,a+b);near(q.outputPlus,r.outputMinus);near(q.outputMinus,r.outputPlus);
 }
 assert.throws(()=>balancedCastleCoupler(-1,2,0,0,4),RangeError);
 assert.throws(()=>balancedCastleCoupler(1,2,0,0,0),RangeError);
});

test('two arms genuinely arrive with the wrong phase; an absent arm cannot impersonate the desired dark output',()=>{
 const f=fixture();try{
  const q=f.rig.readout();assert.equal(q.bothArmsReach,true);assert.deepEqual(q.traces.map(t=>t.segments.map(s=>s.kind)),[['mirror','mirror','input'],['mirror','mirror','input']]);
  near(q.traces[0].length,14);near(q.traces[1].length,12);near(q.outputPlus,0);near(q.outputMinus,80);
  f.rig.faces.find(p=>p.id==='reference-fold-a').enabled=false;
  const missing=f.rig.readout();assert.equal(missing.bothArmsReach,false);near(missing.inputPower,40);near(missing.outputPlus,20);near(missing.outputMinus,20);near(missing.absorbedBeforeCoupler,40);
 }finally{f.dispose();}
});

test('phase follows continuous actual finite flight distances, not a loaded flag or chosen mirror name',()=>{
 const f=fixture();try{
  let previous;
  for(const height of [5,4.875,4.75,4.5,4.25,4]){
   f.rig.tray.position.y=height;const q=f.rig.readout();assert.ok(q.bothArmsReach);near(q.traces[1].length,2*height+2);
   near(q.deltaLength,14-(2*height+2));near(q.outputPlus,40*(1+Math.cos(2*Math.PI*q.deltaLength/4)));
   if(previous!==undefined)assert.ok(q.outputPlus>previous);previous=q.outputPlus;
   assert.equal(q.originalContact,null);
  }
 }finally{f.dispose();}
});

test('finite aperture miss, wrong input direction, blocked path and incorrect input address are real negatives',()=>{
 const f=fixture();try{
  const arm=f.rig.arms[1],input=f.rig.faces.find(p=>p.id==='delay-input');input.center=[2.8,0,1];assert.equal(traceCastleCoherentArm(arm).reached,false);
  input.center=[2,0,1];input.normal=[0,-1,0];assert.equal(traceCastleCoherentArm(arm).reason,'back-of-input');input.normal=[0,1,0];
  assert.equal(traceCastleCoherentArm({...arm,inputId:'reference-input'}).reason,'wrong-input');
  f.rig.faces.push({id:'actual finite occluder',kind:'blocker',center:[0,2,1],normal:[0,1,0],halfWidth:.2,halfHeight:.2});assert.equal(traceCastleCoherentArm(arm).reason,'blocked');
 }finally{f.dispose();}
});

test('the unchanged original3.2kg box loads the real spring tray and geometrically exchanges80W outputs',()=>{
 const f=fixture({loaded:true});try{
  const body=f.cargo,shape=body.shapes[0],initial=f.rig.readout(),q=f.step();
  assert.equal(f.cargo,body);assert.equal(f.cargo.shapes[0],shape);assert.equal(body.mass,3.2);assert.ok(q.bothArmsReach);
  near(q.trayPosition[1],4,.004);near(initial.traces[1].length-q.traces[1].length,2,.008);assert.ok(q.outputPlus>79.99&&q.outputMinus<.01);
  assert.ok(q.originalContact&&q.originalContact.contacts>0);near(q.originalContact.normalForce,3.2*19.5,.25);assert.equal(q.originalContact.originalCargoBodyId,body.id);assert.equal(q.originalContact.originalCargoShapeId,shape.id);
  assert.equal(q.model,'stylized coherent field/resonator');assert.equal(q.wavelength,4);
 }finally{f.dispose();}
});

test('equal foreign mass has identical optical effect; original-contact, held and ownership flags never switch power',()=>{
 const original=fixture({loaded:true}),foreign=fixture();try{
  const reference=original.step();const other=new Body({mass:3.2,shape:new Box(C(.39,.39,.39)),position:C(4,5.55,1),linearDamping:0,angularDamping:0,allowSleep:false});foreign.world.addBody(other);
  const q=foreign.step();near(q.trayPosition[1],reference.trayPosition[1],1e-6);near(q.outputPlus,reference.outputPlus,1e-7);assert.equal(q.originalContact,null);
  original.state.held=true;const held=original.rig.readout();assert.equal(held.originalContact,null);near(held.outputPlus,reference.outputPlus);
  original.state.held=false;original.state.token={};const wrongToken=original.rig.readout();assert.equal(wrongToken.originalContact,null);near(wrongToken.outputPlus,reference.outputPlus);
  original.state.token=original.rig.originalCargoToken;original.state.carryTarget={};assert.equal(original.rig.readout().originalContact,null);
 }finally{original.dispose();foreign.dispose();}
});

test('half mass gives a quarter-wave mixed result, while hovering/off-tray proximity supplies no contact or delay',()=>{
 const half=fixture({loaded:true,mass:1.6}),off=fixture({loaded:true,cargoX:6.3});try{
  const h=half.step();near(h.trayPosition[1],4.5,.004);near(h.outputPlus,40,.3);near(h.outputMinus,40,.3);assert.equal(h.originalContact,null);
  assert.equal(off.rig.readout().originalContact,null);const q=off.step();near(q.trayPosition[1],5,1e-8);near(q.outputPlus,0);assert.equal(q.originalContact,null);
 }finally{half.dispose();off.dispose();}
});

test('passive spring/support energy decays; optical joules conserve through blocking and explicit reset work',()=>{
 const f=fixture({loaded:true});try{
  const initial=f.rig.mechanicalEnergy().joules,q=f.step();assert.ok(q.ledger.springDampingJ>10);assert.ok(q.mechanicalEnergy.joules<initial);
  assert.ok(q.mechanicalEnergy.joules+q.ledger.springDampingJ<initial+1,'Spring/contact integration must not manufacture usable energy');
  near(q.ledger.outputPlusJ+q.ledger.outputMinusJ,q.ledger.couplerInputJ,1e-7);near(q.ledger.sourceInputJ,q.ledger.outputPlusJ+q.ledger.outputMinusJ+q.ledger.absorbedJ,1e-7);
  f.rig.faces.find(p=>p.id==='delay-fold-a').enabled=false;const blocked=f.step(120);assert.ok(blocked.ledger.absorbedJ>0);
  const before=f.rig.mechanicalEnergy().joules,ledger={...blocked.ledger};const reset=f.rig.reset({restoreOriginalCargo:true});
  near(reset.mechanicalEnergy.joules-before,reset.ledger.resetWorkJ);assert.ok(reset.ledger.resetWorkJ>0);assert.equal(reset.ledger.resets,1);assert.equal(reset.originalContact,null);near(reset.ledger.sourceInputJ,ledger.sourceInputJ);near(reset.ledger.outputPlusJ,ledger.outputPlusJ);
  f.rig.faces.find(p=>p.id==='delay-fold-a').enabled=true;const repeated=f.step();near(repeated.outputPlus,q.outputPlus,1e-5);near(repeated.trayPosition[1],q.trayPosition[1],1e-5);assert.equal(f.cargo,f.rig.originalCargoBody);
 }finally{f.dispose();}
});

test('display phase follows geometric arc length through folds and cannot alter measured powers',()=>{
 const f=fixture();try{
  const q=f.rig.readout(),trace=q.traces[1],a=castleFieldPhaseSamples(trace,{wavelength:4,time:0}),b=castleFieldPhaseSamples(trace,{wavelength:4,time:1});
  assert.equal(a.length,13);for(let n=0;n<a.length;n++){near(a[n].distance,n);assert.deepEqual(a[n].position,b[n].position);near(a[n].phase-b[n].phase,Math.PI/2);}
  assert.deepEqual(f.rig.readout().inputs,q.inputs);near(f.rig.readout().outputPlus,q.outputPlus);
 }finally{f.dispose();}
});

test('step receipts reject duplicate energy/force updates and disposal removes only the two owned bodies',()=>{
 const f=fixture();const original=f.cargo,shape=original.shapes[0],count=f.world.bodies.length;
 assert.throws(()=>f.rig.afterStep());f.rig.beforeStep(DT);assert.throws(()=>f.rig.beforeStep(DT));assert.throws(()=>f.rig.reset());f.world.step(DT);f.rig.afterStep();assert.throws(()=>f.rig.afterStep());
 f.rig.dispose();f.rig.dispose();assert.equal(f.world.bodies.length,count-2);assert.ok(f.world.bodies.includes(original));assert.equal(original.shapes[0],shape);assert.throws(()=>f.rig.beforeStep(DT));assert.throws(()=>f.rig.readout());assert.throws(()=>f.rig.mechanicalEnergy());
});
