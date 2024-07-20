/* eslint-disable */
import * as React from "react";
import { SaveCellLinesModal } from "@depmap/interactive";
import { CSVLink } from "react-csv";

export interface ButtonGroupProps {
  showGenerateUrl: boolean;
  generateUrl: () => void;
  csvDownloadData: Array<Record<string, string | number>>;
  csvDownloadFilename: string;
  onShowCustomCsv: () => void;
  showCustomTaiga: boolean;
  onShowCustomTaiga: () => void;
  showSearchForAssociations: boolean;
  searchForAssociations: () => void;
  saveCellLineSet?: (name: string) => void;
  renderOpenInDE2Button: () => React.ReactNode;
}

export interface DownloadButtonProps {
  csvData: Array<Record<string, string | number>>;
  filename: string;
}

export interface ClickButtonProps {
  onClick: () => void;
}

export interface CheckboxProps {
  checked: boolean;
  handleChange: (event: React.FormEvent<HTMLInputElement>) => void;
  label: string;
  name: string;
  disabled?: boolean;
  indeterminate?: boolean;
}

export interface RadioGroupProps {
  radios: Array<RadioProps>;
}

interface RadioProps {
  checked: boolean;
  label: string;
  value: string;
  handleChange: (event: React.FormEvent<HTMLInputElement>) => void;
}

export class ButtonGroup extends React.Component<ButtonGroupProps, any> {
  constructor(props: any) {
    super(props);
    this.state = {
      showSaveCellLinesModal: false,
    };
  }

  openSaveCellLinesModal = () => {
    this.setState({ showSaveCellLinesModal: true });
  };

  closeSaveCellLinesModal = () => {
    this.setState({ showSaveCellLinesModal: false });
  };

  saveCellLineSet = (name: string) => {
    this.closeSaveCellLinesModal();
    this.props.saveCellLineSet?.(name);
  };

  render() {
    return (
      <div>
        <div className="btn-toolbar">
          {this.props.showGenerateUrl && (
            <UrlButton onClick={this.props.generateUrl} />
          )}
          {this.props.showCustomTaiga && (
            <CustomTaigaButton onClick={this.props.onShowCustomTaiga} />
          )}
          <CustomCsvButton onClick={this.props.onShowCustomCsv} />
          <PlotPointsCsvButton
            csvData={this.props.csvDownloadData}
            filename={this.props.csvDownloadFilename}
          />
          {this.props.renderOpenInDE2Button()}
          {this.props.saveCellLineSet && (
            <SaveCellLinesButton onClick={this.openSaveCellLinesModal} />
          )}
        </div>

        <SaveCellLinesModal
          showModal={this.state.showSaveCellLinesModal}
          onHide={this.closeSaveCellLinesModal}
          onSubmit={this.saveCellLineSet}
        />
      </div>
    );
  }
}

class SaveCellLinesButton extends React.Component<ClickButtonProps, any> {
  render() {
    return (
      <button
        type="button"
        onClick={this.props.onClick}
        className="btn btn-default btn-sm"
      >
        Save selected cell lines
      </button>
    );
  }
}

export class SwapXYButton extends React.Component<ClickButtonProps, any> {
  render() {
    return (
      <button
        type="button"
        onClick={this.props.onClick}
        className="btn btn-default btn-sm swapxy-button"
      >
        <span className="glyphicon glyphicon-transfer" aria-hidden="true" />
      </button>
    );
  }
}

export class Checkbox extends React.Component<CheckboxProps, any> {
  componentDidMount() {
    this.el.indeterminate = this.props.indeterminate;
  }

  componentDidUpdate(prevProps: CheckboxProps) {
    if (prevProps.indeterminate !== this.props.indeterminate) {
      this.el.indeterminate = this.props.indeterminate;
    }
  }

  el: any;

  render() {
    return (
      <div className="checkbox" style={{ margin: 0 }}>
        <label>
          <input
            type="checkbox"
            name={this.props.name}
            checked={this.props.checked}
            onChange={this.props.handleChange}
            disabled={this.props.disabled}
            ref={(el) => (this.el = el)}
          />
          {this.props.label}
        </label>
      </div>
    );
  }
}

export class RadioGroup extends React.Component<RadioGroupProps, any> {
  render() {
    const radios = this.props.radios.map((radio) => (
      <Radio key={radio.value} {...radio} />
    ));
    return (
      <div className="radio" style={{ margin: 0 }}>
        {radios}
      </div>
    );
  }
}

class Radio extends React.Component<RadioProps, any> {
  render() {
    return (
      <label className="radio-inline">
        <input
          type="radio"
          value={this.props.value}
          checked={this.props.checked}
          onChange={this.props.handleChange}
        />
        {this.props.label}
      </label>
    );
  }
}

export class UrlButton extends React.Component<ClickButtonProps, any> {
  render() {
    return (
      <button
        type="button"
        onClick={this.props.onClick}
        className="btn btn-default btn-sm"
      >
        {"Get URL "}
        <span className="glyphicon glyphicon-link" aria-hidden="true" />
      </button>
    );
  }
}

class CustomTaigaButton extends React.Component<ClickButtonProps, any> {
  render() {
    return (
      <button
        type="button"
        onClick={this.props.onClick}
        className="btn btn-default btn-sm"
      >
        Plot from Taiga
      </button>
    );
  }
}

class CustomCsvButton extends React.Component<ClickButtonProps, any> {
  render() {
    return (
      <button
        type="button"
        onClick={this.props.onClick}
        className="btn btn-default btn-sm"
      >
        Plot from CSV
      </button>
    );
  }
}

class PlotPointsCsvButton extends React.Component<DownloadButtonProps, any> {
  render() {
    return (
      <CSVLink data={this.props.csvData} filename={this.props.filename}>
        <button type="button" className="btn btn-default btn-sm">
          {"Download plot data "}
          <span
            className="glyphicon glyphicon-download-alt"
            aria-hidden="true"
          />
        </button>
      </CSVLink>
    );
  }
}

export class AssociationsCsvButton extends React.Component<
  ClickButtonProps,
  any
> {
  render() {
    return (
      <button
        type="button"
        onClick={this.props.onClick}
        className="btn btn-default btn-sm"
      >
        {"Download table "}
        <span className="glyphicon glyphicon-download-alt" aria-hidden="true" />
      </button>
    );
  }
}

class CustomAnalysesButton extends React.Component<ClickButtonProps, any> {
  render() {
    return (
      <button
        type="button"
        onClick={this.props.onClick}
        className="btn btn-primary btn-sm custom-assoc-btn"
      >
        {"Custom Analyses "}
        <i style={{ color: "#ffc107", fontSize: "8pt" }}>BETA</i>
      </button>
    );
  }
}
