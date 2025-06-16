import { useEffect, useState } from "react";

export default function useTabVisibility(tabId: string): boolean {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const tabPane = document.querySelector(`.tab-pane#${tabId}`);
    if (!tabPane) {
      return undefined;
    }

    const checkVisibility = () => {
      setIsVisible(tabPane.classList.contains("active"));
    };

    // Initial check
    checkVisibility();

    const observer = new MutationObserver(() => {
      checkVisibility();
    });

    observer.observe(tabPane, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      observer.disconnect();
    };
  }, [tabId]);

  return isVisible;
}
