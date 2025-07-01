import { enabledFeatures } from "@depmap/globals";
import { Accordion } from "@depmap/common-components";
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
                <b>
                  Data in the DepMap portal is available for the community to
                  use. The DepMap team does not need to be included as authors
                  should you seek to publish on the data, but we do ask that you
                  use the following citing instructions.
                </b>
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
                <b>We ask that you also cite the DepMap program:</b> <br />
                Arafeh, R., Shibue, T., Dempster, J.M. <i>et al.</i> The present
                and future of the Cancer Dependency Map. <i>Nat Rev Cancer</i>{" "}
                <b>25</b>, 59-73 (2025).
                https://doi.org/10.1038/s41568-024-00763-x
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
    <div ref={scroll} id={"how-to-cite"}>
      <Accordion
        key="c"
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
