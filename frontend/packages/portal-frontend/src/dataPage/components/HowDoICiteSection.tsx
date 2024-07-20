import { enabledFeatures } from "@depmap/globals";
import { Accordion } from "@depmap/interactive";
import React from "react";
import styles from "src/dataPage/styles/DataPage.scss";
import { allDataTabHref } from "./utils";

interface HowDoICiteSectionProps {
  citation: string | null;
  sectionIsOpen: boolean;
  citationSectionKeySuffix?: number;
  scroll?: () => void;
}

const HowDoICiteSection = ({
  citation,
  sectionIsOpen,
  scroll = () => {},
  citationSectionKeySuffix = 1,
}: HowDoICiteSectionProps) => {
  if (enabledFeatures.full_data_page_citation_section) {
    return (
      <div ref={scroll} id={"how-to-cite"}>
        <Accordion
          key={`how-to-cite-accordion${citationSectionKeySuffix}`}
          isOpen={sectionIsOpen}
          openCloseSymbolStyle={{
            float: "left",
            marginRight: "20px",
            marginTop: "14px",
            position: "relative",
            lineHeight: "unset",
            fontSize: "24px",
          }}
          title={<h1>How do I use and cite DepMap data?</h1>}
        >
          <div className={styles.learnAboutBody}>
            <div className={styles.col1}>
              <div style={{ fontWeight: "500" }}>
                Data in the DepMap portal is available for the community to use.
                The DepMap team does not need to be included as authors should
                you seek to publish on the data, but we do ask that you use the
                following citing instructions.
              </div>
              <br />
              <div>
                In addition to the relevant doi or paper, please include a
                reference to the DepMap portal website in your manuscript:
                <b> https://depmap.org/portal</b>.
              </div>
              <br />
              <div>
                We grant permission for reuse of all images and graphics
                produced from the DepMap portal website.
              </div>
              <br />
              <div>
                DepMap releases data publicly independent of publication. We ask
                that instead of citing a publication, cite the figshare for the
                data release you are using.
              </div>
            </div>
            <div className={styles.col2}>
              {citation && (
                <div dangerouslySetInnerHTML={{ __html: citation }} />
              )}
              <div style={{ marginBottom: "35px" }}>
                <b>If you’d like to cite The DepMap project:</b> <br />
                Tsherniak A, Vazquez F, Montgomery PG, Weir BA, Kryukov G,
                Cowley GS, Gill S, Harrington WF, Pantel S, Krill-Burger JM,
                Meyers RM, Ali L, Goodale A, Lee Y, Jiang G, Hsiao J, Gerath
                WFJ, Howell S, Merkel E, Ghandi M, Garraway LA, Root DE, Golub
                TR, Boehm JS, Hahn WC. Defining a Cancer Dependency Map. Cell.
                2017 Jul 27;170(3):564-576.
              </div>
              <div>
                <b>Other datasets</b>
                <br /> There are also other datasets available in the DepMap
                portal. You can find the appropriate citation to use for each
                dataset in the dropdown on the{" "}
                <a href={allDataTabHref} target="_blank" rel="noreferrer">
                  All Data Downloads page
                </a>
                .
              </div>
            </div>
          </div>
        </Accordion>
      </div>
    );
  }

  return (
    <div id={"how-to-cite"}>
      <Accordion
        key="c"
        openCloseSymbolStyle={{
          float: "left",
          marginRight: "20px",
          marginTop: "14px",
          position: "relative",
          lineHeight: "unset",
          fontSize: "24px",
        }}
        title={<h1>How do I use and cite DepMap data?</h1>}
      >
        <div className={styles.seePublic}>
          See the{" "}
          <a
            className={styles.dataPageLink}
            href={
              "https://depmap.org/portal/data_page/?tab=overview#how-to-cite"
            }
            target="_blank"
            rel="noreferrer"
          >
            public portal
          </a>{" "}
          for information on how to use and cite data.
        </div>
      </Accordion>
    </div>
  );
};

export default HowDoICiteSection;
