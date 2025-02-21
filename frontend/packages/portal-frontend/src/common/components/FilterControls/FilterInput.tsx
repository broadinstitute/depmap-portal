import React, {
  ChangeEvent,
  memo,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import Select from "react-windowed-select";
import { colorPalette } from "depmap-shared";
import { Histoslider } from "@depmap/common-components";
import {
  Data,
  Filter,
  isRangeFilter,
  isCheckboxFilter,
  isMultiSelectFilter,
  isNumberInputFilter,
} from "src/common/models/discoveryAppFilters";
import styles from "src/common/styles/FilterControls.scss";

interface Props {
  data: Data;
  filter: Filter;
  onChangeFilter: (key: string, value: any) => void;
  disableHistogram?: boolean;
  selectedColor?: string | null;
}

function FilterInput({
  data,
  filter,
  onChangeFilter,
  disableHistogram = false,
  selectedColor = null,
}: Props) {
  const sliderRef = useRef<HTMLDivElement>(null);
  const [sliderWidth, setSliderWidth] = useState(200);
  const { key, label } = filter;

  const rangeHandler = useCallback(
    (min: number, max: number) => onChangeFilter(key, [min, max]),
    [key, onChangeFilter]
  );

  useLayoutEffect(() => {
    if (sliderRef.current) {
      setSliderWidth(sliderRef.current.clientWidth);
    }
  }, []);

  if (!data[key]) {
    window.console.warn(
      `Warning: \`data\` does not have a(n) "${key}" property.`
    );
    return null;
  }

  if (isRangeFilter(filter)) {
    const { step, value } = filter;

    return (
      <div className={styles.slider} ref={sliderRef}>
        <div>{label}</div>
        <Histoslider
          selectedColor={selectedColor || colorPalette.interesting_color}
          width={sliderWidth}
          height={100}
          step={step}
          rawNums={data[key]}
          selection={value}
          rangeHandler={rangeHandler}
          disableHistogram={disableHistogram}
        />
      </div>
    );
  }

  if (isNumberInputFilter(filter)) {
    const { value, step } = filter;

    return (
      <div className={styles.numInputFilter}>
        <div>{label}</div>
        <input
          style={{ width: "55px" }}
          type="number"
          value={value}
          step={step}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            onChangeFilter(key, Number(event.target.value))
          }
        />
      </div>
    );
  }

  if (isCheckboxFilter(filter)) {
    const { value } = filter;

    return (
      <div className={styles.checkboxFilter}>
        <label>
          <input
            type="checkbox"
            checked={value}
            onChange={() => onChangeFilter(key, !value)}
          />{" "}
          <span>{label}</span>
        </label>
      </div>
    );
  }

  if (isMultiSelectFilter(filter)) {
    return (
      <div className={styles.multiselectFilterContainer}>
        <label>{filter.label}</label>
        <Select
          isMulti
          classNamePrefix="multiselect-filter"
          value={filter.value.map((value) => ({ value, label: value }))}
          onChange={(selection: any) => {
            return onChangeFilter(
              key,
              Array.isArray(selection)
                ? selection.map(({ value }: any) => value)
                : []
            );
          }}
          menuPortalTarget={document.body}
          options={filter.options.map((value) => ({ value, label: value }))}
          placeholder="(any)"
          isSearchable
        />
      </div>
    );
  }

  window.console.warn(`Warning: unknown filter kind "${(filter as any).kind}"`);
  return null;
}

export default memo(FilterInput);
