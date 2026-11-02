// Entry point for the standalone Node bundle (see webpack.node.js):
//
//   node plot-data.js < request.json > result.json
//
// Reads one JSON request from stdin and writes exactly one JSON document to
// stdout (see runPlotDataRequest.ts for both shapes). Expected failures are an
// `ok: false` document and exit code 0. Only a bug in this script exits
// non-zero, with the details on stderr and nothing on stdout.
//
// stdout is reserved for that one document. Never log the request: it carries
// the caller's identity headers.
import { runPlotDataRequest } from "./runPlotDataRequest";
import type { PlotDataOutcome } from "./runPlotDataRequest";

// Some dependency may well `console.log`, which would corrupt stdout.
console.log = console.error;
console.info = console.error;
console.debug = console.error;

function readStdin() {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];

    process.stdin.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    process.stdin.on("error", reject);
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString()));
  });
}

function finish(outcome: PlotDataOutcome) {
  // One compact write, and exit only once it has flushed (but explicitly, so
  // lingering keep-alive sockets can't hold the process open).
  process.stdout.write(JSON.stringify(outcome), () => {
    process.exit(0);
  });
}

async function main() {
  let input: unknown;

  try {
    input = JSON.parse(await readStdin());
  } catch (e) {
    finish({
      ok: false,
      error: {
        code: "invalid_config",
        message: "The request was not valid JSON.",
        details: null,
      },
    });
    return;
  }

  finish(await runPlotDataRequest(input));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
