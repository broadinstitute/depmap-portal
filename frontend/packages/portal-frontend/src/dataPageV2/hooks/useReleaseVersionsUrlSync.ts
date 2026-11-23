import { useCallback, useEffect, useRef } from "react";
import { ReleaseVersion } from "@depmap/types";
import { DateRangePreset } from "./useReleaseVersions";

const PARAM_RELEASE = "release";
const PARAM_VERSION = "version";
const PARAM_TAG = "tag";
const PARAM_DATE_RANGE = "dateRange";

interface UrlFilterState {
  release: string;
  version: string;
  tag: string;
  dateRange: DateRangePreset;
}

const getVersionIdentifier = (v: ReleaseVersion): string =>
  String(v.version_name);

const findMatchingVersion = (
  releases: ReleaseVersion[],
  releaseName: string,
  versionId: string
): ReleaseVersion | null =>
  releases.find(
    (rv) =>
      rv.release_name === releaseName && getVersionIdentifier(rv) === versionId
  ) ??
  releases.find((rv) => rv.release_name === releaseName) ??
  null;

function readUrlState(): UrlFilterState {
  const params = new URLSearchParams(window.location.search);
  return {
    release: params.get(PARAM_RELEASE) ?? "",
    version: params.get(PARAM_VERSION) ?? "",
    tag: params.get(PARAM_TAG) ?? "",
    dateRange: (params.get(PARAM_DATE_RANGE) ?? "") as DateRangePreset,
  };
}

function writeUrlState(state: UrlFilterState, mode: "push" | "replace") {
  const url = new URL(window.location.href);

  if (state.release && state.version) {
    url.searchParams.set(PARAM_RELEASE, state.release);
    url.searchParams.set(PARAM_VERSION, state.version);
  } else {
    url.searchParams.delete(PARAM_RELEASE);
    url.searchParams.delete(PARAM_VERSION);
  }

  if (state.tag) {
    url.searchParams.set(PARAM_TAG, state.tag);
  } else {
    url.searchParams.delete(PARAM_TAG);
  }

  if (state.dateRange) {
    url.searchParams.set(PARAM_DATE_RANGE, state.dateRange);
  } else {
    url.searchParams.delete(PARAM_DATE_RANGE);
  }

  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (nextUrl === currentUrl) return;

  window.history[mode === "push" ? "pushState" : "replaceState"](
    null,
    "",
    nextUrl
  );
}

interface UseReleaseVersionsUrlSyncOptions {
  enabled: boolean;
  releases: ReleaseVersion[];
  tag: string;
  setTag: (tag: string) => void;
  dateRange: DateRangePreset;
  setDateRange: (range: DateRangePreset) => void;
  selectedVersion: ReleaseVersion | null;
  setSelectedVersionState: (version: ReleaseVersion | null) => void;
}

/**
 * Synchronizes release filters and active version drill-down with URL query params
 * and browser Back/Forward navigation when `enabled` is true.
 */
export function useReleaseVersionsUrlSync({
  enabled,
  releases,
  tag,
  setTag,
  dateRange,
  setDateRange,
  selectedVersion,
  setSelectedVersionState,
}: UseReleaseVersionsUrlSyncOptions) {
  const pendingSelectionRef = useRef<{
    release: string;
    version: string;
  } | null>(null);
  const hasInitializedFromUrlRef = useRef(false);

  // 1. Get initial state from URL on mount
  useEffect(() => {
    if (!enabled) return;

    const initial = readUrlState();
    if (initial.tag) setTag(initial.tag);
    if (initial.dateRange) setDateRange(initial.dateRange);
    if (initial.release && initial.version) {
      pendingSelectionRef.current = {
        release: initial.release,
        version: initial.version,
      };
    }
    hasInitializedFromUrlRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // 2. Resolve deferred URL version selection once releases finish loading
  useEffect(() => {
    if (!enabled) return;
    const pending = pendingSelectionRef.current;
    if (!pending || releases.length === 0) return;

    const match = findMatchingVersion(
      releases,
      pending.release,
      pending.version
    );
    if (match) setSelectedVersionState(match);
    pendingSelectionRef.current = null;
  }, [enabled, releases, setSelectedVersionState]);

  // 3. Keep URL query params in sync when filters or selection change
  useEffect(() => {
    if (!enabled || !hasInitializedFromUrlRef.current) return;

    writeUrlState(
      {
        release: selectedVersion?.release_name ?? "",
        version: selectedVersion ? getVersionIdentifier(selectedVersion) : "",
        tag,
        dateRange,
      },
      "replace"
    );
  }, [enabled, tag, dateRange, selectedVersion]);

  // 4. Respond to browser Back / Forward navigation
  useEffect(() => {
    if (!enabled) return undefined;

    const handlePopState = () => {
      const urlState = readUrlState();
      setTag(urlState.tag);
      setDateRange(urlState.dateRange);

      if (urlState.release && urlState.version) {
        const match = findMatchingVersion(
          releases,
          urlState.release,
          urlState.version
        );
        if (match) {
          setSelectedVersionState(match);
        } else {
          pendingSelectionRef.current = {
            release: urlState.release,
            version: urlState.version,
          };
        }
      } else {
        pendingSelectionRef.current = null;
        setSelectedVersionState(null);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [enabled, releases, setTag, setDateRange, setSelectedVersionState]);

  const pushVersionToUrl = useCallback(
    (version: ReleaseVersion | null) => {
      if (!enabled) return;
      writeUrlState(
        {
          release: version?.release_name ?? "",
          version: version ? getVersionIdentifier(version) : "",
          tag,
          dateRange,
        },
        "push"
      );
    },
    [enabled, tag, dateRange]
  );

  return { pushVersionToUrl };
}
