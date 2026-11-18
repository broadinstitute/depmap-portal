import { useEffect, useMemo, useState } from "react";
import { ReleaseVersion } from "@depmap/types";

export function useReleaseVersion(versions: ReleaseVersion[]) {
  const dropdownOptions = useMemo(() => {
    const labels = versions.map((v) => v.version_name);
    const unique = Array.from(new Set(labels));
    return unique.length > 0 ? unique : ["v1.0"];
  }, [versions]);

  const [selectedOption, setSelectedOption] = useState<string>(
    dropdownOptions[0]
  );

  const currentSelection = dropdownOptions.includes(selectedOption)
    ? selectedOption
    : dropdownOptions[0];

  useEffect(() => {
    if (!dropdownOptions.includes(selectedOption)) {
      setSelectedOption(dropdownOptions[0]);
    }
  }, [dropdownOptions, selectedOption]);

  const activeVersion = useMemo(() => {
    if (versions.length === 0) return null;
    return (
      versions.find((v) => v.version_name === currentSelection) ?? versions[0]
    );
  }, [versions, currentSelection]);

  const formattedDate = activeVersion?.version_date
    ? new Date(activeVersion.version_date).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  return {
    dropdownOptions,
    currentSelection,
    setSelectedOption,
    activeVersion,
    formattedDate,
  };
}
