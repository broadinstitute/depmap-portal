import { Dataset } from "./Dataset";
import { AnnotationTypeMap } from "./Metadata";

export default interface SampleType {
  name: string;
  id_column: string;
  dataset: Dataset;
}

export class SampleTypeUpdateArgs {
  name: string;

  metadata_file: File;

  annotation_type_mapping: string;

  constructor(
    name: string,
    metadata_file: File,
    annotation_type_mapping: AnnotationTypeMap
  ) {
    this.name = name;
    this.metadata_file = metadata_file;
    this.annotation_type_mapping = JSON.stringify(annotation_type_mapping);
  }
}
