import React from "react";
import cx from "classnames";
import { Form, FormControl, FormGroup, ControlLabel } from "react-bootstrap";
import styles from "../../styles/ContextBuilder.scss";

interface Props {
  value: string | undefined;
  onChange: (nextValue: string) => void;
  onSubmit: () => void;
  shouldShowValidation: boolean;
  className?: string;
  label?: string;
}

function ContextNameForm({
  value,
  onChange,
  onSubmit,
  shouldShowValidation,
  className = undefined,
  label = "Context name",
}: Props) {
  let validationState: "success" | "error" | null = null;

  if (shouldShowValidation) {
    validationState = value ? "success" : "error";
  }

  return (
    <Form
      inline
      className={className}
      autoComplete="off"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <FormGroup validationState={validationState}>
        <ControlLabel>{label}</ControlLabel>
        <FormControl
          className={cx(styles.contextNameInput, {
            [styles.longName]: value && value.length > 28,
          })}
          name="context-name"
          type="text"
          value={value || ""}
          onChange={(e) => onChange((e.target as HTMLInputElement).value)}
          placeholder="Type a name…"
          autoComplete="off"
        />
      </FormGroup>
    </Form>
  );
}
export default ContextNameForm;
