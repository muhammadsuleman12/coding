import type { AdminOperations } from "@shopify/admin-api-client";
import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";

export type Admin = AdminApiContext;

type Variables<Op extends keyof AdminOperations> =
  AdminOperations[Op]["variables"];
type Result<Op extends keyof AdminOperations> = AdminOperations[Op]["return"];

const MAX_THROTTLE_RETRIES = 8;

// Runs a typed Admin GraphQL operation. Retries when Shopify throttles us
// (the query cost bucket is empty) and throws on any other GraphQL error.
export async function gql<Op extends keyof AdminOperations>(
  admin: Admin,
  query: Op,
  variables?: Variables<Op>,
): Promise<Result<Op>> {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await admin.graphql(query, {
        variables: variables as never,
        tries: 3,
      });
      const body = await response.json();
      return body.data as Result<Op>;
    } catch (error) {
      if (isThrottled(error) && attempt < MAX_THROTTLE_RETRIES) {
        await sleep(Math.min(1000 * 2 ** attempt, 30_000));
        continue;
      }
      throw error;
    }
  }
}

// Mutations report validation problems as userErrors instead of throwing.
export function assertNoUserErrors(
  what: string,
  userErrors: { field?: string[] | null; message: string }[] | undefined | null,
) {
  if (userErrors && userErrors.length > 0) {
    const details = userErrors
      .map((e) => (e.field?.length ? `${e.field.join(".")}: ` : "") + e.message)
      .join("; ");
    throw new Error(`${what}: ${details}`);
  }
}

function isThrottled(error: unknown): boolean {
  const text = JSON.stringify(
    (error as { body?: unknown })?.body ?? (error as Error)?.message ?? "",
  );
  return text.includes("THROTTLED") || text.includes("Throttled");
}

export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Runs fn over items with at most `limit` calls in flight. Stops at the first
// error.
export async function forEachLimit<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
) {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, () =>
    (async () => {
      while (next < items.length) {
        await fn(items[next++]);
      }
    })(),
  );
  await Promise.all(workers);
}
