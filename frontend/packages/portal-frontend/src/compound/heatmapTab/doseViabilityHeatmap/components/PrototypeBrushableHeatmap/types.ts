import ExtendedPlotType from "src/plot/models/ExtendedPlotType";

export interface StaticHeatmapProps {
  data: {
    x: (string | number)[];
    y: (string | number)[];
    z: (number | null)[][];
    customdata?: any[][];
  };
  xAxisTitle?: string;
  yAxisTitle: string;
  legendTitle: string;
  hovertemplate?: string | string[];
  onLoad?: (plot: ExtendedPlotType) => void;
}

export interface InteractiveHeatmapProps extends StaticHeatmapProps {
  selectedColumns?: Set<number>;
  interactiveVersion?: boolean;
  onSelectColumnRange?: (start: number, end: number, shiftKey: boolean) => void;
  onClearSelection?: () => void;
}
