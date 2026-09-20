import {buildVelocityArena} from './LabVelocityArena.js';
import {ROOM21_SPEC,buildRoom21} from './LabPortalRoom21.js';
import {ROOM22_SPEC,buildRoom22} from './LabPortalRoom22.js';
import {ROOM23_SPEC,buildRoom23} from './LabPortalRoom23.js';
import {ROOM24_SPEC,buildRoom24} from './LabPortalRoom24.js';
import {ROOM25_SPEC,buildRoom25} from './LabPortalRoom25.js';
import {ROOM26_SPEC,buildRoom26} from './LabPortalRoom26.js';
import {buildReadableWindRoom} from './LabWindRoom.js';
import {WORKSHOP_CAMPAIGN,buildWorkshopCampaign} from './LabWorkshopCampaign.js';
import {addExplorationSurfaces} from './LabExplorationSurfaces.js';
import {CAMPAIGN as INTRODUCTORY_CAMPAIGN,buildLabCampaignLevel as buildIntroductoryLevel} from './LabIntroductoryCampaign.js';
import {EXTENDED_CAMPAIGN,buildExtendedCampaign} from './LabExtendedCampaign.js';
import {ROOM12_SPEC,buildRoom12} from './LabPortalRoom12.js';
import {ROOM13_SPEC,buildRoom13} from './LabPortalRoom13.js';
import {ROOM14_SPEC,buildRoom14} from './LabPortalRoom14.js';
import {ROOM15_SPEC,buildRoom15} from './LabPortalRoom15.js';
import {ROOM16_SPEC,buildRoom16} from './LabPortalRoom16.js';
import {ROOM17_SPEC,buildRoom17} from './LabPortalRoom17.js';
import {ROOM18_SPEC,buildRoom18} from './LabPortalRoom18.js';
import {ROOM19_SPEC,buildRoom19} from './LabPortalRoom19.js';
import {ROOM20_SPEC,buildRoom20} from './LabPortalRoom20.js';
import {finishAdvancedRoom} from './LabAdvancedArchitecture.js';
import {upgradeBrowser3DArt} from './LabBrowser3DArt.js';
import {applyPremiumBrowser3DArt} from './LabBrowser3DPremium.js';
import {applyMechanismReflections} from './LabMechanismReflections.js';
import {batchStaticSurfaceFinishes} from './LabStaticSurfaceBatches.js';

const withArtAssets=(spec,...extra)=>({...spec,assets:[...new Set([...spec.assets,...extra])]});
const ROOM13_ART_SPEC=withArtAssets(ROOM13_SPEC,19,29);
const ROOM14_ART_SPEC=ROOM14_SPEC;
const ROOM15_ART_SPEC=ROOM15_SPEC;
export const finishBrowserArt=level=>{
 level.game??=level.world.game;
 if(level.index<11)level.spec??={...CAMPAIGN[level.index],accent:level.world.palette.accent};
 return batchStaticSurfaceFinishes(applyMechanismReflections(applyPremiumBrowser3DArt(upgradeBrowser3DArt(level))));
};
const NEW_CAMPAIGN=[ROOM16_SPEC,ROOM17_SPEC,ROOM18_SPEC,ROOM19_SPEC,ROOM20_SPEC,ROOM21_SPEC,ROOM22_SPEC,ROOM23_SPEC,ROOM24_SPEC,ROOM25_SPEC,ROOM26_SPEC];
const NEW_BUILDERS=[buildRoom16,buildRoom17,buildRoom18,buildRoom19,buildRoom20,buildRoom21,buildRoom22,buildRoom23,buildRoom24,buildRoom25,buildRoom26];

// Preserve the verified introductory rooms; extend the public registry once.
export const CAMPAIGN=Object.freeze([...INTRODUCTORY_CAMPAIGN,...EXTENDED_CAMPAIGN.slice(0,3),...WORKSHOP_CAMPAIGN.slice(0,3).map((room,i)=>i===2?{...room,assets:room.assets.filter(id=>id!==39),accent:0x83cfc7,description:'Направь воздух от вентилятора к приводу двери.',hints:['Круглый вентилятор слева создаёт поток. Привод с решёткой дальше по залу принимает воздух передней стороной.','Воздух толкает тебя и друга. Попав в переднюю решётку приёмника, поток сам запускает дверь; кабель показывает связь.','Соедини правую стену напротив вентилятора с другим участком правой стены напротив привода. Включи вентилятор: когда поток попадёт в приёмник, дверь откроется автоматически. Забери друга и пройди в открывшуюся дверь.']}:room),ROOM12_SPEC,ROOM13_ART_SPEC,ROOM14_ART_SPEC,ROOM15_ART_SPEC,...NEW_CAMPAIGN]);
export function buildLabCampaignLevel(game,index){
 if(!Number.isInteger(index)||index<0||index>=CAMPAIGN.length)throw new RangeError('Unknown campaign course');
 if(game.epicMode&&index===0)return buildVelocityArena(game);
 if(index===10)return finishBrowserArt(buildReadableWindRoom(game,CAMPAIGN[index]));
 if(index===11)return finishBrowserArt(buildRoom12(game,index));
 if(index===12)return finishBrowserArt(finishAdvancedRoom(buildRoom13(game,index)));
 if(index===13)return finishBrowserArt(finishAdvancedRoom(buildRoom14(game,index)));
 if(index===14)return finishBrowserArt(finishAdvancedRoom(buildRoom15(game,index)));
 if(index>=15)return finishBrowserArt(finishAdvancedRoom(NEW_BUILDERS[index-15](game,index)));
 if(index>=8)return finishBrowserArt(buildWorkshopCampaign(game,index));
 const level=index<INTRODUCTORY_CAMPAIGN.length?buildIntroductoryLevel(game,index):buildExtendedCampaign(game,index);
 return finishBrowserArt(addExplorationSurfaces(game,level,index));
}
