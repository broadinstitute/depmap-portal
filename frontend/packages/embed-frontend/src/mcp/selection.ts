import type { DataExplorerPlotResponse } from "@depmap/types";

// The most distinct entities that may be sent in one selection. A conservative
// guess, expected to change; this is the only place it is defined.
export const MAX_SELECTED_ENTITIES = 50;

// Hosts known to turn a view's message into an UNSENT draft in the message
// box. Anywhere else, sendMessage may send immediately (ChatGPT does) or is
// unverified (claude.ai), so the selection feature is not offered. Widen this
// list only after a host has been checked.
export const DRAFT_MESSAGE_HOSTS: readonly string[] = ["Delphi"];

interface HostLike {
  getHostVersion(): { name?: string } | undefined;
  getHostCapabilities(): { message?: { text?: unknown } } | undefined;
}

export function hostAcceptsDraftMessages(app: HostLike | null) {
  const name = app?.getHostVersion()?.name;

  return Boolean(
    name &&
      DRAFT_MESSAGE_HOSTS.includes(name) &&
      app?.getHostCapabilities()?.message?.text
  );
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
