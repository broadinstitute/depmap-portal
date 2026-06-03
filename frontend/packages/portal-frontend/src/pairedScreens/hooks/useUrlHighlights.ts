import { useCallback, useEffect, useState } from "react";

const PARAM = "highlight";

function readFromUrl(): string[] {
  return new URLSearchParams(window.location.search).getAll(PARAM);
}

/**
 * Reads `?highlight=<id>` query params from the URL and exposes them as state.
 * Re-reads on browser back/forward navigation. The returned `clearHighlights`
 * removes the highlight params from the URL (preserving any other params)
 * and pushes a new history entry, mirroring the prior behavior.
 */
export default function useUrlHighlights() {
  const [highlights, setHighlights] = useState<string[]>(readFromUrl);

  useEffect(() => {
    const onPopState = () => setHighlights(readFromUrl());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const clearHighlights = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete(PARAM);
    window.history.pushState({}, "", url.toString());
    setHighlights([]);
  }, []);

  return { highlights, clearHighlights };
}
