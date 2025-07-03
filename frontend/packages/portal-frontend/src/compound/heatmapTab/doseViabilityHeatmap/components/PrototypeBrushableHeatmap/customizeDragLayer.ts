import type { PlotlyHTMLElement } from "plotly.js";

interface Props {
  plot: PlotlyHTMLElement;
  onMouseOut: () => void;
  onChangeInProgressSelection: (start: number, end: number) => void;
  onSelectColumnRange: (start: number, end: number, shiftKey: boolean) => void;
  onClearSelection: () => void;
}

// Hide all of Plotly's default zoom/pan controls that show up on hover
// (since we have our own custom zoom controls).
const hideStandardPlotlyZoomHandles = (plot: PlotlyHTMLElement) => {
  const dragLayer = plot.querySelector(".draglayer") as SVGGElement;

  const rects = dragLayer.querySelectorAll(
    ".drag:not(.nsewdrag)"
  ) as NodeListOf<SVGRectElement>;

  [...rects].forEach((el) => {
    el.style.setProperty("display", "none");
  });
};

const addMouseListeners = ({
  plot,
  onMouseOut,
  onChangeInProgressSelection,
  onSelectColumnRange,
  onClearSelection,
}: Props) => {
  const dragLayer = plot.querySelector(".draglayer") as SVGGElement;
  const zoomLayer = plot.querySelector(".zoomlayer") as SVGGElement;

  dragLayer.addEventListener("mouseout", onMouseOut);

  const createSelectionOutlinePath = (outlineClass: string) => {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const className = `select-outline ${outlineClass} select-outline-xy`;
    path.setAttribute("class", className);
    path.setAttribute("fill-rule", "evenodd");
    return path;
  };

  const createSelectionPath = (
    x: number,
    y: number,
    width: number,
    height: number
  ): string => {
    return `M${x},${y}L${x},${y + height}L${x + width},${y + height}L${
      x + width
    },${y}Z`;
  };

  let isSelecting = false;
  let hasStartedDragging = false;
  let startX = 0;
  let startY = 0;
  let selectionBoxes: SVGPathElement[] = [];

  function getMousePosition(event: MouseEvent) {
    const rect = plot.getBoundingClientRect();

    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  function getRangeFromMousePosition(pos: { x: number }) {
    const x1 = Math.min(startX, pos.x);
    const x2 = x1 + Math.abs(pos.x - startX);

    const dragLayerOffset =
      dragLayer.getBoundingClientRect().left -
      plot.getBoundingClientRect().left;

    const firstCol = Math.round(
      (plot as any)._fullLayout.xaxis.p2l(x1 - dragLayerOffset)
    );

    const lastCol = Math.round(
      (plot as any)._fullLayout.xaxis.p2l(x2 - dragLayerOffset)
    );

    return {
      firstCol: Math.max(0, firstCol),
      lastCol: Math.min((plot as any).data[0].x.length - 1, lastCol),
    };
  }

  dragLayer.addEventListener("mousedown", (event) => {
    if (event.button !== 0) return; // Only left mouse button

    isSelecting = true;
    hasStartedDragging = false;
    const pos = getMousePosition(event);
    startX = pos.x;
    startY = pos.y;

    selectionBoxes = [
      zoomLayer.appendChild(createSelectionOutlinePath("select-outline-1")),
      zoomLayer.appendChild(createSelectionOutlinePath("select-outline-2")),
    ];

    event.preventDefault();
  });

  document.addEventListener("mousemove", (event: MouseEvent) => {
    if (!isSelecting || selectionBoxes.length === 0) return;

    if (!event.shiftKey && !hasStartedDragging) {
      onClearSelection();
    }

    hasStartedDragging = true;

    const pos = getMousePosition(event);
    const { firstCol, lastCol } = getRangeFromMousePosition(pos);
    onChangeInProgressSelection(firstCol, lastCol);

    const currentX = pos.x;
    const currentY = pos.y;

    // Calculate rectangle bounds
    const x = Math.min(startX, currentX);
    const y = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);

    // Update selection boxes
    selectionBoxes.forEach((path) => {
      path.setAttribute("d", createSelectionPath(x, y, width, height));
    });
  });

  document.addEventListener("mouseup", (event) => {
    if (!isSelecting || selectionBoxes.length === 0) return;

    const pos = getMousePosition(event);
    const { firstCol, lastCol } = getRangeFromMousePosition(pos);
    onSelectColumnRange(firstCol, lastCol, event.shiftKey);

    const [box1, box2] = selectionBoxes;
    selectionBoxes = [];
    box1.parentElement?.removeChild(box1);
    box2.parentElement?.removeChild(box2);

    isSelecting = false;
    hasStartedDragging = false;
  });
};

function customizeDragLayer({
  plot,
  onMouseOut,
  onSelectColumnRange,
  onChangeInProgressSelection,
  onClearSelection,
}: Props) {
  if ((plot as any).alreadyConfigured) {
    return;
  }
  addMouseListeners({
    plot,
    onMouseOut,
    onChangeInProgressSelection,
    onSelectColumnRange,
    onClearSelection,
  });

  // eslint-disable-next-line
  (plot as any).alreadyConfigured = true;
}

export default customizeDragLayer;
