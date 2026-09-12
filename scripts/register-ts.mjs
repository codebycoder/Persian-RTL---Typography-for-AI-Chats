import { register } from "node:module";
import { pathToFileURL } from "node:url";

register(new URL("./ts-test-hooks.mjs", import.meta.url));
