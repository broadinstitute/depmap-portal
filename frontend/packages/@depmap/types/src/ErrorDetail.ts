export default interface ErrorDetail {
  body: { detail: string };
}

export function instanceOfErrorDetail(object: any): object is ErrorDetail {
  return "body" in object && "detail" in object.body;
}
