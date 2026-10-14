// The template bundle format: everything the importer copies into a store.
// Exported once per template store (bundles/<template>/content.json) and
// referenced by handle, never by ID, so it can be replayed into any shop.

export interface Bundle {
  template: string;
  files?: BundleFile[];
  products?: BundleProduct[];
  collections?: BundleCollection[];
  pages?: BundlePage[];
  blogs?: BundleBlog[];
  menus?: BundleMenu[];
  redirects?: BundleRedirect[];
  policies?: BundlePolicy[];
}

// Standalone files the theme references (shopify://shop_images/<filename>).
// The filename is kept so those references keep working.
export interface BundleFile {
  filename: string;
  url: string;
  alt?: string;
  contentType: "IMAGE" | "FILE" | "VIDEO";
}

export interface BundleImage {
  url: string;
  alt?: string;
}

export interface BundleSeo {
  title?: string;
  description?: string;
}

export interface BundleMetafield {
  namespace: string;
  key: string;
  type: string;
  value: string;
}

export interface BundleProduct {
  handle: string;
  title: string;
  descriptionHtml?: string;
  vendor?: string;
  productType?: string;
  tags?: string[];
  status?: "ACTIVE" | "DRAFT" | "ARCHIVED";
  templateSuffix?: string;
  seo?: BundleSeo;
  images?: BundleImage[];
  // Omit options/variants for a single-variant product.
  options?: { name: string; values: string[] }[];
  variants?: BundleVariant[];
  metafields?: BundleMetafield[];
}

export interface BundleVariant {
  // Option name -> value, e.g. { Size: "M", Color: "Red" }
  options?: Record<string, string>;
  price: string;
  compareAtPrice?: string;
  sku?: string;
  taxable?: boolean;
  // Index into the product's images
  imageIndex?: number;
}

// Rules mirror the smart-collection conditions in the Shopify admin.
export type BundleCollectionRule =
  | {
      column: "TAG";
      relation: "EQUALS" | "NOT_EQUALS";
      condition: string;
    }
  | {
      column: "TITLE" | "TYPE" | "VENDOR";
      relation:
        | "EQUALS"
        | "NOT_EQUALS"
        | "CONTAINS"
        | "NOT_CONTAINS"
        | "STARTS_WITH"
        | "ENDS_WITH";
      condition: string;
    };

export interface BundleCollection {
  handle: string;
  title: string;
  descriptionHtml?: string;
  sortOrder?:
    | "ALPHA_ASC"
    | "ALPHA_DESC"
    | "BEST_SELLING"
    | "CREATED"
    | "CREATED_DESC"
    | "MANUAL"
    | "PRICE_ASC"
    | "PRICE_DESC";
  templateSuffix?: string;
  seo?: BundleSeo;
  image?: BundleImage;
  // Manual collection: product handles in order
  products?: string[];
  // Smart collection
  rules?: { disjunctive: boolean; conditions: BundleCollectionRule[] };
}

export interface BundlePage {
  handle: string;
  title: string;
  bodyHtml: string;
  templateSuffix?: string;
  published?: boolean;
}

export interface BundleBlog {
  handle: string;
  title: string;
  templateSuffix?: string;
  articles?: BundleArticle[];
}

export interface BundleArticle {
  handle: string;
  title: string;
  author: string;
  bodyHtml: string;
  summaryHtml?: string;
  tags?: string[];
  image?: BundleImage;
  published?: boolean;
  templateSuffix?: string;
}

export interface BundleMenu {
  handle: string;
  title: string;
  items: BundleMenuItem[];
}

// `ref` is the handle of the linked resource. ARTICLE refs are
// "<blog-handle>/<article-handle>"; SHOP_POLICY refs are the policy type,
// e.g. "REFUND_POLICY". HTTP items use `url`.
export interface BundleMenuItem {
  title: string;
  type:
    | "FRONTPAGE"
    | "CATALOG"
    | "COLLECTIONS"
    | "SEARCH"
    | "COLLECTION"
    | "PRODUCT"
    | "PAGE"
    | "BLOG"
    | "ARTICLE"
    | "SHOP_POLICY"
    | "HTTP";
  ref?: string;
  url?: string;
  items?: BundleMenuItem[];
}

export interface BundleRedirect {
  path: string;
  target: string;
}

export interface BundlePolicy {
  type:
    | "REFUND_POLICY"
    | "SHIPPING_POLICY"
    | "PRIVACY_POLICY"
    | "TERMS_OF_SERVICE"
    | "TERMS_OF_SALE"
    | "LEGAL_NOTICE"
    | "CONTACT_INFORMATION";
  body: string;
}
