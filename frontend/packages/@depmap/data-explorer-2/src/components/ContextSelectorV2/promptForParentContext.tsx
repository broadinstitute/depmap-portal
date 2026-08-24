import React, { useEffect, useRef, useState } from "react";
import { breadboxAPI, cached, evaluateContextPersisted } from "@depmap/api";
import {
  promptForValue,
  PromptComponentProps,
} from "@depmap/common-components";
import { SliceSelect } from "@depmap/selects";
import { DataExplorerContextV2 } from "@depmap/types";
import {
  ExpansionRoute,
  fromParentContext,
  getRouteHeading,
  getRouteNouns,
  resolveParentLabel,
  toParentContext,
} from "../../utils/expansionRoutes";
import { capitalize } from "../../utils/misc";
import styles from "../../styles/ContextSelector.scss";

interface SliceSelection {
  id: string;
  label: string;
}

type Status =
  | { kind: "idle" }
  // Resolving the context. Worth surfacing rather than leaving the modal
  // looking inert: transcript contexts routinely take several seconds.
  | { kind: "loading" }
  | { kind: "empty" }
  | { kind: "error" }
  | { kind: "ready"; count: number };

// A one-question Context Builder: "which gene?" in, a context of that gene's
// transcripts out.
//
// It's a modal rather than a control in the configuration panel because it is
// answered once and then done — leaving a picker parked next to the context
// selector spends permanent vertical space on a transient question. This is
// the same shape the "New" and "Manage my contexts…" options already use.
//
// What comes back is an ordinary context, so nothing downstream knows this
// existed: the axis can aggregate or expand over it, it can be saved, and it
// can be opened in the real Context Builder and narrowed by hand afterward.
export default async function promptForParentContext(
  childType: string,
  route: ExpansionRoute,
  currentValue: DataExplorerContextV2 | null
): Promise<DataExplorerContextV2 | null> {
  // Shared with the dropdown option that opens this, so the two always agree.
  const nouns = getRouteNouns(childType, route);
  const members = nouns.members.toLowerCase();
  const parentLabel = nouns.parent;

  const context = await promptForValue<DataExplorerContextV2 | null>({
    title: getRouteHeading(childType, route),
    defaultValue: null,
    modalProps: { className: styles.parentContextModal, bsSize: "small" },

    PromptComponent: ({
      onChange,
      updateAcceptText,
    }: PromptComponentProps<DataExplorerContextV2 | null>) => {
      // The selection is held locally rather than being the prompt's value, so
      // that a parent with no members can stay visible in the select while
      // still leaving the accept button disabled (the prompt disables it on a
      // null value). Reopening shows whatever is currently configured.
      const [selection, setSelection] = useState<SliceSelection | null>(() =>
        fromParentContext(currentValue, route)
      );
      const [status, setStatus] = useState<Status>({ kind: "idle" });
      // How many datasets carry at least one of the members, or null while
      // unknown. Separate from `status` because it arrives on its own schedule:
      // the member count gates the modal and this only annotates it, so it must
      // never be the thing being waited on.
      const [datasetCount, setDatasetCount] = useState<number | null>(null);

      useEffect(() => {
        setTimeout(() => {
          const selector = `div[data-parent-member-select] div[aria-autocomplete="list"]`;
          const el = document.querySelector(selector);
          (el as HTMLInputElement)?.focus();
        }, 100);
      }, []);

      // An id-matched route recovers the parent's id but not its name, so the
      // select would open showing "DPC-000001" instead of "afatinib". Swap in
      // the real label once it resolves. Guarded on the selection being
      // untouched so a fast picker click isn't overwritten by a slow lookup of
      // what was there before.
      useEffect(() => {
        const recovered = fromParentContext(currentValue, route);

        if (!recovered) {
          return;
        }

        let cancelled = false;

        resolveParentLabel(route, recovered).then((resolved) => {
          if (!cancelled) {
            setSelection((current) =>
              current?.id === recovered.id ? resolved : current
            );
          }
        });

        // eslint-disable-next-line consistent-return
        return () => {
          cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);

      // Resolving a context is slow enough to outlive the pick that started it
      // — transcripts take seconds — so a user who changes their mind mid-fetch
      // can have the first answer land after the second. Only the newest pick
      // is allowed to write anything.
      const latestRequest = useRef(0);

      const handleChange = async (next: SliceSelection | null) => {
        const requestId = latestRequest.current + 1;
        latestRequest.current = requestId;

        setSelection(next);

        // Clear the accepted value up front, not just on failure. Without
        // this, changing genes leaves the PREVIOUS gene's context sitting in
        // the prompt while the new one resolves, and accepting during that
        // window applies a context the user has already moved on from.
        onChange(null);
        updateAcceptText("");
        setDatasetCount(null);

        if (!next) {
          setStatus({ kind: "idle" });
          return;
        }

        setStatus({ kind: "loading" });

        const nextContext = await toParentContext(childType, route, next);

        if (!nextContext) {
          if (latestRequest.current === requestId) {
            setStatus({ kind: "idle" });
          }
          return;
        }

        // Fired alongside the resolve below rather than after it, and never
        // awaited: this only annotates the count with how many datasets carry
        // the members, and making every pick wait on a parenthetical would make
        // the modal feel slower for nothing. `getContextDatasetCoverage` already
        // swallows its own failures and answers with no counts, which is
        // indistinguishable from a context genuinely measured nowhere — both
        // render as no clause at all rather than as "across 0 datasets".
        //
        // Counts datasets holding at least ONE member, not all of them, since
        // that is what the endpoint's group-by produces. Good enough for "there
        // is data for these": a stricter reading would need the per-member
        // counts this deliberately throws away.
        cached(breadboxAPI)
          .getContextDatasetCoverage(nextContext)
          .then(({ counts }) => {
            if (latestRequest.current === requestId) {
              setDatasetCount(Object.keys(counts).length);
            }
          })
          .catch(() => {
            // Already logged by the client. Leaving the clause off is the whole
            // fallback.
          });

        // Resolving here is what lets a parent with no members be caught in
        // the modal, where it reads as "this gene has no transcripts", rather
        // than downstream in the materializer, which throws on an expansion
        // context that produced nothing.
        let ids: string[];

        try {
          ({ ids } = await evaluateContextPersisted(nextContext));
        } catch (e) {
          window.console.error(e);

          // Without this the modal sits on "Finding…" forever on a network
          // blip, with no way forward except cancelling.
          if (latestRequest.current === requestId) {
            setStatus({ kind: "error" });
          }

          return;
        }

        if (latestRequest.current !== requestId) {
          return;
        }

        if (ids.length === 0) {
          setStatus({ kind: "empty" });
          return;
        }

        setStatus({ kind: "ready", count: ids.length });
        onChange(nextContext);

        updateAcceptText(`Use ${nouns.members}`);
      };

      return (
        <div data-parent-member-select>
          <SliceSelect
            selectClassName={styles.parentElementSelect}
            slice_type={route.parentType}
            dataset_id={null}
            value={selection}
            onChange={handleChange}
            label={capitalize(parentLabel)}
            placeholder={`Choose a ${parentLabel.toLowerCase()}…`}
          />
          {status.kind === "loading" && (
            <div className={styles.loadingContainer}>
              <div>Finding {members}…</div>
              <div className={styles.spinner} />
            </div>
          )}
          {status.kind === "empty" && selection && (
            <div style={{ marginTop: 15 }}>
              <b>{selection.label}</b> has no {members} on record, so there
              would be nothing to plot. Try another {parentLabel.toLowerCase()}.
            </div>
          )}
          {status.kind === "error" && (
            <div style={{ marginTop: 15 }}>
              Something went wrong looking up{" "}
              {selection ? <b>{selection.label}</b> : "that"}&rsquo;s {members}.
              Try again, or pick a different {parentLabel.toLowerCase()}.
            </div>
          )}
          {status.kind === "ready" && (
            <div style={{ marginTop: 15 }}>
              Found {status.count} {nouns.members}
              {/* Omitted until known, and omitted entirely when nothing
                  matched — see the coverage request above for why those two
                  cases can't be told apart here. The sentence has to read
                  correctly without this clause, so it's a suffix rather than
                  the count being held back until both numbers arrive. */}
              {datasetCount !== null && datasetCount > 0 && (
                <>
                  {" "}
                  across {datasetCount}{" "}
                  {datasetCount === 1 ? "dataset" : "datasets"}
                </>
              )}
              .
            </div>
          )}
        </div>
      );
    },
  });

  return context ?? null;
}
