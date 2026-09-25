/**
 * Minimal DOM builder for the popup and options page. Text is always set via
 * textContent / text nodes, never innerHTML, so user-controlled strings
 * (subreddit names, keywords, category names, imported files) cannot inject
 * markup.
 */

type Child = Node | string | number | null | undefined | false;
type Props = {
  class?: string;
  text?: string;
  attrs?: Record<string, string | boolean | undefined>;
  on?: Partial<{ [K in keyof HTMLElementEventMap]: (e: HTMLElementEventMap[K]) => void }>;
  [key: string]: unknown;
};

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  const { class: className, text, attrs, on, ...rest } = props;
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v === undefined || v === false) continue;
    el.setAttribute(k, v === true ? "" : v);
  }
  for (const [k, v] of Object.entries(on ?? {})) el.addEventListener(k, v as EventListener);
  for (const [k, v] of Object.entries(rest)) {
    if (v !== undefined) (el as unknown as Record<string, unknown>)[k] = v;
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : String(c));
  }
  return el;
}

export function toggle(checked: boolean, onChange: (checked: boolean) => void, label: string): HTMLLabelElement {
  const input = h("input", { type: "checkbox", checked, attrs: { role: "switch", "aria-label": label } });
  input.addEventListener("change", () => onChange(input.checked));
  return h("label", { class: "switch", title: label }, input, h("span", { class: "slider", attrs: { "aria-hidden": "true" } }));
}

export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el as T;
}
