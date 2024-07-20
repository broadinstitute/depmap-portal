/* eslint-disable */
import * as React from "react";
import {
  Modal,
  Form,
  FormGroup,
  Col,
  FormControl,
  ControlLabel,
} from "react-bootstrap";
import { CellLineSelectorUsage } from "@depmap/cell-line-selector";

interface SaveCellLinesModalProps {
  showModal: boolean;
  onHide: () => void;
  onSubmit: (name: string) => void;
}

export class SaveCellLinesModal extends React.Component<SaveCellLinesModalProps> {
  nameField: HTMLInputElement | null = null;

  render() {
    return (
      <Modal show={this.props.showModal} onHide={this.props.onHide}>
        <Modal.Header>
          <Modal.Title>Save to Cell Line Selector</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <p>
            Save your selected cell lines to Cell Line Selector. Cell Line
            Selector is available via the toolbar under &quot;Tools&quot;, and
            is used to define groups of cell lines that can be used throughout
            the portal.
          </p>
          <Form horizontal>
            <FormGroup controlId="name">
              <Col componentClass={ControlLabel} sm={4}>
                Name of group
              </Col>
              <Col sm={8}>
                <FormControl
                  type="text"
                  placeholder="Enter name"
                  inputRef={(ref) => {
                    this.nameField = ref;
                  }}
                />
              </Col>
            </FormGroup>

            <FormGroup controlId="name">
              <Col sm={4} />
              <Col sm={8}>
                <button
                  className="btn btn-primary"
                  onClick={(event: any) => {
                    if (this.nameField) {
                      this.props.onSubmit(this.nameField.value);
                    }
                    event.preventDefault();
                  }}
                >
                  Save cell line group
                </button>
              </Col>
            </FormGroup>
          </Form>
          <CellLineSelectorUsage />
        </Modal.Body>
      </Modal>
    );
  }
}
