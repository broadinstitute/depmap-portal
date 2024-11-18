import React, { useState } from "react";
import { Button } from "react-bootstrap";
import { Tooltip } from "@depmap/common-components";
import MoreOptionsButton from "./MoreOptionsButton";
import styles from "../../styles/ContextManager.scss";

interface Props {
  contextName: string;
  onClickDelete: () => void;
  onClickDownload: () => void;
  onClickDuplicate: () => void;
  onClickEdit: () => void;
}

function ContextListItem({
  contextName,
  onClickDelete,
  onClickDownload,
  onClickDuplicate,
  onClickEdit,
}: Props) {
  const [key, setKey] = useState(0);

  return (
    <div className={styles.ContextListItem}>
      <span>{contextName}</span>
      <span key={key}>
        <Tooltip id="edit-context-tooltip" content="Edit" placement="top">
          <Button
            name="edit-context"
            onClick={() => {
              onClickEdit();
              // prevent tooltip from re-opening
              setKey((k) => k + 1);
            }}
          >
            <i className="glyphicon glyphicon-pencil" />
          </Button>
        </Tooltip>
        <Tooltip
          id="duplicate-context-tooltip"
          content="Duplicate"
          placement="top"
        >
          <Button name="duplicate-context" onClick={onClickDuplicate}>
            <i className="glyphicon glyphicon-duplicate" />
          </Button>
        </Tooltip>
        <MoreOptionsButton
          onClickDelete={() => {
            onClickDelete();
            setKey((k) => k + 1);
          }}
          onClickDownload={() => {
            onClickDownload();
            setKey((k) => k + 1);
          }}
        />
      </span>
    </div>
  );
}

export default ContextListItem;
