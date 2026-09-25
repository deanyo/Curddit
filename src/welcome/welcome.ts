import { SCOPE_LABELS } from "../content/feed-scope";
import { byId, h, toggle } from "../shared/dom";
import { setCategoryEnabled } from "../storage/config-ops";
import { loadConfig, onConfigChanged, updateConfig } from "../storage/config-store";
import { FEED_SCOPES, type Config } from "../storage/schema";

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function render(config: Config): void {
  byId("cats").replaceChildren(
    ...config.categories.map((cat) => {
      const parts = [
        cat.rules.subreddits.length ? (cat.rules.subreddits.length === 1 ? "1 community" : `${cat.rules.subreddits.length} communities`) : "",
        cat.rules.patterns.length ? plural(cat.rules.patterns.length, "name pattern") : "",
        cat.rules.keywords.length ? plural(cat.rules.keywords.length, "title keyword") : "",
      ].filter(Boolean);
      return h(
        "li",
        {},
        h("div", { class: "text" }, h("strong", { text: cat.name }), h("span", { text: cat.description }), h("small", { text: parts.join(" · ") })),
        toggle(cat.enabled, (on) => void updateConfig((c) => setCategoryEnabled(c, cat.id, on)), `Hide ${cat.name}`),
      );
    }),
  );
  byId("scope").replaceChildren(
    ...FEED_SCOPES.map((s) =>
      h(
        "label",
        {},
        h("input", {
          type: "radio",
          name: "scope",
          checked: config.scope === s,
          on: { change: () => void updateConfig((c) => ({ ...c, scope: s })) },
        }),
        SCOPE_LABELS[s],
      ),
    ),
  );
}

async function main(): Promise<void> {
  render(await loadConfig());
  onConfigChanged(render);
  byId("settings").addEventListener("click", () => void browser.runtime.openOptionsPage());
}

void main();
