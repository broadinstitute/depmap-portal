import React, { useEffect, useState } from "react";
import { legacyPortalAPI, LegacyPortalApiResponse } from "@depmap/api";
import { CellLineListsDropdown, CustomList } from "@depmap/cell-line-selector";
import AsyncTile from "src/common/components/AsyncTile";
import {
  TabsWithHistory,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
} from "src/common/components/tabs";
import TableData from "src/common/components/CharacterizationDataTable";
import styles from "../styles/GenePage.scss";

type GeneCharacterizationData = LegacyPortalApiResponse["getGeneCharacterizationData"];

interface Props {
  symbol: string;
  entityId: string;
  onListSelect: any;
  selectedCellLineList: CustomList | undefined;
}

const GeneCharacterizationPanel = ({
  symbol,
  entityId,
  onListSelect,
  selectedCellLineList,
}: Props) => {
  const [
    characterizations,
    setCharacterizations,
  ] = useState<GeneCharacterizationData | null>(null);

  useEffect(() => {
    (async () => {
      const data = await legacyPortalAPI.getGeneCharacterizationData(symbol);
      setCharacterizations(data);
    })();
  }, [symbol]);

  useEffect(() => {
    const handler = () =>
      document.querySelectorAll(".js-plotly-plot").forEach((el) => {
        window.Plotly?.Plots?.resize(el as HTMLElement);
      });
    window.addEventListener("changeTab:characterization", handler);
    return () =>
      window.removeEventListener("changeTab:characterization", handler);
  }, []);

  if (!characterizations) {
    return <div>Loading...</div>;
  }

  // After a tile loads, we run a regex to find all the <script> tags within
  // it and evaluate them.
  const evaluateAllScripts = (html: string) => {
    // An `elementId` variable needs to be in scope even though it appears to
    // be unused. It's actually used interally by the scripts when they're
    // eval'd below.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let elementId;

    const scriptsRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gm;
    let match;

    // eslint-disable-next-line no-cond-assign
    while ((match = scriptsRegex.exec(html))) {
      // eslint-disable-next-line no-eval
      eval(match[1]);
    }
  };

  return (
    <TabsWithHistory
      className={styles.Tabs}
      isManual
      isLazy
      lazyBehavior="keepMounted"
      queryParamName="characterization"
      orientation="vertical"
      onChange={() => {
        document.querySelectorAll(".js-plotly-plot").forEach((el) => {
          window.Plotly?.Plots?.resize(el as HTMLElement);
        });
      }}
    >
      <TabList className={styles.TabList}>
        {characterizations.map((c: any) => (
          <Tab key={c.id} id={c.id} data-dataset={c.dataset}>
            {c.display_name}
          </Tab>
        ))}
        <div className={styles.findCellLines}>
          <label htmlFor="button">Find cell lines:</label>
          <CellLineListsDropdown
            key={selectedCellLineList?.name}
            onListSelect={(list) => {
              onListSelect(list);

              window.dispatchEvent(
                new CustomEvent("characterization_highlighted_lines_changed")
              );
            }}
          />
        </div>
        <label>
          <input
            id="characterization-show-sublineage"
            type="checkbox"
            onClick={() =>
              window.dispatchEvent(
                new Event("characterizationshowsublineageupdated")
              )
            }
          />{" "}
          Show lineage subtypes
        </label>
      </TabList>

      <TabPanels className={styles.TabPanels}>
        {characterizations.map((c: any) => {
          if (c.id === "mutation") {
            return (
              <TabPanel key={c.id} className={styles.TabPanel}>
                <TableData
                  id={entityId}
                  physicalUnit="gene"
                  characterization="mutations"
                />
              </TabPanel>
            );
          }

          if (c.id === "fusion") {
            return (
              <TabPanel key={c.id} className={styles.TabPanel}>
                <TableData
                  id={entityId}
                  physicalUnit="gene"
                  characterization="fusions"
                />
              </TabPanel>
            );
          }

          return (
            <TabPanel key={c.id} className={styles.TabPanel}>
              <AsyncTile
                id={`${c.id}-panel`}
                url={`/gene/gene_characterization_content/${symbol}/${c.id}`}
                onLoad={evaluateAllScripts}
              />
            </TabPanel>
          );
        })}
      </TabPanels>
    </TabsWithHistory>
  );
};

export default GeneCharacterizationPanel;
