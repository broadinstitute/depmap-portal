import React, { useState, useEffect, useCallback } from "react";
import { Row, Col, Button } from "react-bootstrap";
import * as Papa from "papaparse";
import { legacyPortalAPI } from "@depmap/api";
import { toPortalLink, toStaticUrl } from "@depmap/globals";
import { Spinner } from "@depmap/common-components";
import { EntityType } from "src/entity/models/entities";
import {
  CompoundDosePredictiveModelResults,
  GenePredictiveModelResults,
  PredictiveModelResults,
  PredictabilityTable,
  ScreenType,
} from "@depmap/types";
import PredictiveModelsForScreen from "src/predictability/components/PredictiveModelsForScreen";
import "src/predictability/styles/predictability_tab.scss";

interface Props {
  entityIdOrLabel: number | string;
  entityLabel: string;
  entityType: EntityType;
  customDownloadsLink: string;
  methodologyUrl: string;
}

interface InformationalContentProps {
  tables: Array<{
    screen: string;
    screenType: ScreenType;
    modelsAndResults: Array<PredictiveModelResults>;
  }>;
  entityLabel: string;
  entityType: EntityType;
  customDownloadsLink: string;
  methodologyUrl: string;
}

const InformationalContent = ({
  tables,
  entityLabel,
  entityType,
  customDownloadsLink,
  methodologyUrl,
}: InformationalContentProps) => {
  const downloadData = useCallback(() => {
    const data: Array<{
      screen: string;
      model: string;
      compoundExperimentId?: string;
      modelCorrelation: number;
      feature: string;
      featureImportance: number;
      featureCorrelation: number;
      featureType: string;
    }> = [];
    tables.forEach((table) => {
      table.modelsAndResults.forEach((modelAndResults) => {
        modelAndResults.results.forEach((result) => {
          let row;
          if (entityType === EntityType.Compound) {
            row = {
              screen: table.screen,
              model: (modelAndResults as CompoundDosePredictiveModelResults)
                .modelName,
              compoundExperimentId: (modelAndResults as CompoundDosePredictiveModelResults)
                .compoundExperimentId,
              modelCorrelation: modelAndResults.modelCorrelation,
              feature: result.featureName,
              featureImportance: result.featureImportance,
              featureCorrelation: result.correlation,
              featureType: result.featureType,
            };
          } else {
            row = {
              screen: table.screen,
              model: (modelAndResults as GenePredictiveModelResults).modelName,
              modelCorrelation: modelAndResults.modelCorrelation,
              feature: result.featureName,
              featureImportance: result.featureImportance,
              featureCorrelation: result.correlation,
              featureType: result.featureType,
            };
          }
          data.push(row);
        });
      });
    });
    const csv = Papa.unparse(data);

    const f = new Blob([csv], { type: "text/csv" });
    const csvURL = window.URL.createObjectURL(f);
    const tempLink = document.createElement("a");
    tempLink.href = csvURL;
    tempLink.setAttribute(
      "download",
      `depmap_predictability_data_${entityLabel}.csv`
    );
    tempLink.click();
    document.removeChild(tempLink);
  }, [tables, entityType, entityLabel]);

  return (
    <div className="button-container">
      <Button
        bsStyle="link"
        bsSize="xs"
        className="icon-button"
        href={methodologyUrl}
        target="_blank"
      >
        <img
          src={toStaticUrl("img/predictability/pdf.svg")}
          alt=""
          className="icon"
        />
        <span>Information about this page</span>
      </Button>

      <Button
        bsStyle="link"
        bsSize="xs"
        className="icon-button"
        disabled={!tables}
        onClick={downloadData}
      >
        <img
          src={toStaticUrl("img/predictability/download.svg")}
          alt=""
          style={{ height: 14, marginInlineEnd: 2 }}
        />
        <span>Download data for {entityLabel}</span>
      </Button>

      <Button
        bsStyle="link"
        bsSize="xs"
        className="icon-button"
        href={toPortalLink(`/${entityType}/predictability_files`)}
        download
      >
        <img
          src={toStaticUrl("img/predictability/download.svg")}
          alt=""
          style={{ height: 14, marginInlineEnd: 2 }}
        />
        <span>Download data for all {entityType}s</span>
      </Button>

      <Button
        bsStyle="link"
        bsSize="xs"
        href={customDownloadsLink}
        className="icon-button"
      >
        <i className="fa fa-link" aria-hidden="true" />
        <span>Download input data</span>
      </Button>
    </div>
  );
};

