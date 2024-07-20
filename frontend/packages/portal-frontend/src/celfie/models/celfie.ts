enum TopFeatureValue {
  AbsCorrelation = "absolute_correlation",
  MaxCorrelation = "max_correlation",
  MinCorrelation = "min_correlation",
  NegLogP = "-log10(P)",
}

export default TopFeatureValue;

export type ColorByOption = "effect" | "-log10(P)" | "direction" | "task";
