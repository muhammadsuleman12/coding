#!/usr/bin/env node
// Exports a template store's content into bundles/<template>/content.json,
// the format the importer reads (app/importer/bundle.ts).
//
//   shopify store auth --store <store>.myshopify.com --scopes <read scopes>
//   node scripts/export/export.mjs --store <store>.myshopify.com --template general
//
// Queries run through `shopify store execute`, so they use your staff login
// and are read-only. Images keep their Shopify CDN URLs; the importer hands
// those URLs to Shopify, which copies the files into the merchant's store.

import { execFileSync, execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");

const args = parseArgs(process.argv.slice(2));
if (!args.template || (!args.store && !args.endpoint)) {
  console.error(
    "Usage: node scripts/export/export.mjs --store <store>.myshopify.com --template <name>",
  );
  process.exit(1);
}

const skip = new Set((args.skip ?? "").split(",").filter(Boolean));
const warnings = [];
const warn = (message) => {
  warnings.push(message);
  console.warn(`  ! ${message}`);
};

// ---------------------------------------------------------------------------

function toBundleProduct(product) {
  const images = product.media.nodes
    .filter((m) => m.image)
    .map((m) => ({ url: m.image.url, alt: m.image.altText || undefined }));
  const imageIndex = new Map(images.map((img, i) => [stripQuery(img.url), i]));

  const isDefaultOnly =
    product.options.length === 1 &&
    product.options[0].name === "Title" &&
    product.options[0].optionValues.length === 1 &&
    product.options[0].optionValues[0].name === "Default Title";

  if (product.variants.nodes.length === 100) {
    warn(
      `Product ${product.handle} has 100+ variants; only the first 100 are exported`,
    );
  }

  const metafields = product.metafields.nodes.filter((m) => {
    // Reference values are IDs from the template store and would not resolve
    // in the merchant's store; reserved namespaces belong to Shopify or apps.
    if (m.type.includes("reference")) {
      warn(
        `Product ${product.handle}: skipped reference metafield ${m.namespace}.${m.key}`,
      );
      return false;
    }
    return (
      !m.namespace.startsWith("shopify") && !m.namespace.startsWith("app--")
    );
  });

  return {
    handle: product.handle,
    title: product.title,
    descriptionHtml: product.descriptionHtml || undefined,
    vendor: product.vendor || undefined,
    productType: product.productType || undefined,
    tags: product.tags.length ? product.tags : undefined,
    status: product.status,
    templateSuffix: product.templateSuffix || undefined,
    seo: cleanSeo(product.seo),
    images: images.length ? images : undefined,
    options: isDefaultOnly
      ? undefined
      : product.options.map((o) => ({
          name: o.name,
          values: o.optionValues.map((v) => v.name),
        })),
    variants: product.variants.nodes.map((variant) => {
      const variantImage = variant.media.nodes[0]?.image?.url;
      return {
        options: isDefaultOnly
          ? undefined
          : Object.fromEntries(
              variant.selectedOptions.map((o) => [o.name, o.value]),
            ),
        price: variant.price,
        compareAtPrice: variant.compareAtPrice || undefined,
        sku: variant.sku || undefined,
        taxable: variant.taxable,
        imageIndex: variantImage
          ? imageIndex.get(stripQuery(variantImage))
          : undefined,
      };
    }),
    metafields: metafields.length
      ? metafields.map(({ namespace, key, type, value }) => ({
          namespace,
          key,
          type,
          value,
        }))
      : undefined,
  };
}

// Smart-collection rules the importer supports (app/importer/bundle.ts).
const TEXT_COLUMNS = new Set(["TITLE", "TYPE", "VENDOR", "VARIANT_TITLE"]);
const PRICE_COLUMNS = new Set(["VARIANT_PRICE", "VARIANT_COMPARE_AT_PRICE"]);
const TEXT_RELATIONS = new Set([
  "EQUALS",
  "NOT_EQUALS",
  "CONTAINS",
  "NOT_CONTAINS",
  "STARTS_WITH",
  "ENDS_WITH",
]);
const PRICE_RELATIONS = new Set([
  "EQUALS",
  "NOT_EQUALS",
  "GREATER_THAN",
  "LESS_THAN",
]);

function isSupportedRule(rule) {
  if (rule.column === "TAG") {
    return rule.relation === "EQUALS" || rule.relation === "NOT_EQUALS";
  }
  if (TEXT_COLUMNS.has(rule.column)) return TEXT_RELATIONS.has(rule.relation);
  if (PRICE_COLUMNS.has(rule.column)) return PRICE_RELATIONS.has(rule.relation);
  return false;
}

function toBundleCollection(collection) {
  const base = {
    handle: collection.handle,
    title: collection.title,
    descriptionHtml: collection.descriptionHtml || undefined,
    sortOrder:
      collection.sortOrder === "MOST_RELEVANT"
        ? undefined
        : collection.sortOrder,
    templateSuffix: collection.templateSuffix || undefined,
    seo: cleanSeo(collection.seo),
    image: collection.image
      ? {
          url: collection.image.url,
          alt: collection.image.altText || undefined,
        }
      : undefined,
  };

  if (!collection.ruleSet) {
    if (collection.products.nodes.length === 250) {
      warn(
        `Collection ${collection.handle} has 250+ products; only the first 250 are exported`,
      );
    }
    return {
      ...base,
      products: collection.products.nodes.map((p) => p.handle),
    };
  }

  const conditions = [];
  for (const rule of collection.ruleSet.rules) {
    const supported = isSupportedRule(rule);
    if (!supported) {
      warn(
        `Collection ${collection.handle}: unsupported rule ${rule.column} ${rule.relation} "${rule.condition}" (needs importer support)`,
      );
      continue;
    }
    conditions.push({
      column: rule.column,
      relation: rule.relation,
      condition: rule.condition,
    });
  }
  return {
    ...base,
    rules: {
      disjunctive: collection.ruleSet.appliedDisjunctively,
      conditions,
    },
  };
}

// Shopify-managed menus that the importer must not recreate.
const SKIPPED_MENUS = new Set(["customer-account-main-menu"]);
const RESOURCE_TYPES = new Set([
  "COLLECTION",
  "PRODUCT",
  "PAGE",
  "BLOG",
  "ARTICLE",
  "SHOP_POLICY",
]);
const URL_ONLY_TYPES = new Set([
  "FRONTPAGE",
  "CATALOG",
  "COLLECTIONS",
  "SEARCH",
]);

async function exportMenus() {
  const menus = (await run("menus")).menus.nodes.filter(
    (m) => !SKIPPED_MENUS.has(m.handle),
  );

  // Menu items point at resources by ID; resolve them to handles.
  const ids = new Set();
  const collect = (items) =>
    items.forEach((item) => {
      if (item.resourceId) ids.add(item.resourceId);
      collect(item.items ?? []);
    });
  menus.forEach((m) => collect(m.items));

  const refs = new Map();
  const idList = [...ids];
  for (let i = 0; i < idList.length; i += 100) {
    const { nodes } = await run("resources", { ids: idList.slice(i, i + 100) });
    for (const node of nodes) {
      if (!node) continue;
      const ref =
        node.__typename === "Article"
          ? `${node.blog.handle}/${node.handle}`
          : node.__typename === "ShopPolicy"
            ? node.type
            : node.handle;
      refs.set(node.id, ref);
    }
  }

  const toItem = (menuHandle, item) => {
    const children = (item.items ?? [])
      .map((child) => toItem(menuHandle, child))
      .filter(Boolean);
    const base = {
      title: item.title,
      type: item.type,
      items: children.length ? children : undefined,
    };
    if (URL_ONLY_TYPES.has(item.type)) return base;
    if (item.type === "HTTP") return { ...base, url: item.url };
    if (RESOURCE_TYPES.has(item.type)) {
      const ref = refs.get(item.resourceId);
      if (ref) return { ...base, ref };
      warn(
        `Menu ${menuHandle}: "${item.title}" links to a missing ${item.type}; skipped`,
      );
      return null;
    }
    warn(
      `Menu ${menuHandle}: "${item.title}" has unsupported type ${item.type}; skipped`,
    );
    return null;
  };

  return menus.map((menu) => ({
    handle: menu.handle,
    title: menu.title,
    items: menu.items.map((item) => toItem(menu.handle, item)).filter(Boolean),
  }));
}

// ---------------------------------------------------------------------------

function cleanSeo(seo) {
  if (!seo?.title && !seo?.description) return undefined;
  return {
    title: seo.title || undefined,
    description: seo.description || undefined,
  };
}

// Filenames the theme references as shopify://shop_images/<filename>.
function themeImageRefs(themeDir) {
  const refs = new Set();
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(json|liquid)$/.test(entry.name)) {
        const text = fs.readFileSync(full, "utf8");
        for (const m of text.matchAll(
          /shopify:\/\/shop_images\/([^"\\\s]+)/g,
        )) {
          refs.add(decodeURIComponent(m[1]));
        }
      }
    }
  };
  walk(themeDir);
  return refs;
}

