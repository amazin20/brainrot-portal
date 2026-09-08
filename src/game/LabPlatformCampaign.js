import {ROOM12_SPEC,buildRoom12,runRoom12} from './LabPlatformRoom12.js';
import {ROOM13_SPEC,buildRoom13,runRoom13} from './LabPlatformRoom13.js';
import {ROOM14_SPEC,buildRoom14,runRoom14} from './LabPlatformRoom14.js';
import {ROOM15_SPEC,buildRoom15,runRoom15} from './LabPlatformRoom15.js';
import {ROOM16_SPEC,buildRoom16,runRoom16} from './LabPlatformRoom16.js';

export const PLATFORM_CAMPAIGN=Object.freeze([ROOM12_SPEC,ROOM13_SPEC,ROOM14_SPEC,ROOM15_SPEC,ROOM16_SPEC]);
const builders=[buildRoom12,buildRoom13,buildRoom14,buildRoom15,buildRoom16];
const journeys=[runRoom12,runRoom13,runRoom14,runRoom15,runRoom16];
export function buildPlatformCampaign(game,index){return builders[index-11](game,index);}
export function runPlatformJourney(driver){return journeys[driver.game.levelIndex-11](driver);}
