import type { StepContext } from "../context.server";
import { assertNoUserErrors, gql } from "../graphql.server";

export async function importPages(ctx: StepContext) {
  for (const page of ctx.bundle.pages ?? []) {
    if (await findPageId(ctx, page.handle)) {
      ctx.log(`Page ${page.handle} already exists`);
      continue;
    }

    const data = await gql(
      ctx.admin,
      `#graphql
        mutation importerCreatePage($page: PageCreateInput!) {
          pageCreate(page: $page) {
            page {
              id
            }
            userErrors {
              field
              message
            }
          }
        }`,
      {
        page: {
          handle: page.handle,
          title: page.title,
          body: page.bodyHtml,
          templateSuffix: page.templateSuffix,
          isPublished: page.published ?? true,
        },
      },
    );
    assertNoUserErrors(`Page ${page.handle}`, data?.pageCreate?.userErrors);
    ctx.log(`Created page ${page.handle}`);
  }
}

export async function findPageId(ctx: StepContext, handle: string) {
  const data = await gql(
    ctx.admin,
    `#graphql
      query importerFindPage($query: String!) {
        pages(first: 1, query: $query) {
          nodes {
            id
            handle
          }
        }
      }`,
    { query: `handle:'${handle}'` },
  );
  return data?.pages.nodes.find((p) => p.handle === handle)?.id;
}
