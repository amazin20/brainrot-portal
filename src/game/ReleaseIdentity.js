/** Active delivery identity. Historical editions keep their own gameplay and saves. */
export const RELEASE_VERSION='v61-second-chapter';
export const DEFAULT_EDITION='foundation';
export const EDITION_VERSION='foundation-v5';
/** The ordinary root campaign, metadata and package gate share these flags.
 * Standalone reviews, archive and open editions keep their own configuration. */
export const ACTIVE_FOUNDATION_RUNTIME_FLAGS=Object.freeze({
 puzzleProgression:true,campaignSequencePresentation:true,room23PhysicalPrototype:true,
});
export const RELEASE_ORIGINS=Object.freeze({
 game:'63527aacae5eb311bd64194b029e9bc1e021c474',
 previousPublication:'62f2a8c5d83a23f5c1f1581a2619b35dd9d8b156',
});
