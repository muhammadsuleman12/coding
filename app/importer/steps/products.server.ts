import type { BundleProduct } from "../bundle";
import type { StepContext } from "../context.server";
import { publishToOnlineStore } from "../context.server";
import {
  assertNoUserErrors,
  forEachLimit,
  gql,
  sleep,
} from "../graphql.server";

const CONCURRENCY = 4;
const MAX_ATTEMPTS = 3;
const MEDIA_TIMEOUT_MS = 300_000;

// Creates each product with productSet, keyed by handle. Products are
// created a few at a time; their images are checked once all of them exist,
// since Shopify downloads images in the background. Images that fail to
// download (source CDN hiccups happen) are retried by setting the product
// again. An existing product is left untouched unless an earlier run left it
// with failed images, in which case it is repaired.
export async function importProducts(ctx: StepContext) {
  const products = ctx.bundle.products ?? [];
  const toCheck: { product: BundleProduct; id: string }[] = [];

  await forEachLimit(products, CONCURRENCY, async (product) => {
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
    const existingId = existing?.productByIdentifier?.id;
    if (existingId) {
      const media = await loadMedia(ctx, existingId);
      if (!media.some((m) => m.status === "FAILED")) {
        ctx.log(`Product ${product.handle} already exists`);
        return;
      }
      ctx.log(`Product ${product.handle} has failed images; repairing`);
      await setProduct(ctx, product);
      toCheck.push({ product, id: existingId });
      return;
    }

    const id = await setProduct(ctx, product);
    await publishToOnlineStore(ctx, id);
    toCheck.push({ product, id });
    ctx.log(`Created product ${product.handle}`);
  });

  await forEachLimit(toCheck, CONCURRENCY, async ({ product, id }) => {
    for (let attempt = 1; ; attempt++) {
      const error = await waitForMedia(ctx, id);
      if (!error) return;
      if (attempt >= MAX_ATTEMPTS) {
        throw new Error(`Product ${product.handle} images failed: ${error}`);
      }
      ctx.log(`Product ${product.handle} images failed (${error}); retrying`);
      await sleep(5000 * attempt);
      await setProduct(ctx, product);
    }
  });
}

// Creates the product, or replaces it when the handle already exists.
async function setProduct(ctx: StepContext, product: BundleProduct) {
  const data = await gql(
    ctx.admin,
    `#graphql
      mutation importerSetProduct($handle: String!, $input: ProductSetInput!) {
        productSet(
          identifier: { handle: $handle }
          input: $input
          synchronous: true
        ) {
          product {
            id
          }
          userErrors {
            field
            message
          }
        }
      }`,
    { handle: product.handle, input: toProductSetInput(ctx, product) },
  );
  assertNoUserErrors(`Product ${product.handle}`, data?.productSet?.userErrors);
  const id = data?.productSet?.product?.id;
  if (!id) throw new Error(`Product ${product.handle} was not created`);
  return id;
}

async function loadMedia(ctx: StepContext, id: string) {
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
  return data?.product?.media.nodes ?? [];
}

// Waits until Shopify has processed the product's images. Returns the
// failure reasons, or undefined once every image is ready.
async function waitForMedia(ctx: StepContext, id: string) {
  const deadline = Date.now() + MEDIA_TIMEOUT_MS;
  for (;;) {
    const media = await loadMedia(ctx, id);

    const failed = media.filter((m) => m.status === "FAILED");
    if (failed.length > 0) {
      return failed
        .map((m) => {
          const error = m.mediaErrors[0];
          const reason = error
            ? error.details || error.message
            : "unknown error";
          return `${m.alt || "image"}: ${reason}`;
        })
        .join("; ");
    }
    if (media.every((m) => m.status === "READY")) return undefined;

    if (Date.now() > deadline) return "images are still processing";
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