const PredictabilityRowForEntity = (props: {
  tables: Array<PredictabilityTable>;
  entityType: EntityType;
}) => {
  const { entityType, tables } = props;
  if (!tables) {
    return null;
  }

  if (entityType === EntityType.Gene) {
    return (
      <Row>
        {tables.map((table) => {
          const { screen, screenType, modelsAndResults } = table;
          return (
            <Col key={screen} md={6}>
              <PredictiveModelsForScreen
                key={screen}
                entityType={entityType}
                screen={screen}
                screenType={screenType}
                modelsAndResults={modelsAndResults}
              />
            </Col>
          );
        })}
      </Row>
    );
  }

  // sorted on back end; grouping by compound experiment and dataset model which should each have 3 tables
  const tablesGroupedByCompoundExperimentId = tables.reduce<
    Record<string, PredictabilityTable[]>
  >((r, e) => {
    const ceId = e.compoundExperimentId;
    if (ceId !== undefined) {
      return {
        ...r,
        [ceId]: r[ceId] ? [...r[ceId], e] : [e],
      };
    }
    return r;
  }, {});

  const groupedTables = Object.values(tablesGroupedByCompoundExperimentId);
  return (
    <>
      {groupedTables.map((group, i) => {
        return (
          <Row
            key={
              (group[0]
                .modelsAndResults as CompoundDosePredictiveModelResults[])[0]
                .compoundExperimentId
            }
          >
            <Col md={12}>
              <div className="compound-experiment-label-container">
                <div className="all-caps">Compound experiment ID</div>
                <div className="compound-experiment-label">
                  {
                    (group[0]
                      .modelsAndResults[0] as CompoundDosePredictiveModelResults)
                      .compoundExperimentId
                  }
                </div>
              </div>
            </Col>
            {group.map((table) => {
              const { screen, screenType, modelsAndResults } = table;
              return (
                <Col
                  key={modelsAndResults[0].modelName}
                  md={Math.min(Math.floor(12 / group.length), 6)}
                >
                  <PredictiveModelsForScreen
                    key={screen}
                    entityType={entityType}
                    screen={screen}
                    screenType={screenType}
                    modelsAndResults={modelsAndResults}
                  />
                </Col>
              );
            })}
            {i !== groupedTables.length - 1 && <hr />}
          </Row>
        );
      })}
    </>
  );
};

const PredictabilityTab = (props: Props) => {
  const {
    entityIdOrLabel,
    entityLabel,
    entityType,
    customDownloadsLink,
    methodologyUrl,
  } = props;
  const [tables, setTables] = useState<Array<PredictabilityTable> | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (entityType === EntityType.Gene) {
      legacyPortalAPI
        .getPredictiveTableGene(entityIdOrLabel as number)
        .then((r) => {
          setTables(r);
        })
        .catch((e) => {
          setError(true);
          window.console.error(e);
        });
    } else {
      legacyPortalAPI
        .getPredictiveTableCompound(entityIdOrLabel as string)
        .then((r) => {
          setTables(
            r.map((d) => {
              return {
                screenType: ScreenType.Compound,
                ...d,
              };
            })
          );
        })
        .catch((e) => {
          setError(true);
          window.console.error(e);
        });
    }
  }, [entityIdOrLabel, entityType]);

  if (error) {
    return <h4>Sorry, an error occurred.</h4>;
  }

  if (!tables) {
    return <Spinner left="50%" />;
  }

  return (
    <>
      <InformationalContent
        tables={tables}
        entityLabel={entityLabel}
        entityType={entityType}
        customDownloadsLink={customDownloadsLink}
        methodologyUrl={methodologyUrl}
      />
      <PredictabilityRowForEntity tables={tables} entityType={entityType} />
    </>
  );
};

export default PredictabilityTab;
