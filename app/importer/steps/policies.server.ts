import type { StepContext } from "../context.server";
import { assertNoUserErrors, gql } from "../graphql.server";

// Sets shop policies that are still empty; never overwrites one the
// merchant has written.
export async function importPolicies(ctx: StepContext) {
  const current = await loadPolicies(ctx);

  for (const policy of ctx.bundle.policies ?? []) {
    if (current.find((p) => p.type === policy.type)?.body.trim()) {
      ctx.log(`Policy ${policy.type} already set`);
      continue;
    }
    const data = await gql(
      ctx.admin,
      `#graphql
        mutation importerUpdatePolicy($shopPolicy: ShopPolicyInput!) {
          shopPolicyUpdate(shopPolicy: $shopPolicy) {
            userErrors {
              field
              message
            }
          }
        }`,
      { shopPolicy: { type: policy.type, body: policy.body } },
    );
    assertNoUserErrors(
      `Policy ${policy.type}`,
      data?.shopPolicyUpdate?.userErrors,
    );
    ctx.log(`Set policy ${policy.type}`);
  }
}

export async function findPolicyIds(ctx: StepContext) {
  return new Map(
    (await loadPolicies(ctx)).map((p) => [p.type as string, p.id]),
  );
}

async function loadPolicies(ctx: StepContext) {
  const data = await gql(
    ctx.admin,
    `#graphql
      query importerPolicies {
        shop {
          shopPolicies {
            id
            type
            body
          }
        }
      }`,
  );
  return data?.shop.shopPolicies ?? [];
}
