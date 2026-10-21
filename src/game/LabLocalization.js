/** Read the platform language at boot without claiming translations we do not ship.
 * The current catalogue must declare Russian only; room content is Russian. */
export const SUPPORTED_GAME_LANGUAGES = Object.freeze(['ru']);
// These platform language codes have a Russian fallback even if the game's
// supported language catalogue grows later.
export const PLATFORM_LANGUAGE_FALLBACKS = Object.freeze({be:'ru',kk:'ru',uk:'ru',uz:'ru'});
export const PLATFORM_TEXT = Object.freeze({
  ru: Object.freeze({
    loading: 'Подключаем Яндекс Игры',
    sdkUnavailable: 'Не удалось подключить Яндекс Игры. Повтори загрузку.',
    retry: 'Повторить загрузку',
  }),
});

function languageCode(value) {
  return typeof value === 'string' ? value.trim().toLowerCase().split(/[-_]/)[0] : '';
}

export function resolveGameLanguage(value) {
  const language=languageCode(value);
  return Object.hasOwn(PLATFORM_LANGUAGE_FALLBACKS,language)?PLATFORM_LANGUAGE_FALLBACKS[language]:(SUPPORTED_GAME_LANGUAGES.includes(language)?language:'ru');
}

export function resolvePlatformLanguage(sdk) {
  // Reading environment.i18n.lang is required even for a single-language game.
  const portalLanguage = languageCode(sdk?.environment?.i18n?.lang) || null;
  const activeLanguage = resolveGameLanguage(portalLanguage);
  return {
    portalLanguage,
    activeLanguage,
    fallbackUsed: portalLanguage !== null && activeLanguage !== portalLanguage,
    text: PLATFORM_TEXT[activeLanguage],
  };
}
