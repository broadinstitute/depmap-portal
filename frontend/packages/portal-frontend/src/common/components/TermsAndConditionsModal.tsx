import React, { useEffect, useRef, useState } from "react";
import { Button, Modal } from "react-bootstrap";
import { fetchUrlPrefix } from "../utilities/context";
import styles from "src/common/styles/terms_and_conditions_modal.scss";

declare let AcceptedTerms: {
  has: (terms: string) => boolean;
  add: (terms: string, expiration_days: number) => void;
};

const TermsAndConditionsModal = () => {
  const checkboxRef = useRef<HTMLInputElement | null>(null);
  const [show, setShow] = useState<boolean>(
    !AcceptedTerms.has("show-terms-and-conditions")
  );
  const [html, setHtml] = useState<string | null>(null);
  const ref = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const urlPrefix = fetchUrlPrefix().replace(/^\/$/, "");
        const res = await fetch(urlPrefix + "/terms_text");

        if (res.status >= 200 && res.status <= 299) {
          const json = await res.json();
          setHtml(json);
        } else {
          throw new Error(`Unable to get "${urlPrefix + "terms_text"}"`);
        }
      } catch (e) {
        window.console.error(e);
      }
    })();
  }, []);

  const onHide = () => {
    if (checkboxRef.current!.checked) {
      AcceptedTerms.add("show-terms-and-conditions", 90); // Arbitrarily set to 90 days which is about the length of each quarter
    }
    setShow(false);
  };
  return (
    html && (
      <Modal
        show={show}
        onHide={onHide}
        bsSize="large"
        keyboard={false}
        backdrop="static"
      >
        <Modal.Body>
          <div
            ref={ref}
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: html || "" }}
          />
        </Modal.Body>

        <Modal.Footer>
          <span className={styles.checkboxText}>
            <input
              ref={checkboxRef}
              id="terms-and-conditions-modal-checkbox"
              type="checkbox"
            />
            <label
              htmlFor="terms-and-conditions-modal-checkbox"
              style={{ fontWeight: "normal", cursor: "pointer" }}
            >
              <p>&nbsp;Don&apos;t show me this again</p>
            </label>
          </span>

          <Button
            bsStyle={null}
            className={styles.btnNonPublic}
            onClick={onHide}
          >
            I agree
          </Button>
        </Modal.Footer>
      </Modal>
    )
  );
};

export default TermsAndConditionsModal;
