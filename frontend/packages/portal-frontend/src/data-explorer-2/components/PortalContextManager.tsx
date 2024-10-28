import React, { useEffect, useState } from "react";
import { Button, Modal } from "react-bootstrap";
import { ApiContext } from "@depmap/api";
import { Spinner } from "@depmap/common-components";
import { ContextManager } from "@depmap/data-explorer-2";
import {
  getDapi as getApi,
  getVectorCatalogApi,
} from "src/common/utilities/context";
import {
  convertLegacyContexts,
  someLegacyContextsExist,
} from "src/data-explorer-2/utils";

interface Props {
  onHide: () => void;
  showHelpText?: boolean;
  initialContextType?: string;
}

function PortalContextManager({
  onHide,
  showHelpText = false,
  initialContextType = undefined,
}: Props) {
  const [loading, setLoading] = useState(someLegacyContextsExist());
  const [error, setError] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        // Prior to the 23Q2 release, contexts were saved to local storage. Now
        // only the hashes reside there and the acutal content is persisted to
        // a bucket. These two formats are incompatible (with a different
        // hashing method) so we do one big wholesale conversion before trying
        // to load anything. This can probably be removed after a reasonable
        // amount of time has gone by.
        if (someLegacyContextsExist()) {
          setLoading(true);
          await convertLegacyContexts();
          setLoading(false);
        }
      } catch (e) {
        setError(true);
      }
    })();
  }, []);

  if (error) {
    return (
      <Modal show onHide={onHide}>
        <Modal.Header closeButton>
          <Modal.Title>Error</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div>
            There was a problem opening the Context Manager. Please try again
            later. If this problem persists, use the feedback form to report it.
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button bsStyle="primary" onClick={onHide}>
            Cancel
          </Button>
        </Modal.Footer>
      </Modal>
    );
  }

  return loading ? (
    <Modal show onHide={() => {}}>
      <Modal.Header>
        <Modal.Title>Converting your contexts</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div>
          Please wait while we convert your contexts to a new format. Don’t
          close this tab or navigate away until this process completes...
        </div>
        <Spinner left="0px" position="static" />
      </Modal.Body>
    </Modal>
  ) : (
    // ApiContext is needed to support Cell Line Selector inside of
    // ContextBuilder.
    <ApiContext.Provider value={{ getApi, getVectorCatalogApi }}>
      <ContextManager
        onHide={onHide}
        initialContextType={initialContextType}
        showHelpText={showHelpText}
      />
    </ApiContext.Provider>
  );
}

export default PortalContextManager;
