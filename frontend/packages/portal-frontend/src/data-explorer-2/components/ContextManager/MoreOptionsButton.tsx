import React, { useRef } from "react";
import { DropdownButton, MenuItem } from "react-bootstrap";
import { Tooltip } from "@depmap/common-components";
import styles from "src/data-explorer-2/styles/ContextManager.scss";

interface Props {
  onClickDelete: () => void;
  onClickDownload: () => void;
}

function MoreOptionsButton({ onClickDelete, onClickDownload }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div ref={ref} className={styles.MoreOptionsButton}>
      <Tooltip
        id="more-context-options-tooltip"
        content="More options"
        placement="top"
      >
        <DropdownButton
          title={<i className="glyphicon glyphicon-option-horizontal" />}
          id="dropdown-basic"
          noCaret
          onToggle={() => {
            const div = ref.current;

            if (div) {
              div.querySelector("ul")!.style.top = `${
                86 +
                div.offsetTop -
                div.closest("#context-list-items")!.scrollTop
              }px`;
            }
          }}
        >
          <MenuItem onClick={onClickDownload}>Download…</MenuItem>
          <MenuItem className={styles.deleteContext} onClick={onClickDelete}>
            Delete
          </MenuItem>
        </DropdownButton>
      </Tooltip>
    </div>
  );
}

export default MoreOptionsButton;
