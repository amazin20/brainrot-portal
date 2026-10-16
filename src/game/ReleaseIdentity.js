/** Active delivery identity. Historical editions keep their own gameplay and saves. */
export const RELEASE_VERSION='v60-first-chapter';
export const DEFAULT_EDITION='foundation';
export const EDITION_VERSION='foundation-v5';
/** The ordinary root campaign, metadata and package gate share these flags.
 * Standalone reviews, archive and open editions keep their own configuration. */
export const ACTIVE_FOUNDATION_RUNTIME_FLAGS=Object.freeze({
 puzzleProgression:true,campaignSequencePresentation:true,room23PhysicalPrototype:true,
});
export const RELEASE_ORIGINS=Object.freeze({
 game:'c79dbe271588c639d9881f9591efc330f947ea0f',
 previousPublication:'29e252b92e848197c1051725e9838a4084f0aaf7',
});
