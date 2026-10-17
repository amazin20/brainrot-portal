import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {gameplayContract,digest} from './helpers/lab-art-contract.js';
import {originalRoom15Contract,ROOM15_ORIGINAL_CONTRACT_DIGEST,ROOM15_SILL_NAME} from './helpers/lab-room15-observation-sill-contract.js';

let game,contract;
before(async()=>{game=await createHeadlessGame();await game.selectLevel(14,false);contract=gameplayContract(game);});
after(()=>{game?.physics.dispose();game?.portals.dispose();});

test('the one grounded room15 sill normalizes to the unchanged legacy whole-room golden',()=>{
 const before=structuredClone(contract),normalized=originalRoom15Contract(contract);
 assert.deepEqual(contract,before,'The normalizer must not change its actual captured input');
 assert.equal(digest(normalized),ROOM15_ORIGINAL_CONTRACT_DIGEST);
 assert.equal(ROOM15_ORIGINAL_CONTRACT_DIGEST,'8204ffc1bed02cf8aa2e27e44c03e3e5d086d47d1b0d8905f135a0e80767ea68');
 const physical=game.colliders[24],mesh=physical.mesh;
 // The existing premium finish rounds every large architectural box; this
 // solid keeps that geometry type, its visible bounds and shared registries.
 assert.equal(mesh.name,ROOM15_SILL_NAME);assert.equal(mesh.isMesh,true);assert.equal(mesh.geometry.type,'RoundedBoxGeometry');
 assert.equal(mesh.geometry.parameters.width,9);assert.equal(mesh.geometry.parameters.height,2);assert.equal(mesh.geometry.parameters.depth,1.7);
 assert.equal(mesh.geometry.parameters.segments,2);assert.equal(mesh.geometry.parameters.radius,.065);
 assert.equal(game.cameraBlockers[52],mesh);assert.equal(game.aimBlockers[52],mesh);
 assert.equal(game.colliders.filter(c=>c.mesh===mesh).length,1);assert.equal(game.portalPanels.includes(mesh),false);
 assert.ok(new THREE.Box3().setFromObject(mesh).equals(physical.box),'The visible solid and physical bounds must match exactly');
 assert.equal(physical.box.min.y,0);assert.equal(physical.box.max.y,2);
 assert.ok(Math.abs(physical.box.min.z-(-6.95))<3e-8,'The original nominal rear face stays fixed within float32 representation');
 const changed=[];
 const compare=(a,b,path='')=>{if(JSON.stringify(a)===JSON.stringify(b))return;if(a&&b&&typeof a==='object'&&typeof b==='object'){for(const key of new Set([...Object.keys(a),...Object.keys(b)]))compare(a[key],b[key],path?(path+'.'+key):key);}else changed.push(path);};
 compare(normalized,contract);
 assert.deepEqual(changed,['colliders.24.mesh.name','colliders.24.mesh.matrix.14','colliders.24.box.min.2','colliders.24.box.max.2','camera.52.name','camera.52.matrix.14','aim.52.name','aim.52.matrix.14']);
});

for(const[name,mutate]of[
 ['sill collision bound',c=>{c.colliders[24].box.max[2]+=.001;}],
 ['sill top',c=>{c.colliders[24].box.max[1]+=.001;}],
 ['sill rear face',c=>{c.colliders[24].box.min[2]+=.001;}],
 ['sill enable state',c=>{c.colliders[24].enabled=false;}],
 ['sill collider type',c=>{c.colliders[24].kinematic=true;}],
 ['sill visibility',c=>{c.colliders[24].mesh.visible=false;}],
 ['sill transform',c=>{c.colliders[24].mesh.matrix[12]+=.001;}],
 ['sill orientation',c=>{c.colliders[24].mesh.matrix[0]=.999;}],
 ['hidden raycast geometry',c=>{c.colliders[24].mesh.raycastChildren.push({name:'unapproved',visible:true});}],
 ['extra sill collider',c=>{c.colliders.push(structuredClone(c.colliders[24]));}],
 ['missing sill collider',c=>{c.colliders.splice(24,1);}],
 ['reordered collider',c=>{[c.colliders[23],c.colliders[24]]=[c.colliders[24],c.colliders[23]];}],
 ['second named sill',c=>{c.colliders[23].mesh.name=ROOM15_SILL_NAME;}],
 ['unrelated collider',c=>{c.colliders[23].box.min[0]+=.001;}],
 ['camera blocker transform',c=>{c.camera[52].matrix[14]+=.001;}],
 ['aim blocker transform',c=>{c.aim[52].matrix[14]+=.001;}],
 ['missing aim blocker',c=>{c.aim.splice(52,1);}],
 ['extra portal registration',c=>{c.portalRegistry.push(structuredClone(c.camera[52]));}],
 ['portal address',c=>{c.panels.freight.center[1]+=.001;}],
 ['floor support',c=>{c.floors[0].y+=.001;}],
 ['original player spawn',c=>{c.room.spawn[0]+=.001;}],
 ['original cargo spawn',c=>{c.room.cargoSpawn[0]+=.001;}],
 ['cargo throat height',c=>{c.room.puzzle.cargoThroatHeight=1.56;}],
 ['interaction position',c=>{c.terminals[0].position[0]+=.001;}],
 ['initial actuator state',c=>{c.state.funnel.reversed=true;}],
 ['different room identity',c=>{c.room.id='other';}],
 ['nonfinite geometry',c=>{c.colliders[24].box.max[2]=Infinity;}],
 ['nonfinite original state',c=>{c.cargo[0]=NaN;}],
 ['undefined hidden field',c=>{c.colliders[24].unapproved=undefined;}],
 ['array hidden field',c=>{c.floors.unapproved=1;}],
])test('sill exemption rejects '+name,()=>{const altered=structuredClone(contract);mutate(altered);assert.throws(()=>originalRoom15Contract(altered),assert.AssertionError);});
