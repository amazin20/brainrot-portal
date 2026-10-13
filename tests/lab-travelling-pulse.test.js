import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {TravellingPulseField} from '../src/game/LabTravellingPulse.js';
const V=(...p)=>new THREE.Vector3(...p);
function fixture(){const game={colliders:[],portals:{ready:false}};const field=new TravellingPulseField(game,{speed:10});field.receivers=[{name:'membrane',position:V(0,0,-10),normal:V(0,0,1),radius:.76}];field.emit(V(0,0,0),V(0,0,-1));return {game,field};}
test('a pressure packet reaches the real receiver only after traversing its distance',()=>{const {field}=fixture();field.step(.99);assert.equal(field.arrivals.length,0);field.step(.02);assert.equal(field.arrivals.length,1);assert.ok(Math.abs(field.arrivals[0].time-1)<.009);});
test('a continuous sweep cannot tunnel through a thin absorbing wall',()=>{const {field,game}=fixture();game.colliders.push({box:new THREE.Box3(V(-1,-1,-5.001),V(1,1,-5)),enabled:true});field.step(1.5);assert.equal(field.arrivals.length,0);assert.equal(field.packets.length,0);assert.equal(field.absorbed.length,1);});
test('large and fine visual time steps consume equivalent propagation time',()=>{const a=fixture().field,b=fixture().field;a.step(1.2);for(let i=0;i<144;i++)b.step(1/120);assert.equal(a.arrivals.length,1);assert.equal(b.arrivals.length,1);assert.ok(Math.abs(a.arrivals[0].time-b.arrivals[0].time)<1e-8);});
test('packet lifetime and count are bounded; reset removes in-flight state',()=>{const {field}=fixture();for(let i=0;i<40;i++)field.emit(V(1,0,0),V(0,1,0));assert.equal(field.packets.length,field.maxPackets);field.step(13);assert.equal(field.packets.length,0);field.reset();assert.equal(field.emitted,0);assert.equal(field.arrivals.length,0);assert.throws(()=>field.step(Infinity),RangeError);});
