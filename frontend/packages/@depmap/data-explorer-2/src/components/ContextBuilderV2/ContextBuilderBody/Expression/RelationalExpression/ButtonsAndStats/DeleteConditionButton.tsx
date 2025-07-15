import React from "react";
import { Button } from "react-bootstrap";
import { Tooltip } from "@depmap/common-components";
import { useContextBuilderState } from "../../../../state/ContextBuilderState";

interface Props {
  path: (string | number)[];
  varName: string | null;
}

function DeleteConditionButton({ path, varName }: Props) {
  const { dispatch, deleteVar } = useContextBuilderState();

  return (
    <Tooltip
      id="delete-condition-tooltip"
      content="Delete rule"
      placement="top"
    >
      <Button
        id="delete-condition"
        style={{ height: 38 }}
        onClick={() => {
          dispatch({ type: "delete-condition", payload: { path } });

          if (varName) {
            deleteVar(varName);
          }
        }}
      >
        <i className="glyphicon glyphicon-trash" />
      </Button>
    </Tooltip>
  );
}

export default DeleteConditionButton;
