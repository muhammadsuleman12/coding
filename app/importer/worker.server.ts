import db from "../db.server";
import { runImportJob } from "./runner.server";

const POLL_INTERVAL_MS = 2000;

declare global {
  // eslint-disable-next-line no-var
  var importWorkerStarted: boolean | undefined;
}

// Polls the database for queued import jobs and runs them one at a time,
// outside of any web request. Started once per server process; dev-server
// reloads reuse the running loop.
export function startImportWorker() {
  if (global.importWorkerStarted) return;
  global.importWorkerStarted = true;
  void loop();
}

async function loop() {
  // Jobs left RUNNING by a previous process were interrupted; resume them.
  await db.importJob.updateMany({
    where: { status: "RUNNING" },
    data: { status: "QUEUED" },
  });

  for (;;) {
    try {
      const jobId = await claimNextJob();
      if (jobId) {
        await runImportJob(jobId);
        continue;
      }
    } catch (error) {
      console.error("[import worker]", error);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

async function claimNextJob() {
  const next = await db.importJob.findFirst({
    where: { status: "QUEUED" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!next) return null;

  const claimed = await db.importJob.updateMany({
    where: { id: next.id, status: "QUEUED" },
    data: {
      status: "RUNNING",
      startedAt: new Date(),
      attempts: { increment: 1 },
    },
  });
  return claimed.count === 1 ? next.id : null;
}
