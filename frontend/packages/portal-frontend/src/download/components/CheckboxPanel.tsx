import * as React from "react";
import { enabledFeatures } from "@depmap/globals";
import { Checkbox, CheckboxProps } from "@depmap/common-components";
import { Collapse, Button } from "react-bootstrap";

export interface CheckboxPanelProps {
  fileType: CheckboxGroupProps;
  releaseGroup: CheckboxGroupByTypeProps;
  source: CheckboxGroupProps;
  showUnpublished: {
    selected: boolean;
    handleChange: (event: React.FormEvent<HTMLInputElement>) => void;
  };
}

interface CheckboxGroupProps extends CommonCheckboxGroupProps {
  options: Array<string>;
  label?: string;
}

interface CheckboxGroupByTypeProps extends CommonCheckboxGroupProps {
  typeGroup: Array<TypeGroup>;
}

interface CommonCheckboxGroupProps {
  selected: Set<string>;
  isIndeterminate: boolean;
  handleChange: (event: React.FormEvent<HTMLInputElement>) => void;
}

export interface TypeGroupOption {
  name: string;
  versions?: string[];
}

export interface TypeGroup {
  name: string;
  // TypeGroup name comes from ReleaseType. Each ReleaseType can have options that map to either a releasee
  // name OR a releaseVersionGroup (e.g. DepMap Consortium or DepMap Public).
  options: Array<TypeGroupOption>;
}

export class CheckboxPanel extends React.Component<CheckboxPanelProps, any> {
  render() {
    return (
      <div className="checklist-fontsize checklist-padding">
        <div className="checklist-background">
          {enabledFeatures.private_datasets && (
            <Checkbox
              checked={this.props.showUnpublished.selected}
              handleChange={this.props.showUnpublished.handleChange}
              label="Show unpublished"
              name="Show unpublished"
            />
          )}
        </div>
        <CheckboxGroup {...{ ...this.props.fileType, ...{ label: "Type" } }} />
        <CheckboxGroupByType {...this.props.releaseGroup} />
        <CheckboxGroup
          {...{ ...this.props.source, ...{ label: "Institution" } }}
        />
      </div>
    );
  }
}

class CheckboxGroup extends React.Component<CheckboxGroupProps, any> {
  render() {
    const checkboxes = this.props.options.map((option) => (
      <Checkbox
        key={option}
        checked={this.props.selected.has(option)}
        handleChange={this.props.handleChange}
        label={option}
        name={option}
        indeterminate={this.props.isIndeterminate}
      />
    ));
    return (
      <CheckboxCollapsibleGroup
        checkboxes={checkboxes}
        label={this.props.label || "unknown"}
      />
    );
  }
}

class CheckboxGroupByType extends React.Component<
  CheckboxGroupByTypeProps,
  any
> {
  render() {
    const groupedCheckboxes = this.props.typeGroup.map((typeGroup) => {
      if (typeGroup.options.length > 0) {
        // if there are any options in that typeGroup
        const checkboxes = typeGroup.options.map((option) => (
          <Checkbox
            key={option.name}
            checked={this.props.selected.has(option.name)}
            handleChange={this.props.handleChange}
            label={option.name}
            name={option.name}
            indeterminate={this.props.isIndeterminate}
          />
        ));
        return (
          <CheckboxCollapsibleGroup
            checkboxes={checkboxes}
            label={typeGroup.name}
            key={typeGroup.name}
          />
        );
      }
    });

    return <div>{groupedCheckboxes}</div>;
  }
}

interface CheckboxCollapsibleGroupProps {
  checkboxes: JSX.Element[];
  label: string;
}
interface CheckboxCollapsibleGroupState {
  open: boolean;
}
class CheckboxCollapsibleGroup extends React.Component<
  CheckboxCollapsibleGroupProps,
  CheckboxCollapsibleGroupState
> {
  constructor(props: any) {
    super(props);
    this.state = {
      open: true,
    };
  }

  render() {
    const { open } = this.state;
    const arrow = open ? "\u25BC" : "\u25B2";
    return (
      <div>
        <div
          style={{
            paddingTop: "10px",
            display: "flex",
            flexDirection: "row",
            cursor: "pointer",
          }}
          onClick={() => this.setState({ open: !open })}
          aria-controls="example-collapse-text"
          aria-expanded={open}
        >
          <div style={{ flexBasis: 0, flexGrow: 6 }}>
            <span>
              <strong>{this.props.label}</strong>
            </span>
          </div>
          <div
            style={{
              flexBasis: 0,
              flexGrow: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            {arrow}
          </div>
        </div>

        <Collapse in={this.state.open}>
          <div id="example-collapse-text">{this.props.checkboxes}</div>
        </Collapse>
      </div>
    );
  }
}
