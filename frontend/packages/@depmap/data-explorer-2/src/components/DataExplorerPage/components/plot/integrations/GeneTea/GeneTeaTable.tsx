import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import cx from "classnames";
import { LegacyPortalApiResponse } from "@depmap/api";
import { Tooltip, WordBreaker } from "@depmap/common-components";
import { DataExplorerContext } from "@depmap/types";
import { SectionStackContext } from "../../../SectionStack";
import GeneTeaTerm from "./GeneTeaTerm";
import styles from "../../../../styles/DataExplorer2.scss";

type GeneTeaEnrichedTerms = LegacyPortalApiResponse["fetchGeneTeaEnrichment"];

interface Props {
  data: GeneTeaEnrichedTerms;
  onClickColorByContext: (context: DataExplorerContext) => void;
  onClickTerm: (
    term: string,
    matchingGenes: string[],
    synonyms: string[],
    coincident: string[]
  ) => void;
}

function GeneTeaTable({ data, onClickColorByContext, onClickTerm }: Props) {
  const ref = useRef<HTMLTableElement>(null);
  const [hasScrollBar, setHasScrollBar] = useState(false);
  const { sectionHeights } = useContext(SectionStackContext);

  const checkScrollBar = useCallback(() => {
    if (ref.current) {
      const stack = ref.current.closest("#section-stack") as Element;

      // There was a previous assumption that Gene Tea would always be in
      // a stack component, but GeneTEA is now being added to the Predictability
      // Prototype, which does not use a stack component.
      if (stack) {
        setHasScrollBar(stack.scrollHeight > stack.clientHeight);
      }
    }
  }, []);

  useEffect(checkScrollBar, [checkScrollBar, sectionHeights]);

  useEffect(() => {
    window.addEventListener("resize", checkScrollBar);
    return () => window.removeEventListener("resize", checkScrollBar);
  }, [checkScrollBar]);

  return (
    <table
      ref={ref}
      className={cx(styles.GeneTeaTable, {
        [styles.hasScrollBar]: hasScrollBar,
      })}
    >
      <thead>
        <tr>
          <th>Term</th>
          <th>Genes</th>
          <th>FDR</th>
        </tr>
      </thead>
      <tbody>
        {data.term.map((term: string, i: number) => (
          <tr key={term}>
            <td>
              <GeneTeaTerm
                term={term}
                synonyms={data.synonyms[i]}
                coincident={data.coincident[i]}
                onClick={() =>
                  onClickTerm(
                    term,
                    data.matchingGenes[i],
                    data.synonyms[i],
                    data.coincident[i]
                  )
                }
              />
            </td>
            <Tooltip
              id="matching-genes-tooltip"
              content={data.matchingGenes[i].join(", ")}
              placement="top"
            >
              <td
                className={styles.geneTeaMatches}
                onClick={() => {
                  if (onClickColorByContext) {
                    onClickColorByContext({
                      name: term,
                      context_type: "gene",
                      expr: {
                        in: [{ var: "entity_label" }, data.matchingGenes[i]],
                      },
                    });
                  }
                }}
              >
                {data.matchingGenes[i].length}
              </td>
            </Tooltip>
            <td>
              <WordBreaker text={data.fdr[i].toExponential(4)} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default GeneTeaTable;
