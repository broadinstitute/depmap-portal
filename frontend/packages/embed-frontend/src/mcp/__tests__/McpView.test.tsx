/**
 * @jest-environment jsdom
 */
import React from "react";
import ReactDOM from "react-dom";
import { act } from "react-dom/test-utils";

const mockApp = {
  ontoolresult: undefined as undefined | ((r: unknown) => Promise<void>),
  onhostcontextchanged: undefined as undefined | (() => void),
  connect: jest.fn(),
  callServerTool: jest.fn(),
  getHostContext: jest.fn(),
  openLink: jest.fn(),
};

jest.mock("@modelcontextprotocol/ext-apps", () => ({
  App: jest.fn(() => mockApp),
}));

const plotLifecycle = { mounts: 0, unmounts: 0 };

jest.mock("../../components/Plot", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  const R = require("react");
  return {
    PlotView: (props: unknown) => {
      R.useEffect(() => {
        plotLifecycle.mounts += 1;
        return () => {
          plotLifecycle.unmounts += 1;
        };
      }, []);
      return (
        <div data-testid="plot-view" data-props={JSON.stringify(props)}>
          <canvas className="gl-canvas" />
        </div>
      );
    },
  };
});

const mockCodegen = { blocked: false };
jest.mock("../codegen", () => ({
  codeGenerationBlocked: () => mockCodegen.blocked,
}));

let ioCallback:
  | ((entries: { isIntersecting: boolean }[]) => void)
  | null = null;

class MockIntersectionObserver {
  constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
    ioCallback = cb;
  }
  observe = jest.fn();
  disconnect = jest.fn();
}
(window as any).IntersectionObserver = MockIntersectionObserver;

async function setVisible(isIntersecting: boolean) {
  await act(async () => {
    ioCallback!([{ isIntersecting }]);
  });
}

async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

// eslint-disable-next-line import/first
import McpView, {
  VISIBLE_DEBOUNCE_MS,
  MAX_RECOVERY_ATTEMPTS,
} from "../McpView";

const PLOT_DATA = {
  plot_config: { plot_type: "scatter", normalized: true },
  index_labels: ["a", "b"],
  linreg_by_group: [{ slope: 1 }],
};

const toolResult = (overrides: object = {}) => ({
  structuredContent: {
    type: "plot",
    api_version: 1,
    params: { plot_type: "scatter" },
    link: "https://example.com/de?p=1",
    ...overrides,
  },
});

let container: HTMLDivElement;

function setInHost(inHost: boolean) {
  jest
    .spyOn(window, "parent", "get")
    .mockReturnValue(inHost ? ({} as Window & typeof globalThis) : window);
}

async function mountAndDeliverHidden(result: unknown) {
  await act(async () => {
    ReactDOM.render(<McpView />, container);
  });
  await act(async () => {
    await mockApp.ontoolresult!(result);
  });
}

async function mountAndDeliver(result: unknown) {
  await mountAndDeliverHidden(result);
  await setVisible(true);
  await advance(VISIBLE_DEBOUNCE_MS);
}

beforeEach(() => {
  jest.restoreAllMocks();
  jest.useFakeTimers();
  mockCodegen.blocked = false;
  plotLifecycle.mounts = 0;
  plotLifecycle.unmounts = 0;
  ioCallback = null;
  mockApp.connect.mockReset().mockResolvedValue(undefined);
  mockApp.getHostContext.mockReturnValue(undefined);
  mockApp.callServerTool.mockReset();
  mockApp.ontoolresult = undefined;
  container = document.createElement("div");
  document.body.appendChild(container);
  setInHost(true);
});

afterEach(() => {
  jest.useRealTimers();
  ReactDOM.unmountComponentAtNode(container);
  container.remove();
});

it("fetches the plot data with the tool result and renders PlotView", async () => {
  mockApp.callServerTool.mockResolvedValue({
    content: [{ type: "text", text: JSON.stringify(PLOT_DATA) }],
  });

  await mountAndDeliver(toolResult());

  expect(mockApp.callServerTool).toHaveBeenCalledWith({
    name: "get_plot_data",
    arguments: { api_version: 1, params: { plot_type: "scatter" } },
  });

  const props = JSON.parse(
    container
      .querySelector("[data-testid=plot-view]")!
      .getAttribute("data-props")!
  );
  // Uses the server-normalized config, not the params it was asked with.
  expect(props.plotConfig).toEqual(PLOT_DATA.plot_config);
  expect(props.linreg_by_group).toEqual(PLOT_DATA.linreg_by_group);
  expect(props.data.index_labels).toEqual(["a", "b"]);
  expect(props.height).toBe(480);

  const link = container.querySelector("a")!;
  expect(link.textContent).toBe("Open in Data Explorer");
  expect(link.getAttribute("href")).toBe("https://example.com/de?p=1");
});

