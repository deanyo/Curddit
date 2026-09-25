import { SCOPE_LABELS } from "../content/feed-scope";
import { byId, h, toggle } from "../shared/dom";
import { readLifetimeStats, readSessionStats } from "../shared/stats";
import { countActiveRules, setCategoryEnabled } from "../storage/config-ops";
import { loadConfig, onConfigChanged, updateConfig } from "../storage/config-store";
import { LIFETIME_STATS_KEY, SESSION_STATS_KEY, type Config, type SessionStats } from "../storage/schema";

const PAUSE_MS = 60 * 60 * 1000;

let config: Config;
let session: SessionStats = { totalHidden: 0, byCategory: {} };

function isPaused(c: Config): boolean {
  return c.pausedUntil !== null && c.pausedUntil > Date.now();
}

function render(): void {
  byId("master").replaceChildren(
    toggle(config.enabled, (on) => void updateConfig((c) => ({ ...c, enabled: on })), "Enable filtering"),
  );

  const status = byId("status");
  status.classList.toggle("off", !config.enabled || isPaused(config));
  if (!config.enabled) status.textContent = "Filtering is off.";
  else if (isPaused(config)) {
    const t = new Date(config.pausedUntil!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    status.textContent = `Paused until ${t}.`;
  } else if (!config.categories.some((c) => c.enabled)) {
    status.textContent = "No categories switched on yet. Turn some on below.";
  } else status.textContent = `Filtering: ${SCOPE_LABELS[config.scope]}.`;

  const list = byId("categories");
  list.replaceChildren(
    ...config.categories.map((cat) => {
      const rules = cat.rules.subreddits.length + cat.rules.patterns.length + cat.rules.keywords.length;
      const hidden = session.byCategory[cat.id] ?? 0;
      return h(
        "li",
        {},
        h(
          "div",
          { class: "name" },
          h("div", { text: cat.name, title: cat.description }),
          h("small", { text: `${rules} rule${rules === 1 ? "" : "s"} · ${hidden} hidden this session` }),
        ),
        toggle(cat.enabled, (on) => void updateConfig((c) => setCategoryEnabled(c, cat.id, on)), `Enable ${cat.name}`),
      );
    }),
  );
  if (!config.categories.length) list.append(h("li", { class: "muted", text: "No categories. Add some in Settings." }));

  byId("stat-session").textContent = String(session.totalHidden);
  byId("stat-rules").textContent = String(countActiveRules(config));
  const pause = byId<HTMLButtonElement>("pause");
  pause.textContent = isPaused(config) ? "Resume" : "Pause 1 hour";
  pause.disabled = !config.enabled;
}

async function refreshStats(): Promise<void> {
  session = await readSessionStats();
  byId("stat-lifetime").textContent = String((await readLifetimeStats()).totalHidden);
  render();
}

async function main(): Promise<void> {
  config = await loadConfig();
  await refreshStats();

  byId("pause").addEventListener("click", () => {
    void updateConfig((c) => ({ ...c, pausedUntil: isPaused(c) ? null : Date.now() + PAUSE_MS }));
  });
  byId("reset-stats").addEventListener("click", () => {
    void browser.runtime.sendMessage({ type: "reset-session-stats" });
  });
  byId("settings").addEventListener("click", () => {
    void browser.runtime.openOptionsPage();
    window.close();
  });

  onConfigChanged((c) => {
    config = c;
    render();
  });
  browser.storage.onChanged.addListener((changes) => {
    if (SESSION_STATS_KEY in changes || LIFETIME_STATS_KEY in changes) void refreshStats();
  });
}

void main();
