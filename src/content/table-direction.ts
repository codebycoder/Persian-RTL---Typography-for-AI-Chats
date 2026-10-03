import { RASTTEXT_DIR_ATTRIBUTE } from "@shared/constants";
import { buildCssRule, joinCssBlocks } from "./css-rule";

type Direction = "rtl" | "ltr";

/** Headers define column order; long English data must not flip a Persian table. */
export function detectTableDirection(
  table: Element,
  readText: (element: Element) => string,
  detectDirection: (text: string) => Direction | null,
): Direction | null {
  const own = (selector: string) => Array.from(table.querySelectorAll(selector))
    .filter((element) => element.closest("table") === table);
  const headerDirection = detectDirection(own("th").map((header) => readText(header)).join(" "));
  if (headerDirection) return headerDirection;
  const firstRow = own("tr")[0];
  return (firstRow ? detectDirection(readText(firstRow)) : null) ?? detectDirection(readText(table));
}

/** Keep column layout and alignment independent from each cell's text direction. */
export function buildTableDirectionCss(roots: readonly string[]): string {
  const tables = roots.map((root) => `${root} table[${RASTTEXT_DIR_ATTRIBUTE}]`);
  const scoped = (suffix: string) => tables.map((table) => `${table}${suffix}`).join(",\n");
  return joinCssBlocks([
    ...(["rtl", "ltr"] as const).map((direction) => buildCssRule(
      roots.map((root) => `${root} table[${RASTTEXT_DIR_ATTRIBUTE}="${direction}"]`).join(",\n"),
      `  direction: ${direction} !important;\n  text-align: start !important;\n  --rasttext-table-align: ${direction === "rtl" ? "right" : "left"};`,
    )),
    buildCssRule(
      scoped(" :is(thead, tbody, tfoot, tr)"),
      "  direction: inherit !important;",
    ),
    buildCssRule(
      [scoped(" :is(th, td)"), scoped(` :is(th, td) [${RASTTEXT_DIR_ATTRIBUTE}]`)].join(",\n"),
      "  text-align: var(--rasttext-table-align) !important;",
    ),
    buildCssRule(
      scoped(` :is(th, td):not([${RASTTEXT_DIR_ATTRIBUTE}])`),
      "  direction: inherit !important;\n  unicode-bidi: isolate !important;",
    ),
  ]);
}
