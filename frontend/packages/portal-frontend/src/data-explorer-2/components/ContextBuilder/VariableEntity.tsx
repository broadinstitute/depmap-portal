import React, { useEffect, useMemo, useRef, useState } from "react";
import cx from "classnames";
import Select from "react-windowed-select";
import {
  fetchSliceLabelsOfDataset,
  getDimensionTypeLabel,
  isPartialSliceId,
} from "@depmap/data-explorer-2";
import {
  sliceLabelFromSliceId,
  makeSliceId,
} from "src/data-explorer-2/components/ContextBuilder/contextBuilderUtils";
import { ContextBuilderReducerAction } from "src/data-explorer-2/components/ContextBuilder/contextBuilderReducer";
import styles from "src/data-explorer-2/styles/ContextBuilder.scss";

const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

const selectStyles = {
  control: (base: object) => ({
    ...base,
    fontSize: 13,
  }),
  menu: (base: object) => ({
    ...base,
    fontSize: 12,
    minWidth: "100%",
    width: "max-content",
  }),
};

interface Props {
  value: string | null;
  path: (string | number)[];
  slice_type: string;
  dataset_id: string;
  dispatch: React.Dispatch<ContextBuilderReducerAction>;
  shouldShowValidation: boolean;
}

function VariableEntity({
  value,
  path,
  slice_type,
  dataset_id,
  dispatch,
  shouldShowValidation,
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [sliceLabels, setSliceLabels] = useState<string[] | null>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, []);

  useEffect(() => {
    let unmounted = false;

    (async () => {
      if (dataset_id) {
        try {
          const { labels } = await fetchSliceLabelsOfDataset(
            slice_type,
            dataset_id
          );

          if (!unmounted) {
            setSliceLabels(labels.sort(collator.compare));
          }
        } catch (e) {
          window.console.error(e);
        }
      }
    })();

    return () => {
      unmounted = true;
    };
  }, [slice_type, dataset_id]);

  const options = useMemo(() => {
    const out: any = [];

    if (!sliceLabels) {
      return null;
    }

    for (let i = 0; i < sliceLabels.length; i += 1) {
      const label = sliceLabels[i];
      out.push({ label, value: label });
    }

    return out;
  }, [sliceLabels]);

  const handleChange = (option: any) => {
    dispatch({
      type: "update-value",
      payload: {
        path: path.slice(0, -2),
        value: {
          ">": [
            { var: makeSliceId(slice_type, dataset_id, option.value) },
            null,
          ],
        },
      },
    });
  };

  const selectedLabel = sliceLabelFromSliceId(value, dataset_id);
  const selectedValue = selectedLabel
    ? { label: selectedLabel, value: selectedLabel }
    : null;

  return (
    <div ref={ref} style={{ scrollMargin: 22 }}>
      <Select
        className={cx(styles.varEntitySelect, {
          [styles.invalidSelect]:
            shouldShowValidation && (!value || isPartialSliceId(value)),
        })}
        styles={selectStyles}
        isLoading={!options}
        value={selectedValue}
        options={options}
        onChange={handleChange}
        placeholder={`Select ${getDimensionTypeLabel(slice_type)}…`}
        menuPortalTarget={document.querySelector("#modal-container")}
      />
    </div>
  );
}

export default VariableEntity;
