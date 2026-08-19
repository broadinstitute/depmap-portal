import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import Section from "./Section";
import styles from "../styles/DataExplorer2.scss";

// Keyed by each StackableSection's own `title` (a required, already-unique
// string per stack — "Legend", "Plot Selections", "Facets", etc.) rather than
// its position among SectionStack's children. A positional array meant a
// section's identity in the layout algorithm was implicit in child order —
// inserting/reordering/conditionally-omitting a section would silently shift
// every later section's height to the wrong slot, with no error, just a
// visibly wrong size. Keying by title removes that footgun entirely.
export const SectionStackContext = React.createContext({
  sectionHeights: {} as Record<string, number>,
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

  // `{...props}` is spread FIRST so the onOpen/onClose wrappers below can't
  // be clobbered by caller-supplied handlers — the wrappers must always run
  // (they keep `isOpen` in sync with Section's own collapse state) and they
  // already delegate to the caller's handlers themselves.
  return (
    <Section
      {...props}
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
  const titles = _children.map((child) =>
    React.isValidElement(child) ? (child.props as { title: string }).title : ""
  );

  const [needsLayout, setNeedsLayout] = useState(false);
  const [sectionHeights, setSectionHeights] = useState<Record<string, number>>(
    {}
  );
  const sections = useRef<Record<string, SectionInfo>>({});

  useEffect(() => {
    const onResize = () => setNeedsLayout(true);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const handleRender = useCallback(
    (title: string, nextSection: SectionInfo) => {
      const section = sections.current[title];
      const almostEqual = (a: number, b: number) => Math.abs(a - b) < 2;

      if (
        !section ||
        section.open !== nextSection.open ||
        section.minHeight !== nextSection.minHeight ||
        !almostEqual(section.contentHeight, nextSection.contentHeight)
      ) {
        sections.current[title] = nextSection;
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

    setSectionHeights(() => {
      const n = titles.length;
      const heights: Record<string, number> = {};
      let budget = window.innerHeight - 94 - SECTION_TITLE_HEIGHT * n;

      titles.forEach((title) => {
        const section = sections.current[title];
        const { open, minHeight, contentHeight } = section;

        if (open) {
          const height = Math.min(minHeight, contentHeight);
          heights[title] = height;
          budget -= height;
        } else {
          heights[title] = 0;
        }
      });

      titles.forEach((title) => {
        const section = sections.current[title];
        const { open, minHeight, contentHeight } = section;

        if (budget > 0 && open && contentHeight > minHeight) {
          const delta = Math.min(budget, contentHeight - minHeight);
          heights[title] += delta;
          budget -= delta;
        }
      });

      return heights;
    });
  }, [needsLayout, titles]);

  // Guarantee every currently-rendered title has a numeric entry, even
  // before its first layout measurement completes (or if it just mounted —
  // e.g. the conditional "Facets" section appearing/disappearing). Without
  // this, a title missing from `sectionHeights` reads as `undefined` in a
  // consumer's `sectionHeights[title] - X` arithmetic, producing NaN (an
  // invalid CSS value) for one render until the next layout pass fills it
  // in. 0 mirrors the old positional array's initial all-zero state.
  const safeSectionHeights = titles.reduce((acc, title) => {
    acc[title] = sectionHeights[title] ?? 0;
    return acc;
  }, {} as Record<string, number>);

  return (
    <SectionStackContext.Provider
      value={{ sectionHeights: safeSectionHeights }}
    >
      <div id="section-stack" className={styles.SectionStack}>
        {_children.map((child, index) => {
          if (!React.isValidElement(child)) {
            return child;
          }

          const title = titles[index];

          // `key: title` pins each section's React identity to its title.
          // Without it, sections were keyed by position in the null-FILTERED
          // array, so a conditional section appearing or disappearing
          // (Facets, GeneTEA) shifted every later sibling onto a different
          // component instance — sections inherited each other's open/closed
          // state (useState initializers like defaultOpen only run at mount,
          // not on a reused instance). A plain array .map is required here:
          // React.Children.map would re-prefix each key with the child's
          // positional index, making it position-dependent all over again.
          return React.cloneElement(child, {
            key: title,
            onRender: (section) => handleRender(title, section),
          } as Partial<InternalProps>);
        })}
      </div>
    </SectionStackContext.Provider>
  );
}

export default SectionStack;
