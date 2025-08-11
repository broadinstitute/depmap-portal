import { ToggleSwitch } from "@depmap/common-components";
import React from "react";
import Select from "react-select";
import styles from "../styles/GeneTea.scss";

interface SearchOptionsListTabProps {
  /* Still need to add props */
}

function SearchOptionsListTab({}: /* Haven't figured out what the props should be yet */ SearchOptionsListTabProps) {
  return (
    <div className={styles.SearchOptionsListTab}>
      <h4 className={styles.sectionTitle}>TEMP</h4>
      <Select
        defaultValue={{ label: "temp0", value: "temp0" }}
        value={{ label: "temp0", value: "temp0" }}
        isDisabled={false}
        options={[
          { label: "temp0", value: "temp0" },
          { label: "temp1", value: "temp1" },
        ]}
        onChange={(value: any) => {
          if (value) {
            console.log("changed to ", value);
          }
        }}
        id="gene-tea-page-selection"
      />
      <hr className={styles.SearchOptionsListTabHr} />
      <h4 className={styles.sectionTitle} style={{ paddingBottom: "4px" }}>
        Filter by TEMP
      </h4>
      <Select
        defaultValue={{ label: "temp0", value: "temp0" }}
        isDisabled={false}
        isMulti
        options={[
          { label: "temp0", value: "temp0" },
          { label: "temp1", value: "temp1" },
        ]}
        onChange={(value: any) => {
          if (value) {
            console.log("changed to ", value);
          }
        }}
        id="gene-tea-filter-by-TEMP"
      />
      <hr className={styles.SearchOptionsListTabHr} />
      <h4 className={styles.sectionTitle}>TEMP LABEL View Options</h4>
      <div className={styles.toggleRow}>
        <div className={styles.toggleLabel}>TEMP TOGGLE</div>
        <ToggleSwitch
          value={true}
          onChange={(val) => console.log("CHANGED", val)}
          options={[
            { label: "ON", value: true },
            { label: "OFF", value: false },
          ]}
        />
      </div>
    </div>
  );
}

export default SearchOptionsListTab;
