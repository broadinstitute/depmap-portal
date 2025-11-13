import React, { useEffect, useState } from "react";
import jsonBeautify from "json-beautify";
import { isValidSliceQuery } from "@depmap/types";
import { isCompleteExpression } from "../../../utils/misc";
import { dataExplorerAPI } from "../../../services/dataExplorerAPI";
import { useContextBuilderState } from "../state/ContextBuilderState";
import styles from "../../../styles/ContextBuilderV2.scss";

const SHOW_DEBUG_INFO = false;

const DebugInfo = () => {
  const { mainExpr, vars } = useContextBuilderState();
  const [varDomains, setVarDomains] = useState<object>({});

  useEffect(() => {
    const varNames = Object.keys(vars);

    Promise.all(
      varNames.map((varName) => {
        const variable = vars[varName];

        return isValidSliceQuery(variable)
          ? dataExplorerAPI.fetchVariableDomain(variable)
          : null;
      })
    ).then((domains) => {
      const keyedDomains = {} as Record<string, object | null>;

      domains.forEach((domain, i) => {
        // eslint-disable-next-line
        let domainToSet = { ...domain } as any;

        if (
          domain &&
          "unique_values" in domain &&
          domain.unique_values.length > 5
        ) {
          domainToSet.unique_values = [
            ...domain.unique_values.slice(0, 3),
            `…and ${domain.unique_values.length - 3} more`,
          ];
        }

        keyedDomains[varNames[i]] = domainToSet;
      });

      setVarDomains(keyedDomains);
    });
  }, [vars]);

  return (
    <details className={styles.DebugInfo}>
      <summary>Debug info</summary>
      <h5>expr</h5>
      <pre
        style={{
          border: `1px solid ${
            isCompleteExpression(mainExpr) ? "#0a0" : "#f99"
          }`,
        }}
      >
        <code style={{ fontSize: 10 }}>
          {jsonBeautify(mainExpr, null!, 2, 80)}
        </code>
      </pre>
      <h5>vars</h5>
      <pre>
        <code>{jsonBeautify(vars, null!, 2, 80)}</code>
      </pre>
      <h5>var domains</h5>
      <pre className={styles.debugVarDomains}>
        <code>{jsonBeautify(varDomains, null!, 2, 80)}</code>
      </pre>
    </details>
  );
};

export default SHOW_DEBUG_INFO ? DebugInfo : () => null;
