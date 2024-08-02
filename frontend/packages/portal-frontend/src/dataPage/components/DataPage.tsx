import { DownloadTableData, Release, ReleaseType } from "@depmap/data-slicer";
import React, { useEffect, useState } from "react";
import { getDapi } from "src/common/utilities/context";
import styles from "src/dataPage/styles/DataPage.scss";
import { DataAvailability } from "../models/types";
import DataTabs from "./DataTabs";
import { currentReleaseDatasets } from "./utils";

interface DataPageProps {
  termsDefinitions: { [key: string]: string };
  releaseNotesUrl: string | null;
  forumUrl: string | null;
}

export const DataPage = ({
  termsDefinitions,
  releaseNotesUrl,
  forumUrl,
}: DataPageProps) => {
  const dapi = getDapi();
  const [allDownloads, setAllDownloads] = useState<DownloadTableData>([]);
  const [
    currentReleaseData,
    setCurrentReleaseData,
  ] = useState<DownloadTableData>([]);
  const [fullyInitialized, setFullyInitialized] = useState<boolean>(false);
  const [releaseData, setReleaseData] = useState<Release[]>([]);
  const [releaseTypes, setReleaseTypes] = useState<ReleaseType[]>([]);
  const [fileTypes, setFileTypes] = useState<string[]>([]);
  const [sources, setSources] = useState<string[]>([]);

  const [dataUsageUrl, setDataUsageUrl] = useState<string>("");
  const [allDataAvail, setAllDataAvail] = useState<DataAvailability>({
    all_depmap_ids: [],
    data_type_url_mapping: {},
    drug_count_mapping: {},
    data_types: [],
    values: [],
  });
  const [
    currentReleaseDataAvail,
    setCurrentReleaseDataAvail,
  ] = useState<DataAvailability>({
    all_depmap_ids: [],
    data_type_url_mapping: {},
    drug_count_mapping: {},
    data_types: [],
    values: [],
  });

  useEffect(() => {
    (async () => {
      const downloads = await dapi.getAllDataTabDownloadData();
      setAllDownloads(downloads.table);
      setCurrentReleaseData(downloads.currentRelease);
      setReleaseData(downloads.releaseData);
      setReleaseTypes(downloads.releaseType as ReleaseType[]);

      setDataUsageUrl(downloads.dataUsageUrl);

      setFileTypes(downloads.fileType);
      setSources(downloads.source);

      const dataAvail = await dapi.getDataPageDataAvailability();
      setAllDataAvail(dataAvail);

      const currentDataValues: number[][] = [];
      const currentDataTypes: string[] = [];
      const currentDataTypeUrlMapping: { [key: string]: string } = {};
      const currentDataTypeDrugCountMapping: { [key: string]: number } = {};
      dataAvail.data_types.forEach((data_type: string, index: number) => {
        if (currentReleaseDatasets.includes(data_type)) {
          currentDataTypes.push(data_type);
          currentDataValues.push(dataAvail.values[index]);
          currentDataTypeUrlMapping[data_type] =
            dataAvail.data_type_url_mapping[data_type];
          currentDataTypeDrugCountMapping[data_type] =
            dataAvail.drug_count_mapping[data_type];
        }
      });

      setCurrentReleaseDataAvail({
        all_depmap_ids: dataAvail.all_depmap_ids,
        data_type_url_mapping: currentDataTypeUrlMapping,
        drug_count_mapping: currentDataTypeDrugCountMapping,
        data_types: currentDataTypes,
        values: currentDataValues,
      });
      setFullyInitialized(true);
    })();
  }, [dapi]);

  return (
    <div
      className={styles.DataPage}
      data-react-component-loaded-for-selenium={
        fullyInitialized ? "true" : "false"
      }
    >
      <header className={styles.header}>
        <h1>Data</h1>
        <p>
          Browse and access the complete collection of datasets available in the
          DepMap portal.
        </p>
      </header>
      <main className={styles.main}>
        <DataTabs
          allDownloads={allDownloads}
          currentReleaseData={currentReleaseData ?? []}
          releaseData={releaseData ?? []}
          releaseTypes={releaseTypes ?? []}
          fileTypes={fileTypes ?? []}
          sources={sources ?? []}
          dataUsageUrl={dataUsageUrl}
          currentReleaseDataAvail={currentReleaseDataAvail}
          allDataAvail={allDataAvail}
          termsDefinitions={termsDefinitions}
          releaseNotesUrl={releaseNotesUrl}
          forumUrl={forumUrl}
        />
      </main>
    </div>
  );
};

export default DataPage;
