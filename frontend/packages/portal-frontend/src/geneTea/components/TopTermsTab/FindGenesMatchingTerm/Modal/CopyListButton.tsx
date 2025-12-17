import React, { useState } from "react";
import { Button } from "react-bootstrap";

interface CopyButtonProps {
  items: string[];
  title: string;
}

const CopyListButton: React.FC<CopyButtonProps> = ({ items }) => {
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
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <Button
        onClick={handleCopy}
        bsStyle={"secondary"}
        style={{ cursor: "pointer" }}
      >
        Copy List
      </Button>

      {showSuccess && (
        <span
          style={{
            color: "#2e7d32",
            display: "flex",
            alignItems: "center",
            fontSize: "14px",
            fontWeight: "500",
          }}
        >
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
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          Copied genes to clipboard!
        </span>
      )}
    </div>
  );
};

export default CopyListButton;
