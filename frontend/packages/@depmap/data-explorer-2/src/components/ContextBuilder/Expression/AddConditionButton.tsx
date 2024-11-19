import React from "react";
import { Button } from "react-bootstrap";
import { Tooltip } from "@depmap/common-components";
import { ContextBuilderReducerAction } from "../contextBuilderReducer";

interface Props {
  dispatch: React.Dispatch<ContextBuilderReducerAction>;
  numConditions: number;
  path: (string | number)[];
}

const MAX_CONDITIONS = 10;

function AddConditionButton({ path, dispatch, numConditions }: Props) {
  return (
    <Tooltip
      id="add-condition-tooltip"
      content="Add sub-condition"
      placement="top"
    >
      <Button
        id="add-condition"
        style={{ marginLeft: 6, height: 38 }}
        disabled={numConditions >= MAX_CONDITIONS}
        onClick={() => {
          if (path.length < 3) {
            dispatch({ type: "convert-to-group", payload: { path } });
          } else {
            dispatch({
              type: "add-condition",
              payload: { path: path.slice(0, -1) },
            });
          }
        }}
      >
        <i className="glyphicon glyphicon-plus" />
      </Button>
    </Tooltip>
  );
}

export default AddConditionButton;
