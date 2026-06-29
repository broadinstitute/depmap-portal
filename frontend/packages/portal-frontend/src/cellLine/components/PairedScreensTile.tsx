import React from "react";
import { toPortalLink } from "@depmap/globals";
import styles from "../styles/CellLinePage.scss";

// =============================================================================
// Data types
// =============================================================================

export interface ResistanceOrigin {
  // The cultured/engineered columns are mutually exclusive, so we collapse
  // them into one tagged value rather than carrying two parallel fields.
  type: "cultured" | "engineered";
  description: string;
}

export interface ParentalLine {
  id: string;
  name?: string;
}

export interface DerivativeLine {
  id: string;
  name?: string;
}

// A model can be on one side of a paired-screen relationship or the other,
// but not both. `role` discriminates the two cases:
//   - "derivative": this model is a resistant derivative; carries its origin
//     and a link to the parental line it was derived from.
//   - "parental":   this model is itself a parental line; carries links to
//     the derivatives that were created from it.
export type ResistanceInfo =
  | {
      role: "derivative";
      origin?: ResistanceOrigin;
      parentalLine: ParentalLine;
    }
  | {
      role: "parental";
      derivatives: DerivativeLine[];
    };

export interface ResistanceScreenRows {
  // A single model can appear as a Test row, a Ctrl row, or both.
  test?: string[];
  ctrl?: string[];
}

export interface PairedScreensTileProps {
  anchorRowIds?: string[];
  resistanceRows?: ResistanceScreenRows;
  resistance?: ResistanceInfo;
}

// =============================================================================
// URL helpers
// =============================================================================

// Repeated `highlight=` params rather than comma-joined, so row IDs are free
// to contain commas without breaking the parse on the dashboard side.
function buildHighlightUrl(basePath: string, rowIds: string[]): string {
  const params = new URLSearchParams();
  rowIds.forEach((id) => params.append("highlight", id));
  return toPortalLink(`${basePath}?${params.toString()}`);
}

// =============================================================================
// Sub-components
// =============================================================================

function AnchorScreenLink({ rowIds }: { rowIds: string[] }) {
  return (
    <div className={styles.pairedScreensLinkRow}>
      <a
        href={buildHighlightUrl("/anchor_screen_dashboard", rowIds)}
        className={styles.descriptionLinks}
        rel="noopener noreferrer"
        target="_blank"
      >
        View in Anchor Screen Dashboard
      </a>
      {rowIds.length > 1 && (
        <span className={styles.pairedScreensLinkCount}>
          {" "}
          ({rowIds.length} entries)
        </span>
      )}
    </div>
  );
}

function ResistanceScreenLink({ rows }: { rows: ResistanceScreenRows }) {
  // Render one link per role when both are present, so each link can carry
  // exactly the row IDs relevant to that role. This also surfaces the Test
  // vs Ctrl distinction without leaning on the dashboard to communicate it.
  const entries: Array<{ role: "Test arm" | "Ctrl arm"; ids: string[] }> = [];
  if (rows.test && rows.test.length > 0) {
    entries.push({ role: "Test arm", ids: rows.test });
  }

  if (rows.ctrl && rows.ctrl.length > 0) {
    entries.push({ role: "Ctrl arm", ids: rows.ctrl });
  }

  return (
    <>
      {entries.map(({ role, ids }) => (
        <div className={styles.pairedScreensLinkRow} key={role}>
          <a
            href={buildHighlightUrl("/resistance_screen_dashboard", ids)}
            className={styles.descriptionLinks}
            rel="noopener noreferrer"
            target="_blank"
          >
            View in Resistance Screen Dashboard ({role})
          </a>
          {ids.length > 1 && (
            <span className={styles.pairedScreensLinkCount}>
              {" "}
              ({ids.length} entries)
            </span>
          )}
        </div>
      ))}
    </>
  );
}

function ResistanceMetadataSection({ data }: { data: ResistanceInfo }) {
  if (data.role === "parental") {
    return (
      <>
        <h4 className={styles.propertyGroupHeader} style={{ marginTop: 20 }}>
          Derived Resistance Models
        </h4>
        {data.derivatives.map((d) => (
          <div key={d.id}>
            <a
              className={styles.descriptionLinks}
              href={toPortalLink(`/cell_line/${d.id}`)}
              rel="noopener noreferrer"
              target="_blank"
            >
              {d.name ?? d.id}
            </a>
          </div>
        ))}
      </>
    );
  }

  // role === "derivative"

  // Mirrors the property-group / property-header pattern used in the
  // Description tile so the visual rhythm matches what's already on the page.
  return (
    <>
      <h4 className={styles.propertyGroupHeader} style={{ marginTop: 20 }}>
        Resistance
      </h4>

      {data.origin && (
        <>
          <h6 className={styles.propertyHeader}>
            {data.origin.type === "cultured"
              ? "Cultured Resistance"
              : "Engineered Resistance"}
          </h6>
          <p>{data.origin.description}</p>
        </>
      )}
      <h6 className={styles.propertyHeader}>Parental Model</h6>
      <a
        className={styles.descriptionLinks}
        href={toPortalLink(`/cell_line/${data.parentalLine.id}`)}
        target="_blank"
        rel="noreferrer noopener"
      >
        {data.parentalLine.name ?? data.parentalLine.id}
      </a>
    </>
  );
}

// =============================================================================
// Tile
// =============================================================================

export default function PairedScreensTile({
  anchorRowIds = undefined,
  resistanceRows = undefined,
  resistance = undefined,
}: PairedScreensTileProps) {
  const hasAnchor = (anchorRowIds?.length ?? 0) > 0;
  const hasResistance =
    (resistanceRows?.test?.length ?? 0) > 0 ||
    (resistanceRows?.ctrl?.length ?? 0) > 0;
  const hasResistanceMeta = resistance != null;

  // Tile renders nothing when the cell line has no paired-screen footprint.
  // This keeps it from showing as an empty card on most cell line pages.
  if (!hasAnchor && !hasResistance && !hasResistanceMeta) {
    return null;
  }

  return (
    <article className="card_wrapper">
      <div className="card_border container_fluid">
        <h2 className="no_margin cardtitle_text">Paired Screens</h2>
        <div className="card_padding">
          {hasAnchor && <AnchorScreenLink rowIds={anchorRowIds!} />}
          {hasResistance && <ResistanceScreenLink rows={resistanceRows!} />}
          {hasResistanceMeta && (
            <ResistanceMetadataSection data={resistance!} />
          )}
        </div>
      </div>
    </article>
  );
}
