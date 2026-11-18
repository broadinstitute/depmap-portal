import type { DataExplorerPlotResponse } from "@depmap/types";

// The most distinct entities that may be sent in one selection. A conservative
// guess, expected to change; this is the only place it is defined.
export const MAX_SELECTED_ENTITIES = 50;

// The selection feature is offered by any host that declares it accepts
// `ui/message` text. Hosts differ in what they do with it: Delphi (and,
// we expect, claude.ai) put it in the message box as a draft, but ChatGPT sends
// it at once, which is accepted for now. Neither claude.ai nor ChatGPT has been
// verified for this feature.
interface HostLike {
  getHostCapabilities():
    | { message?: { text?: unknown }; experimental?: unknown }
    | undefined;
}

export function hostAcceptsMessages(app: HostLike | null) {
  return Boolean(app?.getHostCapabilities()?.message?.text);
}

// ChatGPT advertises `experimental["openai/message"] = { draft: {} }`: the
// message can go into the composer unsent. The value is an empty object, so
// test for the key. Detected by capability, never by host name.
export function hostSupportsDraft(app: HostLike | null) {
  const exp = app?.getHostCapabilities()?.experimental as
    | Record<string, { draft?: unknown } | undefined>
    | undefined;

  return exp?.["openai/message"]?.draft !== undefined;
}

// The `ui/message` params. With draft support, `_meta` asks the host to leave
// the text in the composer. The ext-apps type for params omits `_meta`, though
// `App.sendMessage` forwards it as given.
export function messageParams(text: string, draft: boolean) {
  return {
    role: "user" as const,
    content: [{ type: "text" as const, text }],
    ...(draft ? { _meta: { "openai/message": { send: false } } } : {}),
  };
}

export interface SelectedEntity {
  id: string;
  label: string;
}

// Distinct entities for the selected points, in the order of the data. Id and
// label come from the same index so they always match.
export function selectedEntities(
  data: Pick<DataExplorerPlotResponse, "index_ids" | "index_labels">,
  selectedPoints: Set<number>
): SelectedEntity[] {
  const seen = new Set<string>();
  const out: SelectedEntity[] = [];
  const ids = data.index_ids ?? [];

  for (let i = 0; i < ids.length; i += 1) {
    const id = ids[i];

    if (selectedPoints.has(i) && !seen.has(id)) {
      seen.add(id);
      out.push({ id, label: data.index_labels?.[i] ?? id });
    }
  }

  return out;
}

// "Cell Line" -> "cell line" / "cell lines".
function noun(displayName: string | undefined, count: number) {
  const base = (displayName || "entity").toLowerCase();

  if (count === 1) {
    return base;
  }

  if (/[^aeiou]y$/.test(base)) {
    return `${base.slice(0, -1)}ies`;
  }

  return /(s|x|ch|sh)$/.test(base) ? `${base}es` : `${base}s`;
}

export function buttonLabel(count: number, displayName?: string) {
  if (count > MAX_SELECTED_ENTITIES) {
    return `Select ${MAX_SELECTED_ENTITIES} or fewer (${count} selected)`;
  }

  return count === 1
    ? `Ask about this ${noun(displayName, 1)}`
    : `Ask about these ${count} ${noun(displayName, count)}`;
}

// Axis labels come from the plot data only. With no y axis it is "the plot of
// <x>".
function describePlot(data: DataExplorerPlotResponse) {
  const x = data.dimensions?.x?.axis_label;
  const y = data.dimensions?.y?.axis_label;

  if (x && y) {
    return `the plot of ${y} against ${x}`;
  }

  return x || y ? `the plot of ${x || y}` : "the plot";
}

// A readable list only: no JSON, nothing that is not in the data.
export function selectionMessage(
  data: DataExplorerPlotResponse,
  entities: SelectedEntity[]
) {
  const count = entities.length;
  const lines = entities.map((e) => `- ${e.label} (${e.id})`);

  return [
    `I selected ${count} ${noun(
      data.index_display_name,
      count
    )} in ${describePlot(data)}:`,
    ...lines,
  ].join("\n");
}
