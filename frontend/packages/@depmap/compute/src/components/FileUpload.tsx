/* eslint-disable */
import * as React from "react";
import { FormControl } from "react-bootstrap";

interface FileUploadProps {
  onChange: any;
}

/**
 * This is a file upload component that fires an onChange every time the user selects a file
 *
 * These changes wrapped here are not needed if a submit button is used
 *   or if one is generally not expecting the onChange to fire every time a user selects a file
 *
 * The component was specifically built let users upload a file without pressing a submit button
 *   the submission code can be directly passed into onChange
 *   otherwise, under normal circumstances, onChange only fires when the file /name/ changes
 */
export class FileUpload extends React.Component<FileUploadProps, any> {
  render() {
    return (
      <FormControl
        type="file"
        onChange={(event: React.FormEvent<FormControl>) => {
          const target = event.target as HTMLInputElement;
          if (target?.files?.[0]) {
            this.props.onChange(target.files[0]);
          }
        }}
        onClick={(event: React.FormEvent<FormControl>) => {
          /**
            Clear the file select every time a user clicks the select input
            This allows to to fire the onchange even when a file with the same name is selected
              The user may have modified it, then want to upload it again
            If a user clicks the select file, then presses escape/cancel, normal behavior without this is to set the selected file to null. So this still has the same behavior.
          */
          const target = event.target as HTMLInputElement;
          target.value = "";
          this.props.onChange(null);
          // this.props.onChange is needed so that the parent is still notified.
          // otherwise, if the file dialog exits with no file selected, the code detects no changes with the filename since we had already set it to null
        }}
      />
    );
  }
}
