// Access groups whose datasets may be written to the persistent cache despite
// not being public.
//
// THE CLAIM YOU ARE MAKING BY ADDING A NAME HERE:
//
//   Everything in this group, now and in the future, is data we are willing to
//   leave on a shared workstation's disk. IndexedDB is origin-global and
//   readable wholesale — via devtools, after a logout, by the next person to
//   sit down. Adding a group says that is an acceptable outcome for every
//   dataset anyone with write access to it will ever upload, because nobody
//   reviews those uploads against this list.
//
//   The case this was built for is pre-release data pending review: private
//   only until it is published, so the disclosure window is bounded by
//   something that was going to happen anyway. A group holding data that is
//   private because it is genuinely sensitive does not belong here, however
//   convenient the cache would be.
//
// REMOVING A NAME REQUIRES A CACHE_VERSION BUMP IN THE SAME COMMIT.
//
//   Removal stops new writes. It does not evict what is already on disk —
//   there is no per-entry invalidation in this engine by design (see the
//   correctness argument at the top of persistentApiCache.ts), so bytes
//   written under an old whitelist stay readable until the epoch rotates.
//   Bumping CACHE_VERSION is the only thing that clears them.
//
// Matched by NAME, not id. Group names are unique per Breadbox instance
// (`Group.name` is `unique=True`), and a name means the same thing across dev,
// staging and prod, while the id does not. A dataset re-uploaded as a new
// version stays in its group, so unlike a list of dataset UUIDs this needs no
// maintenance as data is revised.
export const CACHEABLE_GROUP_NAMES: ReadonlySet<string> = new Set([
  "Domain Annotation Reviewers",
]);
