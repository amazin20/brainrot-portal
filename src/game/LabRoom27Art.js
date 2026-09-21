import * as THREE from 'three';
import {SolidAssembly,createCanopy,createDrive,placeSolidModel} from './LabSolidModels.js';

/** Closed barrel vaults, mounted gearmotors and load-bearing bridgework.
 * Compound collision leaves the belt, view and portal apertures empty. */
export function dressRoom27(k){
 const root=new THREE.Group();root.name='Conveyor city carnival architecture';root.userData.keepMaterial=true;k.world.root.add(root);
 for(const z of [-5.5,9.5])placeSolidModel(k,createCanopy(),[-13,2.4,z],{parent:root});
 const steel=new SolidAssembly('Conveyor city structural columns','carnival');
 for(const [x,z,y] of [[7.1,8.5,8],[16.8,8.5,8],[22.6,13.5,8],[22.6,-20.5,8],[10.3,-17.5,8],[-24.4,-5.4,8],[-24.4,5.4,8],[-9.6,-5.4,8],[-9.6,5.4,8],[6.4,-21.5,16],[9.6,-13,16]]){
  steel.box([x,(y-.22)/2,z],[.34,y-.22,.34],1,.06);
  steel.box([x,.11,z],[.65,.22,.65],1,.045);
  steel.beam([x,y-2.6,z],[x+.8,y-.30,z],.08,1);
  steel.box([x,y-.31,z],[.62,.25,.60],2,.035);
 }
 for(const z of [-5.5,5.5])steel.box([-24.5,11,z],[.3,6,.3],1,.05);
 steel.box([-24.5,14,0],[.65,1.15,12.2],0,.13);
 placeSolidModel(k,steel.finish(),[0,0,0],{parent:root});
 for(const p of [[-16.45,.8,-14.1],[-16.45,.8,14.1],[18.7,8.8,-18.3],[18.7,8.8,8.3]])placeSolidModel(k,createDrive(),p,{parent:root});
 return {root,staticDrawCalls:root.children.reduce((n,m)=>n+m.children.length,0),hasAnimatedArt:false};
}
