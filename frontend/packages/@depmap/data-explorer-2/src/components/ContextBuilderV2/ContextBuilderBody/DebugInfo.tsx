import React, { useEffect, useState } from "react";
import jsonBeautify from "json-beautify";
import { showInfoModal } from "@depmap/common-components";
import { DataExplorerContextV2, isValidSliceQuery } from "@depmap/types";
import { isCompleteExpression } from "../../../utils/misc";
import { dataExplorerAPI } from "../../../services/dataExplorerAPI";
import { useContextBuilderState } from "../state/ContextBuilderState";
import styles from "../../../styles/ContextBuilderV2.scss";

type PartialDeep<T> = { [P in keyof T]?: PartialDeep<T[P]> };

async function copyToClipboard(context: PartialDeep<DataExplorerContextV2>) {
  const text = jsonBeautify(context, null!, 2, 80);

  try {
    await navigator.clipboard.writeText(text);
    showInfoModal({
      title: "Success!",
      content: `Context “${context.name || "(untitled)"}” copied to clipboard.`,
    });
  } catch (err) {
    window.console.error("Failed to copy text:", err);
  }
}

// press Ctrl+Opt+D to bring up this debug panel
const DebugInfo = () => {
  const {
    mainExpr,
    vars,
    dimension_type,
    embeddedContexts,
    name,
  } = useContextBuilderState();
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
      <h5>embedded contexts</h5>
      <pre>
        <code>{jsonBeautify(embeddedContexts, null!, 2, 80)}</code>
      </pre>
      <h5>var domains</h5>
      <pre className={styles.debugVarDomains}>
        <code>
          {jsonBeautify(varDomains, null!, 2, 80).replace(
            /"(…and \d+ more)"/g,
            "$1"
          )}
        </code>
      </pre>
      <button
        type="button"
        onClick={() => {
          copyToClipboard({
            name,
            dimension_type,
            expr: mainExpr as DataExplorerContextV2["expr"],
            vars,
            ...(Object.keys(embeddedContexts).length > 0
              ? { contexts: embeddedContexts }
              : {}),
          });
        }}
      >
        copy to clipboard
      </button>
    </details>
  );
};

const Wrapper = () => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.altKey && e.code === "KeyD") {
        setShow((s) => !s);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return show ? <DebugInfo /> : null;
};

export default Wrapper;
