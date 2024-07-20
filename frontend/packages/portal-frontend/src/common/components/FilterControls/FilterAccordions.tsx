import React, {
  Children,
  isValidElement,
  cloneElement,
  useEffect,
  useState,
} from "react";
import styles from "src/common/styles/FilterControls.scss";

interface Props {
  defaultIndex?: number;
  disabled?: boolean;
  children: React.ReactNode;
}

function FilterAccordions({
  children,
  defaultIndex = undefined,
  disabled = false,
}: Props) {
  const [expandedIndex, setExpandedIndex] = useState<number | undefined>(
    disabled ? undefined : defaultIndex
  );

  useEffect(() => {
    if (!disabled) {
      setExpandedIndex((index) => (index === undefined ? defaultIndex : index));
    }
  }, [disabled, defaultIndex]);

  const handleClickExpand = (index: number) => {
    setExpandedIndex(index === expandedIndex ? undefined : index);
  };

  return (
    <div className={styles.FilterAccordions}>
      {Children.map(children, (child, index) =>
        isValidElement(child)
          ? cloneElement(child, {
              disabled,
              expanded: index === expandedIndex,
              onClickExpand: () => handleClickExpand(index),
            } as any)
          : null
      )}
    </div>
  );
}

export default FilterAccordions;
