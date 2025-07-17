export const Rep1Color = "#CC4778";
export const Rep2Color = "#F89540";
export const Rep3Color = "#176CE0";

export const compoundImageBaseURL =
  "https://storage.googleapis.com/depmap-compound-images/";

// Added to generate the image url location for the Structure and Detail
// tile. The urls were previously located using Python's urllib.parse.quote,
// which encodes differently. As a result, here we needreplace certain
// characters that Python encodes differently. By default, encodeURIComponent
//  does not encode (, ), !, *, ', while Python’s quote does.
export function pythonQuote(str: string): string {
  // encodeURIComponent, then replace characters Python encodes but JS does not
  return encodeURIComponent(str).replace(
    /[!'()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase()
  );
}
