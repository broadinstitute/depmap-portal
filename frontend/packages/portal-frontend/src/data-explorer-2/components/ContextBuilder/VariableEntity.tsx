import React, { useEffect, useMemo, useRef, useState } from "react";
import cx from "classnames";
import Select from "react-windowed-select";
import {
  fetchEntityLabelsOfDataset,
  getDimensionTypeLabel,
  isPartialSliceId,
} from "@depmap/data-explorer-2";
import {
  entityLabelFromSliceId,
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
  entity_type: string;
  dataset_id: string;
  dispatch: React.Dispatch<ContextBuilderReducerAction>;
  shouldShowValidation: boolean;
}

function VariableEntity({
  value,
  path,
  entity_type,
  dataset_id,
  dispatch,
  shouldShowValidation,
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [entityLabels, setEntityLabels] = useState<string[] | null>(null);

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
          const { labels } = await fetchEntityLabelsOfDataset(
            entity_type,
            dataset_id
          );

          if (!unmounted) {
            setEntityLabels(labels.sort(collator.compare));
          }
        } catch (e) {
          window.console.error(e);
        }
      }
    })();

    return () => {
      unmounted = true;
    };
  }, [entity_type, dataset_id]);

  const options = useMemo(() => {
    const out: any = [];

    if (!entityLabels) {
      return null;
    }

    for (let i = 0; i < entityLabels.length; i += 1) {
      const label = entityLabels[i];
      out.push({ label, value: label });
    }

    return out;
  }, [entityLabels]);

  const handleChange = (option: any) => {
    dispatch({
      type: "update-value",
      payload: {
        path: path.slice(0, -2),
        value: {
          ">": [
            { var: makeSliceId(entity_type, dataset_id, option.value) },
            null,
          ],
        },
      },
    });
  };

  const selectedLabel = entityLabelFromSliceId(value, dataset_id);
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
        placeholder={`Select ${getDimensionTypeLabel(entity_type)}…`}
        menuPortalTarget={document.querySelector("#modal-container")}
      />
    </div>
  );
}

export default VariableEntity;
