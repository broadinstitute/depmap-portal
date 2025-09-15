import React from "react";
import styles from "../styles/GeneTea.scss";
import { Tab, Tabs } from "react-bootstrap";
import SectionStack, {
  StackableSection,
} from "./collapsibleOptions/SectionStack";
import PlotOptionsPanel from "./PlotOptionsPanel";
import TermOptionsPanel from "./TermOptionsPanel";
import MultiSelectTextArea from "./MultiSelectTextArea";
import LoadFromGeneContextSection from "./LoadFromGeneContextSection";

function SearchOptionsContainer() {
  return (
    <div className={styles.SearchOptionsContainer}>
      <Tabs className={styles.Tabs} id={"gene-tea-filter-tabs"}>
        <Tab eventKey={"List"} title={"List"} className={styles.Tab}>
          <MultiSelectTextArea />
          <div
            style={{
              marginLeft: "25px",
              marginRight: "25px",
              marginBottom: "25px",
            }}
          >
            <h4 className={styles.sectionTitle}>Load Gene Context</h4>
            <LoadFromGeneContextSection />
          </div>
          <SectionStack>
            <StackableSection title="Plot Options" minHeight={132}>
              <PlotOptionsPanel />
            </StackableSection>
            <StackableSection title="Term Options" minHeight={132}>
              <TermOptionsPanel />
            </StackableSection>
          </SectionStack>
        </Tab>
        {/* NOTE: Temporarily commented out until this feature is fully specced out<Tab
          eventKey={"Continuous"}
          title={"Continuous (Alpha)"}
          className={styles.Tab}
        >
          <h2>Coming soon!</h2>
        </Tab> */}
      </Tabs>
    </div>
  );
}

export default SearchOptionsContainer;
