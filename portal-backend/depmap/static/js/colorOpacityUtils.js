function getHighlightOpacity(cellLine, cellLinesToHighlight) {
  if (cellLinesToHighlight.has(cellLine)) {
    return 1;
  } else {
    return 0.5;
  }
}
