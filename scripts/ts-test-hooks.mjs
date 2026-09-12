import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const projectRoot = join(fileURLToPath(new URL("..", import.meta.url)));
const sharedRoot = join(projectRoot, "src/shared");

function resolveExisting(base) {
  if (existsSync(base) && !base.endsWith("/")) {
    return base;
  }
  if (existsSync(`${base}.ts`)) {
    return `${base}.ts`;
  }
  if (existsSync(join(base, "index.ts"))) {
    return join(base, "index.ts");
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@shared/")) {
    const resolved = resolveExisting(join(sharedRoot, specifier.slice("@shared/".length)));
    if (resolved) {
      return { url: pathToFileURL(resolved).href, shortCircuit: true };
    }
  }

  if (specifier.startsWith(".") && context.parentURL) {
    const parentDir = dirname(fileURLToPath(context.parentURL));
    const resolved = resolveExisting(join(parentDir, specifier));
    if (resolved) {
      return { url: pathToFileURL(resolved).href, shortCircuit: true };
    }
  }

  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.endsWith(".ts")) {
    const fileName = fileURLToPath(new URL(url));
    const source = readFileSync(fileName, "utf8");
    const transpiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        verbatimModuleSyntax: true,
        isolatedModules: true,
      },
      fileName,
    });

    return {
      format: "module",
      source: transpiled.outputText,
      shortCircuit: true,
    };
  }

  return nextLoad(url, context);
}
