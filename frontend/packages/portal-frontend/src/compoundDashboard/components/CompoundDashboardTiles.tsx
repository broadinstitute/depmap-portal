import React, { memo, useState } from "react";
import AsyncTile from "src/common/components/AsyncTile";
import { DropdownButton, MenuItem } from "react-bootstrap";
import tiles from "../json/tiles.json";
import styles from "../styles/CompoundDashboardTiles.scss";

interface Props {
  compound: string | null;
  datasetId: string;
}

const getCompoundPageUrl = (compound: string) => {
  return window.location.href
    .replace(
      /\/compound_dashboard\//,
      `/compound/${encodeURIComponent(compound)}`
    )
    .replace(window.location.search, "");
};

const patchAnyClickTabHandlers = (html: string, gene: string): string => {
  return html.replace(
    /javascript:clickTab\('#([a-z]+)'\)/,
    (_, tab) => `${getCompoundPageUrl(gene)}?tab=${tab}`
  );
};

const Dropdown = ({
  id,
  label,
  onSelect,
}: {
  id: string;
  label: string;
  onSelect: (value: string) => void;
}) => {
  return (
    <DropdownButton
      id={id}
      title={
        <span>
          <div className={styles.dropdownTitle}>Select tile</div>
          <div>{label}</div>
        </span>
      }
      onSelect={onSelect as any}
    >
      {tiles.map((tile) => (
        <MenuItem key={tile.key} eventKey={tile.key}>
          {tile.label}
        </MenuItem>
      ))}
    </DropdownButton>
  );
};

const CompoundDashboardTiles = memo(({ compound, datasetId }: Props) => {
  const [tile, setTile] = useState(tiles[0]);

  const onSelect = (value: string) => {
    const next = tiles.find((t) => t.key === value);

    if (next) {
      setTile(next);
    }
  };

  const url = `/tile/compound/${tile.key}/${compound}?datasetName=${datasetId}`;

  return (
    <div className={styles.CompoundDashboardTiles}>
      <div className={styles.header}>
        {compound && (
          <span>
            Viewing compound tile for{" "}
            <a
              href={getCompoundPageUrl(compound)}
              target="_blank"
              rel="noreferrer"
            >
              {compound}
            </a>
          </span>
        )}
      </div>
      <div className={styles.tileSelector}>
        <Dropdown
          id="compound-tile-dropdown"
          label={tile.label}
          onSelect={onSelect}
        />
        <div className={styles.tile}>
          {compound ? (
            <AsyncTile
              id="compound-tile"
              key={url}
              url={url}
              transformHtml={(html) => {
                return (
                  patchAnyClickTabHandlers(html, compound)
                    // Make all links open in a new tab.
                    .replace(/(href="[^"]+")/g, '$1 target="_blank"')
                    .replace(/(href='[^']+')/g, "$1 target='_blank'")
                    // Make tooltips open to the left where there's more room.
                    .replace(/data-placement="right"/g, 'data-placement="left"')
                );
              }}
              renderEmptyResponse={() => (
                <div className={styles.emptyState}>
                  No {tile.label} tile could be found for {compound}.
                </div>
              )}
            />
          ) : (
            <div className={styles.emptyState}>
              Select a compound to see more detailed information.
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default CompoundDashboardTiles;
