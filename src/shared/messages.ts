/** Messages sent from content scripts to the background script. */

export interface HiddenPostReport {
  /** Stable post key (post id or permalink). Used to avoid double counting. */
  key: string;
  category: string;
}

export type ContentMessage =
  | { type: "posts-hidden"; items: HiddenPostReport[]; tabHiddenCount: number }
  | { type: "tab-count"; tabHiddenCount: number }
  | { type: "open-options" };

export function isContentMessage(m: unknown): m is ContentMessage {
  return typeof m === "object" && m !== null && typeof (m as { type?: unknown }).type === "string";
}
