import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import Section from "./Section";
import styles from "../styles/DataExplorer2.scss";

export const SectionStackContext = React.createContext({
  sectionHeights: [0, 0, 0] as number[],
});

interface StackableSectionProps extends React.ComponentProps<typeof Section> {
  // The minimum height the section won't "give up" to other competing
  // sections. For instance, Plot Selections wants to be able to show at least
  // three values before adding a scroll bar. Note that this is not the same as
  // the actual min-height of the element (it could have fewer than 3 values to
  // show, for instance).
  minHeight: number;
}

interface SectionInfo {
  minHeight: number;
  contentHeight: number;
  open: boolean;
}

interface InternalProps extends StackableSectionProps {
  onRender: (info: SectionInfo) => void;
}

export const StackableSection = (props: StackableSectionProps) => {
  const {
    defaultOpen,
    onRender,
    onOpen,
    onClose,
    minHeight,
  } = props as InternalProps;

  const ref = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState<boolean>(defaultOpen ?? true);

  useLayoutEffect(() => {
    let contentHeight = 0;

    if (ref.current) {
      const content = ref.current.lastChild as HTMLElement;
      contentHeight = content.offsetHeight;

      const overflowDiv = ref.current.querySelector("[data-overflow]");

      if (overflowDiv) {
        contentHeight -= overflowDiv.clientHeight;
        contentHeight += overflowDiv.scrollHeight;
      }
    }

    onRender({ contentHeight, minHeight, open: isOpen });
  }, [onRender, isOpen, minHeight]);

  return (
    <Section
      innerRef={ref}
      onOpen={() => {
        setIsOpen(true);
        if (onOpen) {
          onOpen();
        }
      }}
      onClose={() => {
        setIsOpen(false);
        if (onClose) {
          onClose();
        }
      }}
      {...props}
    />
  );
};

const SECTION_TITLE_HEIGHT = 45;

function SectionStack({
  children,
}: {
  children: (React.ReactElement<StackableSectionProps> | null)[];
}) {
  const _children = children.filter(Boolean);

  const [needsLayout, setNeedsLayout] = useState(false);
  const [sectionHeights, setSectionHeights] = useState(_children.map(() => 0));
  const sections = useRef<SectionInfo[]>(
    _children.map(() => ({} as SectionInfo))
  );

  useEffect(() => {
    const onResize = () => setNeedsLayout(true);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const handleRender = useCallback(
    (index: number, nextSection: SectionInfo) => {
      const section = sections.current[index];
      const almostEqual = (a: number, b: number) => Math.abs(a - b) < 2;

      if (
        !section ||
        section.open !== nextSection.open ||
        section.minHeight !== nextSection.minHeight ||
        !almostEqual(section.contentHeight, nextSection.contentHeight)
      ) {
        sections.current[index] = nextSection;
        setNeedsLayout(true);
      }
    },
    []
  );

  useEffect(() => {
    if (!needsLayout) {
      return;
    }

    setNeedsLayout(false);

    setSectionHeights((prevHeights) => {
      const n = prevHeights.length;
      const heights: number[] = [];
      let budget = window.innerHeight - 94 - SECTION_TITLE_HEIGHT * n;

      for (let i = 0; i < n; i += 1) {
        const section = sections.current[i];
        const { open, minHeight, contentHeight } = section;

        if (open) {
          const height = Math.min(minHeight, contentHeight);
          heights[i] = height;
          budget -= height;
        } else {
          heights[i] = 0;
        }
      }

      for (let i = 0; i < n; i += 1) {
        const section = sections.current[i];
        const { open, minHeight, contentHeight } = section;

        if (budget > 0 && open && contentHeight > minHeight) {
          const delta = Math.min(budget, contentHeight - minHeight);
          heights[i] += delta;
          budget -= delta;
        }
      }

      return heights;
    });
  }, [needsLayout]);

  return (
    <SectionStackContext.Provider value={{ sectionHeights }}>
      <div id="section-stack" className={styles.SectionStack}>
        {React.Children.map(_children, (child, index) => {
          if (!React.isValidElement(child)) {
            return child;
          }

          return React.cloneElement(child, {
            onRender: (section) => handleRender(index, section),
          } as Partial<InternalProps>);
        })}
      </div>
    </SectionStackContext.Provider>
  );
}

export default SectionStack;
