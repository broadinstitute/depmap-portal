export const tableColumns = [
  { accessor: "term", Header: "Term", maxWidth: 120, minWidth: 80 },
  {
    accessor: "termGroup",
    Header: "Term Group",
    maxWidth: 120,
    minWidth: 80,
  },
  {
    accessor: "fdr",
    Header: "FDR",
    maxWidth: 120,
    minWidth: 80,
  },
  {
    accessor: "effectSize",
    Header: "Effect Size",
    maxWidth: 120,
    minWidth: 80,
  },
  {
    accessor: "matchingGenesInList",
    Header: "Matching Query",
    maxWidth: 120,
    minWidth: 80,
  },
  {
    accessor: "nMatchingGenesInList",
    Header: "n Matching Query",
    maxWidth: 120,
    minWidth: 80,
  },
  {
    accessor: "nMatchingGenesOverall",
    Header: "n Matching Overall",
    maxWidth: 120,
    minWidth: 80,
  },
  {
    accessor: "synonyms",
    Header: "Synonyms",
    maxWidth: 120,
    minWidth: 80,
  },
];

export function groupStringsByCondition(
  strings: string[],
  condition: (str: string) => boolean
): [string[], string[]] {
  return strings.reduce(
    (lists: [string[], string[]], currentString: string) => {
      if (condition(currentString)) {
        lists[0].push(currentString); // Add to the first list if condition is true
      } else {
        lists[1].push(currentString); // Add to the second list if condition is false
      }
      return lists;
    },
    [[], []] // Initialize with two empty string arrays
  );
}
