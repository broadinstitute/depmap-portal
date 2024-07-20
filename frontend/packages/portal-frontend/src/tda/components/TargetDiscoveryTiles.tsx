import React, { memo, useState } from "react";
import AsyncTile from "src/common/components/AsyncTile";
import { DropdownButton, MenuItem } from "react-bootstrap";
import tiles from "src/tda/json/tiles.json";
import styles from "src/tda/styles/TargetDiscoveryTiles.scss";

interface Props {
  symbol: string | null;
}

const getGenePageUrl = (gene: string) => {
  return window.location.href
    .replace(/\/tda\//, `/gene/${encodeURIComponent(gene.trim())}`)
    .replace(window.location.search, "");
};

// WORKAROUND: The tiles in the gene page's Overview tab have several links of
// the variety of "view details in the Predictability tab." Here in the TDA
// app, those links don't make sense because we're not rendering any of those
// other tabs. This patches the tile's HTML such that any such links open in a
// new browser tab instead.
const patchAnyClickTabHandlers = (html: string, gene: string): string => {
  return html
    .replace(
      /javascript:clickTab\('#([a-z]+)'\)/,
      (_, tab) => `${getGenePageUrl(gene)}?tab=${tab}`
    )
    .replace(
      /javascript:clickTab\(&#39;#characterization&#39;\)[^"]*/g,
      `${getGenePageUrl(gene)}?tab=characterization&characterization=mutation`
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

const TargetDiscoveryTiles = memo(({ symbol }: Props) => {
  const [tile, setTile] = useState(tiles[0]);

  const onSelect = (value: string) => {
    const next = tiles.find((t) => t.key === value);

    if (next) {
      setTile(next);
    }
  };

  const url = `/tile/gene/${tile.key}/${symbol}`;

  return (
    <div className={styles.TargetDiscoveryTiles}>
      <div className={styles.header}>
        {symbol && (
          <span>
            Viewing gene tile for{" "}
            <a href={getGenePageUrl(symbol)} target="_blank" rel="noreferrer">
              {symbol}
            </a>
          </span>
        )}
      </div>
      <div className={styles.tileSelector}>
        <Dropdown
          id="gene-tile-dropdown"
          label={tile.label}
          onSelect={onSelect}
        />
        <div className={styles.tile}>
          {symbol ? (
            <AsyncTile
              id="gene-tile"
              key={url}
              url={url}
              transformHtml={(html) => {
                return (
                  patchAnyClickTabHandlers(html, symbol)
                    // Make all links open in a new tab.
                    .replace(/(href="[^"]+")/g, '$1 target="_blank"')
                    .replace(/(href='[^']+')/g, "$1 target='_blank'")
                    // Fixes an issue where popovers could get clipped by
                    // this container (which is set to overflow="hidden").
                    .replace(
                      /(data-toggle="popover")/g,
                      '$1 data-container="body"'
                    )
                    // Make tooltips open to the left where there's more room.
                    .replace(/data-placement="right"/g, 'data-placement="left"')
                );
              }}
              renderEmptyResponse={() => (
                <div className={styles.emptyState}>
                  No {tile.label} tile could be found for {symbol}.
                </div>
              )}
            />
          ) : (
            <div className={styles.emptyState}>
              Select a gene to see more detailed information.
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default TargetDiscoveryTiles;
