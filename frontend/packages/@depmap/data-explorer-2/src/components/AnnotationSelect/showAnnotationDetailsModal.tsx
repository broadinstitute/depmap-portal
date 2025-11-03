import React, { useEffect, useRef, useState } from "react";
import { breadboxAPI, cached } from "@depmap/api";
import { showInfoModal } from "@depmap/common-components";
import DetailsModal from "../DimensionSelectV2/useModal/DatasetDetails";

interface Props {
  dataset_id: string;
}

function AnnotationDetailsModal({ dataset_id }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [description, setDescription] = useState<string | undefined | null>(
    undefined
  );

  useEffect(() => {
    (async () => {
      setIsLoading(true);

      try {
        const dataset = await cached(breadboxAPI).getDataset(dataset_id);
        setDescription(dataset.description);

        if (
          dataset.format === "matrix_dataset" ||
          dataset.name !== `${dataset.index_type_name} metadata`
        ) {
          const modalBody = ref.current?.closest(".modal-body");
          const modalHeaderH4 = modalBody?.previousElementSibling?.querySelector(
            "h4"
          );

          if (modalHeaderH4) {
            modalHeaderH4.innerText = dataset.name;
          }
        }
      } catch (e) {
        window.console.error(e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [dataset_id]);

  return (
    <div ref={ref}>
      <DetailsModal isLoading={isLoading} description={description} />
    </div>
  );
}

export default function showAnnotationDetailsModal(dataset_id: string) {
  showInfoModal({
    title: "Annotation Source Details",
    closeButtonText: "OK",
    content: <AnnotationDetailsModal dataset_id={dataset_id} />,
    modalProps: { bsSize: "large" },
  });
}
