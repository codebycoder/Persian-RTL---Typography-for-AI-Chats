import { chatgptAdapter } from "./chatgpt/adapter";
import { claudeAdapter } from "./claude/adapter";
import type { PlatformAdapter } from "./types";

const PLATFORM_ADAPTERS: readonly PlatformAdapter[] = [chatgptAdapter, claudeAdapter];

/**
 * Resolve the adapter for the page hostname. Unknown hosts return
 * `undefined` so the content script can no-op.
 */
export function resolvePlatform(hostname: string): PlatformAdapter | undefined {
  return PLATFORM_ADAPTERS.find((adapter) => adapter.matchesHostname(hostname));
}
