import * as React from "react";
import { Button } from "react-bootstrap";
import { enabledFeatures } from "@depmap/globals";
import { setQueryStringWithoutPageReload } from "@depmap/utils";
import { DownloadFile, Release } from "@depmap/data-slicer";

export interface ReleaseModalProps {
  file: DownloadFile;
  release: Release | null;
  dataUsageUrl: string;
  termsDefinitions: { [key: string]: string };
}

interface CardState {
  descriptionCollapsed: boolean;
}

export class ReleaseCard extends React.Component<ReleaseModalProps, CardState> {
  constructor(props: ReleaseModalProps) {
    super(props);

    this.state = {
      descriptionCollapsed: true,
    };
  }

  renderAsModalContent(
    summaryElement: React.ReactNode,
    citationElement: React.ReactNode,
    fundingElement: React.ReactNode,
    termsElement: React.ReactNode
  ) {
    const { release, file } = this.props;

    if (release == null) return null;

    const releaseNameParams: string =
      release?.releaseName !== undefined
        ? `?releasename=${release.releaseName}`
        : "";

    if (releaseNameParams !== "") {
      setQueryStringWithoutPageReload("releasename", release.releaseName);
    }

    return (
      <div className="dataset_modal_content_container">
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flexBasis: 0,
            flexGrow: 1,
            overflowWrap: "break-word",
            wordBreak: "break-word",
          }}
        >
          <div>
            {!file.retractionOverride && (
              <div>
                <h2
                  className="card_title"
                  style={{
                    marginTop: "5px",
                  }}
                >
                  {release.releaseName !== undefined ? release.releaseName : ""}
                </h2>
                <br />
                {summaryElement}
                <br />
                <h3>Data Usage</h3>
                {citationElement}
                <hr />
                {release ? (
                  release.funding && <div>{fundingElement}</div>
                ) : (
                  <div />
                )}
                {file.terms && <div>{termsElement}</div>}
                <br />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  render() {
    const { release, file, dataUsageUrl, termsDefinitions } = this.props;
    const { descriptionCollapsed } = this.state;

    let citationElement;
    if (release && release.citation) {
      citationElement = (
        <div style={{ paddingTop: 8 }}>
          <div>
            <h5>Please cite the following when using these data</h5>
            <br />
          </div>
          <div dangerouslySetInnerHTML={{ __html: release.citation }} />
        </div>
      );
    } else if (enabledFeatures.dmc_home_template) {
      citationElement = (
        <div>
          <div>
            <h5 className="highlight-color">
              This is an unpublished, priority access dataset.
            </h5>
          </div>
        </div>
      );
    } else {
      citationElement = (
        <div>
          <div>
            <h5 className="highlight-color">This is an unpublished dataset</h5>
          </div>
          <div>
            For datasets to use in publication, please see our{" "}
            <a target="_blank" rel="noreferrer" href={dataUsageUrl}>
              data usage guidelines
            </a>
            .
          </div>
        </div>
      );
    }

    let splitDescription = null;
    const minCharacters = 300;
    if (release) {
      splitDescription = (
        <div dangerouslySetInnerHTML={{ __html: release.description }} />
      );
      if (release.description && release.description.length > minCharacters) {
        // cut at the next occurance of a paragraph start after minCharacters
        const index = release.description.indexOf("<p>", minCharacters);

        if (index > -1) {
          const collapseText = descriptionCollapsed
            ? "... (Read more)"
            : "(Show less)";
          splitDescription = (
            <div>
              <div>
                <span
                  style={{ display: "inline-block" }}
                  dangerouslySetInnerHTML={{
                    __html: release.description.substring(0, index),
                  }}
                />
                {!descriptionCollapsed && (
                  <span style={{ display: "inline-block" }}>
                    <span
                      dangerouslySetInnerHTML={{
                        __html: release.description.substring(index),
                      }}
                    />
                  </span>
                )}
              </div>
              <Button
                bsStyle="link"
                className="view_more_less"
                onClick={() =>
                  this.setState({
                    descriptionCollapsed: !descriptionCollapsed,
                  })
                }
              >
                {collapseText}
              </Button>
            </div>
          );
        }
      }
    }

    const summaryElement: JSX.Element = <div>{splitDescription}</div>;

    const fundingElement: JSX.Element = (
      <div>
        <div>
          <h5>Funding</h5>
        </div>
        <div
          dangerouslySetInnerHTML={{ __html: release ? release.funding : "" }}
        />
      </div>
    );

    const termsElement: JSX.Element = (
      <div>
        <div>
          <h5>Terms and conditions</h5>
        </div>
        <div
          dangerouslySetInnerHTML={{ __html: termsDefinitions[file.terms] }}
        />
      </div>
    );

    return this.renderAsModalContent(
      summaryElement,
      citationElement,
      fundingElement,
      termsElement
    );
  }
}
