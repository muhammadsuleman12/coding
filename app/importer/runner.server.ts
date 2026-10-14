import db from "../db.server";
import { unauthenticated } from "../shopify.server";
import { createContext } from "./context.server";
import type { StepContext } from "./context.server";
import type { StepKey, StepState } from "./steps";
import { parseSteps } from "./jobs.server";
import { importBlogs } from "./steps/blogs.server";
import { importCollections } from "./steps/collections.server";
import { importFiles } from "./steps/files.server";
import { importMenus } from "./steps/menus.server";
import { importPages } from "./steps/pages.server";
import { importPolicies } from "./steps/policies.server";
import { importProducts } from "./steps/products.server";
import { importRedirects } from "./steps/redirects.server";
import { loadBundle } from "./templates.server";

const STEPS: Record<StepKey, (ctx: StepContext) => Promise<void>> = {
  files: importFiles,
  products: importProducts,
  collections: importCollections,
  pages: importPages,
  blogs: importBlogs,
  policies: importPolicies,
  menus: importMenus,
  redirects: importRedirects,
};

// Runs every unfinished step of a claimed job, saving progress after each
// one. Each step skips content that already exists, so re-running a step
// after a crash is safe.
export async function runImportJob(jobId: string) {
  const job = await db.importJob.findUniqueOrThrow({ where: { id: jobId } });
  const steps = parseSteps(job.steps);
  const save = (data: { status?: string; error?: string | null } = {}) =>
    db.importJob.update({
      where: { id: jobId },
      data: { ...data, steps: JSON.stringify(steps) },
    });

  let current: StepState | undefined;
  try {
    const { admin } = await unauthenticated.admin(job.shop);
    const bundle = await loadBundle(job.template);
    const log = (message: string) =>
      console.log(`[import ${job.shop} ${job.template}] ${message}`);
    const ctx = createContext(admin, bundle, log);

    for (const step of steps) {
      if (step.status === "DONE") continue;
      current = step;
      step.status = "RUNNING";
      step.message = undefined;
      await save();

      await STEPS[step.key](ctx);

      step.status = "DONE";
      await save();
    }

    await db.importJob.update({
      where: { id: jobId },
      data: { status: "DONE", finishedAt: new Date() },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[import ${job.shop}] failed:`, error);
    if (current) {
      current.status = "FAILED";
      current.message = message;
    }
    await save({ status: "FAILED", error: message });
  }
}
