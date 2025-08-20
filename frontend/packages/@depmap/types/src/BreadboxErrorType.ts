// should match enums defined in custom_http_exception.py in breadbox
type ErrorType =
  | "UNSPECIFIED_LEGACY_ERROR" // special case for endpoints that haven't been updated yet
  | "DATASET_NOT_FOUND"
  | "FEATURE_NOT_FOUND"
  | "SAMPLE_NOT_FOUND"
  | "DIMENSION_TYPE_NOT_FOUND"
  | "LARGE_DATASET_READ";

export interface ErrorDetail {
  error_type: ErrorType;
  message: string;
}

export function instanceOfErrorDetail(object: any): object is ErrorDetail {
  return (
    typeof object === "object" &&
    object !== null &&
    "error_type" in object &&
    "message" in object
  );
}

/* Custom Error class with error type */
export class ErrorTypeError extends Error {
  name: string;

  errorType: ErrorType;

  cause?: any;

  constructor({
    errorType,
    message,
    cause,
  }: {
    errorType: ErrorType;
    message: string;
    cause?: any;
  }) {
    const fullMessage = `${errorType}: ${message}`;
    super(fullMessage);
    this.name = this.constructor.name;
    this.errorType = errorType;
    this.message = message;
    this.cause = cause;
  }
}
