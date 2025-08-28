import React, { useRef } from "react";
import { DropdownButton, MenuItem } from "react-bootstrap";
import { Tooltip } from "@depmap/common-components";
import { isBreadboxOnlyMode } from "../../isBreadboxOnlyMode";
import styles from "../../styles/ContextManager.scss";

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
          {/* FIXME: We could support this by showing the new SliceTable view */}
          {!isBreadboxOnlyMode && (
            <MenuItem onClick={onClickDownload}>Download…</MenuItem>
          )}
          <MenuItem className={styles.deleteContext} onClick={onClickDelete}>
            Delete
          </MenuItem>
        </DropdownButton>
      </Tooltip>
    </div>
  );
}

export default MoreOptionsButton;
