import test from 'node:test';
import assert from 'node:assert/strict';
import {compileLabScene} from '../src/game/LabSceneCompilation.js';

test('stopped-loop compilation submits cached shader work before readiness polling',async()=>{
 const scene={actors:['player','original companion']},camera={position:[1,2,3]},target={lights:['lab']};
 const before=JSON.stringify({scene,camera,target});let compiled=false,submitted=false,links=0,polls=0;
 const renderer={
  compile(s,c,t){assert.equal(s,scene);assert.equal(c,camera);assert.equal(t,target);if(!compiled){compiled=true;links++;}return new Set();},
  getContext(){return {flush(){assert.equal(compiled,true);submitted=true;}};},
  async compileAsync(s,c,t){this.compile(s,c,t);polls++;assert.equal(submitted,true,'Readiness must not poll an unsubmitted shader queue');},
 };
 await compileLabScene(renderer,scene,camera,target);
 assert.equal(links,1,'The repeated traversal must reuse the linked program');assert.equal(polls,1);
 assert.equal(JSON.stringify({scene,camera,target}),before,'Compilation must not advance actors or move the camera');
});

test('scene compilation propagates driver failures without continuing loading',async()=>{
 const renderer={compile(){},getContext(){return {flush(){}};},async compileAsync(){throw Error('Driver readiness failed');}};
 await assert.rejects(compileLabScene(renderer,{},{}),/Driver readiness failed/);
});

test('headless controllers without GPU compilation remain usable',async()=>{
 await compileLabScene(null,{},{});await compileLabScene({}, {}, {});
 const scene={},camera={};let received;
 await compileLabScene({async compileAsync(...args){received=args;}},scene,camera);
 assert.deepEqual(received,[scene,camera,scene]);
});
