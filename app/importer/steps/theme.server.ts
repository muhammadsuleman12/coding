import type { StepContext, StepResult } from "../context.server";
import { assertNoUserErrors, gql, sleep } from "../graphql.server";
import { TEMPLATES } from "../templates.server";

const THEME_TIMEOUT_MS = 300_000;

// Installs the template's theme as an UNPUBLISHED theme. The merchant
// previews it and publishes it from the app; we never touch other themes.
//
// themeCreate needs Shopify's protected-scope exemption. Until it is granted
// (THEME_API_ENABLED=true), the step is skipped and the merchant gets the
// content with their current theme.
export async function importTheme(ctx: StepContext): Promise<StepResult> {
  if (process.env.THEME_API_ENABLED !== "true") {
    ctx.log("Theme step skipped (theme API not enabled)");
    return { skipped: true };
  }

  const template = TEMPLATES.find((t) => t.id === ctx.bundle.template);
  const name = `${template?.name ?? ctx.bundle.template} – Auto Store Builder`;

  // A retried job reuses the theme an earlier attempt created.
  const existing = await gql(
    ctx.admin,
    `#graphql
      query importerThemes {
        themes(first: 50, roles: [UNPUBLISHED, MAIN]) {
          nodes {
            id
            name
          }
        }
      }`,
  );
  let themeId = existing?.themes?.nodes.find((t) => t.name === name)?.id;

  if (!themeId) {
    const data = await gql(
      ctx.admin,
      `#graphql
        mutation importerCreateTheme($source: URL!, $name: String!) {
          themeCreate(source: $source, name: $name, role: UNPUBLISHED) {
            theme {
              id
            }
            userErrors {
              field
              message
            }
          }
        }`,
      {
        source: ctx.assetUrl(`bundles/${ctx.bundle.template}/theme.zip`),
        name,
      },
    );
    assertNoUserErrors("Theme", data?.themeCreate?.userErrors);
    themeId = data?.themeCreate?.theme?.id;
    if (!themeId) throw new Error("Theme was not created");
  }

  // Shopify unpacks the zip in the background.
  const deadline = Date.now() + THEME_TIMEOUT_MS;
  for (;;) {
    const data = await gql(
      ctx.admin,
      `#graphql
        query importerThemeStatus($id: ID!) {
          theme(id: $id) {
            processing
            processingFailed
          }
        }`,
      { id: themeId },
    );
    if (data?.theme?.processingFailed) {
      throw new Error("Shopify could not process the theme file");
    }
    if (data?.theme && !data.theme.processing) break;
    if (Date.now() > deadline) throw new Error("Theme is still processing");
    await sleep(3000);
  }

  ctx.log(`Installed theme ${name} (${themeId})`);
  return { themeId };
}

export async function publishTheme(
  admin: StepContext["admin"],
  themeId: string,
) {
  const data = await gql(
    admin,
    `#graphql
      mutation importerPublishTheme($id: ID!) {
        themePublish(id: $id) {
          userErrors {
            field
            message
          }
        }
      }`,
    { id: themeId },
  );
  assertNoUserErrors("Publishing theme", data?.themePublish?.userErrors);
}
