import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {clipPortalRibbon} from '../src/game/LabLightBridge.js';
import {pointInsidePortal,makePortalFrame} from '../src/game/LabPortals.js';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
const V=(...p)=>new THREE.Vector3(...p);
test('off-centre solid light is trimmed by the elliptical aperture, not rejected or extended beyond it',()=>{
 for(const x of [-1.1,-.5,0,.5,1.1])for(const y of [-1.2,-.63,0,.8]){
  const f=makePortalFrame(V(2,3,4),V(0,0,1),V(0,1,0),{width:2.8,height:2.1}),point=V(2+x,3+y,4),span=V(1,0,0);
  const interval=clipPortalRibbon(f,point,span,-2.6,2.6);assert.ok(interval);
  assert.ok(interval[1]-interval[0]>2.5);
  for(let n=0;n<=100;n++){const t=interval[0]+(interval[1]-interval[0])*n/100;assert.ok(pointInsidePortal(f,point.clone().addScaledVector(span,t),.0349));}
  if(interval[0]>-2.59)assert.equal(pointInsidePortal(f,point.clone().addScaledVector(span,interval[0]-.01),.035),false);
  if(interval[1]<2.59)assert.equal(pointInsidePortal(f,point.clone().addScaledVector(span,interval[1]+.01),.035),false);
 }
});
test('ribbon clipping is invariant under rotating the complete portal and sheet together',()=>{
 const base=makePortalFrame(V(),V(0,0,1),V(0,1,0),{width:2.8,height:2.1}),point=V(.8,-.63,0),span=V(1,0,0),expected=clipPortalRibbon(base,point,span,-2.6,2.6);
 for(let i=0;i<20;i++){
  const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(i*.12,i*.31,i*.19)),f={...base,quaternion:q};
  const got=clipPortalRibbon(f,point.clone().applyQuaternion(q),span.clone().applyQuaternion(q),-2.6,2.6);
  assert.ok(got.every((n,j)=>Math.abs(n-expected[j])<1e-9));
 }
});
test('new chamber remains traversable after a deliberately displaced source shot; sheet collision remains inside both apertures',async()=>{
 const g=await createHeadlessGame();g.chamberEdition='open';await g.selectLevel(30,false);
 const result=await runV8Journey(g,{scenario:d=>{
  const p=d.level.panels,source=p['light-source'].getFrame().center.clone().add(V(0,0,.85));
  d.aim(0,source);d.aim(1,p['west-bridge'].getFrame().center);d.wait(.4);
  const sheet=d.level.light.pieces[1];assert.ok(sheet.collider.enabled);
  assert.ok(sheet.collider.box.max.z-sheet.collider.box.min.z<5.2);
  const b=sheet.collider.box,output=g.portals.portals[1];
  for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z])assert.ok(pointInsidePortal(output,V(output.position.x,y,z),.034),'Visible sheet corners must fit the exit ellipse');
  d.walk(-19,8);d.walk(4,8);d.walk(4,4);d.walk(4,8);d.walk(-21,8);
  assert.ok(Math.abs(g.playerPosition.y-Math.max(6,sheet.floor.y))<.015,'Feet must rest on the visible sheet above the permanent deck');
 }});
 assert.equal(result.pass,true);assert.equal(result.resets,0);assert.equal(result.respawns,0);
 g.physics.dispose();g.portals.dispose();
});
