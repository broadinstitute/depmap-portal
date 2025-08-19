// should match enums defined in custom_http_exception.py in breadbox
type ErrorType =
  | "DATASET_NOT_FOUND"
  | "FEATURE_NOT_FOUND"
  | "SAMPLE_NOT_FOUND"
  | "DIMENSION_TYPE_NOT_FOUND"
  | "LARGE_DATASET_READ";

export interface ErrorDetail {
  error_type: ErrorType;
  message: string;
}

/* Typing for custom exceptions thrown by Breadbox */
interface BreadboxCustomException {
  detail: string | ErrorDetail; // also string type for backwards compatibility.
}

export function instanceOfBreadboxCustomException(
  object: any
): object is BreadboxCustomException {
  return typeof object === "object" && object !== null && "detail" in object;
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
  name: ErrorType;

  message: string;

  cause?: any;

  constructor({
    name,
    message,
    cause,
  }: {
    name: ErrorType;
    message: string;
    cause?: any;
  }) {
    super();
    this.name = name;
    this.message = message;
    this.cause = cause;
  }
}
