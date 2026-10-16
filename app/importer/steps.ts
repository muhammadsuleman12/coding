// Step definitions shared by the server and the progress screen.

export type StepKey =
  | "files"
  | "products"
  | "collections"
  | "pages"
  | "blogs"
  | "policies"
  | "menus"
  | "redirects"
  | "theme";

export type StepStatus = "PENDING" | "RUNNING" | "DONE" | "FAILED" | "SKIPPED";

export interface StepState {
  key: StepKey;
  status: StepStatus;
  message?: string;
}

export type JobStatus = "QUEUED" | "RUNNING" | "DONE" | "FAILED";

// Run order matters: collections need products, menus need everything
// they link to.
export const STEP_ORDER: StepKey[] = [
  "files",
  "products",
  "collections",
  "pages",
  "blogs",
  "policies",
  "menus",
  "redirects",
  // Last: the theme's sections point at the content imported above.
  "theme",
];

export const STEP_LABELS: Record<StepKey, string> = {
  files: "Images and files",
  products: "Products",
  collections: "Collections",
  pages: "Pages",
  blogs: "Blog posts",
  policies: "Store policies",
  menus: "Navigation menus",
  redirects: "URL redirects",
  theme: "Store design",
};
