import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Vec3,Body,Box} from 'cannon-es';
import {createRoom35CapstanCell} from '../src/game/LabRoom35CapstanCell.js';
import {createRoom35CapstanGuide,traceRoom35Capstan} from '../src/game/LabRoom35CapstanGeometry.js';
import {makePortalFrame,resolvePortalPlacement,orientedBoxFitsPortal,uprightCapsuleFitsPortal} from '../src/game/LabPortals.js';

const vector=a=>new THREE.Vector3(...a);

// Read every real compound shape, including the rotated Cannon Cylinder and
// four entry-collar blocks. No hand-authored proxy may omit a keeper solid.
function shapeBoxes(body){
 return body.shapes.map((shape,i)=>{
  const position=body.position.vadd(body.quaternion.vmult(body.shapeOffsets[i]));
  const quaternion=body.quaternion.mult(body.shapeOrientations[i]);
  const min=new Vec3(),max=new Vec3();shape.calculateWorldAABB(position,quaternion,min,max);
  return {body,shape,box:new THREE.Box3(vector(min.toArray()),vector(max.toArray()))};
 });
}

// This is an isolated native-placement fixture, not an installed room35 panel.
// Use the actual moving-frame API because its returned bounds override metadata.
function pocketSurface(aperture){
 const center=vector(aperture.position),normal=vector(aperture.normal),up=new THREE.Vector3(0,0,1);
 const frame=makePortalFrame(center,normal,up,{width:.25,height:.25});
 return {uuid:'capstan-pocket',userData:{portalable:true,center,normal,portalUp:up,
  portalSize:{width:.25,height:.25},portalBounds:{halfWidth:10,halfHeight:10},
  portalFrame:()=>({center,normal,up,halfWidth:.295,halfHeight:.295})},frame};
}

function fullPrismSeparation(aperture,boxes){
 // Each disc is perpendicular to the portal normal. Its complete ellipse,
 // whatever its in-plane orientation, has exactly the same axial projection.
 // A strict separating plane against *enclosing* shape AABBs proves the whole
 // continuous prism is clear; this is not a centre-ray or sampled-rim check.
 const outward=vector(aperture.normal).negate();
 const nearest=vector(aperture.position).dot(outward)-.85;
 const furthest=Math.max(...boxes.map(({box})=>new THREE.Vector3(
  outward.x>=0?box.max.x:box.min.x,
  outward.y>=0?box.max.y:box.min.y,
  outward.z>=0?box.max.z:box.min.z).dot(outward)));
 return nearest-furthest;
}

test('35 capstan: the former long lead admits the rope but obstructs the complete native aperture',()=>{
 const cell=createRoom35CapstanCell();try{
  const legacy=createRoom35CapstanGuide({involuteLength:4}),aperture=legacy.portalAt(4.8);
  assert.ok(traceRoom35Capstan(legacy,aperture),'Keep the original rope-only success as the regression counterexample');
  const boxes=cell.world.bodies.flatMap(shapeBoxes),surface=pocketSurface(aperture);
  const placement=resolvePortalPlacement(surface,vector(aperture.position),{blockers:boxes});
  assert.equal(placement.ok,false);assert.equal(placement.reason,'obstructed');
 }finally{cell.dispose();}
});

