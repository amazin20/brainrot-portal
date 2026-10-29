import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
function assertCrossingFinish(g){
 const l=g.firstLevel,carrier=l.bridge,deck=carrier.mesh,m=l.workshop.m.floor;
 assert.ok(deck?.isMesh&&deck.parent===carrier.group,'The actual moving walking mesh must remain owned by its carrier');
 assert.equal(deck.material,m,'The material registry must describe the visible floor');
 assert.equal(l.world.materials.floor,m,'The world and workshop must share the actual walking finish');
 assert.ok([...l.opticsArchitecture.clones.values()].includes(m));
 assert.equal(m.map,null,'The filtered observatory finish replaces, rather than doubles, the old texture grid');
 const shader={uniforms:{},vertexShader:'#include <project_vertex>',fragmentShader:'#include <color_fragment>'};
 m.onBeforeCompile(shader,{});
 assert.match(shader.vertexShader,/vOpticsWorld\s*=\s*\(modelMatrix\s*\*\s*op\)\.xyz/,'The rendered floor must use the transformed world position');
 assert.match(shader.fragmentShader,/vec2\s+tile\s*=\s*vOpticsWorld\.xz\//,'The walking pattern must be mapped in both world floor axes');
 assert.match(shader.fragmentShader,/fwidth\(joint\)/,'Distant floor joints must retain derivative filtering');
 const uv=deck.geometry.getAttribute('uv'),normal=deck.geometry.getAttribute('normal'),p=deck.geometry.getAttribute('position');
 assert.ok(uv&&normal&&p,'The original deck UV contract must remain available');
 deck.updateWorldMatrix(true,false);let checked=0;
 for(let i=0;i<p.count;i++)if(normal.getY(i)>.999){
  const point=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(deck.matrixWorld);
  assert.ok(Math.abs(uv.getX(i)-point.x/6)<1e-5);
  assert.ok(Math.abs(uv.getY(i)-point.z/6)<1e-5);checked++;
 }
 assert.ok(checked>6);assert.ok(carrier.floor.enabled);
 const physical=g.colliders.find(c=>c.mesh===carrier.floor.mesh);
 assert.ok(physical&&physical.enabled!==false,'The actual moving floor must retain its physical envelope');
 const bounds=new THREE.Box3().setFromObject(deck);
 assert.ok(bounds.min.distanceTo(physical.box.min)<1e-5&&bounds.max.distanceTo(physical.box.max)<1e-5);
 assert.ok(g.colliders.some(c=>c.box.max.y>5.9&&c.box.max.x>-13));
}

test('31: the mechanically driven crossing retains a world-mapped floor and its actual physical envelope',async()=>{
 const g=await createHeadlessGame();
 try{
  g.chamberEdition='foundation';await g.selectLevel(30,false);assertCrossingFinish(g);
  const deck=g.firstLevel.bridge.mesh,m=deck.material,compile=m.onBeforeCompile,uv=deck.geometry.getAttribute('uv');
  m.onBeforeCompile=()=>{};assert.throws(()=>assertCrossingFinish(g),/transformed world position/);m.onBeforeCompile=compile;
  const firstTop=Array.from({length:uv.count},(_,i)=>i).find(i=>deck.geometry.getAttribute('normal').getY(i)>.999),u=uv.getX(firstTop);
  uv.setX(firstTop,u+.25);assert.throws(()=>assertCrossingFinish(g));uv.setX(firstTop,u);
  const floor=g.firstLevel.bridge.floor;floor.enabled=false;assert.throws(()=>assertCrossingFinish(g));floor.enabled=true;
  assertCrossingFinish(g);
  const original=[...g.firstLevel.opticsArchitecture.clones].find(([,copy])=>copy===m)[0];
  g.firstLevel.opticsArchitecture.release();assert.equal(g.firstLevel.workshop.m.floor,original);assert.equal(g.firstLevel.world.materials.floor,original);assert.equal(deck.material,original);
 }finally{g.physics.dispose();g.portals.dispose();}
});
