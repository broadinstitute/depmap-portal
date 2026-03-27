import React, { useEffect, useState } from "react";
import { breadboxAPI, cached } from "@depmap/api";
import { showInfoModal } from "@depmap/common-components";
import SliceTable from "@depmap/slice-table";
import { isV2Context } from "../../utils/context";
import { fetchContext } from "../../utils/context-storage";
import {
  getDimensionTypeLabel,
  pluralize,
  uncapitalize,
} from "../../utils/misc";
import { convertContextV1toV2 } from "../../utils/context-converter";
import {
  PlotlyLoaderProvider,
  usePlotlyLoader,
} from "../../contexts/PlotlyLoaderContext";
import styles from "../../styles/ContextManager.scss";

function DownloadTable({
  contextHash,
  dimension_type,
  contextName,
  PlotlyLoader,
}: {
  contextName: string;
  dimension_type: string;
  contextHash: string;
  PlotlyLoader: ReturnType<typeof usePlotlyLoader>;
}) {
  const [contextIds, setContextIds] = useState<Set<string>>();
  const [total, setTotal] = useState(0);

  useEffect(() => {
    (async () => {
      let context = await fetchContext(contextHash);

      if (!isV2Context(context)) {
        context = await convertContextV1toV2(context);
      }

      const { ids, num_candidates } = await cached(breadboxAPI).evaluateContext(
        context
      );
      setContextIds(new Set(ids));
      setTotal(num_candidates);
    })();
  }, [contextHash]);

  const entity = getDimensionTypeLabel(dimension_type);
  const entities = uncapitalize(pluralize(entity));

  return (
    <PlotlyLoaderProvider PlotlyLoader={PlotlyLoader}>
      <SliceTable
        index_type_name={dimension_type}
        downloadFilename={contextName}
        implicitFilter={({ id }) => Boolean(contextIds?.has(id))}
        isLoading={!contextIds}
        renderCustomControls={() => {
          if (!contextIds) {
            return null;
          }

          return (
            <div>
              Showing <b>{contextIds.size.toLocaleString()}</b> matches of{" "}
              {total.toLocaleString()} {entities}
            </div>
          );
        }}
      />
    </PlotlyLoaderProvider>
  );
}

function showDownloadContextModal(
  contextName: string,
  dimension_type: string,
  contextHash: string,
  PlotlyLoader: ReturnType<typeof usePlotlyLoader>
) {
  showInfoModal({
    title: `Download context '${contextName}'`,
    modalProps: { className: "foo", bsSize: "lg" },
    content: (
      <div className={styles.downloadContextTable}>
        <DownloadTable
          contextName={contextName}
          dimension_type={dimension_type}
          contextHash={contextHash}
          PlotlyLoader={PlotlyLoader}
        />
      </div>
    ),
  });
}

export default showDownloadContextModal;