function stripQuery(url) {
  return url.split("?")[0];
}

async function fetchAll(name) {
  const rows = [];
  let after = null;
  for (;;) {
    const data = await run(name, { after });
    const connection = Object.values(data)[0];
    if (!connection?.nodes) {
      throw new Error(
        `${name}: unexpected response ${JSON.stringify(data).slice(0, 500)}`,
      );
    }
    rows.push(...connection.nodes);
    if (!connection.pageInfo.hasNextPage) return rows;
    after = connection.pageInfo.endCursor;
  }
}

async function run(name, variables = {}) {
  const query = fs.readFileSync(
    path.join(here, "queries", `${name}.graphql`),
    "utf8",
  );
  for (let attempt = 0; ; attempt++) {
    let body = args.endpoint
      ? runHttp(query, variables)
      : runCli(query, variables);
    // Some responses carry the errors array on its own.
    if (Array.isArray(body)) body = { errors: body };

    const throttled = body.errors?.some(
      (e) => e.extensions?.code === "THROTTLED",
    );
    if (throttled && attempt < 10) {
      await sleep(Math.min(2000 * 2 ** attempt, 30_000));
      continue;
    }
    if (body.errors?.length) {
      throw new Error(`${name}: ${JSON.stringify(body.errors)}`);
    }
    await paceForCost(body.extensions?.cost);
    return body.data ?? body;
  }
}

