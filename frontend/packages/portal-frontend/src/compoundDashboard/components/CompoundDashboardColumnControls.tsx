import React, { ReactNode, memo } from "react";
import { DatasetId } from "src/compoundDashboard/models/types";
import { DropdownButton, MenuItem } from "react-bootstrap";
import columns from "../json/columns.json";
import styles from "../styles/CompoundDashboardColumnControls.scss";
import {
  COMPOUND_DASHBOARD_DATASET_IDS,
  getDatasetLabelFromId,
} from "../utils";

interface Props {
  datasetId: DatasetId;
  onChangeDatasetId: (id: DatasetId) => void;
  xValue: string;
  yValue: string;
  onChangeX: (value: string) => void;
  onChangeY: (value: string) => void;
  viewSelection?: CompoundDashboardView;
}

export enum CompoundDashboardView {
  Plot,
  TableAndPlot,
  TableOnly,
}

const getColumnLabel = (value: string) => {
  const column = columns.find((c) => value === c.value);
  return column ? column.label : "unknown";
};

const Dropdown = ({
  id,
  title,
  label,
  onSelect,
  children,
}: {
  id: string;
  title: string;
  label: string;
  onSelect: (value: string) => void;
  children: ReactNode;
}) => {
  return (
    <DropdownButton
      id={id}
      title={
        <span>
          <div className={styles.dropdownTitle}>{title}</div>
          <div className={styles.selection}>{label}</div>
        </span>
      }
      onSelect={onSelect as any}
    >
      {children}
    </DropdownButton>
  );
};

function CompoundDashboardColumnControls({
  datasetId,
  onChangeDatasetId,
  xValue,
  yValue,
  onChangeX,
  onChangeY,
  viewSelection = undefined,
}: Props) {
  return (
    <div className={styles.CompoundDashboardColumnControls}>
      <Dropdown
        id="x-axis-dataset"
        title="Select dataset"
        label={getDatasetLabelFromId(datasetId)}
        onSelect={(value: any) => onChangeDatasetId(value)}
      >
        {COMPOUND_DASHBOARD_DATASET_IDS.map((idOption: string) => (
          <MenuItem key={idOption} eventKey={idOption}>
            {getDatasetLabelFromId(idOption)}
          </MenuItem>
        ))}
      </Dropdown>
      {(viewSelection === CompoundDashboardView.Plot ||
        viewSelection === CompoundDashboardView.TableAndPlot) && (
        <Dropdown
          id="x-axis-data"
          title="Select X axis"
          label={getColumnLabel(xValue)}
          onSelect={onChangeX}
        >
          {columns.map((column) => (
            <MenuItem key={column.value} eventKey={column.value}>
              {column.label}
            </MenuItem>
          ))}
        </Dropdown>
      )}
      {(viewSelection === CompoundDashboardView.Plot ||
        viewSelection === CompoundDashboardView.TableAndPlot) && (
        <Dropdown
          id="y-axis-data"
          title="Select Y axis"
          label={getColumnLabel(yValue)}
          onSelect={onChangeY}
        >
          {columns.map((column) => (
            <MenuItem key={column.value} eventKey={column.value}>
              {column.label}
            </MenuItem>
          ))}
        </Dropdown>
      )}
    </div>
  );
}

export default memo(CompoundDashboardColumnControls);
