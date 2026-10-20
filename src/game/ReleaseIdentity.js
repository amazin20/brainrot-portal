/** Active delivery identity. Historical editions keep their own gameplay and saves. */
export const RELEASE_VERSION='v62-biosphere';
export const DEFAULT_EDITION='foundation';
export const EDITION_VERSION='foundation-v5';
/** The ordinary root campaign, metadata and package gate share these flags.
 * Standalone reviews, archive and open editions keep their own configuration. */
export const ACTIVE_FOUNDATION_RUNTIME_FLAGS=Object.freeze({
 puzzleProgression:true,campaignSequencePresentation:true,room23PhysicalPrototype:true,
});
export const RELEASE_ORIGINS=Object.freeze({
 game:'d91c208c72f3eede1fc731dc637f12055c4a4769',
 previousPublication:'08a11c3d7e91b06588d3877fb8d674e111d01476',
});
