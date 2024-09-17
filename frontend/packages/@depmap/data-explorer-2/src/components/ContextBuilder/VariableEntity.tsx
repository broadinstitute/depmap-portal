import React, { useEffect, useMemo, useRef, useState } from "react";
import { fetchDimensionLabelsOfDataset } from "../../api";
import { getDimensionTypeLabel, isPartialSliceId } from "../../utils/misc";
import PlotConfigSelect from "../PlotConfigSelect";
import { sliceLabelFromSliceId, makeSliceId } from "./contextBuilderUtils";
import { ContextBuilderReducerAction } from "./contextBuilderReducer";
import styles from "../../styles/ContextBuilder.scss";

const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

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
          const { labels } = await fetchDimensionLabelsOfDataset(
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

  const handleChange = (nextValue: string) => {
    dispatch({
      type: "update-value",
      payload: {
        path: path.slice(0, -2),
        value: {
          ">": [{ var: makeSliceId(slice_type, dataset_id, nextValue) }, null],
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
      <PlotConfigSelect
        show
        enable
        className={styles.varSelect}
        hasError={shouldShowValidation && (!value || isPartialSliceId(value))}
        isLoading={!options}
        value={selectedValue as any}
        options={options || []}
        onChange={handleChange as any}
        placeholder={`Select ${getDimensionTypeLabel(slice_type)}…`}
        menuPortalTarget={document.querySelector("#modal-container")}
      />
    </div>
  );
}

export default VariableEntity;
