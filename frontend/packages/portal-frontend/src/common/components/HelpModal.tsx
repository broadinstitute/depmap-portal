import React, { useRef } from "react";
import { Button, Modal } from "react-bootstrap";

const HelpModal = (props: {
  content: React.ReactNode;
  itemKey: string;
  show: boolean;
  setShowHelpModal: React.Dispatch<React.SetStateAction<boolean>>;
}) => {
  const checkboxRef = useRef<HTMLInputElement | null>(null);
  const { content, itemKey, show, setShowHelpModal } = props;

  const onHide = () => {
    localStorage.setItem(itemKey, String(checkboxRef.current!.checked));
    setShowHelpModal(false);
  };
  return (
    <Modal show={show} onHide={onHide} bsSize="large">
      <Modal.Body>
        {content}
        <div>
          <input
            ref={checkboxRef}
            id="help-modal-checkbox"
            type="checkbox"
            defaultChecked={localStorage.getItem(itemKey) === "true"}
          />{" "}
          <label htmlFor="help-modal-checkbox" style={{ fontWeight: "normal" }}>
            Don&apos;t show me this again
          </label>
        </div>
      </Modal.Body>

      <Modal.Footer>
        <Button onClick={onHide}>Close</Button>
      </Modal.Footer>
    </Modal>
  );
};

export default HelpModal;
