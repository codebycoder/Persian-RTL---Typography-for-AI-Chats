import assert from "node:assert/strict";
import { test } from "node:test";
import { interpretMetricSample } from "./font-availability";

test("interpretMetricSample reports likely-available when both fallbacks diverge and converge", () => {
  assert.equal(
    interpretMetricSample({
      candidateFamily: "Peyda",
      withSerif: 420,
      serifOnly: 310,
      withMonospace: 420.2,
      monospaceOnly: 500,
    }),
    "likely-available",
  );
});

test("interpretMetricSample reports likely-unavailable when metrics match both fallbacks", () => {
  assert.equal(
    interpretMetricSample({
      candidateFamily: "MissingFont",
      withSerif: 310,
      serifOnly: 310,
      withMonospace: 500,
      monospaceOnly: 500,
    }),
    "likely-unavailable",
  );
});

test("interpretMetricSample reports uncertain on mixed metric evidence", () => {
  assert.equal(
    interpretMetricSample({
      candidateFamily: "Maybe",
      withSerif: 400,
      serifOnly: 310,
      withMonospace: 500,
      monospaceOnly: 500,
    }),
    "uncertain",
  );
});
