import React, { ReactNode, memo, useCallback, useState } from "react";
import { DropdownButton, MenuItem } from "react-bootstrap";
import columns from "src/tda/json/columns.json";
import styles from "src/tda/styles/TDAColumnControls.scss";

interface Props {
  xValue: string;
  yValue: string;
  onChangeX: (value: string) => void;
  onChangeY: (value: string) => void;
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

function TDAColumnControls({ xValue, yValue, onChangeX, onChangeY }: Props) {
  const [xDataset, setXDataset] = useState<string>("CRISPR");
  const [yDataset, setYDataset] = useState<string>("CRISPR");

  const handleChangeXDataset = useCallback(
    (nextDataset: string) => {
      const nextXValue = xValue.replace(/(CRISPR|RNAi)/, nextDataset);
      setXDataset(nextDataset);
      onChangeX(nextXValue);
    },
    [xValue, onChangeX]
  );

  const handleChangeYDataset = useCallback(
    (nextDataset: string) => {
      const nextXValue = yValue.replace(/(CRISPR|RNAi)/, nextDataset);
      setYDataset(nextDataset);
      onChangeY(nextXValue);
    },
    [yValue, onChangeY]
  );

  return (
    <div className={styles.TDAColumnControls}>
      <Dropdown
        id="x-axis-dataset"
        title="X axis dataset"
        label={xDataset}
        onSelect={handleChangeXDataset}
      >
        <MenuItem eventKey="CRISPR">CRISPR</MenuItem>
        <MenuItem eventKey="RNAi">RNAi</MenuItem>
      </Dropdown>
      <Dropdown
        id="x-axis-data"
        title="X axis data"
        label={getColumnLabel(xValue)}
        onSelect={onChangeX}
      >
        {columns
          .filter(({ dataset }) => dataset === xDataset)
          .map((column) => (
            <MenuItem key={column.value} eventKey={column.value}>
              {column.label}
            </MenuItem>
          ))}
      </Dropdown>
      <Dropdown
        id="y-axis-dataset"
        title="Y axis dataset"
        label={yDataset}
        onSelect={handleChangeYDataset}
      >
        <MenuItem eventKey="CRISPR">CRISPR</MenuItem>
        <MenuItem eventKey="RNAi">RNAi</MenuItem>
      </Dropdown>
      <Dropdown
        id="y-axis-data"
        title="Y axis data"
        label={getColumnLabel(yValue)}
        onSelect={onChangeY}
      >
        {columns
          .filter(({ dataset }) => dataset === yDataset)
          .map((column) => (
            <MenuItem key={column.value} eventKey={column.value}>
              {column.label}
            </MenuItem>
          ))}
      </Dropdown>
    </div>
  );
}

export default memo(TDAColumnControls);
