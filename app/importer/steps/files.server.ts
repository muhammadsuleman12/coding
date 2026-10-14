import type { StepContext } from "../context.server";
import { assertNoUserErrors, gql, sleep } from "../graphql.server";

// Uploads the standalone files the theme references by filename.
export async function importFiles(ctx: StepContext) {
  for (const file of ctx.bundle.files ?? []) {
    const existing = await gql(
      ctx.admin,
      `#graphql
        query importerFindFile($query: String!) {
          files(first: 1, query: $query) {
            nodes {
              id
            }
          }
        }`,
      { query: `filename:'${file.filename}'` },
    );
    if (existing?.files.nodes.length) {
      ctx.log(`File ${file.filename} already exists`);
      continue;
    }

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
            duplicateResolutionMode: "RAISE_ERROR",
          },
        ],
      },
    );
    assertNoUserErrors(`File ${file.filename}`, data?.fileCreate?.userErrors);
    const id = data?.fileCreate?.files?.[0]?.id;
    if (!id) throw new Error(`File ${file.filename} was not created`);
    await waitForFile(ctx, file.filename, id);
    ctx.log(`Uploaded file ${file.filename}`);
  }
}

const FILE_TIMEOUT_MS = 120_000;

// fileCreate returns before Shopify has downloaded the file; wait for it so a
// broken URL fails the import.
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
      throw new Error(
        `File ${filename} failed: ${error ? error.details || error.message : "unknown error"}`,
      );
    }
    if (file?.fileStatus === "READY") return;

    if (Date.now() > deadline) {
      throw new Error(`File ${filename} is still processing`);
    }
    await sleep(2000);
  }
}
