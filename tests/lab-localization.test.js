import test from 'node:test';
import assert from 'node:assert/strict';
import {resolvePlatformLanguage, SUPPORTED_GAME_LANGUAGES} from '../src/game/LabLocalization.js';

test('startup reads the SDK language even though the catalogue has only Russian', () => {
  let reads=0;
  const sdk={environment:{i18n:{get lang(){reads++;return 'ru';}}}};
  const locale=resolvePlatformLanguage(sdk);
  assert.equal(reads,1);
  assert.equal(locale.portalLanguage,'ru');
  assert.equal(locale.activeLanguage,'ru');
  assert.equal(locale.fallbackUsed,false);
  assert.deepEqual(SUPPORTED_GAME_LANGUAGES,['ru']);
});

test('unsupported SDK languages preserve their detection without claiming an English translation', () => {
  for(const lang of ['en','de','be','kk','uk','uz']){
    const locale=resolvePlatformLanguage({environment:{i18n:{lang}}});
    assert.equal(locale.portalLanguage,lang);
    assert.equal(locale.activeLanguage,'ru');
    assert.equal(locale.fallbackUsed,true);
    assert.equal(locale.text.retry,'Повторить загрузку');
  }
});

test('browser demo and missing SDK locale use actual Russian content', () => {
  for(const sdk of [null,{}, {environment:{i18n:{lang:''}}}]){
    const locale=resolvePlatformLanguage(sdk);
    assert.equal(locale.portalLanguage,null);
    assert.equal(locale.activeLanguage,'ru');
    assert.equal(locale.fallbackUsed,false);
  }
  assert.equal(resolvePlatformLanguage({environment:{i18n:{lang:' RU-ru '}}}).portalLanguage,'ru');
});
