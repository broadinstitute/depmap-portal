import React, { useEffect, useRef, useState } from "react";
import cx from "classnames";
import { Typeahead } from "react-bootstrap-typeahead";
import { CSSTransition } from "react-transition-group";
import { toStaticUrl } from "src/common/utilities/context";
import styles from "src/common/styles/Glossary.scss";
import replaceReferencesWithLinks, {
  replaceSuperscriptTags,
} from "src/common/components/Glossary/replaceReferencesWithLinks";
import { GlossaryItem } from "src/common/components/Glossary/types";

interface Props {
  data: GlossaryItem[];
}

function Glossary({ data }: Props) {
  const [selected, setSelected] = useState<{ value: number }[]>([]);
  const [open, setOpen] = useState(false);
  const wasOpen = useRef(false);
  const element = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && selected?.length > 0) {
      element.current
        ?.querySelector(`[data-term-index="${selected[0].value}"]`)
        ?.scrollIntoView({ behavior: wasOpen.current ? "smooth" : "auto" });
    }

    wasOpen.current = open;
  }, [open, selected]);

  const searchOptions = data.map((item, index) => ({
    label: item.term,
    value: index,
  }));

  return (
    <div
      className={cx(styles.overlay, { [styles.open]: open })}
      ref={element}
      role="presentation"
      onClick={(e) => {
        // Close this flyout when the background overlay is clicked.
        if (e.target === e.currentTarget) {
          setOpen(false);
        }
      }}
    >
      <div className={styles.container}>
        <div className={styles.buttonWrapper}>
          <button
            type="button"
            className={styles.toggleButton}
            onClick={() => setOpen((prev) => !prev)}
          >
            <span className={styles.buttonText}>Terms and definitions</span>
          </button>
        </div>
        <div className={styles.content}>
          <CSSTransition in={open} timeout={500} unmountOnExit>
            <>
              <div className={styles.search}>
                <Typeahead
                  id="glossary-search"
                  options={searchOptions}
                  selected={selected}
                  onChange={setSelected}
                  minLength={1}
                  placeholder="Search for terms from this page"
                  autoFocus={!selected || selected.length === 0}
                  highlightOnlyResult
                />
                <span className={styles.magnifyingGlass}>
                  <img
                    alt=""
                    src={toStaticUrl(
                      "img/nav_footer/magnifyingglass_purple.svg"
                    )}
                  />
                </span>
              </div>
              <dl className={styles.definitions}>
                {data.map((item, index) => (
                  <div key={item.term} data-term-index={index}>
                    <dt>{item.term}</dt>
                    {item.multipartDefinition?.map((part: string) => (
                      <div key={part} style={{ marginTop: "15px" }}>
                        <dd>{replaceSuperscriptTags(part)}</dd>
                      </div>
                    ))}
                    <dd>
                      {replaceReferencesWithLinks(
                        item.definition,
                        item.references
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </>
          </CSSTransition>
        </div>
      </div>
    </div>
  );
}

export default Glossary;
