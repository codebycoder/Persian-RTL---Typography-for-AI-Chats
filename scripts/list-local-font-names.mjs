import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { extname, join } from "node:path";

const KEYWORDS = ["yekan", "bakh", "peyda", "iran", "estedad"];
const FONT_DIRS = [join(homedir(), "Library/Fonts"), "/Library/Fonts"];

function decodeUtf16Be(raw) {
  const copied = Buffer.from(raw);
  copied.swap16();
  return copied.toString("utf16le").replaceAll("\u0000", "").trim();
}

function readNameTable(filePath) {
  const data = readFileSync(filePath);
  if (data.length < 12) {
    return null;
  }

  const isTrueType = data.readUInt32BE(0) === 0x00010000;
  const isOpenType = data.toString("ascii", 0, 4) === "OTTO";
  if (!isTrueType && !isOpenType) {
    return null;
  }

  const numTables = data.readUInt16BE(4);
  let nameOffset;
  let nameLength;
  for (let i = 0; i < numTables; i += 1) {
    const rec = 12 + i * 16;
    if (data.toString("ascii", rec, rec + 4) === "name") {
      nameOffset = data.readUInt32BE(rec + 8);
      nameLength = data.readUInt32BE(rec + 12);
      break;
    }
  }
  if (nameOffset === undefined || nameLength === undefined) {
    return null;
  }

  const table = data.subarray(nameOffset, nameOffset + nameLength);
  const count = table.readUInt16BE(2);
  const stringOffset = table.readUInt16BE(4);
  const wanted = new Map([
    [1, "family"],
    [4, "full"],
    [6, "postscript"],
    [16, "typographicFamily"],
  ]);
  const names = {};

  for (let i = 0; i < count; i += 1) {
    const rec = 6 + i * 12;
    const platformId = table.readUInt16BE(rec);
    const languageId = table.readUInt16BE(rec + 4);
    const nameId = table.readUInt16BE(rec + 6);
    const length = table.readUInt16BE(rec + 8);
    const offset = table.readUInt16BE(rec + 10);
    const label = wanted.get(nameId);
    if (!label) {
      continue;
    }

    const raw = table.subarray(stringOffset + offset, stringOffset + offset + length);
    const text =
      platformId === 3 || platformId === 0 ? decodeUtf16Be(raw) : raw.toString("latin1").trim();
    if (!text) {
      continue;
    }

    const preferred = platformId === 3 && languageId === 0x409;
    if (!names[label] || preferred) {
      names[label] = text;
    }
  }

  return names;
}

function listFontFiles(dir) {
  if (!existsSync(dir)) {
    return [];
  }

  return readdirSync(dir)
    .filter((name) => [".ttf", ".otf", ".ttc", ".otc"].includes(extname(name).toLowerCase()))
    .map((name) => join(dir, name));
}

const files = FONT_DIRS.flatMap(listFontFiles).filter((filePath) => {
  const lower = filePath.toLowerCase();
  return KEYWORDS.some((keyword) => lower.includes(keyword));
});

if (files.length === 0) {
  console.log("No matching font files found in ~/Library/Fonts or /Library/Fonts.");
  console.log("Install the font, then update candidateFamilyNames in src/shared/font-registry.ts.");
  process.exit(0);
}

console.log("Installed font name tables (family / full / postscript):");
for (const filePath of files.sort()) {
  const names = readNameTable(filePath);
  console.log(`\n${filePath}`);
  if (!names) {
    console.log("  (could not parse name table)");
    continue;
  }
  for (const [key, value] of Object.entries(names)) {
    console.log(`  ${key}: ${value}`);
  }
}

console.log("\nCopy matching family names into src/shared/font-registry.ts.");
