import styles from "../../../styles/GeneTea.scss";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { cached, legacyPortalAPI } from "@depmap/api";
import { Spinner } from "@depmap/common-components";
import GeneTeaTerm from "@depmap/data-explorer-2/src/components/DataExplorerPage/components/plot/integrations/GeneTea/GeneTeaTerm";
import { Button } from "react-bootstrap";
import { DepMap } from "@depmap/globals";

interface ExcerptTableProps {
  useTerms: boolean;
  term: string;
  termToMatchingGenesMap: Map<string, string[]>;
  useAllGenes: boolean;
}

const ExcerptTable: React.FC<ExcerptTableProps> = ({
  useTerms,
  term,
  termToMatchingGenesMap,
  useAllGenes,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState(false);
  const [allGenes, setAllGenes] = useState<string[]>([]);

  const matchingGenes = useMemo(() => termToMatchingGenesMap.get(term) || [], [
    termToMatchingGenesMap,
    term,
  ]);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      setError(false);

      try {
        let allAvailableGenes: string[] = [];
        if (useAllGenes) {
          const genesMatchingTermsData = await cached(
            legacyPortalAPI
          ).fetchGeneTeaGenesMatchingTermExperimental([term], []);
          allAvailableGenes = genesMatchingTermsData[term].split(" ");
          setAllGenes(allAvailableGenes);
        }
        const fetchedData = await cached(
          legacyPortalAPI
        ).fetchGeneTeaTermContext(
          term,
          useAllGenes ? allAvailableGenes : matchingGenes || []
        );
        setData(fetchedData);
      } catch (e) {
        setError(true);
        window.console.error(e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [term, matchingGenes]);

  const handleClickCreateTermContext = useCallback(() => {
    DepMap.saveNewContext({
      name: term,
      context_type: "gene",
      expr: {
        in: [{ var: "entity_label" }, useAllGenes ? allGenes : matchingGenes],
      },
    });
  }, [term, matchingGenes, allGenes]);

  return (
    <div style={{ paddingTop: "20px" }}>
      {" "}
      <p>
        The term “
        <GeneTeaTerm
          term={term}
          synonyms={[]} // TODO: ask Bella if we need to use synonyms and coincident this for anything. Reusing data explorer's GeneTeaTerm, and this doesn't seem like something we need.
          coincident={[]}
        />
        ” is associated with{" "}
        {useAllGenes ? allGenes.length : matchingGenes.length} of the selected
        genes.
      </p>
      {/* If the user is grouping terms (i.e. using Term Groups instead of just Terms),
      the excerpt table will render inside a tab for a particular term. We need this button to
      differentiate creating a Gene Context from TERM matching genes from
      the button for creating a Gene Context from TERM GROUP matching genes (located outside the tabs and ExcerptTable)  */}
      {!useTerms && (
        <div style={{ paddingBottom: "20px" }}>
          <Button
            bsStyle="primary"
            bsSize="small"
            onClick={handleClickCreateTermContext}
          >
            Save as Gene Context
          </Button>
        </div>
      )}
      <table className="table">
        <thead>
          <tr>
            <th>Gene</th>
            <th>Context</th>
          </tr>
        </thead>
        {data && (
          <tbody>
            {Object.entries(data).map(([gene, context]) => {
              const html = context
                .replace(/<a href/g, '<a target="_blank" href')
                .replace(/ \| /g, "<br/><br/>");

              return (
                <tr key={gene}>
                  <td>
                    <a
                      href={`../gene/${gene}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {gene}
                    </a>
                  </td>
                  <td>
                    {/* eslint-disable-next-line react/no-danger */}
                    <div dangerouslySetInnerHTML={{ __html: html }} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        )}
      </table>
      {isLoading && (
        <div className={styles.geneTeaModalSpinner}>
          <Spinner left="0px" position="static" />
        </div>
      )}
      {error && (
        <h2>
          Sorry, there was a problem retrieving the context for this term 😭
        </h2>
      )}
      {data && Object.keys(data).length === 0 && (
        <h2>Hmm, the context for this term seems to have gone missing 🤔</h2>
      )}
    </div>
  );
};

export default ExcerptTable;
