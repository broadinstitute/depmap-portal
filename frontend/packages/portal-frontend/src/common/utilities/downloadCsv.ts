export default function downloadCsv(
  data: Record<string, any[]>,
  idColumn: string,
  filename: string,
  visiblePoints?: boolean[]
) {
  const keys = Object.keys(data);
  const header = keys.sort((key) => (key === idColumn ? -1 : 1));

  const otherRows = data[keys[0]]
    .map((_, i) => header.map((key) => data[key][i]))
    .filter((_, i) => visiblePoints?.[i] ?? true)
    .map((row) =>
      row
        // represent null values as NA
        .map((value) =>
          value === null || value === undefined || Number.isNaN(value)
            ? "NA"
            : value
        )
        // if the value contains commas, wrap it in quotes
        .map((value) =>
          typeof value === "string" && value.indexOf(",") > 1
            ? `"${value}"`
            : value
        )
    );

  const csv = [header, ...otherRows].join("\r\n");
  const link = document.createElement("a");
  link.href = `data:text/csv,${encodeURIComponent(csv)}`;
  link.download = filename;

  link.click();
}
