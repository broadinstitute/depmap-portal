import React from "react";
import { Spinner } from "@depmap/common-components/src/components/Spinner";

function LoadingSpinner() {
  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <Spinner position="relative" left="-2px" />
    </div>
  );
}

export default LoadingSpinner;
