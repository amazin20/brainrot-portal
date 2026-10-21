/** Active delivery identity. Historical editions keep their own gameplay and saves. */
export const RELEASE_VERSION='v67-visual-completion';
export const DEFAULT_EDITION='foundation';
export const EDITION_VERSION='foundation-v5';
/** The ordinary root campaign, metadata and package gate share these flags.
 * Standalone reviews, archive and open editions keep their own configuration. */
export const ACTIVE_FOUNDATION_RUNTIME_FLAGS=Object.freeze({
 puzzleProgression:true,campaignSequencePresentation:true,room23PhysicalPrototype:true,
});
export const RELEASE_ORIGINS=Object.freeze({
 game:'fa37048d48a279203a6eae7e945f5f5880a2b499',
 previousPublication:'a2e9302c593a484918733c225392a34ad7051ecf',
});
