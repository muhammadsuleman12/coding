import db from "../db.server";
import type { StepState } from "./steps";
import { STEP_ORDER } from "./steps";

export function parseSteps(steps: string): StepState[] {
  return JSON.parse(steps);
}

export async function createImportJob(shop: string, template: string) {
  const steps: StepState[] = STEP_ORDER.map((key) => ({
    key,
    status: "PENDING",
  }));
  return db.importJob.create({
    data: { shop, template, steps: JSON.stringify(steps) },
  });
}

export async function latestImportJob(shop: string) {
  return db.importJob.findFirst({
    where: { shop },
    orderBy: { createdAt: "desc" },
  });
}

// A failed job resumes from its first unfinished step.
export async function retryImportJob(shop: string, id: string) {
  await db.importJob.updateMany({
    where: { id, shop, status: "FAILED" },
    data: { status: "QUEUED", error: null },
  });
}
