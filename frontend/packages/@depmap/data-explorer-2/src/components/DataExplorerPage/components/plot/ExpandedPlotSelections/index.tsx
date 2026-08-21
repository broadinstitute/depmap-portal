import React, { useContext, useMemo } from "react";
import { Button } from "react-bootstrap";
import { showInfoModal } from "@depmap/common-components";
import {
  DataExplorerExpansion,
  DataExplorerPlotResponse,
  EntityRefSet,
  entityRefKey,
  pairRef,
} from "@depmap/types";
import { pluralize } from "../../../../../utils/misc";
import { SectionStackContext } from "../../SectionStack";
import HelpTip from "../../HelpTip";
import PairsVirtualList, { SelectionRow } from "./PairsVirtualList";
import ExpandedSelectionsTable, {
  SelectionPair,
} from "./ExpandedSelectionsTable";
import { resolvePairLabels } from "./pairLabels";
import styles from "../../../styles/DataExplorer2.scss";

// ExpandedPlotSelections
//
// The selection panel for expanded plots — the sibling of PlotSelections
// that the plot wrappers dispatch to when the response carries an
// expansion. Where PlotSelections lists one row per selected *index*
// entity, this groups the selected *points* under theirs: a header row per
// index entity, with its selected expansion members listed and indented
// beneath it.
//
// Neither half is a fixed dimension type. Both are named from the response
// (index_display_name, and the expansion's own display_name), so the panel
// reads "Cell Line"/"Transcript" for one plot and "Compound"/"Dose" for
// another. It used to say Model and Transcript outright, in its field names,
// its column headers, its modal title and its CSV filename.
//
// Why a separate component rather than a flag on PlotSelections:
//   - It consumes the selection as an EntityRefSet directly (pairs), not
//     the index-id-only Set<string> the legacy panel is built around.
//   - It has no Visualize / Copy / Save-as-Context buttons. Those
//     operations are defined over index entities (a context names one
//     entity type, never a pair), so they're meaningless here until pair
//     contexts exist. Per Phil's direction the panel is buttons-free
//     except for clearing the selection.
//   - "Set selection from a context" is omitted for the same reason: a
//     context resolves to single refs, which can never match a pair ref,
//     so the control would silently select nothing.
//
// The component deliberately consumes only { data, selection,
// onClickClearSelection } — every prop is used, so the signature is
// honest about what the panel actually needs. Hyperlinking the individual
// pair components is deferred (a two-entity row wants a two-column
// design); rows are plain text for now.
interface Props {
  data: DataExplorerPlotResponse | null;
  selection: EntityRefSet | null;
  onClickClearSelection: () => void;
}

// The height of everything in the section *except* the scrolling list: the
// instructions/clear-button block plus the sectionContent padding. Used the
// same way PlotSelections uses its own constant — subtracted from the
// SectionStack's allocated height to size the list. PlotSelections reserves
// ~194 because it also has a three-button column below the list; this panel
// has no buttons, so reserving that much leaves the list box ~120px short and
// hides trailing rows. This is an eyeballed value for the fragile SectionStack
// measurement, not a precise one — nudge it if the list ends up slightly too
// tall or too short.
const SECTION_HEIGHT_WITHOUT_LIST = 104;

function ExpandedPlotSelections({
  data,
  selection,
  onClickClearSelection,
}: Props) {
  const { sectionHeights } = useContext(SectionStackContext);

  // MVP "at most one expansion": the points index is expansions[0], parallel
  // to index_ids / index_labels. Cast because `expansions` belongs to
  // DataExplorerExpandedPlotResponse and the prop is typed as the base
  // response; hoisted out of the pairs memo below so the labels can name it
  // too, rather than casting twice.
  const expansion = (data as { expansions?: DataExplorerExpansion[] } | null)
    ?.expansions?.[0];

  const pairs = useMemo<SelectionPair[]>(() => {
    if (!data || !selection || !expansion) {
      return [];
    }

    // Walk points (not the selection set) so rows come out in the plot's own
    // point order, matching how PlotSelections derives its list.
    const out: SelectionPair[] = [];

    for (let i = 0; i < data.index_ids.length; i += 1) {
      const ref = pairRef(data.index_ids[i], expansion.ids[i]);

      if (selection.has(ref)) {
        out.push({
          indexId: data.index_ids[i],
          indexLabel: data.index_labels[i],
          memberId: expansion.ids[i],
          memberLabel: expansion.labels[i],
          key: entityRefKey(ref),
        });
      }
    }

    return out;
  }, [data, selection, expansion]);

  const rows = useMemo<SelectionRow[]>(() => {
    // Group the flat pairs by index id (unique — two entities can share a
    // label) and display the label; the list carries a header row per index
    // entity followed by its selected expansion members, indented.
    const groups = new Map<
      string,
      { label: string; members: SelectionRow[] }
    >();

    pairs.forEach((pair) => {
      let group = groups.get(pair.indexId);

      if (!group) {
        group = { label: pair.indexLabel, members: [] };
        groups.set(pair.indexId, group);
      }

      group.members.push({
        kind: "member",
        label: pair.memberLabel,
        key: pair.key,
      });
    });

    const out: SelectionRow[] = [];

    groups.forEach((group, id) => {
      out.push({ kind: "header", label: group.label, key: `header:${id}` });
      group.members.forEach((member) => out.push(member));
    });

    return out;
  }, [pairs]);

  const count = rows.length;

  const maxHeightOfList =
    count > 0
      ? sectionHeights["Plot Selections"] - SECTION_HEIGHT_WITHOUT_LIST
      : Infinity;

  // What this plot calls the two halves of a pair — see resolvePairLabels.
  const labels = useMemo(() => resolvePairLabels(data, expansion), [
    data,
    expansion,
  ]);

  // "Show Table" opens a two-column table of the selected pairs, with a CSV
  // download. Pair selections don't support the usual PlotSelections
  // operations, so this is a read-only view for now.
  const onClickShowTable = () => {
    showInfoModal({
      title: `Selected ${pluralize(labels.member).toLowerCase()}`,
      content: <ExpandedSelectionsTable pairs={pairs} labels={labels} />,
    });
  };

  return (
    <div>
      <div className={styles.plotInstructions}>
        <div>
          Select points to populate list
          <HelpTip id="select-points-help" />
        </div>
        {selection && selection.size > 0 && (
          <div>
            <div>
              <button
                className={styles.setSelectionButton}
                type="button"
                onClick={onClickClearSelection}
              >
                clear {selection.size.toLocaleString()} selected{" "}
                {selection.size === 1 ? "pair" : "pairs"}
              </button>
            </div>
            <div>
              <Button
                className={styles.seeTableButton}
                onClick={onClickShowTable}
                bsStyle="primary"
                bsSize="xs"
              >
                See Table
              </Button>
            </div>
          </div>
        )}
      </div>
      <div className={styles.plotSelectionsContent}>
        <div>
          <PairsVirtualList items={rows} maxHeight={maxHeightOfList} />
        </div>
      </div>
    </div>
  );
}

export default ExpandedPlotSelections;