it("shows the message when the tool call reports an error", async () => {
  mockApp.callServerTool.mockResolvedValue({
    isError: true,
    content: [{ type: "text", text: "forbidden: You can't see this dataset." }],
  });

  await mountAndDeliver(toolResult());

  expect(container.textContent).toContain(
    "forbidden: You can't see this dataset."
  );
  expect(container.querySelector("[data-testid=plot-view]")).toBeNull();
});

it("shows an error when the response is not valid JSON", async () => {
  mockApp.callServerTool.mockResolvedValue({
    content: [{ type: "text", text: "{not json" }],
  });

  await mountAndDeliver(toolResult());

  expect(container.textContent).toContain("not valid JSON");
  expect(container.querySelector("[data-testid=plot-view]")).toBeNull();
});

it("shows an error when the tool call itself rejects", async () => {
  mockApp.callServerTool.mockRejectedValue(new Error("host went away"));

  await mountAndDeliver(toolResult());

  expect(container.textContent).toContain("host went away");
});

it("rejects a malformed structuredContent without calling the tool", async () => {
  await mountAndDeliver({ structuredContent: { type: "table" } });

  expect(mockApp.callServerTool).not.toHaveBeenCalled();
  expect(container.textContent).toContain("Malformed tool result");
});

it("explains itself when there is no host, and never creates an App", async () => {
  setInHost(false);

  await act(async () => {
    ReactDOM.render(<McpView />, container);
  });

  expect(container.textContent).toContain(
    "meant to be embedded in an MCP host"
  );
  expect(mockApp.connect).not.toHaveBeenCalled();
});

const plotHeight = () =>
  JSON.parse(
    container
      .querySelector("[data-testid=plot-view]")!
      .getAttribute("data-props")!
  ).height;

async function mountWithPlot() {
  mockApp.callServerTool.mockResolvedValue({
    content: [{ type: "text", text: JSON.stringify(PLOT_DATA) }],
  });
  await mountAndDeliver(toolResult());
}

it("does not feed the host's iframe height back into the plot height", async () => {
  await mountWithPlot();
  expect(plotHeight()).toBe(480);

  let reported = 480;
  for (let i = 0; i < 5; i += 1) {
    // What ChatGPT presumably does: the iframe is as tall as what we reported
    // last time, plus the link row it measured.
    mockApp.getHostContext.mockReturnValue({
      containerDimensions: { height: reported + 28 },
    });
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      mockApp.onhostcontextchanged!();
    });
    const docHeight = parseInt(
      (container.querySelector("[data-testid=plot-view]")!.parentElement!
        .parentElement as HTMLElement).style.height,
      10
    );
    // Document = plot + the 28px link row, every time.
    expect(docHeight).toBe(508);
    expect(plotHeight()).toBe(480);
    reported = docHeight;
  }
});

it("caps the height by the host's maxHeight when only that is reported", async () => {
  mockApp.getHostContext.mockReturnValue({
    containerDimensions: { maxHeight: 300 },
  });
  await mountWithPlot();
  expect(plotHeight()).toBe(300);
});

