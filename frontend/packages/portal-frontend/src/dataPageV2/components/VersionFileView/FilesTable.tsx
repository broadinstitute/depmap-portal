import React, { useMemo, useState } from "react";
import styles from "./FilesTable.scss";
import { ReleaseFile } from "@depmap/types";
import { VersionBadge } from "src/dataPage/components/VersionBadge";
import { Markdown } from "@depmap/common-components";

interface FilesTableProps {
  files: ReleaseFile[];
}

/**
 * Maximum number of plain-text characters (excluding HTML tags) shown in a
 * file description before it collapses behind a "Show more" toggle.
 */
const COLLAPSE_THRESHOLD = 110;

// From here until line 123: Generated with the help of Gemini. The file descriptions are html blobs
// instead of strings. the following functions calculate when the html is tall enough to warrant a "See More"
// button using a maximum character count threshold. It also truncates the html nodes to generate the "collapsed"
// version of HTML that the user sees when "See more" is an option.
interface TruncatedHtmlResult {
  html: string;
  isTruncated: boolean;
}

interface TruncationResult {
  node: Node | null;
  remaining: number;
}

const truncateTextAtWordBoundary = (text: string, maxChars: number): string => {
  const sliced = text.slice(0, maxChars);
  const lastSpaceIndex = sliced.lastIndexOf(" ");
  const cleanCut =
    lastSpaceIndex > 0 ? sliced.slice(0, lastSpaceIndex) : sliced;

  return `${cleanCut.trimEnd()}...`;
};

const truncateTextNode = (
  node: Node,
  remainingChars: number
): { node: Text; remaining: number } => {
  const text = node.textContent ?? "";

  if (text.length <= remainingChars) {
    return {
      node: document.createTextNode(text),
      remaining: remainingChars - text.length,
    };
  }

  return {
    node: document.createTextNode(
      truncateTextAtWordBoundary(text, remainingChars)
    ),
    remaining: 0,
  };
};

const truncateHtmlNodes = (
  node: Node,
  remainingChars: number
): TruncationResult => {
  if (remainingChars <= 0) {
    return { node: null, remaining: 0 };
  }

  if (node.nodeType === Node.TEXT_NODE) {
    return truncateTextNode(node, remainingChars);
  }

  if (node.nodeType === Node.ELEMENT_NODE) {
    const clonedElement = node.cloneNode(false);
    let currentRemaining = remainingChars;

    for (const child of Array.from(node.childNodes)) {
      if (currentRemaining <= 0) {
        break;
      }

      const result = truncateHtmlNodes(child, currentRemaining);
      currentRemaining = result.remaining;

      if (result.node) {
        clonedElement.appendChild(result.node);
      }
    }

    return { node: clonedElement, remaining: currentRemaining };
  }

  return { node: null, remaining: remainingChars };
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
  let remainingChars = maxLength;

  for (const child of Array.from(doc.body.childNodes)) {
    if (remainingChars <= 0) {
      break;
    }

    const result = truncateHtmlNodes(child, remainingChars);
    remainingChars = result.remaining;

    if (result.node) {
      container.appendChild(result.node);
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

  const toggleRow = (rowKey: string) => {
    setExpandedRows((prev) => ({
      ...prev,
      [rowKey]: !prev[rowKey],
    }));
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
                <td className={styles.fileNameCell} title={file.file_name}>
                  <div className={styles.fileNameWrapper}>
                    <span className={styles.fileNameText}>
                      {file.file_name}
                    </span>
                    {file.version && (
                      <VersionBadge versionNumber={file.version} />
                    )}
                  </div>
                </td>
                <td>
                  {file.tags && file.tags.length > 0 ? (
                    <div className={styles.datatypeBadges}>
                      {file.tags.map((datatype: string) => (
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
                    <div className={styles.descriptionWrapper}>
                      <Markdown className={styles.descriptionText}>
                        {isExpanded || !isTruncated
                          ? file.description
                          : previewHtml}
                      </Markdown>

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
