import {
  quoteCssFontFamily,
  type RegisteredFont,
} from "./font-registry";

export type FontAvailabilityStatus = "likely-available" | "likely-unavailable" | "uncertain";

export type FontAvailabilityResult = {
  readonly status: FontAvailabilityStatus;
  readonly matchedCandidate: string | null;
};

const METRIC_EPSILON = 0.5;
const PROBE_TEXT = "گیاه milliliter mmwwWW@Ii";

export type MetricSample = {
  readonly candidateFamily: string;
  readonly withSerif: number;
  readonly serifOnly: number;
  readonly withMonospace: number;
  readonly monospaceOnly: number;
};

export function interpretMetricSample(sample: MetricSample): FontAvailabilityStatus {
  const differsFromSerif = Math.abs(sample.withSerif - sample.serifOnly) > METRIC_EPSILON;
  const differsFromMono = Math.abs(sample.withMonospace - sample.monospaceOnly) > METRIC_EPSILON;
  const serifAndMonoConverge =
    Math.abs(sample.withSerif - sample.withMonospace) <= METRIC_EPSILON;

  if (differsFromSerif && differsFromMono && serifAndMonoConverge) {
    return "likely-available";
  }

  if (!differsFromSerif && !differsFromMono) {
    return "likely-unavailable";
  }

  return "uncertain";
}

function measureWidth(fontShorthand: string): number | null {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  context.font = fontShorthand;
  return context.measureText(PROBE_TEXT).width;
}

function sampleCandidate(family: string): MetricSample | null {
  const quoted = quoteCssFontFamily(family);
  const withSerif = measureWidth(`72px ${quoted}, serif`);
  const serifOnly = measureWidth("72px serif");
  const withMonospace = measureWidth(`72px ${quoted}, monospace`);
  const monospaceOnly = measureWidth("72px monospace");

  if (
    withSerif === null ||
    serifOnly === null ||
    withMonospace === null ||
    monospaceOnly === null
  ) {
    return null;
  }

  return {
    candidateFamily: family,
    withSerif,
    serifOnly,
    withMonospace,
    monospaceOnly,
  };
}

async function localFaceLoads(localName: string): Promise<boolean | null> {
  if (typeof FontFace !== "function") {
    return null;
  }

  const probeFamily = `cfc-probe-${localName.replaceAll(/[^a-zA-Z0-9-]/g, "")}-${Math.random().toString(36).slice(2, 8)}`;
  const face = new FontFace(probeFamily, `local(${quoteCssFontFamily(localName)})`);

  try {
    await face.load();
    return face.status === "loaded";
  } catch {
    return false;
  }
}

/**
 * Heuristic availability check.
 *
 * `document.fonts.check()` is not used as proof: MDN documents that it can
 * return true when a fallback would be used. This combines canvas metrics
 * against two generic fallbacks with optional `FontFace` `local()` loads.
 * Local Font Access (`queryLocalFonts`) is not requested.
 */
export async function detectFontAvailability(
  font: RegisteredFont,
): Promise<FontAvailabilityResult> {
  const metricStatuses: FontAvailabilityStatus[] = [];
  let matchedCandidate: string | null = null;

  for (const candidate of font.candidateFamilyNames) {
    const sample = sampleCandidate(candidate);
    if (!sample) {
      metricStatuses.push("uncertain");
      continue;
    }

    const metricStatus = interpretMetricSample(sample);
    metricStatuses.push(metricStatus);
    if (metricStatus === "likely-available" && matchedCandidate === null) {
      matchedCandidate = candidate;
    }
  }

  if (matchedCandidate !== null) {
    return { status: "likely-available", matchedCandidate };
  }

  const localNames = font.localFaceNames.flatMap((face) => face.localNames);
  const loadResults = await Promise.all(localNames.map((name) => localFaceLoads(name)));
  const anyLoaded = loadResults.some((result) => result === true);
  const anyUnknown = loadResults.some((result) => result === null);
  const allFailed = loadResults.length > 0 && loadResults.every((result) => result === false);
  const allMetricsUnavailable =
    metricStatuses.length > 0 && metricStatuses.every((status) => status === "likely-unavailable");

  if (allMetricsUnavailable && allFailed && !anyUnknown) {
    return { status: "likely-unavailable", matchedCandidate: null };
  }

  if (allMetricsUnavailable && anyLoaded) {
    return { status: "uncertain", matchedCandidate: null };
  }

  return { status: "uncertain", matchedCandidate: null };
}
