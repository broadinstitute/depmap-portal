import * as React from "react";

export interface ValidationTextboxProps {
  // validValues or validationFunction must be included (but not both)
  validValues?: Set<string>;
  validationFunction: (inputs: string[]) => Promise<ValidationResult>; // todo:  placeholder fix later plz
  separator: string;
  onAllInputsValidated: (validInputs: Set<string>) => void;
  onInvalidInputsExist: (invalidInputs: Set<string>) => void;
  textboxSizeRows: number;
  placeholderText?: string;
}

export interface ValidationResult {
  valid: Set<string>; // These are upper/lower case-corrected, and may thus differ from the casing of query input
  invalid: Set<string>;
}

interface ValidationTextboxState {
  validInputs: Set<string>; // These are upper/lower case-corrected, and may thus differ from the casing of the text in the input
  invalidInputs: ReadonlySet<string>;
  inputStrings: string[];
}

export class ValidationTextbox extends React.Component<
  ValidationTextboxProps,
  ValidationTextboxState
> {
  static defaultProps: Partial<ValidationTextboxProps> = {
    validValues: undefined,
    placeholderText: "",
  };

  constructor(props: ValidationTextboxProps) {
    super(props);
    this.state = {
      validInputs: new Set(),
      invalidInputs: new Set(),
      inputStrings: [],
    };
  }

  validateTextField = (inputArray: string[]) => {
    let validInputs: Set<string> = new Set();
    let invalidInputs: Set<string> = new Set();
    const { validValues, validationFunction } = this.props;
    if (validValues) {
      inputArray.forEach((value: string) => {
        if (validValues && validValues.has(value)) {
          validInputs.add(value);
        } else {
          invalidInputs.add(value);
        }
      });
      this.updateValidInvalidInputs(validInputs, invalidInputs);
    } else if (validationFunction) {
      validationFunction(inputArray).then((result: ValidationResult) => {
        validInputs = new Set(result.valid);
        invalidInputs = new Set(result.invalid);
        this.updateValidInvalidInputs(validInputs, invalidInputs);
      });
    }
    this.setState({
      inputStrings: inputArray,
    });
  };

  updateValidInvalidInputs = (
    validInputs: Set<string>,
    invalidInputs: Set<string>
  ) => {
    // hacky workaround
    if (invalidInputs.has("")) {
      invalidInputs.delete("");
    }
    if (validInputs.has("")) {
      validInputs.delete("");
    }
    this.setState({
      validInputs,
      invalidInputs,
    });

    const { onAllInputsValidated, onInvalidInputsExist } = this.props;
    if (invalidInputs.size === 0) {
      onAllInputsValidated(validInputs);
    } else {
      onInvalidInputsExist(invalidInputs);
    }
  };

  onChange = (newTextAreaInput: string) => {
    const { separator } = this.props;
    const inputArray: string[] = newTextAreaInput
      .replace(/\n/g, " ")
      .split(
        separator
      ); /* Replace newlines with space and then split on space */
    this.validateTextField(inputArray);
  };

  validateTextFieldTriggeredByParent = () => {
    const { inputStrings } = this.state;
    this.validateTextField(inputStrings);
  };

  removeString = (stringToRemove: string) => {
    const { inputStrings } = this.state;
    const newInputArray: string[] = inputStrings.filter(
      (str: string) => str !== stringToRemove
    );
    this.validateTextField(newInputArray);

    // let newInvalidInputs: ReadonlySet<string> = update(
    //   this.state.invalidInputs,
    //   {
    //     $remove: [stringToRemove]
    //   }
    // );
    // this.setState({
    //   inputStrings: newArray,
    //   invalidInputs: newInvalidInputs
    // });
  };

  render() {
    const { validInputs, invalidInputs, inputStrings } = this.state;
    const { placeholderText, separator, textboxSizeRows } = this.props;
    const postValidationDisplay: any[] = [];
    if (invalidInputs.size > 0) {
      postValidationDisplay.push(
        <div
          key="warning"
          style={{
            borderRadius: "5px",
            paddingLeft: "8px",
            paddingRight: "8px",
            margin: "2px",
            backgroundColor: "firebrick",
            color: "white",
          }}
        >
          <span
            className="glyphicon glyphicon-exclamation-sign"
            aria-hidden="true"
            style={{ paddingRight: "2px" }}
          />{" "}
          Invalid Inputs
        </div>
      );

      invalidInputs.forEach((invalidInput: string) => {
        postValidationDisplay.push(
          <div
            key={invalidInput}
            aria-hidden="true"
            onClick={() => {
              this.removeString(invalidInput);
            }}
            style={{
              borderRadius: "5px",
              paddingLeft: "8px",
              paddingRight: "8px",
              margin: "2px",
              backgroundColor: "gainsboro",
              color: "grey",
              cursor: "pointer",
            }}
          >
            <span
              className="glyphicon glyphicon-remove-sign"
              aria-hidden="true"
              style={{ paddingRight: "2px" }}
            />{" "}
            {invalidInput}
          </div>
        );
      });
    } else if (validInputs.size > 0) {
      postValidationDisplay.push(
        <div
          key="warning"
          style={{
            borderRadius: "5px",
            paddingLeft: "8px",
            paddingRight: "8px",
            margin: "2px",
            backgroundColor: "forestgreen",
            color: "white",
          }}
        >
          <span
            className="glyphicon glyphicon-ok"
            aria-hidden="true"
            style={{ paddingRight: "2px" }}
          />{" "}
          All Inputs Valid
        </div>
      );
    }
    return (
      <div>
        <textarea
          style={{ width: "100%" }}
          placeholder={placeholderText}
          value={inputStrings.join(separator)}
          rows={textboxSizeRows}
          onChange={(event: any) => {
            this.onChange(event.target.value);
          }}
        />
        <div
          style={{ display: "flex", flexDirection: "row", flexWrap: "wrap" }}
        >
          {postValidationDisplay}
        </div>
      </div>
    );
  }
}
