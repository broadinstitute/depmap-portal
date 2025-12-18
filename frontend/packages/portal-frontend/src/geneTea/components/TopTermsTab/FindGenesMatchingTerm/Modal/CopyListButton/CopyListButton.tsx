import React, { useState } from "react";
import { Button } from "react-bootstrap";
import styles from "./CopyListButton.scss";

interface CopyButtonProps {
  items: string[];
  title: string;
  disabled: boolean;
}

const CopyListButton: React.FC<CopyButtonProps> = ({
  items,
  title,
  disabled,
}) => {
  const [showSuccess, setShowSuccess] = useState(false);

  const handleCopy = async () => {
    try {
      const listString = items.join(",");
      await navigator.clipboard.writeText(listString);

      // Show success message
      setShowSuccess(true);

      // Hide message after 3 seconds
      setTimeout(() => {
        setShowSuccess(false);
      }, 3000);
    } catch (err) {
      console.error("Failed to copy: ", err);
    }
  };

  return (
    <div className={styles.CopyListButton}>
      <Button
        onClick={handleCopy}
        bsStyle={"secondary"}
        className={styles.copyButton}
        disabled={disabled}
      >
        {title}
      </Button>

      {showSuccess && (
        <span className={styles.successMessage}>
          {/* Green Check Mark SVG */}
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ marginRight: "4px" }}
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Copied genes to clipboard!
        </span>
      )}
    </div>
  );
};

export default CopyListButton;
