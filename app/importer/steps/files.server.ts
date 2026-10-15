import type { BundleFile } from "../bundle";
import type { StepContext } from "../context.server";
import {
  assertNoUserErrors,
  forEachLimit,
  gql,
  sleep,
} from "../graphql.server";

const CONCURRENCY = 4;
const MAX_ATTEMPTS = 3;
const FILE_TIMEOUT_MS = 120_000;

// Uploads the standalone files the theme references by filename. Shopify
// downloads each file from its source URL in the background; a download that
// fails (source CDN hiccups happen) is retried. Uploads replace any file with
// the same name, so a file left FAILED by an earlier run is overwritten and
// the filename the theme references stays the same.
export async function importFiles(ctx: StepContext) {
  await forEachLimit(ctx.bundle.files ?? [], CONCURRENCY, async (file) => {
    const existing = await findFile(ctx, file.filename);
    if (existing && existing.fileStatus !== "FAILED") {
      ctx.log(`File ${file.filename} already exists`);
      return;
    }

    for (let attempt = 1; ; attempt++) {
      const id = await createFile(ctx, file);
      const error = await waitForFile(ctx, file.filename, id);
      if (!error) break;

      if (attempt >= MAX_ATTEMPTS) {
        throw new Error(`File ${file.filename} failed: ${error}`);
      }
      ctx.log(`File ${file.filename} failed (${error}); retrying`);
      await sleep(5000 * attempt);
    }
    ctx.log(`Uploaded file ${file.filename}`);
  });
}

async function findFile(ctx: StepContext, filename: string) {
  const data = await gql(
    ctx.admin,
    `#graphql
      query importerFindFile($query: String!) {
        files(first: 1, query: $query) {
          nodes {
            id
            fileStatus
          }
        }
      }`,
    { query: `filename:'${filename}'` },
  );
  return data?.files.nodes[0];
}

async function createFile(ctx: StepContext, file: BundleFile) {
  const data = await gql(
    ctx.admin,
    `#graphql
      mutation importerCreateFile($files: [FileCreateInput!]!) {
        fileCreate(files: $files) {
          files {
            id
          }
          userErrors {
            field
            message
          }
        }
      }`,
    {
      files: [
        {
          originalSource: ctx.assetUrl(file.url),
          filename: file.filename,
          alt: file.alt,
          contentType: file.contentType,
          duplicateResolutionMode: "REPLACE",
        },
      ],
    },
  );
  assertNoUserErrors(`File ${file.filename}`, data?.fileCreate?.userErrors);
  const id = data?.fileCreate?.files?.[0]?.id;
  if (!id) throw new Error(`File ${file.filename} was not created`);
  return id;
}

// Waits until Shopify has processed the file. Returns the failure reason, or
// undefined once the file is ready.
async function waitForFile(ctx: StepContext, filename: string, id: string) {
  const deadline = Date.now() + FILE_TIMEOUT_MS;
  for (;;) {
    const data = await gql(
      ctx.admin,
      `#graphql
        query importerFileStatus($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on File {
              fileStatus
              fileErrors {
                message
                details
              }
            }
          }
        }`,
      { ids: [id] },
    );
    const file = data?.nodes[0] as
      | {
          fileStatus?: string;
          fileErrors?: { message: string; details?: string | null }[];
        }
      | null
      | undefined;

    if (file?.fileStatus === "FAILED") {
      const error = file.fileErrors?.[0];
      return error ? error.details || error.message : "unknown error";
    }
    if (file?.fileStatus === "READY") return undefined;

    if (Date.now() > deadline) return `${filename} is still processing`;
    await sleep(2000);
  }
}
