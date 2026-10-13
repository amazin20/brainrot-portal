/** Active delivery identity. Historical editions keep their own gameplay and saves. */
export const RELEASE_VERSION='v56-living-campaign';
export const DEFAULT_EDITION='foundation';
export const EDITION_VERSION='foundation-v5';
/** The ordinary root campaign, metadata and package gate share these flags.
 * Standalone reviews, archive and open editions keep their own configuration. */
export const ACTIVE_FOUNDATION_RUNTIME_FLAGS=Object.freeze({
 puzzleProgression:true,campaignSequencePresentation:true,room23PhysicalPrototype:true,
});
export const RELEASE_ORIGINS=Object.freeze({
 game:'ba5c86fd07facd9613f5e6e8efb9709bd2ef9e89',
 previousPublication:'ba3218f7855e7cbff8170ec1f692a0fd786794a6',
});
