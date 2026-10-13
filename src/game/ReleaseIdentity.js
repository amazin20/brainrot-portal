/** Active delivery identity. Historical editions keep their own gameplay and saves. */
export const RELEASE_VERSION='v55-castle-finale';
export const DEFAULT_EDITION='foundation';
export const EDITION_VERSION='foundation-v4';
/** The ordinary root campaign, metadata and package gate share these flags.
 * Standalone reviews, archive and open editions keep their own configuration. */
export const ACTIVE_FOUNDATION_RUNTIME_FLAGS=Object.freeze({
 puzzleProgression:true,campaignSequencePresentation:true,room23PhysicalPrototype:true,
});
export const RELEASE_ORIGINS=Object.freeze({
 game:'3f2e83127dfd5800068854a98843d73eb9377609',
 previousPublication:'a74b64fe6d861baa94bbba7c6311794e6d520534',
});
