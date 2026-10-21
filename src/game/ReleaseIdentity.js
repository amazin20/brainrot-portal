/** Active delivery identity. Historical editions keep their own gameplay and saves. */
export const RELEASE_VERSION='v65-checker-readiness';
export const DEFAULT_EDITION='foundation';
export const EDITION_VERSION='foundation-v5';
/** The ordinary root campaign, metadata and package gate share these flags.
 * Standalone reviews, archive and open editions keep their own configuration. */
export const ACTIVE_FOUNDATION_RUNTIME_FLAGS=Object.freeze({
 puzzleProgression:true,campaignSequencePresentation:true,room23PhysicalPrototype:true,
});
export const RELEASE_ORIGINS=Object.freeze({
 game:'307aefaa960cc8f6b0ce9b3d7267e1eeaceccb81',
 previousPublication:'cfad67aa7accfb84cdea2e6d4979d0d45b7d637e',
});
