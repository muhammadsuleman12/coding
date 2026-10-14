import type { StepContext } from "../context.server";
import { assertNoUserErrors, gql } from "../graphql.server";

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
            originalSource: file.url,
            filename: file.filename,
            alt: file.alt,
            contentType: file.contentType,
            duplicateResolutionMode: "RAISE_ERROR",
          },
        ],
      },
    );
    assertNoUserErrors(`File ${file.filename}`, data?.fileCreate?.userErrors);
    ctx.log(`Uploaded file ${file.filename}`);
  }
}
