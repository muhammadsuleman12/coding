#!/usr/bin/env node
// Zips each template theme (bundles/<template>/theme) into
// public/bundles/<template>/theme.zip, where themeCreate downloads it from.
// Runs before `react-router build` and before `shopify app dev`; the zips
// are generated files and are not committed.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { zipSync } from "fflate";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bundlesDir = path.join(root, "bundles");

for (const template of fs.readdirSync(bundlesDir)) {
  const themeDir = path.join(bundlesDir, template, "theme");
  if (!fs.existsSync(themeDir)) continue;

  const files = {};
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      // Zip paths use forward slashes regardless of platform.
      else files[path.relative(themeDir, full).split(path.sep).join("/")] =
        fs.readFileSync(full);
    }
  };
  walk(themeDir);

  const outDir = path.join(root, "public", "bundles", template);
  fs.mkdirSync(outDir, { recursive: true });
  const zip = zipSync(files, { level: 9 });
  fs.writeFileSync(path.join(outDir, "theme.zip"), zip);
  console.log(
    `theme.zip for ${template}: ${Object.keys(files).length} files, ${(zip.length / 1e6).toFixed(1)} MB`,
  );
}
