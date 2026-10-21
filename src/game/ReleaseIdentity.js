/** Active delivery identity. Historical editions keep their own gameplay and saves. */
export const RELEASE_VERSION='v66-visual-audit';
export const DEFAULT_EDITION='foundation';
export const EDITION_VERSION='foundation-v5';
/** The ordinary root campaign, metadata and package gate share these flags.
 * Standalone reviews, archive and open editions keep their own configuration. */
export const ACTIVE_FOUNDATION_RUNTIME_FLAGS=Object.freeze({
 puzzleProgression:true,campaignSequencePresentation:true,room23PhysicalPrototype:true,
});
export const RELEASE_ORIGINS=Object.freeze({
 game:'8eee93c02d4d6da18107ba9882c5656939257938',
 previousPublication:'cfad67aa7accfb84cdea2e6d4979d0d45b7d637e',
});
