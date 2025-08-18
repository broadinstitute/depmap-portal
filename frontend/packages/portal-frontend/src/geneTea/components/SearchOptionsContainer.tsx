import { ToggleSwitch } from "@depmap/common-components";
import React, { useContext } from "react";
import Select from "react-select";
import styles from "../styles/GeneTea.scss";
import { Tab, Tabs } from "react-bootstrap";
import MultiSelectTextarea from "./MultiSelectTextArea";
import SectionStack, {
  SectionStackContext,
  StackableSection,
} from "./collapsibleOptions/SectionStack";
import PlotOptionsPanel from "./PlotOptionsPanel";
import TermOptionsPanel from "./TermOptionsPanel";

function SearchOptionsContainer() {
  const { sectionHeights } = useContext(SectionStackContext);

  return (
    <div className={styles.SearchOptionsContainer}>
      <Tabs className={styles.Tabs} id={"gene-tea-filter-tabs"}>
        <Tab eventKey={"List"} title={"List"} className={styles.Tab}>
          <h4 className={styles.sectionTitle}>Enter Gene Symbols</h4>
          <MultiSelectTextarea />
          <hr className={styles.SearchOptionsContainerHr} />
          <SectionStack>
            <StackableSection title="Plot Options" minHeight={132}>
              <PlotOptionsPanel />
            </StackableSection>
            <StackableSection title="Term Options" minHeight={132}>
              <TermOptionsPanel />
            </StackableSection>
          </SectionStack>
        </Tab>
        <Tab
          eventKey={"Continuous"}
          title={"Continuous (Alpha)"}
          className={styles.Tab}
        >
          <h2>Coming soon!</h2>
        </Tab>
      </Tabs>
    </div>
  );
}

export default SearchOptionsContainer;
