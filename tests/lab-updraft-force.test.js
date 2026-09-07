import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';

const game=await createHeadlessGame();
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const step=(level,seconds)=>{for(let n=0;n<Math.round(seconds*120);n++)level.update(1/120);};
async function room(){await game.selectLevel(7,false);game.resetRun(true);return game.firstLevel;}
const sample=(level,radial=0,velocity=V())=>level.playerAcceleration(level.state.airOrigin.clone().add(V(1,-1.1,radial)),velocity).x;
after(()=>{game.physics.dispose();game.portals.dispose();});

test('updraft force builds with its rotor and remains during the visible coast',async()=>{
 const l=await room(),s=l.state;
 assert.equal(sample(l),0);
 s.enabled=true;l.update(1/120);const first=sample(l);
 step(l,1.5);const running=sample(l);
 assert.ok(running>60,'The established lift must retain enough sustained force');
 assert.ok(first>0&&first<running*.1,`Abrupt startup: first=${first}, running=${running}`);
 s.enabled=false;l.update(1/120);const coasting=sample(l);
 assert.ok(coasting>running*.8&&coasting<running,'A still-spinning fan must keep a diminishing flow');
 assert.ok(Math.abs(s.airflow.strength-s.fanSpeed/12)<1e-10,'Flow and rotor use different strengths');
 l.renderUpdate(1);assert.equal(s.airflow.mesh.visible,true);
 step(l,1);assert.ok(sample(l)>0&&sample(l)<coasting*.03);
 step(l,2);l.renderUpdate(1);
 assert.equal(sample(l),0);assert.equal(s.airflow.mesh.visible,false);assert.deepEqual(s.segments,[]);
});

test('updraft weakens near the visible plume edge and cannot push beyond it',async()=>{
 const l=await room();l.state.enabled=true;step(l,2);
 const radius=l.state.airflow.radius,center=sample(l),edge=sample(l,radius*.85),lip=sample(l,radius-.01);
 assert.ok(edge>0&&edge<center*.8,`Hard edge instead of falloff: center=${center}, edge=${edge}`);
 assert.ok(lip>=0&&lip<edge*.02);
 assert.equal(sample(l,radius+.01),0);
 assert.ok(sample(l,0,V(18,0,0))<0,'Wind must brake a body already faster than the stream');
});

test('a closed shutter blocks the updraft path throughout rotor coast',async()=>{
 const l=await room(),s=l.state;s.enabled=true;step(l,2);
 const box=new THREE.Box3(s.airOrigin.clone().add(V(2,-2,-2)),s.airOrigin.clone().add(V(2.2,2,2)));
 const shutter=game.collisionProxy(box);shutter.opticallyTransparent=true;l.update(1/120);
 const behind=s.airOrigin.clone().add(V(3,-1.1,0));
 assert.ok(sample(l)>0);assert.equal(l.playerAcceleration(behind,V()).lengthSq(),0);
 assert.ok(s.segments[0].b.x<=box.min.x+.001);
 s.enabled=false;l.update(1/120);
 assert.ok(sample(l)>0);assert.equal(l.playerAcceleration(behind,V()).lengthSq(),0);
 l.reset();assert.equal(sample(l),0);assert.equal(s.fanSpeed,0);
});

test('free companion receives the sampled wind force while a held companion does not',async()=>{
 const l=await room(),s=l.state;s.enabled=true;step(l,2);
 const b=game.physics.cargoBody;
 game.cargo.position.copy(s.airOrigin).add(V(1,0,0));game.cargo.velocity.set(0,0,0);
 b.force.setZero();l.applyCargoForces();assert.ok(Math.abs(b.force.x/b.mass-sample(l))<1e-8);
 game.heldCube=game.cargo;b.force.setZero();l.applyCargoForces();assert.equal(b.force.lengthSquared(),0);
 game.heldCube=null;l.reset();b.force.setZero();l.applyCargoForces();assert.equal(b.force.lengthSquared(),0);
});
