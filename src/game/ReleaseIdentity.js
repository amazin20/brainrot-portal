/** Active delivery identity. Historical editions keep their own gameplay and saves. */
export const RELEASE_VERSION='v58-mechanism-readability';
export const DEFAULT_EDITION='foundation';
export const EDITION_VERSION='foundation-v5';
/** The ordinary root campaign, metadata and package gate share these flags.
 * Standalone reviews, archive and open editions keep their own configuration. */
export const ACTIVE_FOUNDATION_RUNTIME_FLAGS=Object.freeze({
 puzzleProgression:true,campaignSequencePresentation:true,room23PhysicalPrototype:true,
});
export const RELEASE_ORIGINS=Object.freeze({
 game:'ac46f51fdaee4c4d966994988ca24081f9f49493',
 previousPublication:'88fb7f4376e7505a1af29b6da1c61258fde6aff7',
});
