import * as React from "react";
import Select, { ValueType } from "react-select";
import { FormGroup, ControlLabel, FormControl } from "react-bootstrap";
import { Model } from "src/celligner/models/types";

type Props = {
  cellLines: Array<Model>;
  onCellLineSelected: (cellLine: string, kNeighbors: number) => void;
};

type State = {
  cellLine: string | null;
  kNeighbors: number;
};

export default class CellignerTumorsForCellLineControlPanel extends React.Component<
  Props,
  State
> {
  constructor(props: Props) {
    super(props);
    this.state = {
      cellLine: null,
      kNeighbors: 25,
    };

    this.handleCellLineChange = this.handleCellLineChange.bind(this);
    this.handleKNeighborsChange = this.handleKNeighborsChange.bind(this);
  }

  handleCellLineChange(selection: ValueType<{ value: string }, false>) {
    const { onCellLineSelected } = this.props;
    const { kNeighbors } = this.state;

    this.setState({ cellLine: selection ? selection.value : null });
    if (selection) {
      onCellLineSelected(selection.value, kNeighbors);
    }
  }

  handleKNeighborsChange(
    formEvent: React.FormEvent<FormControl & HTMLInputElement>
  ) {
    const { onCellLineSelected } = this.props;

    const { cellLine } = this.state;

    const kNeighbors = parseInt(formEvent.currentTarget.value, 10);
    this.setState({ kNeighbors });
    if (cellLine) {
      onCellLineSelected(cellLine, kNeighbors);
    }
  }

  render() {
    const { cellLines } = this.props;
    const { kNeighbors } = this.state;
    const options: Array<{ value: string; label: string }> = cellLines.map(
      (cellLine) => {
        return {
          value: cellLine.sampleId || cellLine.displayName,
          label: cellLine.displayName,
        };
      }
    );

    return (
      <div className="control_panel">
        <FormGroup>
          <ControlLabel>1. Select a model</ControlLabel>
          <Select
            options={options}
            onChange={this.handleCellLineChange}
            // defaultValue={cellLines[0].depmap_id || cellLines[0].name}
          />
        </FormGroup>
        <FormGroup controlId="selectK">
          <ControlLabel>2. Select K nearest neighbors</ControlLabel>
          <FormControl
            type="text"
            value={kNeighbors}
            onChange={this.handleKNeighborsChange}
          />
        </FormGroup>
      </div>
    );
  }
}
