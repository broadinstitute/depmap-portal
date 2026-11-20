import React, { useMemo, useState } from "react";
import styles from "./FilesTable.scss";
import { ReleaseFile } from "@depmap/types";

interface FilesTableProps {
  files: ReleaseFile[];
}

/**
 * Maximum number of plain-text characters (excluding HTML tags) shown in a
 * file description before it collapses behind a "Show more" toggle.
 */
const COLLAPSE_THRESHOLD = 110;

interface TruncatedHtmlResult {
  html: string;
  isTruncated: boolean;
}

// From here until line 106: Generated with the help of Gemini. The file descriptions are html blobs
// instead of strings. the following functions calculate when the html is tall enough to warrant a "See More"
// button using a maximum character count threshold. It also truncates the html nodes to generate the "collapsed"
// version of HTML that the user sees when "See more" is an option.
interface CharBudget {
  remaining: number;
}

const truncateTextAtWordBoundary = (text: string, maxChars: number): string => {
  const sliced = text.slice(0, maxChars);
  const lastSpaceIndex = sliced.lastIndexOf(" ");
  const cleanCut =
    lastSpaceIndex > 0 ? sliced.slice(0, lastSpaceIndex) : sliced;

  return `${cleanCut.trimEnd()}...`;
};

const truncateTextNode = (node: Node, budget: CharBudget): Text => {
  const text = node.textContent ?? "";

  if (text.length <= budget.remaining) {
    budget.remaining -= text.length;
    return document.createTextNode(text);
  }

  const truncatedText = truncateTextAtWordBoundary(text, budget.remaining);
  budget.remaining = 0;

  return document.createTextNode(truncatedText);
};

const truncateHtmlNodes = (node: Node, budget: CharBudget): Node | null => {
  if (budget.remaining <= 0) {
    return null;
  }

  if (node.nodeType === Node.TEXT_NODE) {
    return truncateTextNode(node, budget);
  }

  if (node.nodeType === Node.ELEMENT_NODE) {
    const clonedElement = node.cloneNode(false);

    for (const child of Array.from(node.childNodes)) {
      if (budget.remaining <= 0) {
        break;
      }

      const truncatedChild = truncateHtmlNodes(child, budget);
      if (truncatedChild) {
        clonedElement.appendChild(truncatedChild);
      }
    }

    return clonedElement;
  }

  return null;
};

const getTruncatedHtml = (
  rawHtml: string,
  maxLength: number
): TruncatedHtmlResult => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml, "text/html");
  const totalTextLength = (doc.body.textContent ?? "").trim().length;

  if (totalTextLength <= maxLength) {
    return { html: rawHtml, isTruncated: false };
  }

  const container = document.createElement("div");
  const budget: CharBudget = { remaining: maxLength };

  for (const child of Array.from(doc.body.childNodes)) {
    if (budget.remaining <= 0) {
      break;
    }
    const truncatedChild = truncateHtmlNodes(child, budget);
    if (truncatedChild) {
      container.appendChild(truncatedChild);
    }
  }

  return { html: container.innerHTML, isTruncated: true };
};

const FilesTable: React.FC<FilesTableProps> = ({ files }) => {
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const processedRows = useMemo(
    () =>
      files.map((file, fileIndex) => {
        const rowKey = `${file.id ?? file.file_name ?? "file"}-${fileIndex}`;
        const truncated = file.description
          ? getTruncatedHtml(file.description, COLLAPSE_THRESHOLD)
          : { html: "", isTruncated: false };

        return {
          file,
          rowKey,
          previewHtml: truncated.html,
          isTruncated: truncated.isTruncated,
        };
      }),
    [files]
  );

  if (files.length === 0) {
    return (
      <div className={styles.emptyMessage}>
        No files found matching your search criteria.
      </div>
    );
  }

  const collapsibleKeys = processedRows
    .filter((row) => row.isTruncated)
    .map((row) => row.rowKey);

  const allExpanded =
    collapsibleKeys.length > 0 &&
    collapsibleKeys.every((key) => Boolean(expandedRows[key]));

  const handleToggleAll = () => {
    if (allExpanded) {
      setExpandedRows({});
      return;
    }

    const nextState: Record<string, boolean> = {};
    collapsibleKeys.forEach((key) => {
      nextState[key] = true;
    });
    setExpandedRows(nextState);
  };

  const toggleRow = (rowKey: string) => {
    setExpandedRows((prev) => ({
      ...prev,
      [rowKey]: !prev[rowKey],
    }));
  };

  const handleDescriptionContainerClick = (
    event: React.MouseEvent<HTMLDivElement>,
    rowKey: string,
    isTruncated: boolean
  ) => {
    if (!isTruncated) {
      return;
    }

    const target = event.target as HTMLElement;
    if (target.closest("a") || target.closest("button")) {
      return;
    }

    toggleRow(rowKey);
  };

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.filesTable}>
        <thead>
          <tr>
            <th>File Name</th>
            <th>Data Types</th>
            <th>Size</th>
            <th>
              <div className={styles.descriptionHeader}>
                <span>Description</span>
              </div>
            </th>
            <th>Download</th>
          </tr>
        </thead>
        <tbody>
          {processedRows.map(({ file, rowKey, previewHtml, isTruncated }) => {
            const downloadHref = file.bucket_url;
            const isExpanded = Boolean(expandedRows[rowKey]);

            return (
              <tr key={rowKey}>
                <td className={styles.file_nameCell} title={file.file_name}>
                  {file.file_name}
                </td>
                <td>
                  {file.datatypes && file.datatypes.length > 0 ? (
                    <div className={styles.datatypeBadges}>
                      {file.datatypes.map((datatype: string) => (
                        <span key={datatype} className={styles.datatypeBadge}>
                          {datatype}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className={styles.placeholderDash}>—</span>
                  )}
                </td>
                <td className={styles.sizeCell}>
                  {file.size ? file.size : "—"}
                </td>
                <td className={styles.descriptionCell}>
                  {file.description ? (
                    <div
                      className={`${styles.descriptionWrapper} ${
                        isTruncated ? styles.descriptionCollapsible : ""
                      }`}
                      onClick={(event) =>
                        handleDescriptionContainerClick(
                          event,
                          rowKey,
                          isTruncated
                        )
                      }
                    >
                      <div
                        className={styles.descriptionText}
                        dangerouslySetInnerHTML={{
                          __html:
                            isExpanded || !isTruncated
                              ? file.description
                              : previewHtml,
                        }}
                      />

                      {isTruncated && (
                        <button
                          type="button"
                          className={styles.toggleDescriptionButton}
                          aria-expanded={isExpanded}
                          onClick={() => toggleRow(rowKey)}
                        >
                          <span>{isExpanded ? "Show less" : "Show more"}</span>
                          <span
                            className={`glyphicon glyphicon-chevron-down ${
                              isExpanded ? styles.toggleChevronExpanded : ""
                            }`}
                            aria-hidden="true"
                          />
                        </button>
                      )}
                    </div>
                  ) : (
                    <span className={styles.placeholderDash}>—</span>
                  )}
                </td>
                <td className={styles.downloadCell}>
                  {downloadHref ? (
                    <a
                      href={downloadHref}
                      download
                      className={styles.downloadButton}
                    >
                      Download
                    </a>
                  ) : (
                    <span className={styles.unavailableText}>Unavailable</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default FilesTable;
