// eslint-disable-next-line max-classes-per-file
interface Span {
  label: string;
  start: Date;
  spanID: string;
  parentSpanID: string;
  end: Date;
}

const hexChars = "0123456789abcdef";
function makeRandomHexString(length: number) {
  const result = [];
  for (let i = 0; i < length * 2; i += 1) {
    result.push(hexChars.charAt(Math.floor(Math.random() * hexChars.length)));
  }
  return result.join("");
}

export class Trace {
  accumulatedSpans: Array<Span>;

  traceID: string;

  currentSpan: ActiveSpanImpl;

  constructor(label: string) {
    this.traceID = makeRandomHexString(16);
    this.accumulatedSpans = [];

    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    this.currentSpan = new ActiveSpanImpl(this, label, null);
  }

  end() {
    this.currentSpan.end();
  }

  getSpanSubmission() {
    const spanList = this.accumulatedSpans.map((x) => {
      return {
        startTime: x.start.toISOString(),
        endTime: x.end.toISOString(),
        displayName: { value: x.label },
        spanId: x.spanID,
        parentSpanId: x.parentSpanID,
      };
    });
    return spanList;
  }
}

export interface ActiveSpan {
  end: () => void;
}

export const NoOpSpan = { end: () => {} };

class ActiveSpanImpl {
  trace: Trace;

  label: string;

  parent: ActiveSpanImpl | null;

  start: Date;

  spanID: string;

  constructor(trace: Trace, label: string, parent: ActiveSpanImpl | null) {
    this.trace = trace;
    this.label = label;
    this.parent = parent;
    this.start = new Date();
    this.spanID = makeRandomHexString(8);
  }

  startChild(label: string): ActiveSpanImpl {
    return new ActiveSpanImpl(this.trace, label, this);
  }

  end() {
    let parentSpanID = "";
    if (this.parent) {
      parentSpanID = this.parent.spanID;
    }
    this.trace.accumulatedSpans.push({
      label: this.label,
      start: this.start,
      end: new Date(),
      parentSpanID,
      spanID: this.spanID,
    });
  }
}