test('35 capstan: both extended pockets clear every actual keeper solid over the full native depth prism',()=>{
 const cell=createRoom35CapstanCell();try{
  const keeper=cell.world.bodies.find(body=>body.id===cell.diagnostics().keeperBodyId);
  assert.ok(keeper&&keeper.shapes.length>200);
  const keeperBoxes=shapeBoxes(keeper),allBoxes=cell.world.bodies.flatMap(shapeBoxes);
  assert.equal(keeperBoxes.length,keeper.shapes.length);
  for(const theta of [.35,4.8]){
   const aperture=cell.guide.portalAt(theta),surface=pocketSurface(aperture);
   assert.ok(fullPrismSeparation(aperture,keeperBoxes)>.15,`Full prism must lie at least 15cm beyond all keeper AABBs for ${theta}rad`);
   for(const [x,y]of [[0,0],[.24,0],[-.24,0],[0,.24],[0,-.24]]){
    const hit=new THREE.Vector3(x,y,0).applyQuaternion(surface.frame.quaternion).add(vector(aperture.position));
    const placement=resolvePortalPlacement(surface,hit,{blockers:allBoxes});
    assert.equal(placement.ok,true,`${theta}rad hit(${x},${y}): ${placement.reason}`);
    assert.ok(placement.position.distanceTo(vector(aperture.position))<1e-12,'Actual narrow frame bounds clamp a local shot to its equal-length pocket');
    assert.equal(placement.frame.width,.25);assert.equal(placement.frame.height,.25);
   }
   const outside=new THREE.Vector3(.34,0,0).applyQuaternion(surface.frame.quaternion).add(vector(aperture.position));
   assert.equal(resolvePortalPlacement(surface,outside,{blockers:allBoxes}).reason,'outside','No remote hit relocation');
   // Freight and the avatar still need separately authored full-size panels.
   assert.equal(uprightCapsuleFitsPortal(surface.frame,2.4,.43),false);
   assert.equal(orientedBoxFitsPortal(surface.frame,surface.frame.position,new THREE.Quaternion(),.39),false);
   assert.equal(orientedBoxFitsPortal(surface.frame,surface.frame.position,new THREE.Quaternion(),.04),true);
  }
 }finally{cell.dispose();}
});

test('35 capstan: a real new obstacle still blocks a geometrically clear extended pocket',()=>{
 const cell=createRoom35CapstanCell();try{
  const aperture=cell.guide.portalAt(4.8),surface=pocketSurface(aperture);
  const center=vector(aperture.position).addScaledVector(vector(aperture.normal),.4);
  const obstruction=new Body({mass:0,position:new Vec3(...center.toArray()),shape:new Box(new Vec3(.1,.1,.1))});
  const placement=resolvePortalPlacement(surface,vector(aperture.position),{blockers:[...cell.world.bodies.flatMap(shapeBoxes),...shapeBoxes(obstruction)]});
  assert.equal(placement.ok,false);assert.equal(placement.reason,'obstructed');
 }finally{cell.dispose();}
});

test('35 capstan: equal lead extension preserves curvature and force ratio and recalibrates finite rope rest length',()=>{
 const legacy=createRoom35CapstanGuide({involuteLength:4}),guide=createRoom35CapstanGuide(),paths=[];
 for(const theta of [.32,.35,.38,4.77,4.8,4.83]){
  const previous=traceRoom35Capstan(legacy,legacy.portalAt(theta)),current=traceRoom35Capstan(guide,guide.portalAt(theta));
  assert.ok(previous&&current);paths.push(current);
  assert.ok(Math.abs(current.curvatureTurn-previous.curvatureTurn)<1e-12);
  assert.ok(Math.abs(Math.exp(.4*current.curvatureTurn)-Math.exp(.4*previous.curvatureTurn))<1e-12);
  assert.ok(Math.abs(current.length-previous.length-Math.hypot(guide.radius,guide.k)/guide.radius)<1e-12);
 }
 assert.ok(Math.max(...paths.map(p=>p.length))-Math.min(...paths.map(p=>p.length))<1e-12);
 const short=createRoom35CapstanCell({theta:.35}),long=createRoom35CapstanCell({theta:4.8});
 try{
  assert.ok(Math.abs(short.rest.left-long.rest.left)<1e-12);
  assert.equal(short.rest.right,long.rest.right);
  assert.equal(short.mechanical(),short.diagnostics().initialEnergy);
  assert.equal(long.mechanical(),long.diagnostics().initialEnergy);
  for(let i=0;i<50;i++)assert.equal(long.setPortal(long.guide.portalAt(i%2?.35:4.8)),true);
  assert.equal(long.ledger.manualWork,0);
  assert.equal(long.ledger.portalGeometryWork,0);
 }finally{short.dispose();long.dispose();}
});
