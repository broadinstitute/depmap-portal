import { ToggleSwitch } from "@depmap/common-components";
import React, { useContext, useState } from "react";
import Select from "react-select";
import styles from "../styles/GeneTea.scss";
import { Button, Tab, Tabs } from "react-bootstrap";
import MultiSelectTextarea from "./MultiSelectTextArea";
import SectionStack, {
  SectionStackContext,
  StackableSection,
} from "./collapsibleOptions/SectionStack";
import PlotOptionsPanel from "./PlotOptionsPanel";

interface SearchOptionsContainerProps {
  handleToggleGroupTerms: (nextValue: boolean) => void;
  handleToggleClusterGenes: (nextValue: boolean) => void;
  handleToggleClusterTerms: (nextValue: boolean) => void;
  handleSetGeneSymbolSelections: (
    selections: React.SetStateAction<Set<string>>
  ) => void;
  handleSetValidGenes: (selections: React.SetStateAction<Set<string>>) => void;
  handleSetInvalidGenes: (
    selections: React.SetStateAction<Set<string>>
  ) => void;
  allSelections: Set<string>;
  validSelections: Set<string>;
  invalidSelections: Set<string>;
  doClusterTerms: boolean;
  doClusterGenes: boolean;
  doGroupTerms: boolean;
}

function SearchOptionsContainer({
  handleToggleGroupTerms,
  handleToggleClusterGenes,
  handleToggleClusterTerms,
  handleSetGeneSymbolSelections,
  handleSetValidGenes,
  handleSetInvalidGenes,
  allSelections,
  validSelections,
  invalidSelections,
  doClusterTerms,
  doClusterGenes,
  doGroupTerms,
}: SearchOptionsContainerProps) {
  const { sectionHeights } = useContext(SectionStackContext);

  return (
    <div className={styles.SearchOptionsContainer}>
      <Tabs className={styles.Tabs} id={"gene-tea-filter-tabs"}>
        <Tab eventKey={"List"} title={"List"} className={styles.Tab}>
          <h4 className={styles.sectionTitle}>Enter Gene Symbols</h4>
          <MultiSelectTextarea
            handleSetGeneSymbolSelections={handleSetGeneSymbolSelections}
            handleSetValidGenes={handleSetValidGenes}
            handleSetInvalidGenes={handleSetInvalidGenes}
            allSelections={allSelections}
            validSelections={validSelections}
            invalidSelections={invalidSelections}
          />
          <hr className={styles.SearchOptionsContainerHr} />
          <SectionStack>
            <StackableSection title="Plot Options" minHeight={132}>
              <PlotOptionsPanel
                clusterTerms={doClusterTerms}
                clusterGenes={doClusterGenes}
                groupTerms={doGroupTerms}
                handleToggleClusterTerms={handleToggleClusterTerms}
                handleToggleClusterGenes={handleToggleClusterGenes}
                handleToggleGroupTerms={handleToggleGroupTerms}
              />
            </StackableSection>
            <StackableSection title="Term Options" minHeight={132}>
              <PlotOptionsPanel
                clusterTerms={doClusterTerms}
                clusterGenes={doClusterGenes}
                groupTerms={doGroupTerms}
                handleToggleClusterTerms={handleToggleClusterTerms}
                handleToggleClusterGenes={handleToggleClusterGenes}
                handleToggleGroupTerms={handleToggleGroupTerms}
              />
            </StackableSection>
          </SectionStack>
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
          <hr className={styles.SearchOptionsContainerHr} />
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
        </Tab>
        <Tab
          eventKey={"Continuous"}
          title={"Continuous (Alpha"}
          className={styles.Tab}
        >
          <h2>Coming soon!</h2>
        </Tab>
      </Tabs>
    </div>
  );
}

export default SearchOptionsContainer;
