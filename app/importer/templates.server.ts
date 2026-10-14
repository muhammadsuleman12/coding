import fs from "node:fs/promises";
import path from "node:path";
import type { Bundle } from "./bundle";

export interface Template {
  id: string;
  name: string;
  description: string;
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
