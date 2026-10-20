/** Active delivery identity. Historical editions keep their own gameplay and saves. */
export const RELEASE_VERSION='v63-player-access-optics';
export const DEFAULT_EDITION='foundation';
export const EDITION_VERSION='foundation-v5';
/** The ordinary root campaign, metadata and package gate share these flags.
 * Standalone reviews, archive and open editions keep their own configuration. */
export const ACTIVE_FOUNDATION_RUNTIME_FLAGS=Object.freeze({
 puzzleProgression:true,campaignSequencePresentation:true,room23PhysicalPrototype:true,
});
export const RELEASE_ORIGINS=Object.freeze({
 game:'8102e724cafff008faf57316fcd82f03ed6f4072',
 previousPublication:'c5814892d6a40ffc911e0ed62df022f82990cb4a',
});
