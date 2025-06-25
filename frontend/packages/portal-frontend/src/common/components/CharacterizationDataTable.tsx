import React, { useState, useEffect } from "react";
import { getUrlPrefix } from "@depmap/globals";
import WideTable from "@depmap/wide-table";

let relativeUrlPrefix = getUrlPrefix();

if (relativeUrlPrefix === "/") {
  relativeUrlPrefix = "";
}

const urlPrefix = `${window.location.protocol}//${window.location.host}${relativeUrlPrefix}`;

interface Props {
  id: string;
  physicalUnit: string;
  characterization: string;
}

function TableData({ id, physicalUnit, characterization }: Props) {
  const [data, setData] = useState([]);
  const [columnNames, setColumnNames] = useState([]);
  const [defaultColumnsToShow, setDefaultColumns] = useState([]);
  const [downloadURL, setDownloadURL] = useState("");
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<string | null>(null);

  const columns = columnNames
    .filter((name) => name !== "Oncogenic" && name !== "Mutation Effect")
    .map((name) => {
      return {
        accessor: name,
        Cell: ({ row, value }: any) => {
          const origValue = data[row.index][name] as any;

          if (origValue.type === "link") {
            return <a href={origValue.url}>{origValue.name}</a>;
          }
          // Handle boolean display
          if (typeof origValue === "boolean") {
            return origValue ? "True" : "False";
          }
          return value;
        },
      };
    });

  const formattedData = data.map((row) => {
    const nextRow: Record<string, unknown> = {};

    Object.entries(row).forEach(([columnName, value]) => {
      if (typeof value === "object") {
        // eslint-disable-next-line react/prop-types
        nextRow[columnName] = (value as any).name;
      } else {
        nextRow[columnName] = value;
      }
    });

    return nextRow;
  });

  useEffect(() => {
    const URL = `${urlPrefix}/${physicalUnit}/${characterization}/${id}`;
    fetch(URL)
      .then((res) => res.json())
      .then((response) => {
        setData(response.data);
        setColumnNames(response.columns);
        setDefaultColumns(response.default_columns_to_show);
        setDownloadURL(response.download_url);
        if (response.sort_col) {
          setSortCol(response.sort_col);
        }
        if (response.sort_order) {
          setSortOrder(response.sort_order);
        }
      });
  }, [id, physicalUnit, characterization]);
  if (
    data.length === 0 ||
    columns.length === 0 ||
    defaultColumnsToShow.length === 0
  ) {
    return null;
  }

  const initialSorted = sortCol
    ? [{ id: sortCol, desc: sortOrder === "desc" }]
    : [];

  return (
    <WideTable
      data={formattedData}
      columns={columns}
      defaultColumnsToShow={defaultColumnsToShow}
      downloadURL={downloadURL}
      sorted={initialSorted}
    />
  );
}

export default TableData;
