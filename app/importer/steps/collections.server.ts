import type {
  BundleCollection,
  BundleCollectionRule,
  TextRelation,
} from "../bundle";
import type { CurrencyCode } from "../../types/admin.types";
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

  const rules = collection.rules?.conditions ?? [];
  const currencyCode = rules.some((r) => r.column.startsWith("VARIANT_"))
    ? await shopCurrency(ctx)
    : "USD";
  const conditions = rules.map((rule) => toCondition(rule, currencyCode));
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
function toCondition(rule: BundleCollectionRule, currencyCode: CurrencyCode) {
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
    case "VARIANT_TITLE":
      return {
        variantTitle: {
          relation: textRelation(rule.relation),
          values,
          matchType,
        },
      };
    case "VARIANT_PRICE":
      return {
        variantPrice: {
          relation: rule.relation,
          value: { amount: rule.condition, currencyCode },
        },
      };
    case "VARIANT_COMPARE_AT_PRICE":
      return {
        variantCompareAtPrice: {
          relation: rule.relation,
          value: { amount: rule.condition, currencyCode },
        },
      };
  }
}

function textRelation(relation: TextRelation) {
  return relation === "NOT_CONTAINS" ? ("DOES_NOT_CONTAIN" as const) : relation;
}

// Price rules compare in the merchant's store currency.
async function shopCurrency(ctx: StepContext) {
  const data = await gql(
    ctx.admin,
    `#graphql
      query importerShopCurrency {
        shop {
          currencyCode
        }
      }`,
  );
  return data?.shop.currencyCode ?? "USD";
}
