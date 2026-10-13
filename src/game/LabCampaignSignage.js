import {foundationDisplayNumber} from './LabCampaignSequence.js';

/** Only a room-title prefix changes. Instrument readings, stage numbers and
 * old-edition signs retain their authored text. Save/query IDs never change. */
export function campaignSignText(text,{index,game}={}){
 if(!game?.campaignSequencePresentation||game.chamberEdition!=='foundation'
  ||typeof text!=='string'||!Number.isInteger(index)||index<0||index>50)return text;
 const prefix=text.match(/^(\d{1,2})(\s*(?:\/|·|—|–)\s*)/);
 if(!prefix||Number(prefix[1])!==index+1)return text;
 return String(foundationDisplayNumber(index))+text.slice(prefix[1].length);
}
