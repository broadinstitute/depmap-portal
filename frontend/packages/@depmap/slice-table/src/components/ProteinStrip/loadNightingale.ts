import { useEffect, useState } from "react";

// Module-level, not per-component: every strip in the table wants the same
// elements, and a table can easily have a hundred cells asking at once. The
// promise is the memo, so concurrent askers share one in-flight import and
// later ones resolve immediately.
let loader: Promise<void> | null = null;
let loaded = false;

export function loadNightingale(): Promise<void> {
  if (!loader) {
    loader = import(
      /* webpackChunkName: "nightingale" */ "./nightingaleElements"
    ).then(() => {
      loaded = true;
    });
  }

  return loader;
}

// True once the custom elements are defined and it is safe to create one.
//
// Initialized from `loaded` rather than always starting false, so cells that
// mount after the first load -- which is most of them, since the table
// virtualizes rows and remounts cells on every scroll -- render the strip on
// their first paint instead of flashing a placeholder.
export function useNightingale(): boolean {
  const [ready, setReady] = useState(loaded);

  useEffect(() => {
    if (ready) {
      return undefined;
    }

    let cancelled = false;

    loadNightingale()
      .then(() => {
        if (!cancelled) {
          setReady(true);
        }
      })
      .catch((e) => {
        // A failed chunk load leaves `ready` false forever, which renders the
        // plain-text fallback. That is a worse cell than the strip but a much
        // better one than a blank space, and it means a CDN hiccup can't take
        // out the table.
        window.console.error("Failed to load Nightingale elements", e);
      });

    return () => {
      cancelled = true;
    };
  }, [ready]);

  return ready;
}
