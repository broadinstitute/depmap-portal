import React, { useEffect, useState } from "react";
import { legacyPortalAPI } from "@depmap/api";
import { CellLineDataMatrix, OncogenicAlteration } from "@depmap/types";
import AsyncTile from "src/common/components/AsyncTile";
import { CardContainer, CardColumn } from "src/common/components/Card";
import { DatasetDataTypes, ModelInfo } from "src/cellLine/models/types";
import styles from "src/common/styles/async_tile.module.scss";

const DatasetsTile = React.lazy(
  () => import("src/cellLine/components/DatasetsTile")
);
const OncogenicAlterationsTile = React.lazy(
  () => import("src/cellLine/components/OncogenicAlterationsTile")
);
const PrefDepTile = React.lazy(
  () =>
    import(
      /* webpackChunkName: "PrefDepTile" */
      "src/cellLine/components/PrefDepTile"
    )
);
const DescriptionTile = React.lazy(
  () => import("src/cellLine/components/DescriptionTile")
);

const CompoundSensitivityTile = React.lazy(
  () => import("src/cellLine/components/CompoundSensitivityTile")
);

interface Props {
  modelId: string;
  hasMetMapData: boolean;
}

const CellLineOverview = ({ modelId, hasMetMapData }: Props) => {
  const [
    descriptionTileData,
    setDescriptionTileData,
  ] = useState<ModelInfo | null>(null);

  const [
    prefDepCrisprData,
    setPrefDepCrisprData,
  ] = useState<CellLineDataMatrix | null>(null);

  const [
    prefDepRnaiData,
    setPrefDepRnaiData,
  ] = useState<CellLineDataMatrix | null>(null);

  const [
    compoundSensitivityData,
    setCompoundSensitivityData,
  ] = useState<CellLineDataMatrix | null>(null);

  const [cellLineDatasets, setCellLineDatasets] = useState<
    DatasetDataTypes[] | null
  >(null);

  const [oncoAlterations, setOncoAlterations] = useState<
    Array<OncogenicAlteration>
  >([]);
  const [oncokbDatasetVersion, setOncokbDatasetVersion] = useState<string>("");

  useEffect(() => {
    legacyPortalAPI.getCellLineDescriptionTileData(modelId).then((data) => {
      setDescriptionTileData(data as ModelInfo);
    });
  }, [modelId]);

  useEffect(() => {
    // Don't try to update an unmounted component - could cause memory leaks
    let mounted = true;

    legacyPortalAPI.getCellLinePrefDepData("crispr", modelId).then((data) => {
      if (mounted) {
        setPrefDepCrisprData(data);
      }
    });

    legacyPortalAPI.getCellLinePrefDepData("rnai", modelId).then((data) => {
      if (mounted) {
        setPrefDepRnaiData(data);
      }
    });

    legacyPortalAPI.getCellLineCompoundSensitivityData(modelId).then((data) => {
      if (mounted) {
        setCompoundSensitivityData(data);
      }
    });

    legacyPortalAPI.getCellLineDatasets(modelId).then((data) => {
      if (mounted) {
        setCellLineDatasets(data);
      }
    });

    legacyPortalAPI.getOncogenicAlterations(modelId).then((data) => {
      if (mounted) {
        setOncoAlterations(data.onco_alterations);
        setOncokbDatasetVersion(data.oncokb_dataset_version);
      }
    });

    return () => {
      mounted = false;
    };
  }, [modelId]);

  return (
    <CardContainer>
      <CardColumn>
        {descriptionTileData && (
          <React.Suspense
            fallback={<div className={styles.LoadingTile}>Loading...</div>}
          >
            <DescriptionTile data={descriptionTileData} />
          </React.Suspense>
        )}

        {oncoAlterations.length > 0 && (
          <React.Suspense
            fallback={<div className={styles.LoadingTile}>Loading...</div>}
          >
            <OncogenicAlterationsTile
              oncogenicAlterations={oncoAlterations}
              oncokbDatasetVersion={oncokbDatasetVersion}
            />
          </React.Suspense>
        )}
        {compoundSensitivityData && (
          <React.Suspense
            fallback={<div className={styles.LoadingTile}>Loading...</div>}
          >
            <CompoundSensitivityTile
              depmapId={modelId}
              dataMatrix={compoundSensitivityData}
            />
          </React.Suspense>
        )}
      </CardColumn>
      <CardColumn>
        {prefDepCrisprData && prefDepRnaiData && (
          <React.Suspense
            fallback={<div className={styles.LoadingTile}>Loading...</div>}
          >
            <PrefDepTile
              depmapId={modelId}
              crisprData={prefDepCrisprData}
              rnaiData={prefDepRnaiData}
            />
          </React.Suspense>
        )}
      </CardColumn>
      <CardColumn>
        {cellLineDatasets && (
          <React.Suspense
            fallback={<div className={styles.LoadingTile}>Loading...</div>}
          >
            <DatasetsTile cellLineDatasets={cellLineDatasets} />
          </React.Suspense>
        )}
        {hasMetMapData && (
          <AsyncTile url={`/tile/cell_line/metmap/${modelId}`} />
        )}
      </CardColumn>
    </CardContainer>
  );
};

export default CellLineOverview;
