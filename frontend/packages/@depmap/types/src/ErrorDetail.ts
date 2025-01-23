interface BodyDetailError {
  body: { detail: string };
}

interface DetailError {
  detail: string;
}

// TODO: Verify whether this backwards compatibility safeguard is necessary. Error response verified to follow DetailError type definition so far
type ErrorDetail = BodyDetailError | DetailError;

export function instanceOfErrorDetail(object: any): object is ErrorDetail {
  return "detail" in object || ("body" in object && "detail" in object.body);
}
