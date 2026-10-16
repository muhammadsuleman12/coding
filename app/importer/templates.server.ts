import fs from "node:fs/promises";
import path from "node:path";
import type { Bundle } from "./bundle";

export interface Template {
  id: string;
  name: string;
  description: string;
  // Internal test data, shown only when SHOW_SAMPLE_TEMPLATE=true
  internal?: boolean;
}

export const TEMPLATES: Template[] = [
  {
    id: "general",
    name: "General",
    description: "A versatile store for any kind of product.",
  },
  {
    id: "pet",
    name: "Pet",
    description: "A store designed for pet products and accessories.",
  },
  {
    id: "sample",
    name: "Sample (test data)",
    description: "A few products, pages and menus for testing the importer.",
    internal: true,
  },
];

// Bundles live in bundles/<template>/content.json for now; they move to
// object storage (R2) once exports exist for the real templates.
function bundlePath(templateId: string) {
  return path.join(process.cwd(), "bundles", templateId, "content.json");
}

export async function isTemplateAvailable(templateId: string) {
  try {
    await fs.access(bundlePath(templateId));
    return true;
  } catch {
    return false;
  }
}

export async function loadBundle(templateId: string): Promise<Bundle> {
  if (!TEMPLATES.some((t) => t.id === templateId)) {
    throw new Error(`Unknown template ${templateId}`);
  }
  return JSON.parse(await fs.readFile(bundlePath(templateId), "utf8"));
}

export function visibleTemplates() {
  return TEMPLATES.filter(
    (t) => !t.internal || process.env.SHOW_SAMPLE_TEMPLATE === "true",
  );
}

const previewCache = new Map<string, string | null>();

// The first image on the template theme's homepage, used as the card
// preview. Resolved from the bundle's files, so it is the template store's
// CDN URL.
export async function templatePreview(templateId: string) {
  if (previewCache.has(templateId)) return previewCache.get(templateId)!;
  let preview: string | null = null;
  try {
    const index = await fs.readFile(
      path.join(
        process.cwd(),
        "bundles",
        templateId,
        "theme",
        "templates",
        "index.json",
      ),
      "utf8",
    );
    const filename = /shopify:\/\/shop_images\/([^"\\]+)/.exec(index)?.[1];
    const bundle = await loadBundle(templateId);
    const url = bundle.files?.find(
      (f) => f.filename === decodeURIComponent(filename ?? ""),
    )?.url;
    if (url) preview = `${url}${url.includes("?") ? "&" : "?"}width=800`;
  } catch {
    // No theme yet (e.g. the sample template): no preview.
  }
  previewCache.set(templateId, preview);
  return preview;
}
