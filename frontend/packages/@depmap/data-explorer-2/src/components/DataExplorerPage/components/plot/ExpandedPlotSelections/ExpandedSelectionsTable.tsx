import React from "react";

// ExpandedSelectionsTable
//
// Bespoke table for the expanded-selections "Show Table" modal. One row per
// selected point — a (model, transcript) pair — with one column per axis of
// the pair: the index entity plus each expansion. We support a single
// expansion today, so that's two columns (Model, Transcript); the same shape
// generalizes to num_expansions + 1 columns. Includes a CSV download of the
// same rows (with ids, which a label-only export would lose).
export interface SelectionPair {
  modelId: string;
  modelLabel: string;
  transcriptId: string;
  transcriptLabel: string;
  key: string;
}

const escapeCsv = (value: string) =>
  /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

function downloadPairsCsv(pairs: SelectionPair[]) {
  const header = ["Model", "Model ID", "Transcript", "Transcript ID"];
  const lines = [header.join(",")];

  pairs.forEach((p) => {
    lines.push(
      [p.modelLabel, p.modelId, p.transcriptLabel, p.transcriptId]
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
  link.download = "selected_transcripts.csv";
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

function ExpandedSelectionsTable({ pairs }: { pairs: SelectionPair[] }) {
  return (
    <div>
      <div style={{ marginBottom: 8, textAlign: "right" }}>
        <button type="button" onClick={() => downloadPairsCsv(pairs)}>
          Download CSV
        </button>
      </div>
      <div style={{ maxHeight: 400, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>Model</th>
              <th style={thStyle}>Transcript</th>
            </tr>
          </thead>
          <tbody>
            {pairs.map((p) => (
              <tr key={p.key}>
                <td style={tdStyle}>{p.modelLabel}</td>
                <td style={tdStyle}>{p.transcriptLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ExpandedSelectionsTable;
