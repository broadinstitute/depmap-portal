// fake-indexeddb requires structuredClone, which jest-environment-jsdom does
// not provide. Node's v8 serializer implements the same structured clone
// algorithm, so it's a faithful stand-in.
/* eslint-disable @typescript-eslint/no-var-requires */
const v8 = require("v8");

if (typeof globalThis.structuredClone === "undefined") {
  globalThis.structuredClone = (value) => v8.deserialize(v8.serialize(value));
}
