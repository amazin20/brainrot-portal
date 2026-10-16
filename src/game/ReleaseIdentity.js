/** Active delivery identity. Historical editions keep their own gameplay and saves. */
export const RELEASE_VERSION='v59-castle-impulse';
export const DEFAULT_EDITION='foundation';
export const EDITION_VERSION='foundation-v5';
/** The ordinary root campaign, metadata and package gate share these flags.
 * Standalone reviews, archive and open editions keep their own configuration. */
export const ACTIVE_FOUNDATION_RUNTIME_FLAGS=Object.freeze({
 puzzleProgression:true,campaignSequencePresentation:true,room23PhysicalPrototype:true,
});
export const RELEASE_ORIGINS=Object.freeze({
 game:'f73063b77461be70d7039e2c767fa6df4467ff3b',
 previousPublication:'5ed4b7b5ca735a03c26f7e065297d7da9650e208',
});
