import React, { useEffect, useState } from "react";
import { pluralize } from "../../../../utils/misc";
import { Expr } from "../../utils/expressionUtils";
import useDimensionType from "../../hooks/useDimensionType";
import useMatches from "../../hooks/useMatches";

interface Props {
  expr: Expr;
  className?: string;
  showNumCandidates?: boolean;
  isGroupTotal?: boolean;
}

const LoadingAnimation = () => {
  const [numDots, setNumDots] = useState(1);

  useEffect(() => {
    const interval = setInterval(() => {
      setNumDots((n) => (n % 3) + 1);
    }, 250);

    return () => clearInterval(interval);
  }, []);

  return ".".repeat(numDots);
};

function NumberOfMatches({
  expr,
  className = "",
  showNumCandidates = false,
  isGroupTotal = false,
}: Props) {
  const { dimensionType } = useDimensionType();
  const { numMatches, numCandidates, isLoading, hasError } = useMatches(expr);

  if (hasError) {
    return (
      <div className={className} style={{ color: "#a94442" }}>
        error
      </div>
    );
  }

  if (numMatches === null && !isLoading) {
    return null;
  }

  if (!showNumCandidates) {
    return (
      <div className={className}>
        {isLoading ? <LoadingAnimation /> : numMatches?.toLocaleString()}{" "}
        {isGroupTotal ? "grouped " : ""}
        {numMatches === 1 ? "match" : "matches"}
      </div>
    );
  }

  if (numCandidates === null) {
    return null;
  }

  const entity = dimensionType?.display_name || "";
  const entities = entity ? pluralize(entity) : "";

  return (
    <div className={className}>
      {isLoading ? <LoadingAnimation /> : <b>{numMatches?.toLocaleString()}</b>}
      {" of "}
      {numCandidates.toLocaleString()} {numCandidates === 1 ? entity : entities}
    </div>
  );
}

export default NumberOfMatches;
