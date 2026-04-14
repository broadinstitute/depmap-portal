export function tokenize(input: string | null) {
  const str = input || "";
  const tokens = str.split(/\s+/g).filter(Boolean);
  const uniqueTokens = new Set(tokens);

  return [...uniqueTokens];
}
