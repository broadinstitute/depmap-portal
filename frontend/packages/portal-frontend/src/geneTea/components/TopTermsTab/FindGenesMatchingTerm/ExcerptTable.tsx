import styles from "@depmap/data-explorer-2/src/components/DataExplorerPage/styles/DataExplorer2.scss";
import React, { useEffect, useState } from "react";
import { cached, legacyPortalAPI } from "@depmap/api";
import { Spinner } from "@depmap/common-components";
import GeneTeaTerm from "@depmap/data-explorer-2/src/components/DataExplorerPage/components/plot/integrations/GeneTea/GeneTeaTerm";

interface ExcerptTableProps {
  term: string;
  termToMatchingGenesMap: Map<string, string[]>;
}

const ExcerptTable: React.FC<ExcerptTableProps> = ({
  term,
  termToMatchingGenesMap,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState(false);
  const matchingGenes = termToMatchingGenesMap.get(term) || [];

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      setError(false);

      try {
        const fetchedData = await cached(
          legacyPortalAPI
        ).fetchGeneTeaTermContext(term, matchingGenes || []);
        setData(fetchedData);
      } catch (e) {
        setError(true);
        window.console.error(e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [term, matchingGenes]);

  return (
    <div>
      {" "}
      <p>
        The term “
        <GeneTeaTerm
          term={term}
          synonyms={[]} // TODO: ask Bella if we need to use synonyms and coincident this for anything. Reusing data explorer's GeneTeaTerm, and this doesn't seem like something we need.
          coincident={[]}
        />
        ” is associated with {matchingGenes.length} of the selected genes.
      </p>
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
