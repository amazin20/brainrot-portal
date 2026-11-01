import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gameplayContract} from './lab-art-contract.js';

// This is a narrowly reviewed migration of authored entry coordinates, not a
// new gameplay baseline. Historical fixture bytes remain unchanged. Each row
// requires the complete current runtime source and the exact named room before
// replacing only five initial-entry fields in a cloned contract.
const sourcePins=Object.freeze({
 'LabLateCampaignRoomsA.js':'727d6da39ec0e0c588586a4c8051b5c6a00ca46dfe8367c144c5e2a0aba369ea',
 'LabPostCampaignA.js':'858c0c84dfa2657e423d634d1a91f320a2c391f8d53bd5a8714e5d172d9351dd',
 'LabSiphonObservatory.js':'2aad6e704ab6871cc5c932a59a8fe5e54e46f9d72026e671b7df9ee41d11615f',
 'LabCreativeCounterweightRoom.js':'83a957c495820c05dd7037fb73833e3fc14a6c634f9a4a0a88bd4082a6416580',
 'LabCreativeFinalRooms.js':'754bfe66229f1f81b341572af703d4b652aca2a0b4a5044b2256fbeef5a3b574',
 'LabPostCampaignB.js':'53e33082005ea41b2ba77a2bbbb990f8ec6095493d8082697d75a5579c4e2c3e',
 'LabLateCampaignThermalRoom.js':'f9b723b9dec4d0f3e200fb7fe716dda6662cbef864ef3b53828074471b8a3e59',
});
const entry=(id,file,currentSpawn,currentCargo,currentView,oldSpawn,oldCargo,oldView)=>({id,file,currentSpawn,currentCargo,currentView,oldSpawn,oldCargo,oldView});
const entries=new Map([
 [30,entry('post-freight-rake','LabLateCampaignRoomsA.js',[-26.4,0,23],[-25,.6,21],{yaw:.2,pitch:-.1},[-23,0,23],[-25,.6,21],{yaw:.2,pitch:-.1})],
 [31,entry('post-thin-shadow','LabPostCampaignA.js',[-6,0,20],[-4.5,.6,21.2],{yaw:-1.2,pitch:-.1},[-6,0,20],[-9,.6,18],{yaw:0,pitch:-.05})],
 [32,entry('siphon-observatory','LabSiphonObservatory.js',[7.5,0,22],[11,.6,18],{yaw:.32,pitch:-.18},[9,0,15],[11,.6,18],{yaw:.32,pitch:.04})],
 [33,entry('post-pneumatic-reservoir','LabCreativeCounterweightRoom.js',[-4,0,20],[-2.5,.40,18.6],{yaw:.15,pitch:-.05},[-4,0,20],[-7,.6,18],{yaw:.15,pitch:-.05})],
 [35,entry('post-angular-cassette','LabCreativeFinalRooms.js',[-21.2,10,.7],[-23.3,10.6,-1.5],{yaw:0,pitch:-.2},[-21.2,10,.7],[-23.3,10.6,-1.5],{yaw:-1.18,pitch:-.65})],
 [36,entry('post-magnetic-u-channel','LabCreativeFinalRooms.js',[-8,0,18],[-11,.6,16],{yaw:.29,pitch:-.05},[-8,0,18],[-11,.6,16],{yaw:.14,pitch:-.05})],
 [37,entry('post-separated-freight','LabPostCampaignB.js',[9,0,17],[7,.6,14],{yaw:-.1,pitch:-.22},[9,0,17],[7,.6,14],{yaw:-.17,pitch:-.10})],
 [38,entry('post-thermal-memory','LabLateCampaignThermalRoom.js',[-5,0,22],[-9,.6,21],{yaw:.7,pitch:-.1},[-5,0,22],[-9,.6,21],{yaw:.2,pitch:-.06})],
 [39,entry('post-differential-optical-calibration','LabCreativeFinalRooms.js',[-13,0,10.8],[-11.4,.6,12.6],{yaw:-1,pitch:-.1},[-10,0,22],[-12,.6,20],{yaw:.1,pitch:-.06})],
]);

export function originalObservatoryEntryContract(contract){
 const row=entries.get(contract.room.index);
 if(!row)return contract;
 assert.equal(contract.room.id,row.id,'Only the exact reviewed named observatory room can migrate its entry');
 const runtime=fs.readFileSync(new URL('../../src/game/'+row.file,import.meta.url));
 assert.equal(createHash('sha256').update(runtime).digest('hex'),sourcePins[row.file],'The complete reviewed room source must remain exact');
 assert.deepEqual(contract.room.spawn,row.currentSpawn,'Exact reviewed authored hero spawn');
 assert.deepEqual(contract.room.cargoSpawn,row.currentCargo,'Exact reviewed authored original-cargo spawn');
 assert.deepEqual(contract.room.spawnView,row.currentView,'Exact reviewed authored initial view');
 assert.deepEqual(contract.player,row.currentSpawn,'Only the unchanged initial hero position can migrate');
 assert.deepEqual(contract.cargo,row.currentCargo,'Only the unchanged initial original cargo position can migrate');
 const historical=structuredClone(contract);
 historical.room.spawn=structuredClone(row.oldSpawn);
 historical.room.cargoSpawn=structuredClone(row.oldCargo);
 historical.room.spawnView=structuredClone(row.oldView);
 historical.player=structuredClone(row.oldSpawn);
 historical.cargo=structuredClone(row.oldCargo);
 return historical;
}

export function observatoryEntryContract(game){
 assert.equal(game.firstLevel.index,game.levelIndex,'The selected room and current game index must match');
 return originalObservatoryEntryContract(gameplayContract(game));
}
