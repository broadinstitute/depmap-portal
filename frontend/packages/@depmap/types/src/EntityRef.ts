// EntityRef and EntityRefSet
//
// A reference to a thing on the plot, with enough information to identify
// it uniquely. Two flavors today:
//   - "single": one index entity (e.g. one cell line, one gene). The
//     plot's identity per-point is just the index id.
//   - "pair":   an (index, expansion) pair (e.g. (cell line, transcript)).
//     The plot is "expanded" by a second axis, and a point's identity
//     requires both ids.
//
// The discriminated union — rather than `{ indexId; expansionId? }` with
// expansionId optional — is deliberate. Consumers handling a reference
// must decide whether they handle the pair case or only the single case;
// the type system enforces that decision rather than letting it be a
// runtime-only "is expansionId undefined" check that's easy to forget.
//
// This type lives in @depmap/types because the pair concept is expected
// to be reused across multiple places — not only selection, but anywhere
// the application needs to talk about "the thing at this position in an
// expanded plot." Keep this module narrow: structural ids only, no
// display labels or other ephemeral data. If you want to carry a label
// alongside a ref, wrap it (e.g. `{ ref: EntityRef; label: string }`)
// rather than widening this type.
//
// Serialization: EntityRef is a plain object; serialization is JSON-safe
// without custom hooks. EntityRefSet is a class for membership semantics
// (see below), but it exposes toJSON()/fromJSON() so it can round-trip
// through URL state, localStorage, or any structured-clone boundary that
// might appear later.
export type EntityRef =
  | { kind: "single"; indexId: string }
  | { kind: "pair"; indexId: string; expansionId: string };

// Stable string key for an EntityRef. Used internally as the Map key in
// EntityRefSet and exposed for any consumer that needs a primitive key
// (e.g. React list keys, debug logs). Two refs with the same key are the
// same ref; the key is total and injective over the type.
//
// The encoding uses ASCII unit separator (\x1f) — a control character
// that doesn't appear in any reasonable identifier — so the
// (indexId, expansionId) split is unambiguous. The "kind" discriminator
// is included so a single ref with indexId "foo" never collides with a
// pair ref whose indexId happens to start with "foo" and has an empty
// expansionId (which shouldn't be constructable anyway, but defending
// against impossible states is cheap and the key is internal).
export function entityRefKey(ref: EntityRef): string {
  return ref.kind === "single"
    ? `s\x1f${ref.indexId}`
    : `p\x1f${ref.indexId}\x1f${ref.expansionId}`;
}

// Construction helpers — readability sugar at call sites, and a single
// place to evolve the shape if the discriminated union ever gains a
// third variant.
export function singleRef(indexId: string): EntityRef {
  return { kind: "single", indexId };
}

export function pairRef(indexId: string, expansionId: string): EntityRef {
  return { kind: "pair", indexId, expansionId };
}

// EntityRefSet
//
// Set semantics over EntityRefs. Uses a Map<key, ref> internally; the
// derived string key gives reliable membership and dedup that
// Set<object> can't provide (Set uses reference identity for objects,
// which breaks for refs constructed at different call sites).
//
// The class wraps the Map rather than extending it because the public
// API is narrower than Map's: consumers should not see the key encoding
// or be tempted to use Map operations that bypass the EntityRef
// abstraction. Methods named after their Set analogues (.has, .add,
// .delete, .size, .forEach, [Symbol.iterator]) so this is roughly
// drop-in for the Set<string> it replaces.
//
// Instances are immutable from the consumer's perspective: .add and
// .delete return new sets rather than mutating in place. This is
// deliberate — it matches React's expectations for state updates
// (referential change signals a render), and it avoids the bug class
// where shared selection state is silently mutated. The cost is one
// Map allocation per change, which is negligible at any realistic
// selection size.
export class EntityRefSet {
  // Map<entityRefKey, ref>. Private; consumers go through the methods.
  private readonly entries: Map<string, EntityRef>;

  constructor(entries?: Iterable<EntityRef>) {
    this.entries = new Map();
    if (entries) {
      for (const ref of entries) {
        this.entries.set(entityRefKey(ref), ref);
      }
    }
  }

  get size(): number {
    return this.entries.size;
  }

  has(ref: EntityRef): boolean {
    return this.entries.has(entityRefKey(ref));
  }

  // Returns a new set with `ref` added. If `ref` is already present (by
  // entityRefKey equality), returns this same set instance unchanged —
  // gives React a referential no-op to short-circuit re-renders.
  add(ref: EntityRef): EntityRefSet {
    const key = entityRefKey(ref);
    if (this.entries.has(key)) {
      return this;
    }
    const next = new EntityRefSet(this.entries.values());
    next.entries.set(key, ref);
    return next;
  }

  // Returns a new set with `ref` removed. If `ref` was not present,
  // returns this same instance unchanged (same rationale as `add`).
  delete(ref: EntityRef): EntityRefSet {
    const key = entityRefKey(ref);
    if (!this.entries.has(key)) {
      return this;
    }
    const next = new EntityRefSet(this.entries.values());
    next.entries.delete(key);
    return next;
  }

  // Returns a new empty set instance. Provided for API symmetry — clearing
  // a selection is a common operation and `new EntityRefSet()` at every
  // call site is noisier than `.clear()`.
  clear(): EntityRefSet {
    return this.size === 0 ? this : new EntityRefSet();
  }

  forEach(cb: (ref: EntityRef) => void): void {
    this.entries.forEach((ref) => cb(ref));
  }

  // Spread- and for…of-friendly iteration over the refs themselves,
  // not the internal keys.
  [Symbol.iterator](): IterableIterator<EntityRef> {
    return this.entries.values();
  }

  // Convenience: most call sites need to bulk-construct from an array
  // of either kind of id. Provided here so callers don't reach for
  // `new EntityRefSet([...].map(singleRef))` everywhere.
  static fromIndexIds(indexIds: Iterable<string>): EntityRefSet {
    const refs: EntityRef[] = [];
    for (const id of indexIds) {
      refs.push({ kind: "single", indexId: id });
    }
    return new EntityRefSet(refs);
  }

  static fromPairs(
    pairs: Iterable<{ indexId: string; expansionId: string }>
  ): EntityRefSet {
    const refs: EntityRef[] = [];
    for (const { indexId, expansionId } of pairs) {
      refs.push({ kind: "pair", indexId, expansionId });
    }
    return new EntityRefSet(refs);
  }

  // Serialization. EntityRefSet is a class, so JSON.stringify on it
  // produces an empty object by default. These methods make the
  // round-trip explicit and total. Format is the array of refs, which
  // is the minimum needed to reconstruct.
  toJSON(): EntityRef[] {
    return [...this.entries.values()];
  }

  static fromJSON(refs: EntityRef[]): EntityRefSet {
    return new EntityRefSet(refs);
  }
}
