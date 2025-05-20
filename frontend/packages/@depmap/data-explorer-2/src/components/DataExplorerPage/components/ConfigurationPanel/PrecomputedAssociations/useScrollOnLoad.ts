import { useEffect, useState } from "react";
import usePrecomputedAssocationData from "../../../hooks/usePrecomputedAssocationData";

interface Props {
  data: ReturnType<typeof usePrecomputedAssocationData>;
  sectionRef: React.MutableRefObject<HTMLDivElement | null>;
}

function useScrollOnLoad({ data, sectionRef }: Props) {
  const [wasLoading, setWasLoading] = useState(false);
  const [alreadyScrolled, setAlreadyScrolled] = useState(false);
  const { isLoading } = data;

  useEffect(() => {
    if (isLoading) {
      setWasLoading(true);
    }
  }, [isLoading]);

  useEffect(() => {
    if (wasLoading && !isLoading && !alreadyScrolled && sectionRef.current) {
      sectionRef.current.parentElement?.scrollTo({
        top: sectionRef.current.offsetTop - 50,
        behavior: "smooth",
      });

      setAlreadyScrolled(true);
    }
  }, [alreadyScrolled, isLoading, wasLoading, sectionRef]);
}

export default useScrollOnLoad;
