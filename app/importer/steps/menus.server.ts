import type { BundleMenuItem } from "../bundle";
import type { StepContext } from "../context.server";
import { assertNoUserErrors, gql } from "../graphql.server";
import { findBlog } from "./blogs.server";
import { findPageId } from "./pages.server";
import { findPolicyIds } from "./policies.server";

// Creates menus, resolving each item's handle to the resource ID in this
// store. Every store starts with default "main-menu" and "footer" menus;
// those are replaced, any other existing menu is left alone.
export async function importMenus(ctx: StepContext) {
  const existing = await gql(
    ctx.admin,
    `#graphql
      query importerMenus {
        menus(first: 100) {
          nodes {
            id
            handle
            isDefault
          }
        }
      }`,
  );
  const menusByHandle = new Map(
    existing?.menus.nodes.map((menu) => [menu.handle, menu]),
  );

  for (const menu of ctx.bundle.menus ?? []) {
    const items = await Promise.all(
      menu.items.map((item) => resolveItem(ctx, item)),
    );
    const current = menusByHandle.get(menu.handle);

    if (current && !current.isDefault) {
      ctx.log(`Menu ${menu.handle} already exists`);
      continue;
    }

    if (current) {
      const data = await gql(
        ctx.admin,
        `#graphql
          mutation importerUpdateMenu($id: ID!, $title: String!, $items: [MenuItemUpdateInput!]!) {
            menuUpdate(id: $id, title: $title, items: $items) {
              userErrors {
                field
                message
              }
            }
          }`,
        { id: current.id, title: menu.title, items },
      );
      assertNoUserErrors(`Menu ${menu.handle}`, data?.menuUpdate?.userErrors);
      ctx.log(`Replaced default menu ${menu.handle}`);
    } else {
      const data = await gql(
        ctx.admin,
        `#graphql
          mutation importerCreateMenu($title: String!, $handle: String!, $items: [MenuItemCreateInput!]!) {
            menuCreate(title: $title, handle: $handle, items: $items) {
              userErrors {
                field
                message
              }
            }
          }`,
        { title: menu.title, handle: menu.handle, items },
      );
      assertNoUserErrors(`Menu ${menu.handle}`, data?.menuCreate?.userErrors);
      ctx.log(`Created menu ${menu.handle}`);
    }
  }
}

interface ResolvedItem {
  title: string;
  type: BundleMenuItem["type"];
  resourceId?: string;
  url?: string;
  items?: ResolvedItem[];
}

async function resolveItem(
  ctx: StepContext,
  item: BundleMenuItem,
): Promise<ResolvedItem> {
  const children = item.items?.length
    ? await Promise.all(item.items.map((child) => resolveItem(ctx, child)))
    : undefined;
  const base = { title: item.title, type: item.type, items: children };

  switch (item.type) {
    case "FRONTPAGE":
      return { ...base, url: "/" };
    case "CATALOG":
      return { ...base, url: "/collections/all" };
    case "COLLECTIONS":
      return { ...base, url: "/collections" };
    case "SEARCH":
      return { ...base, url: "/search" };
    case "HTTP":
      return { ...base, url: item.url };
    default:
      return { ...base, resourceId: await resolveResource(ctx, item) };
  }
}

async function resolveResource(ctx: StepContext, item: BundleMenuItem) {
  const ref = item.ref ?? "";
  let id: string | undefined;

  if (item.type === "COLLECTION") {
    const data = await gql(
      ctx.admin,
      `#graphql
        query importerMenuCollection($handle: String!) {
          collectionByIdentifier(identifier: { handle: $handle }) {
            id
          }
        }`,
      { handle: ref },
    );
    id = data?.collectionByIdentifier?.id;
  } else if (item.type === "PRODUCT") {
    const data = await gql(
      ctx.admin,
      `#graphql
        query importerMenuProduct($handle: String!) {
          productByIdentifier(identifier: { handle: $handle }) {
            id
          }
        }`,
      { handle: ref },
    );
    id = data?.productByIdentifier?.id;
  } else if (item.type === "PAGE") {
    id = await findPageId(ctx, ref);
  } else if (item.type === "BLOG") {
    id = (await findBlog(ctx, ref))?.id;
  } else if (item.type === "ARTICLE") {
    const [blogHandle, articleHandle] = ref.split("/");
    id = (await findBlog(ctx, blogHandle))?.articles.nodes.find(
      (a) => a.handle === articleHandle,
    )?.id;
  } else if (item.type === "SHOP_POLICY") {
    id = (await findPolicyIds(ctx)).get(ref);
  }

  if (!id) {
    throw new Error(`Menu item "${item.title}": ${item.type} ${ref} not found`);
  }
  return id;
}
