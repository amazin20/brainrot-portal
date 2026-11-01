import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {installBiosphereArchitecture} from '../src/game/LabBiosphereArchitecture.js';
import {mockCases,createDrawingMock,protectedDrawingSnapshot,ownershipSnapshot,sha} from './helpers/room30-floor-inlay-mock.js';

const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/room30-floor-inlay-original-baseline.json',import.meta.url)));
assert.equal(fixture.kind,'assetless-THREE-drawing-regression-original-baseline');
assert.equal(fixture.sourceCommit,'372089aae69ae49bae49c1ce4bb9c1dbd4c7f09e');
assert.equal(fixture.sourceSha256,'c05e440beaff9044fbadc50a021dcb5c70d78f8129247c41c4418f46c55dbe70');
assert.deepEqual(fixture.rows.map(r=>r.id),mockCases.map(r=>r.id));

for(const spec of mockCases)test(`Floor inlay: ${spec.id} retains original drawing geometry, matrices, bounds and untouched materials`,()=>{
 const mock=createDrawingMock(spec),before=ownershipSnapshot(mock);
 installBiosphereArchitecture(mock.game,mock.level);const a=mock.level.biosphereArchitecture,row=fixture.rows.find(r=>r.id===spec.id);
 assert.equal(sha(protectedDrawingSnapshot(mock)),row.protectedDrawingSha256,'Only the declared fallback floor bronze material/bank may differ from original source');
 assert.equal(a.stats.sourcePanels,row.sourcePanels);assert.equal(a.stats.parts,row.parts);assert.equal(a.stats.batches,row.batches);
 assert.equal(a.stats.newColliders,0);assert.equal(a.stats.newLights,0);
 const materials=[a.materials.metal,a.materials.floorInlay].filter(Boolean);
 assert.equal(a.root.children.filter(m=>materials.includes(m.material)).reduce((n,m)=>n+m.count,0),row.bronzeInstances);
 if(spec.fallback){
  assert.equal(row.bronzeInstances,912);assert.equal(a.stats.floorPanels,228);
  assert.equal(a.root.children.filter(m=>m.material===a.materials.floorInlay).length,1);
  assert.ok(a.root.children.filter(m=>m.material===a.materials.floorInlay).every(m=>m.name==='Conservatory / floorInlay:box'&&m.geometry===a.geometry.box));
 }else assert.equal(a.materials.floorInlay,undefined,'Room21–29 and room30 existing cassettes keep their original opaque bronze');
 assert.deepEqual(ownershipSnapshot(mock),before,'The assetless fixture physical/query/actor owners must not change');
 for(const mesh of a.root.children)assert.ok(!mock.game.colliders.includes(mesh)&&!mock.game.aimBlockers.includes(mesh)&&!mock.game.cameraBlockers.includes(mesh)&&!mock.game.portalPanels.includes(mesh));
 const original=a;installBiosphereArchitecture(mock.game,mock.level);assert.equal(mock.level.biosphereArchitecture,original);a.release();
});

test('Only the owned fallback floor bronze clone changes alpha/depth state and owns its shader/cache hook',()=>{
 for(const spec of mockCases.filter(s=>s.fallback)){
  const mock=createDrawingMock(spec);installBiosphereArchitecture(mock.game,mock.level);const a=mock.level.biosphereArchitecture,m=a.materials.floorInlay,original=a.materials.metal;
  assert.notEqual(m,original);assert.equal(m.transparent,true);assert.equal(m.blending,THREE.NormalBlending);assert.equal(m.depthTest,true);assert.equal(m.depthWrite,false);assert.equal(m.side,THREE.FrontSide);
  assert.equal(original.transparent,false);assert.equal(original.depthWrite,true);assert.equal(original.depthTest,true);
  const state=x=>{const j=x.toJSON();delete j.uuid;delete j.metadata;return j;};
  const normalized=state(m),baseline=state(original);normalized.name=baseline.name;delete normalized.transparent;delete normalized.depthWrite;
  assert.deepEqual(normalized,baseline,'Colour, roughness, metalness, clipping and all other serialized material properties stay inherited');
  assert.notEqual(m.onBeforeCompile,original.onBeforeCompile);assert.notEqual(m.customProgramCacheKey(),original.customProgramCacheKey());
  const shader={vertexShader:'#include <begin_vertex>\n#include <project_vertex>',fragmentShader:'#include <color_fragment>\n#include <opaque_fragment>'};m.onBeforeCompile(shader);
  assert.ok(shader.vertexShader.includes('vRoom30InlayBoxLocal=position;'));
  assert.ok(shader.fragmentShader.includes('fwidth(vRoom30InlayBoxLocal)'));
  assert.ok(shader.fragmentShader.includes('diffuseColor.a*=inlayCoverage;'));
  assert.equal(shader.vertexShader.match(/#include <project_vertex>/g)?.length,1);assert.equal(shader.fragmentShader.match(/#include <opaque_fragment>/g)?.length,1);
  // String inspection verifies the hook is wired; native linked shader and
  // real far/near pixel comparisons remain separate browser acceptance.
  a.release();
 }
});

test('Fallback releases every owned resource once and restores source visibility, hangar materials and lights',()=>{
 const mock=createDrawingMock(mockCases.find(s=>s.id==='room30-fallback-visible-tiles'));
 const before=ownershipSnapshot(mock),sources=mock.sources.map(n=>({node:n,visible:n.visible,material:n.material})),lights=mock.lights.map(n=>({node:n,intensity:n.intensity,color:n.color.clone(),ground:n.groundColor?.clone()}));
 installBiosphereArchitecture(mock.game,mock.level);const a=mock.level.biosphereArchitecture;
 const resources=new Set([...Object.values(a.geometry),...Object.values(a.materials),...mock.sources.filter(n=>n.name.startsWith('Solid hangar')||n.name==='Lower hangar service deck').map(n=>n.material)]),counts=new Map([...resources].map(r=>[r,0]));
 for(const r of resources)r.addEventListener('dispose',()=>counts.set(r,counts.get(r)+1));
 a.release();a.release();mock.level.dispose();
 assert.equal(a.disposed,true);assert.equal(a.root.parent,null);assert.equal(a.root.children.length,0);
 assert.ok([...counts.values()].every(n=>n===1),'Geometry, original owned materials, new bronze clone and hangar clones each release exactly once');
 for(const r of sources){assert.equal(r.node.visible,r.visible);assert.equal(r.node.material,r.material);}
 for(const r of lights){assert.equal(r.node.intensity,r.intensity);assert.ok(r.node.color.equals(r.color));if(r.ground)assert.ok(r.node.groundColor.equals(r.ground));}
 assert.deepEqual(ownershipSnapshot(mock),before);
});
