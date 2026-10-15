/** Active delivery identity. Historical editions keep their own gameplay and saves. */
export const RELEASE_VERSION='v57-physical-power';
export const DEFAULT_EDITION='foundation';
export const EDITION_VERSION='foundation-v5';
/** The ordinary root campaign, metadata and package gate share these flags.
 * Standalone reviews, archive and open editions keep their own configuration. */
export const ACTIVE_FOUNDATION_RUNTIME_FLAGS=Object.freeze({
 puzzleProgression:true,campaignSequencePresentation:true,room23PhysicalPrototype:true,
});
export const RELEASE_ORIGINS=Object.freeze({
 game:'a3c81ee59a9b2cbf1b23254857dd8c2a6f6b3c38',
 previousPublication:'8184c23bfac7d97261e90e4dae4477a651e8bfaf',
});
