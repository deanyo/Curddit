// Builds the extension: bundles each entry point with esbuild (no runtime
// dependencies, no code splitting, no eval) and copies static files.
//
//   node scripts/build.mjs                  -> dist/         (Firefox)
//   node scripts/build.mjs --target=chrome  -> dist-chrome/  (Chrome, Edge, Brave, Opera...)
//   add --watch to rebuild scripts on change
//
// The source is shared. The Chrome build differs only in its manifest
// (service-worker background, PNG icons, no Firefox-only keys) and a one-line
// banner aliasing `chrome` as `browser` (Chrome MV3's chrome.* APIs return
// promises, like Firefox's browser.*).
import { build, context } from "esbuild";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";

const watch = process.argv.includes("--watch");
const target = process.argv.find((a) => a.startsWith("--target="))?.split("=")[1] ?? "firefox";
if (!["firefox", "chrome"].includes(target)) throw new Error(`Unknown target: ${target}`);
const chrome = target === "chrome";
const outdir = chrome ? "dist-chrome" : "dist";

const entryPoints = {
  background: "src/background/index.ts",
  content: "src/content/index.ts",
  "popup/popup": "src/popup/popup.ts",
  "options/options": "src/options/options.ts",
  "welcome/welcome": "src/welcome/welcome.ts",
};

const options = {
  entryPoints,
  outdir,
  bundle: true,
  format: "iife",
  target: chrome ? ["chrome120"] : ["firefox142"],
  banner: chrome ? { js: "globalThis.browser ??= globalThis.chrome;" } : undefined,
  sourcemap: watch ? "inline" : false,
  legalComments: "none",
  logLevel: "info",
};

const PNG_ICONS = { 16: "icons/icon-16.png", 32: "icons/icon-32.png", 48: "icons/icon-48.png", 128: "icons/icon-128.png" };

function chromeManifest(m) {
  const { browser_specific_settings: _firefoxOnly, ...rest } = m;
  return {
    ...rest,
    minimum_chrome_version: "120",
    icons: PNG_ICONS,
    background: { service_worker: "background.js" },
    action: { ...m.action, default_icon: PNG_ICONS },
  };
}

async function copyStatic() {
  await cp("static", outdir, { recursive: true });
  for (const page of ["popup", "options", "welcome"]) {
    await mkdir(`${outdir}/${page}`, { recursive: true });
    await cp(`src/${page}/${page}.html`, `${outdir}/${page}/${page}.html`);
    await cp(`src/${page}/${page}.css`, `${outdir}/${page}/${page}.css`);
  }
  await cp("src/shared/ui.css", `${outdir}/shared/ui.css`);
  // Keep the manifest version in sync with package.json.
  const pkg = JSON.parse(await readFile("package.json", "utf8"));
  let manifest = JSON.parse(await readFile(`${outdir}/manifest.json`, "utf8"));
  manifest.version = pkg.version;
  if (chrome) manifest = chromeManifest(manifest);
  await writeFile(`${outdir}/manifest.json`, JSON.stringify(manifest, null, 2));
}

await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });
await copyStatic();
if (watch) {
  const ctx = await context(options);
  await ctx.watch();
  console.log("Watching for changes (static files are copied once; restart to pick up HTML/CSS/manifest changes).");
} else {
  await build(options);
}
