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
        keyedDomains[varNames[i]] = domain;
      });

      setVarDomains(keyedDomains);
    });
  }, [vars]);

  return (
    <div className={styles.DebugInfo}>
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
      <pre>
        <code>{jsonBeautify(varDomains, null!, 2, 80)}</code>
      </pre>
    </div>
  );
};

export default SHOW_DEBUG_INFO ? DebugInfo : () => null;
