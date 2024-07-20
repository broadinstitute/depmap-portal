/* eslint-disable */
import React, { ChangeEvent } from "react";
import memoize from "lodash.memoize";
import Histoslider from "histoslider"; // https://github.com/samhogg/histoslider

interface Bins {
  x0: number; // start of bin
  x: number; // end of bin
  y: number; // count in bin
}

interface BasicProps {
  width: number;
  height: number;
  selectedColor?: string;
  rangeHandler: (lower: number, upper: number) => void;
  rawNums: readonly number[];
  numBins?: number;
  step?: number;
  disableHistogram?: boolean;
}

// Passing a `selection` prop rather than a `defaultSelection` prop will cause
// the component to be controlled.
interface ControlledProps extends BasicProps {
  selection: [number, number];
  defaultSelection?: never;
}

// Passing a `defaultSelection` prop rather than a `selection` prop will cause
// the component to be uncontrolled.
interface UncontrolledProps extends BasicProps {
  selection?: never;
  defaultSelection: [number, number];
}

type HistosliderContainerProps = ControlledProps | UncontrolledProps;

interface HistosliderContainerState {
  selection: [number, number];
  swapped: boolean;
}

const EPSILON = 0.000000001;

const numArrayToBins = memoize(
  ({
    nums,
    numBins,
  }: {
    nums: readonly number[];
    numBins: number;
  }): Array<Bins> => {
    const min: number = nums.reduce((a, b) => {
      return Math.min(a, b);
    });
    const max: number = nums.reduce((a, b) => {
      return Math.max(a, b);
    });
    const range = max - min;
    let binSize: number = range / numBins;
    if (range === 0) {
      // handle this pathological case
      binSize = 1;
    }
    const binsArray: Array<Bins> = [];

    for (let i = 0; i < numBins; i++) {
      binsArray.push({
        x0: min + i * binSize,
        x: min + (i + 1) * binSize,
        y: 0,
      });
    }

    const sortedArray = [...nums].sort();
    for (let i = 0; i < nums.length; i++) {
      let index: number = Math.floor((sortedArray[i] - min) / binSize);
      if (index === binsArray.length) {
        index = binsArray.length - 1;
      }
      binsArray[index].y = binsArray[index].y + 1;
    }

    return binsArray;
  }
);

const minMax = memoize((nums: readonly number[]) => {
  const data = nums.filter((n) => typeof n === "number");

  return {
    min: Math.min(...data),
    max: Math.max(...data),
  };
});

export class HistosliderContainer extends React.Component<
  HistosliderContainerProps,
  HistosliderContainerState
> {
  static defaultProps = {
    selectedColor: "#0174d9",
    disableHistogram: false,
  };

  state = {
    selection: this.props.defaultSelection || this.props.selection,

    // This 2-valued slider allows for the interesting ability to drag the min
    // right past the max, thus turning it into the new max. This `swapped`
    // value tracks when we're in this state.
    swapped: false,
  };

  lastRaf = 0;

  setSelection(selection: [number, number]) {
    window.cancelAnimationFrame(this.lastRaf);

    this.lastRaf = window.requestAnimationFrame(() => {
      this.setState({
        selection,
        swapped: selection[0] > selection[1],
      });

      const min: number = Math.min(selection[0], selection[1]);
      const max: number = Math.max(selection[0], selection[1]);
      this.props.rangeHandler(min, max);
    });
  }

  render() {
    const numBins = this.props.numBins
      ? this.props.numBins
      : Math.ceil(Math.log2(this.props.rawNums.length) + 1);

    // these are the min and max of the user's current selection
    const min: number = Math.min(
      ...(this.props.selection || this.state.selection)
    );
    const max: number = Math.max(
      ...(this.props.selection || this.state.selection)
    );

    // these are the min and max of the raw data that was passed in via props
    const { min: minFromData, max: maxFromData } = minMax(this.props.rawNums);

    const precision = this.props.step === 1 ? 0 : 3;

    const round = (n: number) => {
      if (Math.abs(n - minFromData) < EPSILON) {
        return minFromData;
      }

      if (Math.abs(n - maxFromData) < EPSILON) {
        return maxFromData;
      }

      return Math.round(n * Math.pow(10, precision)) / Math.pow(10, precision);
    };

    const keyboardStep = this.props.step || 0.01;

    const bins = numArrayToBins({
      nums: this.props.rawNums.filter((n) => typeof n === "number"),
      numBins,
    });

    return (
      <div style={{ height: this.props.height }}>
        <Histoslider
          data={bins}
          onChange={(sel) => {
            if (sel !== null) {
              sel = [round(sel[0]), round(sel[1])];
              this.setSelection(sel);
            }
          }}
          width={this.props.width}
          height={this.props.height - 20}
          selectedColor={this.props.selectedColor}
          selection={this.state.swapped ? [max, min] : [min, max]}
          keyboardStep={keyboardStep}
          disableHistogram={this.props.disableHistogram}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            width: this.props.width,
          }}
        >
          <input
            id="minEntry"
            type="number"
            style={{ height: "2em", width: "75px" }}
            value={min}
            min={Math.round(minFromData * 1000) / 1000}
            max={Math.round(maxFromData * 1000) / 1000}
            step={keyboardStep}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              this.setSelection([round(Number(event.target.value)), max])
            }
          />

          <input
            id="maxEntry"
            type="number"
            style={{ height: "2em", width: "75px" }}
            value={max}
            min={Math.round(minFromData * 1000) / 1000}
            max={Math.round(maxFromData * 1000) / 1000}
            step={keyboardStep}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              this.setSelection([min, round(Number(event.target.value))])
            }
          />
        </div>
      </div>
    );
  }
}
