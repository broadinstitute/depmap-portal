import React, { useReducer, useState } from "react";
import jsonBeautify from "json-beautify";
import { Button } from "react-bootstrap";
import { DataExplorerContext } from "@depmap/types";
import { isCompleteExpression } from "../../utils/misc";
import ContextNameForm from "./ContextNameForm";
import Expression from "./Expression";
import contextBuilderReducer from "./contextBuilderReducer";
import { denormalizeExpr, normalizeExpr } from "./contextBuilderUtils";
import { useEvaluatedExpressionResult } from "./Expression/utils";
import styles from "../../styles/ContextBuilder.scss";

interface Props {
  context: DataExplorerContext | { context_type: string };
  onClickSave: (context: DataExplorerContext) => void;
  onClickCancel: () => void;
  editInCellLineSelector: (
    modelNamesOrIDs: string[],
    shouldUseModelNames: boolean
  ) => Promise<string[]>;
}

const SHOW_DEBUG_INFO = false;

const emptyGroup = denormalizeExpr({ "==": [null, null] });

function ModalContent({
  context,
  onClickSave,
  onClickCancel,
  editInCellLineSelector,
}: Props) {
  const [name, setName] = useState("name" in context ? context.name : "");
  const [expr, dispatch] = useReducer(
    contextBuilderReducer,
    denormalizeExpr("expr" in context ? context.expr : null) || emptyGroup
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
          slice_type={context.context_type}
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
              {jsonBeautify(expr, null!, 2, 80)}
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
