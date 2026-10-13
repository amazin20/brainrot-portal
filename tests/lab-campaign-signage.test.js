import test from 'node:test';
import assert from 'node:assert/strict';
import {campaignSignText} from '../src/game/LabCampaignSignage.js';
const game={chamberEdition:'foundation',campaignSequencePresentation:true};

test('Campaign signs follow the final castle order without changing readings',()=>{
 assert.equal(campaignSignText('43 / ЗЕРКАЛЬНЫЙ КОМПАС',{index:42,game}),'42 / ЗЕРКАЛЬНЫЙ КОМПАС');
 assert.equal(campaignSignText('51 / ЭХО',{index:50,game}),'50 / ЭХО');
 assert.equal(campaignSignText('41 · СКЛАДЧАТЫЙ ЗАМОК',{index:40,game}),'51 · СКЛАДЧАТЫЙ ЗАМОК');
 for(const text of ['2 / 3','175 Дж / ПОРОГ','41 / датчик в комнате 43'])
  assert.equal(campaignSignText(text,{index:42,game}),text);
});

test('Archive, previews and unnumbered descriptions retain their text',()=>{
 for(const oldGame of [{chamberEdition:'archive',campaignSequencePresentation:true},{chamberEdition:'foundation'}])
  assert.equal(campaignSignText('43 / КОМНАТА',{index:42,game:oldGame}),'43 / КОМНАТА');
 assert.equal(campaignSignText('СТОПОР / ВХОД',{index:40,game}),'СТОПОР / ВХОД');
});
