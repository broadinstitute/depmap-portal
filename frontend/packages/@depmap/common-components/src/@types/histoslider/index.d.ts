// These types are copied from the source of the Histoslider library.
// For whatever reason, they don't export them.
// https://github.com/samhogg/histoslider/blob/8f2d8a5/src/typings/histoslider.d.ts
declare module "histoslider" {
  import * as React from "react";

  interface HistosliderBucket {
    x0: number;
    x: number;
    y: number;
  }

  interface HistosliderProps {
    data: Array<HistosliderBucket>;
    padding?: number;
    width?: number;
    height?: number;
    selection: [number, number];
    keyboardStep?: number;
    labels?: boolean;
    onChange: (selection: [number, number]) => void;

    selectedColor?: string;
    unselectedColor?: string;
    barBorderRadius?: number;

    barStyle?: React.StyleHTMLAttributes<HTMLStyleElement>;
    histogramStyle?: React.StyleHTMLAttributes<HTMLStyleElement>;
    sliderStyle?: React.StyleHTMLAttributes<HTMLStyleElement>;

    showOnDrag?: boolean;
    style?: any;
    handleLabelFormat?: string;
    formatLabelFunction?: (value: number) => string;
    disableHistogram?: boolean;
    showLabels?: boolean;
  }

  // eslint-disable-next-line react/prefer-stateless-function
  class Histoslider extends React.Component<HistosliderProps> {}
  export = Histoslider;
}
