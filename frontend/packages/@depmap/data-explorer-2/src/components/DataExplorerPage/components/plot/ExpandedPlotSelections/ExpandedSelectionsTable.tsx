import React from "react";
import { PairLabels, toFilenamePart } from "./pairLabels";

// ExpandedSelectionsTable
//
// Bespoke table for the expanded-selections "Show Table" modal. One row per
// selected point — an (index entity, expansion member) pair — with one column
// per axis of the pair: the index entity plus each expansion. We support a
// single expansion today, so that's two columns; the same shape generalizes to
// num_expansions + 1 columns. Includes a CSV download of the same rows (with
// ids, which a label-only export would lose).
//
// Nothing here names a dimension type. The first version did — the fields were
// modelId/transcriptLabel and the headers read "Model" and "Transcript" — which
// was true of the plot it was built for and of nothing else. The types are the
// plot's own (an expansion is depmap_model × transcript in Transcript Explorer
// and compound × dose elsewhere), so they arrive as labels the caller read off
// the response.
export interface SelectionPair {
  indexId: string;
  indexLabel: string;
  memberId: string;
  memberLabel: string;
  key: string;
}

const escapeCsv = (value: string) =>
  /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

function downloadPairsCsv(pairs: SelectionPair[], labels: PairLabels) {
  const header = [
    labels.index,
    `${labels.index} ID`,
    labels.member,
    `${labels.member} ID`,
  ];
  const lines = [header.join(",")];

  pairs.forEach((p) => {
    lines.push(
      [p.indexLabel, p.indexId, p.memberLabel, p.memberId]
        .map(escapeCsv)
        .join(",")
    );
  });

  const blob = new Blob([lines.join("\r\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `selected_${toFilenamePart(labels.member)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "4px 8px",
  borderBottom: "2px solid #ccc",
  position: "sticky",
  top: 0,
  background: "#fff",
};

const tdStyle: React.CSSProperties = {
  padding: "4px 8px",
  borderBottom: "1px solid #eee",
};

function ExpandedSelectionsTable({
  pairs,
  labels,
}: {
  pairs: SelectionPair[];
  labels: PairLabels;
}) {
  return (
    <div>
      <div style={{ marginBottom: 8, textAlign: "right" }}>
        <button type="button" onClick={() => downloadPairsCsv(pairs, labels)}>
          Download CSV
        </button>
      </div>
      <div style={{ maxHeight: 400, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>{labels.index}</th>
              <th style={thStyle}>{labels.member}</th>
            </tr>
          </thead>
          <tbody>
            {pairs.map((p) => (
              <tr key={p.key}>
                <td style={tdStyle}>{p.indexLabel}</td>
                <td style={tdStyle}>{p.memberLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ExpandedSelectionsTable;
