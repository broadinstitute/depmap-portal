export const hexToRgba = (hex: string, alpha: number) => {
  const [r, g, b] = hex
    .replace(/^#/, "")
    .replace(/(.)/g, hex.length < 6 ? "$1$1" : "$1")
    .match(/../g)!
    .map((word) => parseInt(word, 16));

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
