/* eslint-disable */
import * as React from "react";
import { Tooltip, OverlayTrigger } from "react-bootstrap";

export interface StackedBarBar {
  count: number;
  color: string;
  label: string;
}
export interface StackedBarProps {
  bars: StackedBarBar[];
  onBarClick?: (label: string) => void;
}

export class StackedBar extends React.Component<StackedBarProps, any> {
  constructor(props: StackedBarProps) {
    super(props);
  }

  renderBars = () => {
    const bars: any[] = [];
    const sortedBars: StackedBarBar[] = this.props.bars.sort((a, b) =>
      a.count > b.count ? -1 : 1
    );
    const total: number = sortedBars
      .map((bar) => {
        return bar.count;
      })
      .reduce((a, b) => a + b, 0);
    for (let i = 0; i < sortedBars.length; i++) {
      const displayName =
        sortedBars[i].label == "" || sortedBars[i].label == null
          ? "null"
          : sortedBars[i].label;
      const tooltip = (
        <Tooltip
          id={`tooltip${i.toString()}`}
          style={{ backgroundColor: sortedBars[i].color }}
        >
          {displayName}
          <br />
          {sortedBars[i].count} out of {total}
        </Tooltip>
      );
      bars.push(
        <OverlayTrigger placement="top" overlay={tooltip} key={`${i}-bar`}>
          <div
            key={i}
            style={{
              display: "flex",
              flexGrow: sortedBars[i].count,
              backgroundColor: sortedBars[i].color,
            }}
            onClick={() => {
              if (this.props.onBarClick) {
                this.props.onBarClick(sortedBars[i].label);
              }
            }}
          >
            {" "}
          </div>
        </OverlayTrigger>
      );
    }
    return bars;
  };

  render() {
    return (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
        }}
      >
        {this.renderBars()}
      </div>
    );
  }
}
