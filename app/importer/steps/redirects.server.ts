import type { StepContext } from "../context.server";
import { assertNoUserErrors, gql } from "../graphql.server";

export async function importRedirects(ctx: StepContext) {
  for (const redirect of ctx.bundle.redirects ?? []) {
    const existing = await gql(
      ctx.admin,
      `#graphql
        query importerFindRedirect($query: String!) {
          urlRedirects(first: 1, query: $query) {
            nodes {
              path
            }
          }
        }`,
      { query: `path:'${redirect.path}'` },
    );
    if (existing?.urlRedirects.nodes.some((r) => r.path === redirect.path)) {
      ctx.log(`Redirect ${redirect.path} already exists`);
      continue;
    }
    const data = await gql(
      ctx.admin,
      `#graphql
        mutation importerCreateRedirect($urlRedirect: UrlRedirectInput!) {
          urlRedirectCreate(urlRedirect: $urlRedirect) {
            userErrors {
              field
              message
            }
          }
        }`,
      { urlRedirect: redirect },
    );
    assertNoUserErrors(
      `Redirect ${redirect.path}`,
      data?.urlRedirectCreate?.userErrors,
    );
    ctx.log(`Created redirect ${redirect.path}`);
  }
}
