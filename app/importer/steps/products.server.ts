import type { BundleProduct } from "../bundle";
import type { StepContext } from "../context.server";
import { publishToOnlineStore } from "../context.server";
import { assertNoUserErrors, gql, sleep } from "../graphql.server";

// Creates each product with productSet, keyed by handle. Products whose
// handle already exists are left untouched.
export async function importProducts(ctx: StepContext) {
  for (const product of ctx.bundle.products ?? []) {
    const existing = await gql(
      ctx.admin,
      `#graphql
        query importerFindProduct($handle: String!) {
          productByIdentifier(identifier: { handle: $handle }) {
            id
          }
        }`,
      { handle: product.handle },
    );
    if (existing?.productByIdentifier) {
      ctx.log(`Product ${product.handle} already exists`);
      continue;
    }

    const data = await gql(
      ctx.admin,
      `#graphql
        mutation importerSetProduct($input: ProductSetInput!) {
          productSet(input: $input, synchronous: true) {
            product {
              id
            }
            userErrors {
              field
              message
            }
          }
        }`,
      { input: toProductSetInput(ctx, product) },
    );
    assertNoUserErrors(
      `Product ${product.handle}`,
      data?.productSet?.userErrors,
    );
    const id = data?.productSet?.product?.id;
    if (!id) throw new Error(`Product ${product.handle} was not created`);

    await waitForMedia(ctx, product.handle, id);
    await publishToOnlineStore(ctx, id);
    ctx.log(`Created product ${product.handle}`);
  }
}

const MEDIA_TIMEOUT_MS = 120_000;

// Shopify downloads product images after productSet returns. Wait until they
// are processed so a broken image URL fails the import instead of leaving a
// product without photos.
async function waitForMedia(ctx: StepContext, handle: string, id: string) {
  const deadline = Date.now() + MEDIA_TIMEOUT_MS;
  for (;;) {
    const data = await gql(
      ctx.admin,
      `#graphql
        query importerProductMedia($id: ID!) {
          product(id: $id) {
            media(first: 250) {
              nodes {
                alt
                status
                mediaErrors {
                  message
                  details
                }
              }
            }
          }
        }`,
      { id },
    );
    const media = data?.product?.media.nodes ?? [];

    const failed = media.filter((m) => m.status === "FAILED");
    if (failed.length > 0) {
      const reasons = failed
        .map((m) => {
          const error = m.mediaErrors[0];
          const reason = error
            ? error.details || error.message
            : "unknown error";
          return `${m.alt || "image"}: ${reason}`;
        })
        .join("; ");
      throw new Error(`Product ${handle} images failed: ${reasons}`);
    }
    if (media.every((m) => m.status === "READY")) return;

    if (Date.now() > deadline) {
      throw new Error(`Product ${handle} images are still processing`);
    }
    await sleep(2000);
  }
}

function toProductSetInput(ctx: StepContext, product: BundleProduct) {
  const images = product.images ?? [];
  const files = images.map((image) => ({
    originalSource: ctx.assetUrl(image.url),
    alt: image.alt,
    contentType: "IMAGE" as const,
  }));

  // Shopify requires at least one option; single-variant products use the
  // default "Title" option.
  const options = product.options?.length
    ? product.options
    : [{ name: "Title", values: ["Default Title"] }];
  const variants = product.variants?.length
    ? product.variants
    : [{ price: "0.00", options: { Title: "Default Title" } }];

  return {
    handle: product.handle,
    title: product.title,
    descriptionHtml: product.descriptionHtml,
    vendor: product.vendor,
    productType: product.productType,
    tags: product.tags,
    status: product.status ?? "ACTIVE",
    templateSuffix: product.templateSuffix,
    seo: product.seo,
    metafields: product.metafields,
    files,
    productOptions: options.map((option, position) => ({
      name: option.name,
      position: position + 1,
      values: option.values.map((name) => ({ name })),
    })),
    variants: variants.map((variant, position) => ({
      position: position + 1,
      price: variant.price,
      compareAtPrice: variant.compareAtPrice,
      sku: variant.sku,
      taxable: variant.taxable,
      optionValues: options.map((option) => ({
        optionName: option.name,
        name: variant.options?.[option.name] ?? option.values[0],
      })),
      file:
        variant.imageIndex !== undefined && files[variant.imageIndex]
          ? files[variant.imageIndex]
          : undefined,
    })),
  };
}