describe("visibility", () => {
  const ok = () =>
    mockApp.callServerTool.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify(PLOT_DATA) }],
    });

  it("does not fetch before the view is visible", async () => {
    ok();
    await mountAndDeliverHidden(toolResult());
    await advance(60000);

    expect(mockApp.callServerTool).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Plot will load when visible");
  });

  it("does not fetch if it stays visible for less than the debounce", async () => {
    ok();
    await mountAndDeliverHidden(toolResult());

    await setVisible(true);
    await advance(VISIBLE_DEBOUNCE_MS - 100);
    await setVisible(false);
    await advance(60000);

    expect(mockApp.callServerTool).not.toHaveBeenCalled();
  });

  it("fetches exactly once after the debounce", async () => {
    ok();
    await mountAndDeliverHidden(toolResult());
    await setVisible(true);
    await advance(VISIBLE_DEBOUNCE_MS - 1);
    expect(mockApp.callServerTool).not.toHaveBeenCalled();

    await advance(1);
    await advance(60000);
    expect(mockApp.callServerTool).toHaveBeenCalledTimes(1);
  });

  it("does not refetch when the view comes back into view", async () => {
    ok();
    await mountAndDeliver(toolResult());
    expect(mockApp.callServerTool).toHaveBeenCalledTimes(1);

    await setVisible(false);
    await advance(5000);
    await setVisible(true);
    await advance(5000);

    expect(mockApp.callServerTool).toHaveBeenCalledTimes(1);
  });

  it("unmounts the plot on leaving the view and re-renders on entering", async () => {
    ok();
    await mountAndDeliver(toolResult());
    expect(plotLifecycle).toEqual({ mounts: 1, unmounts: 0 });

    await setVisible(false);
    expect(plotLifecycle.unmounts).toBe(1);
    expect(container.querySelector("[data-testid=plot-view]")).toBeNull();

    await setVisible(true);
    expect(plotLifecycle.mounts).toBe(2);
    expect(container.querySelector("[data-testid=plot-view]")).not.toBeNull();
  });

  it("keeps the same document height while the plot is unmounted", async () => {
    ok();
    await mountAndDeliver(toolResult());
    const doc = () =>
      (container.firstElementChild!.firstElementChild as HTMLElement).style
        .height;
    const before = doc();

    await setVisible(false);
    expect(doc()).toBe(before);
  });

  it("shows a message with the link, and never fetches, when code generation is blocked", async () => {
    mockCodegen.blocked = true;
    ok();
    await mountAndDeliver(toolResult());

    expect(mockApp.callServerTool).not.toHaveBeenCalled();
    expect(container.textContent).toContain("code generation");
    expect(container.querySelector("a")!.getAttribute("href")).toBe(
      "https://example.com/de?p=1"
    );
  });
});

describe("WebGL context loss", () => {
  const lose = async (count = 1) => {
    const canvases = Array.from(container.querySelectorAll("canvas"));
    await act(async () => {
      canvases
        .slice(0, count)
        .forEach((c) => c.dispatchEvent(new Event("webglcontextlost")));
    });
  };

  beforeEach(async () => {
    jest.spyOn(Math, "random").mockReturnValue(1); // max jitter: 1500ms
    mockApp.callServerTool.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify(PLOT_DATA) }],
    });
    await mountAndDeliver(toolResult());
  });

  it("re-renders from memory after a jittered delay, without refetching", async () => {
    expect(plotLifecycle.mounts).toBe(1);

    await lose();
    await advance(1499);
    expect(plotLifecycle.mounts).toBe(1);

    await advance(1);
    expect(plotLifecycle.mounts).toBe(2);
    expect(mockApp.callServerTool).toHaveBeenCalledTimes(1);
  });

  it("uses the lower jitter bound too", async () => {
    (Math.random as jest.Mock).mockReturnValue(0);
    await lose();
    await advance(199);
    expect(plotLifecycle.mounts).toBe(1);
    await advance(1);
    expect(plotLifecycle.mounts).toBe(2);
  });

  it("runs one recovery at a time per view", async () => {
    await lose(1);
    await lose(1); // another event while one is already scheduled
    await advance(1500);
    await advance(5000);

    expect(plotLifecycle.mounts).toBe(2);
  });

  it("gives up after the maximum attempts and offers a retry", async () => {
    for (let i = 0; i < MAX_RECOVERY_ATTEMPTS; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await lose();
      // eslint-disable-next-line no-await-in-loop
      await advance(1500);
    }
    expect(plotLifecycle.mounts).toBe(1 + MAX_RECOVERY_ATTEMPTS);

    await lose();
    await advance(5000);

    expect(plotLifecycle.mounts).toBe(1 + MAX_RECOVERY_ATTEMPTS);
    expect(container.textContent).toContain("Plot unavailable, click to retry");

    await act(async () => {
      (container.querySelector("[role=button]") as HTMLElement).click();
    });
    expect(container.querySelector("[data-testid=plot-view]")).not.toBeNull();
    expect(container.textContent).not.toContain("click to retry");
  });

  it("ignores context loss while out of view", async () => {
    const canvas = container.querySelector("canvas")!;
    await setVisible(false);
    await act(async () => {
      canvas.dispatchEvent(new Event("webglcontextlost"));
    });
    await advance(5000);
    await setVisible(true);

    // Only the remount from coming back into view.
    expect(plotLifecycle.mounts).toBe(2);
  });
});
