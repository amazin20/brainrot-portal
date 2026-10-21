import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {finishVisualAudit} from '../src/game/LabVisualAuditFinish.js';
import {finishBridgeSheetNormals} from '../src/game/LabWorkshopModels.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {finishArchitecturalMaterials} from '../src/game/LabArchitecturalFinishV67.js';

test('finished floor keeps the mechanism material registry and restores it before world cleanup',()=>{
 const root=new THREE.Group(),source=new THREE.MeshStandardMaterial(),map=new THREE.Texture();source.map=map;source.userData.architecturalRole='floor';
 const deck=new THREE.Mesh(new THREE.BoxGeometry(6,.2,6),source);root.add(deck);
 const world={root,materials:{floor:source}},workshop={world,m:{floor:source}},level={world,workshop};
 const finish=finishArchitecturalMaterials({assets:new Map()},level,[root]),drawing=deck.material;
 assert.notEqual(drawing,source);assert.equal(drawing.map,map);
 assert.equal(workshop.m.floor,drawing);assert.equal(world.materials.floor,drawing);
 let released=0;drawing.addEventListener('dispose',()=>released++);
 finish.dispose();finish.dispose();assert.equal(released,1);
 assert.equal(deck.material,source);assert.equal(workshop.m.floor,source);assert.equal(world.materials.floor,source);
 deck.geometry.dispose();source.dispose();map.dispose();
});

test('recessed partitions keep the exact physical and portal contracts while replacing one visible skin',()=>{
 const scene=new THREE.Scene(),root=new THREE.Group();scene.add(root);
 const material=new THREE.MeshStandardMaterial({color:0x98b4ac});material.userData.architecturalRole='wall';
 const partition=new THREE.Mesh(new THREE.BoxGeometry(.65,24,9),material);partition.position.set(0,12,7);root.add(partition);
 const ceramic=new THREE.Mesh(new THREE.BoxGeometry(6,5,.3),material);root.add(ceramic);
 const box=new THREE.Box3().setFromObject(partition),portalGeometry=ceramic.geometry;
 const colliders=[{mesh:partition,box:box.clone()}],floors=[],portalPanels=[ceramic],game={scene,chamberEdition:'foundation',assets:new Map(),colliders,floors,portalPanels};
 const level={structure:root,world:{root},update(){return 1;},renderUpdate(){return 2;}};
 const update=level.update,renderUpdate=level.renderUpdate;
 finishVisualAudit(game,level,21,[root]);
 const after=new THREE.Box3().setFromObject(partition);
 assert.ok(after.min.distanceTo(box.min)<1e-6&&after.max.distanceTo(box.max)<1e-6);
 assert.equal(game.colliders,colliders);assert.ok(colliders[0].box.equals(box));assert.equal(game.floors,floors);assert.equal(game.portalPanels,portalPanels);
 assert.equal(ceramic.geometry,portalGeometry);assert.equal(level.update,update);assert.equal(level.renderUpdate,renderUpdate);
 assert.equal(level.visualAuditFinish.diagnostics.partitions,1);assert.ok(partition.geometry.attributes.color);
 const geometry=partition.geometry;finishVisualAudit(game,level,21,[root]);assert.equal(partition.geometry,geometry);
});

test('static display bodies retain live display meshes and release their owned instance resources once',()=>{
 const scene=new THREE.Scene(),root=new THREE.Group();scene.add(root);
 const screen=new THREE.Mesh(new THREE.PlaneGeometry(10,1.5),new THREE.MeshBasicMaterial());screen.name='Process instrument';screen.position.set(2,8,-12);root.add(screen);
 screen.updateMatrix();const matrix=screen.matrix.clone(),geometry=screen.geometry,material=screen.material;
 let previousDisposals=0;const level={structure:root,world:{root},dispose(){previousDisposals++;}},game={scene,chamberEdition:'foundation',assets:new Map()};
 finishVisualAudit(game,level,16,[root]);
 assert.equal(screen.geometry,geometry);assert.equal(screen.material,material);assert.ok(screen.matrix.equals(matrix));
 const bank=level.visualAuditFinish.root.children[0],owned=[bank.geometry,bank.material];let events=0;for(const resource of owned)resource.addEventListener('dispose',()=>events++);
 assert.equal(level.visualAuditFinish.diagnostics.instruments,1);assert.equal(bank.count,6);assert.equal(level.visualAuditFinish.diagnostics.extraColliders,0);
 level.dispose();level.dispose();assert.equal(events,2);assert.equal(previousDisposals,1);assert.equal(level.visualAuditFinish.root.parent,null);
});

test('visible premium rounded partitions receive relief while hidden measured owners and portal masters are protected',()=>{
 const scene=new THREE.Scene(),root=new THREE.Group();scene.add(root);
 const material=new THREE.MeshStandardMaterial({name:'Structural laboratory wall'});material.userData.architecturalRole='wall';
 const visible=new THREE.Mesh(new RoundedBoxGeometry(18,12,.65,2,.06),material);root.add(visible);
 const hiddenMaterial=material.clone();hiddenMaterial.visible=false;
 const hidden=new THREE.Mesh(new RoundedBoxGeometry(18,12,.65,2,.06),hiddenMaterial);hidden.position.x=30;root.add(hidden);
 const portal=new THREE.Mesh(new RoundedBoxGeometry(18,12,.65,2,.06),material);portal.position.x=-30;root.add(portal);
 const hiddenParent=new THREE.Group();hiddenParent.visible=false;root.add(hiddenParent);
 const hiddenChild=new THREE.Mesh(new RoundedBoxGeometry(18,12,.65,2,.06),material);hiddenParent.add(hiddenChild);
 const originals=[hidden.geometry,portal.geometry,hiddenChild.geometry],bounds=new THREE.Box3().setFromObject(visible);
 const game={scene,chamberEdition:'foundation',portalPanels:[portal],assets:new Map()},level={world:{root}};
 finishVisualAudit(game,level,31,[root]);
 assert.equal(level.visualAuditFinish.diagnostics.partitions,1);assert.ok(visible.geometry.attributes.color);
 const finished=new THREE.Box3().setFromObject(visible);
 assert.ok(bounds.min.distanceTo(finished.min)<1e-5&&bounds.max.distanceTo(finished.max)<1e-5);
 assert.deepEqual([hidden.geometry,portal.geometry,hiddenChild.geometry],originals);
});

test('bridge hard-sheet shading changes no vertex, colour or triangle used for physical height samples',()=>{
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([-1,2,-1,-1,2,1,1,2,1],3));
 geometry.setAttribute('normal',new THREE.Float32BufferAttribute([.7,.7,0,0,.8,.6,-.6,.8,0],3));
 geometry.setAttribute('color',new THREE.Float32BufferAttribute([1,.8,.7,.8,.7,.6,1,.9,.8],3));
 const positions=Array.from(geometry.attributes.position.array),colours=Array.from(geometry.attributes.color.array);
 assert.equal(finishBridgeSheetNormals(geometry),1);
 assert.deepEqual(Array.from(geometry.attributes.position.array),positions);assert.deepEqual(Array.from(geometry.attributes.color.array),colours);
 for(let i=0;i<3;i++)assert.deepEqual([geometry.attributes.normal.getX(i),geometry.attributes.normal.getY(i),geometry.attributes.normal.getZ(i)],[0,1,0]);
});
