import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../lab-headless.mjs';
import {runV8Journey} from '../../src/game/LabV8Journey.js';
import {installRoom21Aim} from '../../src/game/LabRoom21Journey.js';
import {aimLateSurface} from '../../src/game/LabLateCampaignAim.js';

/** These attacks use production projectiles from reachable walking positions.
 * A sealed partition must reject the charge even when an explicit source
 * aperture is already active. No actor/portal poses or puzzle flags are set. */
export async function runSealedPartitionCases(){
 const game=await createHeadlessGame();game.chamberEdition='foundation';const results=[];
 try{
  for(const room of [32,33,35]){
   await game.selectLevel(room-1,false);let evidence;
   try{
    const report=await runV8Journey(game,{scenario:d=>{
     installRoom21Aim(d);const level=d.level;
     const sealed=room===33?[{name:level.bulkhead.name,mesh:level.bulkhead,portal:false}]:level.world.surfaces.filter(s=>s.name==='Sealed partition'||s.name==='Spring charge observation slot surround');
     assert.ok(sealed.length>0);assert.ok(sealed.every(s=>!s.portal&&!s.mesh.userData.portalable),'every authored structural partition stays nonportal');
     assert.ok(Object.values(level.panels).every(s=>s.mesh.userData.portalable),'explicit manufactured apertures remain portalable');
     let source,approach,plane;
     if(room===32){d.walk(7,16);source=level.panels['shadow-dispatch'];aimLateSurface(d,0,source);approach=[-8,-4];plane=-7.87;}
     else if(room===33){d.walk(4,19);source=level.loading;aimLateSurface(d,0,source);approach=[8,-4];plane=-7.6;}
     else{d.walk(0,21);source=level.panels['air-origin'];aimLateSurface(d,0,source);approach=[-8,13];plane=9.13;}
     d.walk(approach[0],approach[1]);const target=new THREE.Vector3(approach[0],3,plane),rejected=[];
     d.look(target);
     for(let attempt=0;attempt<3;attempt++){
      assert.equal(game.firePortal(1),true,'the attack must request a real charge');
      d.until(()=>!game.portalShots.queue.length&&!game.portalShots.active.length,3,'Attack charge unresolved');
      const impact={...game.portalShots.lastImpact};assert.equal(impact.valid,false,'an authored closed partition cannot become a destination portal');assert.equal(impact.reason,'surface');assert.match(impact.surface,/Sealed partition/);
      assert.equal(game.portals.portals[0]?.surfaceId,source.mesh.uuid,'rejected destination preserves its existing manufactured source');assert.equal(game.portals.portals[1],null);
      rejected.push(impact);d.wait(.22);
     }
     let nearest=Infinity;game.input.keys.add('ShiftLeft');
     for(let frame=0;frame<240;frame++){
      game.input.jumpQueued=frame%16===0;d.worldMove(0,-1);d.frame();nearest=Math.min(nearest,game.playerPosition.z);
      assert.equal(game.teleportCount,0);assert.notEqual(game.state,'won');assert.ok(game.playerPosition.z>plane+.38,'sprint/jump spam cannot cross the rejected destination wall');
     }
     d.stop();evidence={sealedSurfaces:sealed.length,source:source.name,rejected,nearest,teleports:game.teleportCount};
     d.mark('Three actual sealed-wall charges reject; fast capsule attempts retain the physical partition');
    }});
    results.push({room,pass:report.pass,evidence,report});
   }catch(error){results.push({room,pass:false,error:String(error),player:game.playerPosition.toArray(),impact:game.portalShots.lastImpact});}
  }
 }finally{game.firstLevel?.dispose?.();game.physics?.dispose();game.portals?.dispose();}
 return {scope:'Reachable ordinary-input shots and sprint/jump attacks against authored closed partitions in foundation 32/33/35. Explicit aperture UUIDs are checked; no actor/portal assignments or completion flags.',pass:results.every(r=>r.pass),results};
}
