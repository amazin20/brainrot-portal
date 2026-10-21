/** Active delivery identity. Historical editions keep their own gameplay and saves. */
export const RELEASE_VERSION='v64-mobile-controls';
export const DEFAULT_EDITION='foundation';
export const EDITION_VERSION='foundation-v5';
/** The ordinary root campaign, metadata and package gate share these flags.
 * Standalone reviews, archive and open editions keep their own configuration. */
export const ACTIVE_FOUNDATION_RUNTIME_FLAGS=Object.freeze({
 puzzleProgression:true,campaignSequencePresentation:true,room23PhysicalPrototype:true,
});
export const RELEASE_ORIGINS=Object.freeze({
 game:'a60a31dfd4c624d6d60f4c33111d315b3bc44aa6',
 previousPublication:'21f54a9f6ef63a7e18e4a2002565ec1616879eb9',
});
