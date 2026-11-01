import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoom35CapstanGuide,traceRoom35Capstan,projectRoom35Capstan,dampRoom35CapstanTensions,ropeVector as V} from '../src/game/LabRoom35CapstanGeometry.js';
import {createRoom35CapstanCell} from '../src/game/LabRoom35CapstanCell.js';

test('35 prototype: current tangencies, helical keeper and involute apertures determine turn and conserve path length',()=>{
 const g=createRoom35CapstanGuide(),lengths=[];
 for(const angle of [.32,.35,.38,4.77,4.8,4.83]){
  const aperture=g.portalAt(angle);aperture.name='the name is not a mechanism input';
  const p=traceRoom35Capstan(g,aperture);assert.ok(p);assert.ok(Math.abs(p.theta-angle)<1e-12);lengths.push(p.length);
  for(const tangent of [p.entryTangent,p.exitTangent])assert.ok(Math.abs(Math.hypot(tangent[0]-g.center[0],tangent[1]-g.center[1])-g.radius)<1e-12);
  assert.ok(p.keeperClearance>=.01);assert.ok(p.throatClearance>=.2099);
  assert.ok(p.crossing.distance>2*g.ropeRadius+.005);
 }
 assert.ok(Math.max(...lengths)-Math.min(...lengths)<1e-12);
 const long=traceRoom35Capstan(g,g.portalAt(4.8));assert.ok(long.crossing.distance>.2106);
 assert.ok(Math.abs(long.curvatureTurn-4.794254808386394)<1e-12);
 const backwards=g.portalAt(4.8);backwards.normal=V.scale(backwards.normal,-1);assert.equal(traceRoom35Capstan(g,backwards),null);
 assert.equal(traceRoom35Capstan({...g,entryCollar:{...g.entryCollar,clearRadius:.01}},g.portalAt(4.8)),null);
 assert.equal(traceRoom35Capstan(g,g.portalAt(2)),null,'A tangent aimed through solid keeper hood is physically blocked');
});

test('35 prototype: every unilateral static slip projection dissipates elastic energy, including slack and both reversals',()=>{
 for(let i=0;i<10000;i++){
  const a=Math.sin(i*1.7)*2,b=Math.cos(i*.91)*2,s=Math.sin(i*.21),stiffness=3000,curvatureTurn=(i%81)/16;
  const r=projectRoom35Capstan({leftLength:5+a,rightLength:5+b,leftRest:5,rightRest:5,slip:s,stiffness,curvatureTurn});
  const before=.5*stiffness*(Math.max(0,a-s)**2+Math.max(0,b+s)**2);
  assert.ok(r.elasticEnergy<=before+1e-8);assert.ok(r.frictionHeat>=0);
  assert.ok(Math.abs(before-r.elasticEnergy-r.frictionHeat)<1e-8);
  assert.ok(r.leftTension<=r.ratio*r.rightTension+1e-7&&r.rightTension<=r.ratio*r.leftTension+1e-7);
 }
 const left=projectRoom35Capstan({leftLength:6,rightLength:5,leftRest:5,rightRest:5,curvatureTurn:3});
 const right=projectRoom35Capstan({leftLength:5,rightLength:6,leftRest:5,rightRest:5,curvatureTurn:3});
 assert.ok(left.materialTravel>0&&right.materialTravel<0);
 const slack=projectRoom35Capstan({leftLength:4,rightLength:4,leftRest:5,rightRest:5,slip:0,curvatureTurn:5});
 assert.equal(slack.leftTension+slack.rightTension+slack.elasticEnergy+slack.frictionHeat,0);
});

test('35 prototype: projected axial viscosity never leaves the static force cone or supplies positive endpoint work',()=>{
 for(let i=0;i<10000;i++){
  const E=Math.exp((i%90)/30),right=1+i%300,left=right*Math.exp(Math.sin(i)*Math.log(E)),vL=Math.sin(i*.73)*15,vR=Math.cos(i*.49)*15;
  const r=dampRoom35CapstanTensions({leftTension:left,rightTension:right,ratio:E},vL,vR,2*Math.sqrt(3000*3.2));
  assert.ok(r.leftTension>=0&&r.rightTension>=0);
  assert.ok(r.leftTension<=E*r.rightTension+1e-7&&r.rightTension<=E*r.leftTension+1e-7);
  assert.ok((r.leftTension-left)*vL+(r.rightTension-right)*vR>=-1e-7);
 }
 assert.deepEqual(dampRoom35CapstanTensions({leftTension:0,rightTension:0,ratio:7},100,100),{leftTension:0,rightTension:0,dissipationRate:0});
});

