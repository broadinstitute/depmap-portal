// URL-encodes any interpolated values in the template literal it tags.
// Example:
//   getJson(uri`/datasets/features/${dataset_id}`)
// is equivalent to:
//   getJson(`/datasets/features/${encodeURIComponent(dataset_id)}`)
export function uri(
  strings: TemplateStringsArray,
  ...values: unknown[]
): string {
  return strings.reduce((result, str, i) => {
    const val = values[i];
    return result + str + (val == null ? "" : encodeURIComponent(String(val)));
  }, "");
}
