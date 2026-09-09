import NightingaleColoredSequence from "@nightingale-elements/nightingale-colored-sequence";

export const COLORED_SEQUENCE_TAG = "nightingale-colored-sequence";

// The dynamic-import target that pulls Nightingale into the bundle, and nothing
// else. It lives in its own module so that `import()` in loadNightingale.ts has
// a single, stable chunk to name -- Nightingale brings lit and most of d3 with
// it, which no page without a protein strip should have to download.
//
// Only the colored-sequence element is needed. nightingale-sequence is its base
// class and comes along transitively; we never instantiate it directly, because
// at the width of a table cell a sequence of letters renders as an empty band
// (Nightingale draws residue characters only once each base is wide enough to
// fit one).
//
// The explicit define() below is load-bearing, and not for the reason it looks
// like. Nightingale registers its own elements as a side effect of module
// evaluation, so `import "@nightingale-elements/nightingale-colored-sequence"`
// ought to be all this file needs -- except every Nightingale package declares
// `"sideEffects": false`, which is simply untrue of a module whose entire
// purpose is that registration. Webpack believes the declaration, so in a
// production build a bare side-effect import is tree-shaken away and the
// element never registers. The failure is silent and production-only (dev
// builds don't tree-shake): createElement returns an element that never
// upgrades, and the cell renders blank.
//
// Importing the class as a *value* and using it here is what keeps the module
// in the bundle. Guarding on customElements.get() keeps this correct whether
// the package self-registers or not.
if (!customElements.get(COLORED_SEQUENCE_TAG)) {
  customElements.define(
    COLORED_SEQUENCE_TAG,
    (NightingaleColoredSequence as unknown) as CustomElementConstructor
  );
}
