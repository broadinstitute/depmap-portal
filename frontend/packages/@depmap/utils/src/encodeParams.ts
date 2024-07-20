type Params = {
  [key: string]: string | number | boolean | Array<string> | undefined;
};

const encodeParams = (params: Params) => {
  return Object.keys(params)
    .filter((key) => params[key] !== undefined)
    .map((key) => {
      if (params[key] instanceof Array) {
        const mappedArray: Array<string> = [];
        (params[key] as Array<any>).forEach((value: string | number) => {
          mappedArray.push([key, value].map(encodeURIComponent).join("="));
        });
        return mappedArray.join("&");
      }
      return [key, params[key] as string | number | boolean]
        .map(encodeURIComponent)
        .join("=");
    })
    .join("&");
};

export default encodeParams;
