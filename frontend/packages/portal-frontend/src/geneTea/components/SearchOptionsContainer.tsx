import React, { useContext } from "react";
import styles from "../styles/GeneTea.scss";
import { Tab, Tabs } from "react-bootstrap";
import MultiSelectTextarea from "./MultiSelectTextExperimental";
import SectionStack, {
  SectionStackContext,
  StackableSection,
} from "./collapsibleOptions/SectionStack";
import PlotOptionsPanel from "./PlotOptionsPanel";
import TermOptionsPanel from "./TermOptionsPanel";
import MultiSelectTextArea from "./MultiSelectTextArea";

function SearchOptionsContainer() {
  const { sectionHeights } = useContext(SectionStackContext);

  return (
    <div className={styles.SearchOptionsContainer}>
      <Tabs className={styles.Tabs} id={"gene-tea-filter-tabs"}>
        <Tab eventKey={"List"} title={"List"} className={styles.Tab}>
          <MultiSelectTextArea />
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
