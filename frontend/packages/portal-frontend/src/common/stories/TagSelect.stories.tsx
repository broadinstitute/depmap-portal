import * as React from "react";
import { useState } from "react";
import { Label } from "react-bootstrap";
import { TagSelect, TagOption } from "@depmap/common-components";
import { FileUpload } from "@depmap/compute";
import Papa from "papaparse";

export default {
  title: "Components/Common/TagSelect",
  component: TagSelect,
};

export function TagSelectFromFileColumns() {
  const [hasRemainingOptions, setHasRemainingOptions] = useState(false);
  const [remainingOptions, setRemainingOptions] = useState<TagOption[]>([]);
  const [selectedOptions, setSelectedOptions] = useState<TagOption[] | null>(
    null
  );
  const checkOptions = (
    selectedOptions: TagOption[] | null,
    remainingOptions: TagOption[]
  ) => {
    console.log("Data remaining: ", remainingOptions);
    setHasRemainingOptions(remainingOptions.length != 0);
    setRemainingOptions(remainingOptions);
    setSelectedOptions(selectedOptions);
  };

  const handleFileUpload = (fileUpload: any) => {
    console.log(fileUpload);
    if (fileUpload != null) {
      Papa.parse(fileUpload, {
        preview: 1,
        complete(results, file) {
          console.log("Parsing complete results:", results);
          console.log("Parsing complete file: ", file);
          const columnNames: TagOption[] = results.data[0].map(
            (colName: string) => {
              if (colName == "") {
                throw new Error(
                  "Column must not contain an empty string! CSV must be in tabular format"
                );
              }
              return { label: colName, value: colName };
            }
          );
          setRemainingOptions(columnNames);
          setHasRemainingOptions(true);
          setSelectedOptions(null);
        },
        error(error, file) {
          console.log(error);
          console.log(file);
        },
      });
    }
  };
  return (
    <>
      <FileUpload onChange={handleFileUpload} />
      <div>
        {remainingOptions.map((option, i) => (
          <Label bsStyle="info">{option.label}</Label>
        ))}
      </div>
      <TagSelect
        remainingOptions={remainingOptions}
        selectedOptions={selectedOptions}
        forwardOptions={checkOptions}
        isDisabled={false}
      />
      {hasRemainingOptions ? (
        <p>There are still remaining options left to choose!</p>
      ) : null}
    </>
  );
}
