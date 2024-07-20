// these are methods for recording a log in memory which can be used for recording events
// which can later retrieving by tailLog(). The intented usecase is for async events to be
// recorded into the log so that selenium or other tests can inspect whether they happened
// or not.

let logTail: Array<string> = [];
let logCount = 0;

export function log(message: string) {
  // set a cap the length we keep just so we avoid leaking memory from some pathlogical behavior where we do
  // lots of logging
  if (logTail.length > 100) {
    logTail = logTail.slice(0, 100);
  }

  logTail.push(message);
  logCount += 1;
}

export function tailLog() {
  return logTail;
}

export function getLogCount() {
  return logCount;
}
