import {
  getHighlightOpacity,
  getHighlightLineWidth,
  getHighlightSymbol,
  mutationNumToColor,
} from "@depmap/utils";

export class HoverInfo {
  anchorSelector: string;

  text: string;

  constructor(anchorSelector: string, text: string) {
    this.anchorSelector = anchorSelector;
    this.text = text;
  }

  appendTo(targetSelector: string) {
    const hoverElement = $(
      `<span class="entitySummaryHoverInfo glyphicon glyphicon-info-sign" aria-hidden="true" data-toggle="tooltip" data-html="true" data-placement="right" data-anchor-selector="${this.anchorSelector}" title="${this.text}" style="position: absolute;"></span>`
    );
    const target = $(targetSelector);
    target.append(hoverElement);

    // activate tooltip
    $(`${targetSelector} > span.entitySummaryHoverInfo`).tooltip();
  }

  static positionAll() {
    const allHoverInfo: HTMLElement[] = $("span.entitySummaryHoverInfo").get();

    allHoverInfo.forEach((hoverInfo) => {
      const anchorSelector = hoverInfo.getAttribute(
        "data-anchor-selector"
      ) as string;
      HoverInfo.positionElementToRight($(hoverInfo), $(anchorSelector));
    });
  }

  static positionElementToRight(
    element: JQuery<HTMLElement>,
    anchor: JQuery<HTMLElement>
  ) {
    const offset = anchor.offset();
    const domrect = anchor[0].getBoundingClientRect();

    if (offset) {
      element.offset({
        top: offset.top + 1,
        left: offset.left + domrect.width + 4,
      });
    }
  }
}

export const getEntitySummaryStripHighlightData = (
  cellLines: string[],
  cellLinesToHighlight: Set<string>,
  mutationNums: number[],
  size: any,
  entityType = "gene"
) => {
  /**
   * This function deals with the combination of cellLinesToHighlight and mutationNums producing color and opacity, in anticipation that the four will be intertwined
   * Right now, opacity is determined by both cellLinesToHighlight and mutationNums
   * We anticipate the possibility that color may also be a combination of both.
   * E.g. make mutation blue, if the cell line is highlighted make it a brighter blue
   */
  const opacity = [];
  const color = [];
  const line = [];
  let symbol: any[] = [];

  for (let i = 0; i < cellLines.length; i += 1) {
    if (cellLinesToHighlight.size > 0) {
      // if highlighted group is specified
      opacity.push(getHighlightOpacity(cellLines[i], cellLinesToHighlight));
      line.push(getHighlightLineWidth(cellLines[i], cellLinesToHighlight));
      symbol.push(getHighlightSymbol(cellLines[i], cellLinesToHighlight));
    } else {
      // no cell lines specified to highlight, opacity is determined by mutation
      if (mutationNums[i] === 0) {
        opacity.push(0.7);
      } else {
        opacity.push(1);
      }
      symbol = cellLines.map(() => "circle");
    }

    color.push(mutationNumToColor(mutationNums[i], entityType));
  }

  size.forEach((s: any, i: number) => {
    if (s === null) {
      symbol[i] = `${symbol[i]}-open`;
    }
  });

  return {
    opacity,
    line,
    symbol,
    color,
  };
};
