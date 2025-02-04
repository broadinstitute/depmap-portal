import * as React from "react";
import Select from "react-select";
import { Popover, OverlayTrigger } from "react-bootstrap";

import { enabledFeatures } from "@depmap/globals";
import { titleCase } from "@depmap/utils";
import { GroupingCategory } from "../models/types";
import { CellLineListsDropdown, CustomList } from "@depmap/cell-line-selector";
import styles from "src/celligner/styles/celligner.scss";

type Props = {
  selectedPrimarySite: string | null;
  onSelectedPrimarySitesChange: (newPrimarySite: string | null) => void;
  subtypes: ReadonlyMap<string, Array<string>>;
  colorByCategory: GroupingCategory;
  onColorByCategoryChange: (newCategory: GroupingCategory) => void;
  onSubtypeSelected: (subtype: string) => void;
  onCellLineListChange: (cellLineList: CustomList) => void;
};

export default class CellignerGraphFilter extends React.Component<Props> {
  lineages: Array<string>;

  constructor(props: Props) {
    super(props);

    this.lineages = Array.from(props.subtypes.keys()).sort();
  }

  handlePrimaryTypeSelected = (
    value: { value: string; label: string } | null
  ) => {
    const { onSelectedPrimarySitesChange } = this.props;
    const selectedPrimarySite = value ? value.value : null;

    onSelectedPrimarySitesChange(selectedPrimarySite);
  };

  handleSubtypeSelected(subtype: string) {
    const { onSubtypeSelected } = this.props;

    onSubtypeSelected(subtype);
  }

  renderSubtypeFilter() {
    const { selectedPrimarySite, subtypes } = this.props;
    const options: Array<{ value: string; label: string }> = [];
    if (selectedPrimarySite) {
      subtypes.get(selectedPrimarySite)?.forEach((v) => {
        options.push({ value: v, label: titleCase(v, true) });
      });
    }
    return (
      <fieldset>
        <label htmlFor="celligner-subtype-filter-cell-lines-for-tumors">
          2. Select subtype to update median distance in table
        </label>
        <Select
          options={options}
          // defaultValue={options.length == 1 && options[0]}
          isDisabled={selectedPrimarySite == null}
          onChange={(value) => {
            if (value) {
              this.handleSubtypeSelected(value.value);
            }
          }}
          key={selectedPrimarySite || "none"}
          defaultValue={
            options.length === 1 && options[0].value === "all"
              ? options[0]
              : null
          }
          id="celligner-subtype-filter-cell-lines-for-tumors"
        />
      </fieldset>
    );
  }

  renderPrimarySiteFilter() {
    const options = this.lineages.map((lineage) => {
      return {
        value: lineage,
        label: titleCase(lineage.split(/[-_]/g).join(" ")),
      };
    });
    return (
      <fieldset>
        <label htmlFor="celligner-primary-site-filter-cell-lines-for-tumors">
          1. Select lineage
        </label>
        <Select
          options={options}
          isClearable
          onChange={this.handlePrimaryTypeSelected as any}
          id="celligner-primary-site-filter-cell-lines-for-tumors"
        />
      </fieldset>
    );
  }

  renderColorByOptions() {
    const {
      selectedPrimarySite,
      colorByCategory,
      onColorByCategoryChange,
      onCellLineListChange,
    } = this.props;
    const options: Array<{
      value: GroupingCategory;
      label: string;
      isDisabled?: boolean;
    }> = [
      { value: "lineage", label: "Lineage" },
      { value: "cluster", label: "Cluster" },
      { value: "primaryMet", label: "Origin" },
      { value: "growthPattern", label: "Growth Pattern" },
      {
        value: "subtype",
        label: "Subtype",
        isDisabled: !selectedPrimarySite,
      },
      {
        value: "cellLineSet",
        label: "Model Context",
      },
    ];

    if (enabledFeatures.celligner_app_v3) {
      options.splice(3, 0, { value: "type", label: "Sample Type" });
    }

    const helpPopover = (
      <Popover id="popover-color-by-helper-text" title="Color by categories">
        <ul>
          <li>
            <strong>Lineage</strong>: The primary origin of the sample.
          </li>
          <li>
            <strong>Origin</strong>: Whether the sample is a primary or
            metastatic sample
          </li>
          <li>
            <strong>Cluster</strong>: We clustered the combined, corrected data
            in the first seventy principle components using a shared nearest
            neighbor (SNN) modularity optimization based clustering method from
            the Seurat R package using a resolution parameter of 5.
          </li>
          <li>
            <strong>Subtype</strong>: subtype annotations across a variety of
            sources (see faq for citations of sources)
          </li>
        </ul>
      </Popover>
    );

    const popoverIcon = (
      <OverlayTrigger
        trigger={["hover", "focus"]}
        placement="top"
        overlay={helpPopover}
      >
        <span
          className="glyphicon glyphicon-question-sign"
          style={{ marginInlineStart: 8 }}
        />
      </OverlayTrigger>
    );

    return (
      <fieldset>
        <label>Color by {popoverIcon}</label>
        <Select
          options={options}
          value={options.find((option) => option.value === colorByCategory)}
          onChange={(value) => {
            if (value) {
              onColorByCategoryChange(value.value as GroupingCategory);
            }
          }}
        />
        {colorByCategory === "cellLineSet" && (
          <div className={styles.cellLineListsDropdown}>
            <CellLineListsDropdown onListSelect={onCellLineListChange} />
          </div>
        )}
      </fieldset>
    );
  }

  render() {
    return (
      <div className="control_panel">
        {this.renderPrimarySiteFilter()}
        {this.renderSubtypeFilter()}
        <hr style={{ marginBottom: 0, backgroundColor: "#ccc" }} />
        {this.renderColorByOptions()}
      </div>
    );
  }
}
