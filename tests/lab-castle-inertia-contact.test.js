// Collision regression for the recorded diagonal corner jump. Real input-only
// reproduction and canonical journey evidence are in qa-speedrun-castle-new.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
const V=(...p)=>new THREE.Vector3(...p);
let fixture;
async function castle(){fixture??=(async()=>{const g=await createHeadlessGame();g.chamberEdition='foundation';await g.selectLevel(40,true);return g;})();return fixture;}
function segmentHits(a,b,box){const delta=b.clone().sub(a),distance=delta.length(),hit=new THREE.Ray(a,delta.normalize()).intersectBox(box,new THREE.Vector3());return !!hit&&hit.distanceTo(a)<=distance+1e-6;}

test('Receiver wall blocks the reproduced west-end diagonal sprint jump',async()=>{
 const g=await castle(),r=g.firstLevel.rooms.get('inertia'),point=V(...r.P(0,6,.5));
 const wall=g.colliders.find(c=>c.enabled!==false&&c.box.containsPoint(point)&&c.box.max.y-c.box.min.y>7.9);
 assert.ok(wall,'The receiver needs a real wall along its exposed south boundary');
 const jump=V(-44.1024957595,54,-27.7376131182),landing=V(-38.7357517106,50.5,-33.1043571252);
 const capsuleBox=wall.box.clone();capsuleBox.min.x-=.43;capsuleBox.max.x+=.43;capsuleBox.min.z-=.43;capsuleBox.max.z+=.43;capsuleBox.min.y-=1.9;
 assert.ok(segmentHits(jump,landing,capsuleBox),'The formerly successful recorded approach must hit the new visible wall');
 // The jump arc is entirely below this tall wall's top, including its apex.
 assert.ok(wall.box.max.y>jump.y+3,'A single cargo step and ordinary jump cannot clear the guard');
});

test('Receiver enclosure keeps the canonical western approach and fling line open',async()=>{
 const g=await castle(),r=g.firstLevel.rooms.get('inertia'),point=V(...r.P(0,6,.5));
 const wall=g.colliders.find(c=>c.enabled!==false&&c.box.containsPoint(point)&&c.box.max.y-c.box.min.y>7.9),expanded=wall.box.clone().expandByScalar(.43);
 assert.ok(!segmentHits(V(...r.P(-22,12)),V(...r.P(-22,-4)),expanded),'The ordinary west approach still needs access to the intake and falling platform');
 assert.ok(!wall.box.containsPoint(V(-58.6836358928,59.7627756478,-28.725)),'The actual canonical portal shot must clear the added guard');
 assert.ok(!segmentHits(V(...r.P(-17,0,9.4)),V(...r.P(21,0,-3.5)),expanded),'The real portal fling must still pass to the lower receiver');
});
