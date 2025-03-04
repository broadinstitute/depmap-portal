interface ErrorDetail {
  detail: string;
}

export function instanceOfErrorDetail(object: any): object is ErrorDetail {
  return "detail" in object;
}
