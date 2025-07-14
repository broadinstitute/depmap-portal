export function scrollLastConditionIntoView(path?: (string | number)[]) {
  setTimeout(() => {
    const attr = "data-expr-scroll-index";

    const el = path
      ? document.querySelector(`[${attr}="${path[1]}"]`)
      : [...document.querySelectorAll(`[${attr}]`)].slice(-1)[0];

    (el as HTMLElement).scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, 0);
}

export function scrollParentIntoView(element: HTMLElement | null) {
  setTimeout(() => {
    element?.parentElement?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, 0);
}

let prevScrollTop = 0;
let prevSentinel = {};

export function saveScrollPosition(sentinel: object) {
  const el = document.querySelector('[data-expr-scroll-index="0"]')
    ?.parentElement;

  prevScrollTop = el?.scrollTop || 0;
  prevSentinel = sentinel;
}

export function restoreScrollPosition(sentinel: object) {
  const el = document.querySelector('[data-expr-scroll-index="0"]')
    ?.parentElement;

  if (el && sentinel === prevSentinel) {
    setTimeout(() => {
      el.scrollTop = prevScrollTop;
    }, 0);
  }
}
