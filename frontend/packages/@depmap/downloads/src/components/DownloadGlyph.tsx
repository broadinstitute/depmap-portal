import { useCallback, useState } from "react";
import * as React from "react";
import { Modal } from "react-bootstrap";

interface AcceptTermsProps {
  show: boolean;
  onAccept: (evt: React.MouseEvent<HTMLElement>) => void;
  onHide: (evt: React.MouseEvent<HTMLElement>) => void;
  termsText: string;
}

declare let AcceptedTerms: {
  has: (terms: string) => boolean;
  add: (terms: string) => void;
};

function AcceptTermsModal({
  show,
  onAccept,
  termsText,
  onHide,
}: AcceptTermsProps) {
  return (
    <Modal show={show} dialogClassName="dataset_modal" onHide={onHide}>
      <Modal.Body>
        <p dangerouslySetInnerHTML={{ __html: termsText }} />
      </Modal.Body>
      <Modal.Footer>
        <button type="button" onClick={onHide} className="btn btn-default">
          Close
        </button>
        <button
          type="button"
          onClick={onAccept}
          className="btn btn-default btn-primary"
        >
          Accept
        </button>
      </Modal.Footer>
    </Modal>
  );
}

function startDownload(downloadUrl: string) {
  // Randy: is this okay? Or is this an "effect"?
  if (downloadUrl.includes("cds.team/taiga")) {
    window.open(downloadUrl, "_blank")!.focus();
  } else {
    window.location.href = downloadUrl;
  }
}

export interface Props {
  terms: string;
  downloadUrl: string;
  isDownloadModal: boolean;
  termsDefinitions: { [key: string]: string };
}

interface DownloadLinkProps {
  terms: string;
  downloadUrl: string;
  termsDefinitions: { [key: string]: string };
  buttonText: string;
}

export function DownloadLink({
  downloadUrl,
  terms,
  termsDefinitions,
  buttonText,
}: DownloadLinkProps) {
  const [acceptModalShown, setAcceptModalShown] = useState<boolean>(false);
  const termsAccepted = AcceptedTerms.has(terms);

  const buttonClicked = useCallback(
    (evt: any) => {
      evt.stopPropagation();
      if (!termsAccepted) {
        setAcceptModalShown(true);
      } else {
        startDownload(downloadUrl);
      }
    },
    [termsAccepted, downloadUrl]
  );

  return (
    <span>
      <button
        className="accept-terms-before-download"
        onClick={buttonClicked}
        type="button"
        style={{
          all: "unset",
          color: "#337ab7",
          cursor: "pointer",
          textDecoration: "underline",
        }}
      >
        {buttonText}
      </button>
      {/* The following div solely exists to prevent the click event from onHide to trickle up to the parent component. That handler */}
      {/* doesn't have access to the triggering event, so we can't do it within the handler */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        onClick={(evt) => {
          evt.stopPropagation();
        }}
      >
        <AcceptTermsModal
          termsText={termsDefinitions[terms]}
          show={acceptModalShown}
          onHide={() => {
            setAcceptModalShown(false);
          }}
          onAccept={() => {
            setAcceptModalShown(false);
            // Randy: is this an effect?
            AcceptedTerms.add(terms);
            startDownload(downloadUrl);
          }}
        />
      </div>
    </span>
  );
}

export function DownloadGlyph({
  downloadUrl,
  isDownloadModal,
  terms,
  termsDefinitions,
}: Props) {
  const [acceptModalShown, setAcceptModalShown] = useState<boolean>(false);
  const glyphSizeClass = isDownloadModal
    ? "downloads-icon-modal-fontsize"
    : "checklist-fontsize";
  const termsAccepted = AcceptedTerms.has(terms);

  const glyphClicked = useCallback(
    (evt: any) => {
      evt.stopPropagation();
      if (!termsAccepted) {
        setAcceptModalShown(true);
      } else {
        startDownload(downloadUrl);
      }
    },
    [termsAccepted, downloadUrl]
  );

  return (
    <span>
      <button
        className="accept-terms-before-download"
        onClick={glyphClicked}
        type="button"
        style={{ border: "none", background: "none" }}
      >
        {" "}
        <i className={`fas fa-download ${glyphSizeClass}`} />{" "}
      </button>
      {/* The following div solely exists to prevent the click event from onHide to trickle up to the parent component. That handler */}
      {/* doesn't have access to the triggering event, so we can't do it within the handler */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        onClick={(evt) => {
          evt.stopPropagation();
        }}
      >
        <AcceptTermsModal
          termsText={termsDefinitions[terms]}
          show={acceptModalShown}
          onHide={() => {
            setAcceptModalShown(false);
          }}
          onAccept={() => {
            setAcceptModalShown(false);
            // Randy: is this an effect?
            AcceptedTerms.add(terms);
            startDownload(downloadUrl);
          }}
        />
      </div>
    </span>
  );
}
