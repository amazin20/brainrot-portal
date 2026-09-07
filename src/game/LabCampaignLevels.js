import {buildReadableWindRoom} from './LabWindRoom.js';
import {WORKSHOP_CAMPAIGN,buildWorkshopCampaign} from './LabWorkshopCampaign.js';
import {addExplorationSurfaces} from './LabExplorationSurfaces.js';
import {CAMPAIGN as INTRODUCTORY_CAMPAIGN,buildLabCampaignLevel as buildIntroductoryLevel} from './LabIntroductoryCampaign.js';
import {EXTENDED_CAMPAIGN,buildExtendedCampaign} from './LabExtendedCampaign.js';

// Preserve the verified introductory rooms; extend the public registry once.
export const CAMPAIGN=Object.freeze([...INTRODUCTORY_CAMPAIGN,...EXTENDED_CAMPAIGN.slice(0,3),...WORKSHOP_CAMPAIGN.map((room,i)=>i===2?{...room,assets:room.assets.filter(id=>id!==39),accent:0x83cfc7,description:'Направь воздух от вентилятора к приводу двери.',hints:['Круглый вентилятор слева создаёт поток. Привод с решёткой дальше по залу принимает воздух передней стороной.','Воздух толкает тебя и друга. Попав в переднюю решётку приёмника, поток сам запускает дверь; кабель показывает связь.','Соедини правую стену напротив вентилятора с другим участком правой стены напротив привода. Включи вентилятор: когда поток попадёт в приёмник, дверь откроется автоматически. Забери друга и пройди в открывшуюся дверь.']}:room)]);
export function buildLabCampaignLevel(game,index){
 if(!Number.isInteger(index)||index<0||index>=CAMPAIGN.length)throw new RangeError('Unknown campaign course');
 if(index===10)return buildReadableWindRoom(game,CAMPAIGN[index]);
 if(index>=8)return buildWorkshopCampaign(game,index);
 const level=index<INTRODUCTORY_CAMPAIGN.length?buildIntroductoryLevel(game,index):buildExtendedCampaign(game,index);
 return addExplorationSurfaces(game,level,index);
}
