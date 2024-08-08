import React, { useReducer, useState } from "react";
import jsonBeautify from "json-beautify";
import { Button } from "react-bootstrap";
import { isCompleteExpression } from "@depmap/data-explorer-2";
import { DataExplorerContext } from "@depmap/types";
import contextBuilderReducer from "src/data-explorer-2/components/ContextBuilder/contextBuilderReducer";
import { useEvaluatedExpressionResult } from "src/data-explorer-2/components/ContextBuilder/Expression/utils";
import {
  denormalizeExpr,
  normalizeExpr,
} from "src/data-explorer-2/components/ContextBuilder/contextBuilderUtils";
import ContextNameForm from "src/data-explorer-2/components/ContextBuilder/ContextNameForm";
import Expression from "src/data-explorer-2/components/ContextBuilder/Expression";
import styles from "src/data-explorer-2/styles/ContextBuilder.scss";

interface Props {
  context: any;
  onClickSave: (context: DataExplorerContext) => void;
  onClickCancel: () => void;
  editInCellLineSelector: (
    modelNamesOrIDs: string[],
    shouldUseModelNames: boolean
  ) => Promise<string[]>;
}

type Expr = Record<string, any> | null;

const SHOW_DEBUG_INFO = false;

const emptyExpr: Expr = { "==": [null, null] };
const emptyGroup: Expr = denormalizeExpr(emptyExpr);

function ModalContent({
  context,
  onClickSave,
  onClickCancel,
  editInCellLineSelector,
}: Props) {
  const [name, setName] = useState(context.name || "");
  const [expr, dispatch] = useReducer(
    contextBuilderReducer,
    denormalizeExpr(context.expr) || emptyGroup
  );
  const [shouldShowValidation, setShouldShowValidation] = useState(false);

  const result = useEvaluatedExpressionResult(context.context_type, expr);
  const hasSomeMatches = result && result.num_matches > 0;

  const handleClickSave = async () => {
    setShouldShowValidation(true);

    if (name && isCompleteExpression(expr) && hasSomeMatches) {
      onClickSave({
        name,
        context_type: context.context_type,
        expr: normalizeExpr(expr),
      });
    }
  };

  return (
    <div className={styles.ModalContent}>
      <ContextNameForm
        value={name}
        onChange={setName}
        onSubmit={handleClickSave}
        shouldShowValidation={shouldShowValidation}
      />
      <div className={styles.mainGroup}>
        <Expression
          expr={expr}
          path={[]}
          dispatch={dispatch}
          entity_type={context.context_type}
          shouldShowValidation={shouldShowValidation}
          editInCellLineSelector={editInCellLineSelector}
        />
      </div>
      {SHOW_DEBUG_INFO && (
        <div style={{ marginTop: 20 }}>
          <pre
            style={{
              border: `1px solid ${
                isCompleteExpression(expr) ? "#0a0" : "#f99"
              }`,
            }}
          >
            <code style={{ fontSize: 10 }}>
              {jsonBeautify(expr, null as any, 2, 80)}
            </code>
          </pre>
        </div>
      )}
      <div className={styles.footer}>
        <Button id="cancel-context-builder" onClick={onClickCancel}>
          Cancel
        </Button>
        <Button
          id="save-context-builder"
          bsStyle="primary"
          onClick={handleClickSave}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

export default ModalContent;
