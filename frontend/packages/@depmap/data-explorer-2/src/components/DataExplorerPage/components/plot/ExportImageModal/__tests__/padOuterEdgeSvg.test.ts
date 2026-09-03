import { padOuterEdgeSvg } from "../index";

const encodeSvg = (svg: string) =>
  `data:image/svg+xml,${encodeURIComponent(svg)}`;

const decodeSvg = (dataUrl: string) => {
  const doc = new DOMParser().parseFromString(
    decodeURIComponent(dataUrl.slice(dataUrl.indexOf(",") + 1)),
    "image/svg+xml"
  );
  return doc.documentElement;
};

const SMALL_SVG = encodeSvg(
  '<svg xmlns="http://www.w3.org/2000/svg" width="90" height="70" viewBox="0 0 90 70"><rect width="90" height="70" fill="#fff"/></svg>'
);

describe("padOuterEdgeSvg", () => {
  test("padding <= 0 returns the input untouched", () => {
    expect(padOuterEdgeSvg(SMALL_SVG, 100, 80, 0, "#fff")).toBe(SMALL_SVG);
  });

  test("shifts the viewBox origin left by `padding` and grows width/height to the full requested size, without scaling the existing content", () => {
    const result = padOuterEdgeSvg(SMALL_SVG, 100, 80, 10, "#fff");
    const root = decodeSvg(result);

    // Full requested size, not the smaller rendered size — this is what
    // makes the file's own intrinsic dimensions the ones asked for.
    expect(root.getAttribute("width")).toBe("100");
    expect(root.getAttribute("height")).toBe("80");

    // Same viewBox *size* as the physical width/height (100x80), so
    // nothing already in the document is scaled — only the origin moves,
    // by exactly `padding`, which is what opens up empty space on the
    // left without touching any existing coordinate.
    expect(root.getAttribute("viewBox")).toBe("-10 0 100 80");
  });

  test("adds a background rect covering the newly-opened margin, so it isn't left transparent", () => {
    const result = padOuterEdgeSvg(SMALL_SVG, 100, 80, 10, "#abc123");
    const root = decodeSvg(result);
    const rect = root.querySelector("rect");

    expect(rect).not.toBeNull();
    expect(rect?.getAttribute("x")).toBe("-10");
    expect(rect?.getAttribute("y")).toBe("0");
    expect(rect?.getAttribute("width")).toBe("100");
    expect(rect?.getAttribute("height")).toBe("80");
    expect(rect?.getAttribute("fill")).toBe("#abc123");
  });

  test("a malformed data URL is returned untouched rather than throwing", () => {
    const notASvgUrl = "data:image/svg+xml,not-actually-svg-markup";
    expect(padOuterEdgeSvg(notASvgUrl, 100, 80, 10, "#fff")).toBe(notASvgUrl);
  });
});
