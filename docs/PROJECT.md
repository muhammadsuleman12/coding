# Auto Store Builder (formerly "AI Store Builder") — Shopify App (project brief)

## Dev workflow
Code is written in the cloud session and pushed to branch
`claude/ai-store-builder-shopify-2o09jy`. Developer's local clone lives in
`D:\Office\Shopifyapp`; they `git pull` and run `shopify app dev` there.

## Working agreement
Developer is new to Shopify app development. Go one step at a time, explain each
command before it runs, and wait for confirmation of the result before moving on.
Give exact click-by-click instructions for anything done in a browser.

## What the app does
Public (unlisted) Shopify app that copies a complete pre-built template store into a
merchant's store: theme, products, collections, pages, blogs, menus, files,
metafields/metaobjects, policies and settings.

Flow:
1. Customer picks a template (General, Pet, …) on the client's site and installs the app.
2. App imports all content in a background job.
3. App installs the matching theme (unpublished), links content, then publishes it.
4. Merchant sees a progress screen, then a "store ready" screen.

Competitor reference: https://freestorebuild.com — aim for faster, cleaner UI.

## Template stores (source data)
- General: https://new-eph-general-demo.myshopify.com/
- Pet: https://new-eph-pet-demo.myshopify.com/
- Storefront password lives in `.env` only — never commit it.
- 3 demo/dev stores available for testing.

## Status
- [x] Joined client's Partner org (Optiapps)
- [x] App "AI Store Builder" created in Dev Dashboard (versions -1, -2, unconfigured)
- [x] Distribution: Public (unlisted, install via link)
- [x] Theme exemption request submitted Oct 16, 2026 (Asset API + Theme API: themeCreate, themePublish, themeFilesUpsert). Shopify replies within 14 days. App renamed "Auto Store Builder".
      themePublish, themeFilesUpsert. Waiting on who submits.
- [x] Step 1: tools installed on dev machine (Windows): Node 24, Git, VS Code, Shopify CLI 4.9
- [x] Step 2: project scaffolded from React Router template, linked to AI Store Builder
- [x] Step 3 (partial): scopes set; `shopify app dev` runs on dev store asb-test-1.myshopify.com
      (Optiapps org, empty store). Permissions verified: no customer/order access.
- [x] Privacy compliance webhooks (tested with `shopify app webhook trigger`)
- [x] Importer v1: files, products, collections (2026-10 `sources`), pages, blogs,
      policies, menus, redirects; ImportJob table + in-process worker; progress UI.
      Sample bundle (bundles/sample, images in public/bundles/sample) imports
      cleanly on asb-test-1 with product images; importer waits for media READY.
- [x] Staff access to General/Pet demo stores granted. Themes are free (General's
      live theme "eph-improved-general" is a customized Horizon). No pre-made files:
      we export ourselves.
- [x] Export script (scripts/export/export.mjs via `shopify store execute`);
      bundles/general and bundles/pet exported (75 products each).
- [x] Full General import into fresh dev store asb-test-2-xrwwlbjm: all steps done,
      products/images/collections/menus show on the storefront (default Horizon look).
      Importer retries CDN 503s and repairs failed media on job retry.
- [x] Themes pulled (bundles/*/theme); General tested on asb-test-2, Pet on asb-test-3 via `shopify theme push --unpublished` — both match the templates.
- [ ] App theme step (themeCreate from zip → publish on merchant confirm) once exemption approved.
- [ ] Files: bundle files (135/80) look like duplicate product images; keep only
      files referenced by the theme or page/article HTML.
- Note: Dev Dashboard distribution card still says "Select distribution method".
- Do NOT request other protected scopes (customer data, orders, subscriptions…).

## Tech stack
- Shopify app template: React Router + TypeScript, Polaris web components, App Bridge,
  session-token auth, embedded
- GraphQL Admin API only (no REST Asset API)
- Postgres + Prisma (sessions, installs, import jobs)
- BullMQ + Redis (Upstash) — imports run in a worker, never in a web request
- Cloudflare R2 for template bundles (theme.zip must be fetchable by themeCreate)
- Fly.io: web + worker processes

## Access scopes (verify each against current docs; remove unused)
read_themes, write_themes, read_products, write_products, write_content,
write_online_store_pages, write_online_store_navigation, write_files,
write_publications, write_metaobjects, write_metaobject_definitions, write_legal_policies

## Architecture
### Export (once per template)
- Theme: `shopify theme pull --store <demo> --path bundles/<template>/theme`, zip
- Content script (Admin GraphQL) → `bundles/<template>/content.json`
- Upload bundles to R2

### Import (per install) — order matters
1. Files/images (keep filenames)
2. Metafield + metaobject definitions
3. Products (`productSet`, same handles, throttle by query cost)
4. Collections (same handles)
5. Pages, blogs, articles
6. Menus (`menuCreate`) with old→new ID remap
7. Metafield/metaobject values, policies, redirects
8. `themeCreate` (unpublished) → patch settings → `themePublish` after confirmation

Rules: same handles/filenames; keep old→new ID map; idempotent and resumable;
never touch the merchant's existing theme; no storefront scripts. Until the
exemption is approved, test the theme step with `shopify theme push`.

## UI
1. Template picker (preselect via `?template=`)
2. Import progress (polls job status)
3. Done (view store / customize theme)

## Built for Shopify from day one
Embedded + session tokens + latest App Bridge; Web Vitals (LCP<2.5s, CLS<0.1,
INP<200ms); no Asset API; Polaris; GDPR webhooks; clean uninstall; Billing API if paid.

## Roadmap
1. Install tools ✓
2. `shopify app init` (React Router) → `shopify app config link`
3. Scopes in toml → `shopify app deploy` → `shopify app dev` on a demo store ✓ (dev done; deploy pending)
4. Export General + Pet bundles ✓
5. Importer (worker + queue)
6. UI screens
7. Deploy to Fly.io (+ Postgres, Redis, R2)
8. Switch theme step to themeCreate after exemption
9. Test on all 3 demo stores
10. Compliance webhooks, billing, listing, review

## Open questions for the client
1. Demo themes custom-built or Theme Store? (paid themes need per-store license)
2. How does checkout pass the chosen template? (link param vs in-app picker)
3. What does "better" include? (AI copy, brand colors, logo upload…)
4. Free or paid?
5. Overwrite existing content, or fresh stores only?
6. Who submits the exemption form?

## Notes for the next session
- shopify.dev is allowed in the cloud environment's network settings, but Node
  can't reach it through the proxy: download the schema with curl
  (introspection POST to https://shopify.dev/admin-graphql-direct-proxy/2026-10)
  into app/types/admin-2026-10.schema.json, then `npm run graphql-codegen`.
- Job queue is a DB-polling worker (app/importer/worker.server.ts) instead of
  BullMQ/Redis for now; revisit at deploy time.
