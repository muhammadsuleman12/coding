import type { BundleCollection, BundleCollectionRule } from "../bundle";
import type { StepContext } from "../context.server";
import { publishToOnlineStore } from "../context.server";
import { assertNoUserErrors, gql } from "../graphql.server";

// Creates manual and smart collections, keyed by handle. Runs after products
// so manual collections can resolve their product handles.
export async function importCollections(ctx: StepContext) {
  for (const collection of ctx.bundle.collections ?? []) {
    const existing = await gql(
      ctx.admin,
      `#graphql
        query importerFindCollection($handle: String!) {
          collectionByIdentifier(identifier: { handle: $handle }) {
            id
          }
        }`,
      { handle: collection.handle },
    );
    if (existing?.collectionByIdentifier) {
      ctx.log(`Collection ${collection.handle} already exists`);
      continue;
    }

    const data = await gql(
      ctx.admin,
      `#graphql
        mutation importerCreateCollection($collection: CollectionCreateInput!) {
          collectionCreate(collection: $collection) {
            collection {
              id
            }
            userErrors {
              field
              message
            }
          }
        }`,
      {
        collection: {
          handle: collection.handle,
          title: collection.title,
          descriptionHtml: collection.descriptionHtml,
          sortOrder: collection.sortOrder,
          templateSuffix: collection.templateSuffix,
          seo: collection.seo,
          image: collection.image
            ? {
                src: ctx.assetUrl(collection.image.url),
                altText: collection.image.alt,
              }
            : undefined,
          sources: await toSources(ctx, collection),
        },
      },
    );
    assertNoUserErrors(
      `Collection ${collection.handle}`,
      data?.collectionCreate?.userErrors,
    );
    const id = data?.collectionCreate?.collection?.id;
    if (!id) throw new Error(`Collection ${collection.handle} was not created`);

    await publishToOnlineStore(ctx, id);
    ctx.log(`Created collection ${collection.handle}`);
  }
}

async function toSources(ctx: StepContext, collection: BundleCollection) {
  const selections = [];
  for (const handle of collection.products ?? []) {
    const product = await gql(
      ctx.admin,
      `#graphql
        query importerFindCollectionProduct($handle: String!) {
          productByIdentifier(identifier: { handle: $handle }) {
            id
          }
        }`,
      { handle },
    );
    const productId = product?.productByIdentifier?.id;
    if (!productId) {
      throw new Error(
        `Collection ${collection.handle}: product ${handle} not found`,
      );
    }
    selections.push({ productId });
  }

  const conditions = (collection.rules?.conditions ?? []).map(toCondition);
  if (selections.length === 0 && conditions.length === 0) return undefined;

  return [
    {
      source: {
        title: collection.title,
        inclusion: {
          matchType: collection.rules?.disjunctive
            ? ("ANY" as const)
            : ("ALL" as const),
          conditions: conditions.length ? conditions : undefined,
          selections: selections.length ? selections : undefined,
        },
      },
    },
  ];
}

// Maps an admin-style smart collection rule to a source condition.
function toCondition(rule: BundleCollectionRule) {
  const values = [rule.condition];
  const matchType = "ANY" as const;
  switch (rule.column) {
    case "TAG":
      return {
        productTag: {
          relation:
            rule.relation === "EQUALS"
              ? ("TAGGED_WITH" as const)
              : ("NOT_TAGGED_WITH" as const),
          values,
          matchType,
        },
      };
    case "TITLE":
      return {
        productTitle: {
          relation: textRelation(rule.relation),
          values,
          matchType,
        },
      };
    case "TYPE":
      return {
        productType: {
          relation: textRelation(rule.relation),
          values,
          matchType,
        },
      };
    case "VENDOR":
      return {
        productVendor: {
          relation: textRelation(rule.relation),
          values,
          matchType,
        },
      };
  }
}

function textRelation(
  relation: Exclude<BundleCollectionRule, { column: "TAG" }>["relation"],
) {
  return relation === "NOT_CONTAINS" ? ("DOES_NOT_CONTAIN" as const) : relation;
}
