// Builds the extension into dist/: bundles each entry point with esbuild
// (no runtime dependencies, no code splitting, no eval) and copies static files.
import { build, context } from "esbuild";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";

const watch = process.argv.includes("--watch");
const outdir = "dist";

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
  target: ["firefox142"],
  sourcemap: watch ? "inline" : false,
  legalComments: "none",
  logLevel: "info",
};

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
  const manifest = JSON.parse(await readFile(`${outdir}/manifest.json`, "utf8"));
  manifest.version = pkg.version;
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
