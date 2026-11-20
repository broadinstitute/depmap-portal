import React from "react";
import styles from "./FilesTable.scss";
import { ReleaseFile } from "@depmap/types";

interface FilesTableProps {
  files: ReleaseFile[];
}

const FilesTable: React.FC<FilesTableProps> = ({ files }) => {
  if (files.length === 0) {
    return (
      <div className={styles.emptyMessage}>
        No files found matching your search criteria.
      </div>
    );
  }

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.filesTable}>
        <thead>
          <tr>
            <th>File Name</th>
            <th>Tags</th>
            <th>Size</th>
            <th>Description</th>
            <th>Download</th>
          </tr>
        </thead>
        <tbody>
          {files.map((file, fileIndex) => (
            <tr key={file.id ?? file.file_name ?? fileIndex}>
              <td className={styles.fileNameCell}>{file.file_name}</td>
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
              <td className={styles.sizeCell}>{file.size ? file.size : "—"}</td>
              <td className={styles.descriptionCell}>
                {file.description ? (
                  <div
                    dangerouslySetInnerHTML={{
                      __html: file.description,
                    }}
                  />
                ) : (
                  <span className={styles.placeholderDash}>—</span>
                )}
              </td>
              <td className={styles.downloadCell}>
                {file.bucket_url ? (
                  <a
                    href={file.bucket_url}
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
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default FilesTable;