// Wait until the cost bucket has room for another query like this one, so we
// stay under Shopify's rate limit instead of bouncing off it.
async function paceForCost(cost) {
  const status = cost?.throttleStatus;
  if (!status) return;
  const needed = cost.requestedQueryCost - status.currentlyAvailable;
  if (needed > 0) await sleep((needed / status.restoreRate) * 1000 + 250);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runCli(query, variables) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "asb-export-"));
  const queryFile = path.join(dir, "query.graphql");
  const variableFile = path.join(dir, "variables.json");
  fs.writeFileSync(queryFile, query);
  fs.writeFileSync(variableFile, JSON.stringify(variables));
  try {
    // Inputs go through the CLI's SHOPIFY_FLAG_* environment variables so the
    // command line itself is constant (shopify is a .cmd shim on Windows and
    // needs a shell).
    return JSON.parse(
      execSync("shopify store execute --json --no-input", {
        encoding: "utf8",
        maxBuffer: 256 * 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          SHOPIFY_FLAG_STORE: args.store,
          SHOPIFY_FLAG_QUERY_FILE: queryFile,
          SHOPIFY_FLAG_VARIABLE_FILE: variableFile,
        },
      }),
    );
  } catch (error) {
    // Progress output is hidden on success; show it when the CLI fails.
    if (error.stderr) console.error(error.stderr);
    throw error;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// For testing against a plain GraphQL endpoint (no auth) instead of the CLI.
function runHttp(query, variables) {
  const output = execFileSync(
    "curl",
    [
      "-sS",
      "-X",
      "POST",
      "-H",
      "Content-Type: application/json",
      "--data-binary",
      "@-",
      args.endpoint,
    ],
    {
      encoding: "utf8",
      input: JSON.stringify({ query, variables }),
      maxBuffer: 256 * 1024 * 1024,
    },
  );
  return JSON.parse(output);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) out[argv[i].slice(2)] = argv[i + 1];
    i++;
  }
  return out;
}

// ---------------------------------------------------------------------------

