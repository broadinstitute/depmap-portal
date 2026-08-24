import React, { useContext } from "react";
import {
  DataExplorerPlotConfig,
  DataExplorerExpandedPlotResponse,
  DataExplorerPlotResponse,
} from "@depmap/types";
import { SectionStackContext } from "../SectionStack";
import HelpTip from "../HelpTip";
import LegendLabel from "./LegendLabel";
import ChooseCategoriesButton from "./ChooseCategoriesButton";
import ExpansionMembersControl from "../ConfigurationPanel/ExpansionMembersControl";
import { NEUTRAL_FACET_FILL } from "./prototype/plotUtils";
import type { ContinuousBins, LegendKey } from "./prototype/plotUtils";
import styles from "../../styles/DataExplorer2.scss";

const HEIGHT_WITHOUT_LIST = 54;

function FacetLabels({
  data,
  facetKeys,
  continuousBins,
  hiddenFacetValues,
  onClickFacetItem,
  handleClickShowAllFacets,
  handleClickHideAllFacets,
}: {
  data: any;
  facetKeys: LegendKey[];
  continuousBins: any;
  hiddenFacetValues: any;
  onClickFacetItem: any;
  handleClickShowAllFacets: any;
  handleClickHideAllFacets: any;
}) {
  const { sectionHeights } = useContext(SectionStackContext);

  // Unlike the color legend, there's no colorMap to source "the universe of
  // all known keys" from (show/hide-all only ever needs the keys — see
  // useLegendState's handleClickHideAll/onClickLegendItem, both of which
  // read Reflect.ownKeys and ignore the values entirely).
  const facetKeysAsObject = Object.fromEntries(
    facetKeys.map((key) => [key, ""])
  );

  const hasFacetDimensionLabels = Boolean(data?.dimensions?.facet);
  const extraTextHeight = hasFacetDimensionLabels ? 40 : 0;
  const maxHeight =
    sectionHeights.Facets - HEIGHT_WITHOUT_LIST - extraTextHeight;

  return (
    <div className={styles.LegendLabels} style={{ maxHeight }} data-overflow>
      {facetKeys.length > 1 && (
        <div className={styles.legendHideAllShowAllButtons}>
          <button type="button" onClick={() => handleClickShowAllFacets()}>
            Show all
          </button>
          <span> | </span>
          <button
            type="button"
            onClick={() => handleClickHideAllFacets(facetKeysAsObject)}
          >
            Hide all
          </button>
        </div>
      )}
      {facetKeys.map((facet) => (
        <div key={facet.toString()}>
          <button
            type="button"
            style={{
              opacity: hiddenFacetValues.has(facet) ? 0.3 : 1.0,
            }}
            onClick={() => onClickFacetItem(facet, facetKeysAsObject)}
          >
            <span
              className={styles.legendSwatch}
              style={{
                backgroundColor: NEUTRAL_FACET_FILL,
                borderRadius: 2,
              }}
            />
            <LegendLabel
              data={data}
              continuousBins={continuousBins}
              category={facet}
              target="facet"
            />
          </button>
        </div>
      ))}
    </div>
  );
}

function FacetSliceDescription({
  data,
}: {
  data: DataExplorerPlotResponse | null;
}) {
  const dimension = data?.dimensions?.facet;
  if (dimension) {
    return (
      <div className={styles.colorDimensionLabels}>
        <div>{dimension.axis_label}</div>
        <div>{dimension.dataset_label}</div>
      </div>
    );
  }

  const property = data?.metadata?.facet_property;
  if (property) {
    const { label, units, dataset_label } = property;

    return (
      <div className={styles.colorDimensionLabels}>
        <div>{label}</div>
        {units && units !== "unitless" && <div>{units}</div>}
        {dataset_label && <div>{dataset_label}</div>}
      </div>
    );
  }

  return null;
}

interface Props {
  // Widened to the expanded response so the member counts below are reachable.
  // The expanded shape extends the plain one, so every other reader is
  // unaffected; `"expansions" in data` is what distinguishes them.
  data: DataExplorerPlotResponse | DataExplorerExpandedPlotResponse | null;
  // Display-order list of facets — sortedFacetKeys for density/waterfall,
  // facetOrder for scatter (already computed by each caller for its own
  // rendering purposes; this panel doesn't recompute facet identity).
  facetKeys: LegendKey[];
  continuousBins: ContinuousBins;
  hiddenFacetValues: Set<LegendKey>;
  onClickFacetItem: (
    item: string | symbol,
    facetKeysAsObject: Record<string, string>
  ) => void;
  handleClickShowAllFacets: () => void;
  handleClickHideAllFacets: (facetKeysAsObject: Record<string, string>) => void;
  plotConfig?: DataExplorerPlotConfig | null;
  onChangeCategories?: (
    target: "color" | "facet",
    categories: string[] | null
  ) => void;
  onChangeExpansionMembers?: (members: string[] | null) => void;
}

// Shown only when color_by/facet_by diverge (resolveColorMode's target is
// "color" with facet_by independently set to something real) — the one case
// where the Legend panel no longer doubles as the facet key. Mirrors
// PlotLegend's interaction (click to toggle, double-click to isolate,
// show/hide all), but each row's marker is a fixed neutral square rather
// than a real color swatch: there's no color mapping to show (color is
// coming from somewhere else entirely) — the square is just a plain list
// marker, not a per-facet color assignment.
function PlotFacets({
  data,
  facetKeys,
  continuousBins,
  hiddenFacetValues,
  onClickFacetItem,
  handleClickShowAllFacets,
  handleClickHideAllFacets,
  plotConfig = null,
  onChangeCategories = undefined,
  onChangeExpansionMembers = undefined,
}: Props) {
  // Only an expanded response carries these; a plain one leaves them undefined,
  // which the control reads as "no counts to report".
  const expansion = data && "expansions" in data ? data.expansions[0] : null;

  return (
    <div>
      <div className={styles.plotInstructions}>
        Click to toggle on/off
        <HelpTip id="legend-doubleclick-help" />
      </div>
      <FacetSliceDescription data={data} />
      <FacetLabels
        data={data}
        facetKeys={facetKeys}
        continuousBins={continuousBins}
        hiddenFacetValues={hiddenFacetValues}
        onClickFacetItem={onClickFacetItem}
        handleClickShowAllFacets={handleClickShowAllFacets}
        handleClickHideAllFacets={handleClickHideAllFacets}
      />
      {onChangeExpansionMembers && plotConfig?.facet_by === "expansion" ? (
        // This panel only renders when color and facet have diverged, so when
        // facet_by is the expansion these rows are its members.
        <ExpansionMembersControl
          plot={plotConfig}
          onChangeMembers={onChangeExpansionMembers}
          shownCount={expansion?.shown_count}
          availableCount={expansion?.available_count}
        />
      ) : null}
      {onChangeCategories && (
        <ChooseCategoriesButton
          data={data}
          plotConfig={plotConfig}
          target="facet"
          onChangeCategories={onChangeCategories}
        />
      )}
    </div>
  );
}

export default PlotFacets;
