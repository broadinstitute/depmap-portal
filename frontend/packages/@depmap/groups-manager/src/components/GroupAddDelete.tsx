import React, { useState } from "react";
import { GroupArgs } from "@depmap/types";
import {
  FormGroup,
  FormControl,
  Button,
  HelpBlock,
  Row,
  Col,
} from "react-bootstrap";
import styles from "../styles/styles.scss";

interface GroupAddDeleteProps {
  selectedGroupIds: Set<string>;
  onAdd: (groupArgs: GroupArgs) => void;
  onDelete: (groupIdsSet: Set<string>) => void;
  errorMessage?: string | null;
}

function GroupAddDelete({
  selectedGroupIds,
  onAdd,
  onDelete,
  errorMessage = null,
}: GroupAddDeleteProps) {
  const [groupName, setGroupName] = useState<string>("");

  const handleInputChange = (e: any) => {
    const { value } = e.target;
    setGroupName(value);
  };

  return (
    <>
      <Row className={styles.container}>
        <Col xs={12} md={8}>
          <FormGroup
            controlId="name"
            validationState={errorMessage ? "error" : undefined}
          >
            <FormControl
              name="name"
              type="text"
              value={groupName}
              onChange={handleInputChange}
              placeholder="Enter name of group to add"
              required
            />
            <HelpBlock>{errorMessage}</HelpBlock>
          </FormGroup>
        </Col>
        <Col xs={6} md={4}>
          <Row>
            <Button
              bsStyle="primary"
              onClick={() => {
                onAdd({ name: groupName });
                setGroupName("");
              }}
              disabled={groupName.length === 0}
            >
              Add new group
            </Button>
            <Button
              style={{ marginLeft: 10 }}
              bsStyle="danger"
              onClick={() => onDelete(selectedGroupIds)}
              disabled={selectedGroupIds.size === 0}
            >
              Delete selected
            </Button>
          </Row>
        </Col>
      </Row>
    </>
  );
}

export default GroupAddDelete;
