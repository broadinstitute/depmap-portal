import React from "react";
import { Checkbox } from "react-bootstrap";
import styles from "src/contextExplorer/styles/ContextExplorer.scss";
import InfoIcon from "src/common/components/InfoIcon";
import { CONTEXT_EXPL_BAR_THICKNESS, DATATYPE_TOOLTIP_TEXT } from "../utils";

interface Props {
  datatypes: string[];
  onClick: (clickedOption: string) => void;
  checked: ReadonlySet<string>;
  customInfoImg: React.JSX.Element;
}

const DatatypeSelector = (props: Props) => {
  const { datatypes, checked, onClick, customInfoImg } = props;

  const display: any = [];
  datatypes.forEach((datatype: string) => {
    display.push(
      <div className={styles.selector} key={`checkboxWrapper-${datatype}`}>
        <Checkbox
          key={`checkbox-${datatype}`}
          className={styles.selectorCheckbox}
          checked={checked.has(datatype)}
          onChange={() => {
            onClick(datatype);
          }}
        >
          <span style={{ width: "100%" }}>
            {datatype}
            <InfoIcon
              target={customInfoImg}
              popoverContent={<p>{DATATYPE_TOOLTIP_TEXT.get(datatype)}</p>}
              popoverId={`datatype-popover`}
              trigger={["hover", "focus"]}
            />
          </span>
        </Checkbox>
      </div>
    );
  });
  return (
    <div className={styles.datatypeSelector}>
      <div
        style={{
          display: "grid",
          alignItems: "center",
          gridTemplateRows: `repeat(${datatypes.length + 1}, ${
            CONTEXT_EXPL_BAR_THICKNESS - 1
          }px)`,
        }}
      >
        <div>
          <h5>DATASETS</h5>
        </div>
        {display}
      </div>
    </div>
  );
};

export default DatatypeSelector;
