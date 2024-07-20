import React from "react";
import { Button } from "react-bootstrap";
import { Tooltip } from "@depmap/common-components";

interface Props {
  path: (string | number)[];
  dispatch: any;
}

function DeleteConditionButton({ path, dispatch }: Props) {
  return (
    <Tooltip
      id="delete-condition-tooltip"
      content="Delete condition"
      placement="top"
    >
      <Button
        id="delete-condition"
        style={{ height: 38 }}
        onClick={() => {
          dispatch({ type: "delete-condition", payload: { path } });
        }}
      >
        <i className="glyphicon glyphicon-trash" />
      </Button>
    </Tooltip>
  );
}

export default DeleteConditionButton;