const DT=1/960;
function wind(cell){cell.step(3/DT);assert.ok(cell.angle()<-.7);assert.equal(cell.ledger.manualWork,0);cell.control.pressed=true;cell.step(14/DT);assert.ok(cell.angle()>-.001);assert.ok(cell.ledger.manualWork>1000);}
function identity(cell,body,shape){assert.equal(cell.cargo,body);assert.equal(cell.cargo.shapes[0],shape);assert.equal(body.mass,3.2);assert.deepEqual(shape.halfExtents.toArray(),[.39,.39,.39]);}

for(const theta of [.35,4.8])test(`35 prototype: ${theta}rad physical cell has bounded actual-control work and zero positive raw residual at explicit1/960 clock`,()=>{
 const c=createRoom35CapstanCell({theta,dt:DT}),body=c.cargo,shape=c.originalShape;
 try{
  wind(c);const before=c.diagnostics(),work=c.ledger.manualWork;
  c.control.position=[20,6,22];c.step(8/DT);const d=c.diagnostics();
  assert.equal(c.ledger.manualWork,work);assert.equal(d.lastManual.force,0);assert.equal(d.lastManual.active,false);
  assert.ok(d.ledger.maxManualPower<=240+1e-6&&d.ledger.minManualPower>=-240-1e-6);assert.ok(d.ledger.maxManualForce<=405);
  assert.equal(d.motorEquationPresent,false);assert.equal(d.ledger.maxConeViolation,0);assert.equal(d.ledger.maxSlipEnergyGain,0);
  assert.ok(d.keeperShapeCount>200&&d.keeperInWorld,'The fixed cylinder, collar, groove lips and hood must exist as actual physical shapes');
  assert.ok(d.ledger.maxResidual<=1e-6,'This checks the stated1/960 prototype clock only; coarse-clock residuals are separately reported');
  assert.ok(d.ledger.maxTotalStretch<.15);assert.ok(before.theta!==null&&d.theta!==null);
  if(theta<1)assert.ok(d.angle<-.7);else assert.ok(d.angle>-.02&&d.angle<.001);
  identity(c,body,shape);
 }finally{c.dispose();}
});

test('35 prototype: equal-length readdressing redistributes tension dissipatively and has no portal-work source',()=>{
 const c=createRoom35CapstanCell({dt:DT});try{
  wind(c);c.control.position=[20,6,22];c.step(2/DT);const work=c.ledger.manualWork;
  for(let i=0;i<20;i++){
   assert.equal(c.setPortal(c.guide.portalAt(i%2?.35:4.8)),true);c.step(.05/DT);
  }
  const d=c.diagnostics();assert.equal(c.ledger.manualWork,work);assert.ok(Math.abs(d.ledger.portalGeometryWork)<1e-7);
  assert.ok(d.ledger.maxPortalGeometryWork<1e-7);assert.equal(d.ledger.maxSlipEnergyGain,0);assert.equal(d.ledger.maxConeViolation,0);
  assert.ok(d.ledger.maxResidual<1e-6);assert.ok(d.ledger.capstanHeat>0);
 }finally{c.dispose();}
});

test('35 prototype: actual rope disconnection permits gravity return and original-body catch without a retained angle',()=>{
 const c=createRoom35CapstanCell({dt:DT}),body=c.cargo,shape=c.originalShape;try{
  wind(c);c.control.position=[20,6,22];c.step(2/DT);assert.ok(c.angle()>-.02);
  assert.equal(c.setPortal(null),false);const work=c.ledger.manualWork;c.step(8/DT);const d=c.diagnostics();
  assert.ok(c.angle()<-.7);assert.ok(c.cargo.position.y< -9.5);assert.equal(d.theta,null);assert.equal(d.tensions.leftTension+d.tensions.rightTension,0);
  assert.equal(d.ledger.manualWork,work);assert.ok(d.ledger.disconnectHeat>0);assert.equal(c.setPortal(c.guide.portalAt(4.8)),false,'A finite disconnected rope cannot magically reach a distant cargo body');
  identity(c,body,shape);
 }finally{c.dispose();}
});