async function main() {
  const bundle = { template: args.template };

  console.log(`Exporting ${args.store ?? args.endpoint} as "${args.template}"`);

  const products = await fetchAll("products");
  bundle.products = products.map(toBundleProduct);
  console.log(`  products: ${bundle.products.length}`);

  const productImageUrls = new Set(
    bundle.products.flatMap((p) =>
      (p.images ?? []).map((i) => stripQuery(i.url)),
    ),
  );

  bundle.collections = (await fetchAll("collections"))
    .map(toBundleCollection)
    .filter(Boolean);
  console.log(`  collections: ${bundle.collections.length}`);

  bundle.pages = (await fetchAll("pages")).map((page) => ({
    handle: page.handle,
    title: page.title,
    bodyHtml: page.body,
    templateSuffix: page.templateSuffix || undefined,
    published: page.isPublished,
  }));
  console.log(`  pages: ${bundle.pages.length}`);

  bundle.blogs = (await fetchAll("blogs")).map((blog) => ({
    handle: blog.handle,
    title: blog.title,
    templateSuffix: blog.templateSuffix || undefined,
    articles: blog.articles.nodes.map((article) => ({
      handle: article.handle,
      title: article.title,
      author: article.author?.name || "Store Team",
      bodyHtml: article.body,
      summaryHtml: article.summary || undefined,
      tags: article.tags,
      published: article.isPublished,
      templateSuffix: article.templateSuffix || undefined,
      image: article.image
        ? { url: article.image.url, alt: article.image.altText || undefined }
        : undefined,
    })),
  }));
  console.log(
    `  blogs: ${bundle.blogs.length} (${bundle.blogs.reduce((n, b) => n + b.articles.length, 0)} articles)`,
  );

  const policies = (await run("policies")).shop.shopPolicies;
  bundle.policies = policies
    .filter((p) => p.body?.trim() && p.type !== "SUBSCRIPTION_POLICY")
    .map((p) => ({ type: p.type, body: p.body }));
  console.log(`  policies: ${bundle.policies.length}`);

  // --skip menus (etc.) is only for test endpoints that deny some data.
  bundle.menus = skip.has("menus") ? [] : await exportMenus();
  console.log(`  menus: ${bundle.menus.length}`);

  bundle.redirects = (
    skip.has("redirects") ? [] : await fetchAll("redirects")
  ).map((r) => ({
    path: r.path,
    target: r.target,
  }));
  console.log(`  redirects: ${bundle.redirects.length}`);

  // Files uploaded under Content > Files. The theme references these as
  // shopify://shop_images/<filename>. Once the theme has been pulled into
  // bundles/<template>/theme, only files it (or page/article HTML) uses are
  // kept; stores accumulate many unused uploads. --all-files keeps them all.
  const themeDir = path.join(repoRoot, "bundles", args.template, "theme");
  const referenced = fs.existsSync(themeDir)
    ? themeImageRefs(themeDir)
    : undefined;
  const contentHtml = JSON.stringify([bundle.pages, bundle.blogs]);

  bundle.files = [];
  const seenFilenames = new Set();
  for (const file of skip.has("files") ? [] : await fetchAll("files")) {
    const url = file.image?.url ?? file.url;
    if (!url) continue;
    const filename = decodeURIComponent(
      path.posix.basename(new URL(url).pathname),
    );
    if (seenFilenames.has(filename)) continue;

    const used =
      referenced?.has(filename) || contentHtml.includes(stripQuery(url));
    const keep =
      referenced && !args["all-files"]
        ? used
        : used || !productImageUrls.has(stripQuery(url));
    if (!keep) continue;

    seenFilenames.add(filename);
    bundle.files.push({
      filename,
      url,
      alt: file.alt || undefined,
      contentType: file.image ? "IMAGE" : "FILE",
    });
  }
  for (const filename of referenced ?? []) {
    if (!seenFilenames.has(filename)) {
      warn(
        `Theme references shop_images/${filename}, which is not in the store's files`,
      );
    }
  }
  if (!referenced) {
    warn(
      "No theme in bundles/<template>/theme yet; exported all uploaded files",
    );
  }
  console.log(`  files: ${bundle.files.length}`);

  const outDir = path.join(repoRoot, "bundles", args.template);
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, "content.json");
  fs.writeFileSync(outFile, JSON.stringify(bundle, null, 2) + "\n");

  console.log(`\nWrote ${path.relative(repoRoot, outFile)}`);
  if (warnings.length) {
    console.log(`${warnings.length} warning(s); review them above.`);
  }
}

await main();
