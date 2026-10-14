import type { Bundle } from "./bundle";
import type { Admin } from "./graphql.server";
import { gql } from "./graphql.server";

export interface StepContext {
  admin: Admin;
  bundle: Bundle;
  log: (message: string) => void;
  onlineStorePublicationId: () => Promise<string>;
  assetUrl: (url: string) => string;
}

export function createContext(
  admin: Admin,
  bundle: Bundle,
  log: (message: string) => void,
): StepContext {
  let publicationId: Promise<string> | undefined;
  return {
    admin,
    bundle,
    log,
    // Products and collections are created unpublished; this is the sales
    // channel we publish them to.
    onlineStorePublicationId: () =>
      (publicationId ??= findOnlineStorePublication(admin)),
    assetUrl,
  };
}

// Bundle files may use paths relative to where bundle assets are hosted
// (e.g. "bundles/sample/hero.jpg"). Shopify downloads them from that host,
// which defaults to the app itself (its public/ folder).
function assetUrl(url: string) {
  if (/^https?:\/\//.test(url)) return url;
  const base =
    process.env.BUNDLE_ASSET_BASE_URL || process.env.SHOPIFY_APP_URL || "";
  if (!base) throw new Error(`No base URL to resolve asset ${url}`);
  return `${base.replace(/\/$/, "")}/${url.replace(/^\//, "")}`;
}

async function findOnlineStorePublication(admin: Admin) {
  const data = await gql(
    admin,
    `#graphql
      query importerPublications {
        publications(first: 50) {
          nodes {
            id
            name
          }
        }
      }`,
  );
  const onlineStore = data?.publications.nodes.find(
    (p) => p.name === "Online Store",
  );
  if (!onlineStore) {
    throw new Error("The store has no Online Store sales channel");
  }
  return onlineStore.id;
}

export async function publishToOnlineStore(ctx: StepContext, id: string) {
  const data = await gql(
    ctx.admin,
    `#graphql
      mutation importerPublish($id: ID!, $input: [PublicationInput!]!) {
        publishablePublish(id: $id, input: $input) {
          userErrors {
            field
            message
          }
        }
      }`,
    { id, input: [{ publicationId: await ctx.onlineStorePublicationId() }] },
  );
  const errors = data?.publishablePublish?.userErrors ?? [];
  if (errors.length > 0) {
    throw new Error(
      `Publishing ${id}: ${errors.map((e) => e.message).join("; ")}`,
    );
  }
}
