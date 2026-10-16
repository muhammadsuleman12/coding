import { useEffect, useState } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData, useRevalidator } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import {
  createImportJob,
  latestImportJob,
  markThemePublished,
  parseSteps,
  retryImportJob,
} from "../importer/jobs.server";
import { STEP_LABELS } from "../importer/steps";
import type { JobStatus, StepState } from "../importer/steps";
import { publishTheme } from "../importer/steps/theme.server";
import {
  isTemplateAvailable,
  templatePreview,
  visibleTemplates,
} from "../importer/templates.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const job = await latestImportJob(session.shop);

  const templates = await Promise.all(
    visibleTemplates().map(async (t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      available: await isTemplateAvailable(t.id),
      preview: await templatePreview(t.id),
    })),
  );

  // The client's checkout links to the app with ?template=<id>; that
  // template is shown first and highlighted.
  const requested = new URL(request.url).searchParams.get("template");
  const chosen = templates.find((t) => t.id === requested && t.available);
  if (chosen) templates.sort((a) => (a === chosen ? -1 : 0));

  return {
    shop: session.shop,
    templates,
    chosenTemplate: chosen?.id ?? null,
    job: job && {
      id: job.id,
      template: job.template,
      status: job.status as JobStatus,
      steps: parseSteps(job.steps),
      error: job.error,
      themeId: job.themeId,
      themePublished: Boolean(job.themePublishedAt),
    },
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const form = await request.formData();
  const intent = form.get("intent");
  const current = await latestImportJob(session.shop);

  if (intent === "retry") {
    await retryImportJob(session.shop, String(form.get("jobId")));
    return null;
  }

  if (intent === "publish") {
    // Only the theme this app installed for this shop can be published.
    if (current?.status === "DONE" && current.themeId) {
      await publishTheme(admin, current.themeId);
      await markThemePublished(current.id);
    }
    return null;
  }

  const template = String(form.get("template"));
  if (current && ["QUEUED", "RUNNING"].includes(current.status)) {
    return null;
  }
  if (!(await isTemplateAvailable(template))) {
    throw new Response("Template not available", { status: 400 });
  }
  await createImportJob(session.shop, template);
  return null;
};

export default function Index() {
  const { shop, templates, chosenTemplate, job } =
    useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const revalidator = useRevalidator();
  const active = job?.status === "QUEUED" || job?.status === "RUNNING";
  const submitting = fetcher.state !== "idle";
  const [choosingNew, setChoosingNew] = useState(false);

  // Poll for progress while the import runs.
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => revalidator.revalidate(), 2000);
    return () => clearInterval(timer);
  }, [active, revalidator]);

  const submit = (data: Record<string, string>) =>
    fetcher.submit(data, { method: "POST" });

  if (job && !choosingNew) {
    const templateName =
      templates.find((t) => t.id === job.template)?.name ?? job.template;
    const themeNumericId = job.themeId?.split("/").pop();

    return (
      <s-page heading="Auto Store Builder">
        {job.status === "FAILED" && (
          <s-button
            slot="primary-action"
            onClick={() => submit({ intent: "retry", jobId: job.id })}
            {...(submitting ? { loading: true } : {})}
          >
            Retry
          </s-button>
        )}
        {!active && (
          <s-button
            slot="secondary-actions"
            onClick={() => setChoosingNew(true)}
          >
            Choose another template
          </s-button>
        )}

        {job.status === "DONE" && (
          <s-section heading="Your store is ready">
            {themeNumericId && !job.themePublished && (
              <s-banner tone="info" heading="Your new design is installed">
                <s-paragraph>
                  The {templateName} design was added to your themes without
                  changing your live store. Preview it, then publish it when
                  you&apos;re happy.
                </s-paragraph>
              </s-banner>
            )}
            {job.themePublished && (
              <s-banner tone="success" heading="Your new design is live">
                <s-paragraph>
                  Customers now see the {templateName} design. You can switch
                  back any time in Online Store &gt; Themes.
                </s-paragraph>
              </s-banner>
            )}
            {!themeNumericId && (
              <s-paragraph>
                Your products, collections, pages and menus are in place.
              </s-paragraph>
            )}
            <s-stack direction="inline" gap="base">
              {themeNumericId && !job.themePublished ? (
                <>
                  <s-button
                    variant="primary"
                    onClick={() => submit({ intent: "publish" })}
                    {...(submitting ? { loading: true } : {})}
                  >
                    Publish design
                  </s-button>
                  <s-button
                    href={`https://${shop}/?preview_theme_id=${themeNumericId}`}
                    target="_blank"
                  >
                    Preview design
                  </s-button>
                </>
              ) : (
                <s-button
                  variant="primary"
                  href={`https://${shop}`}
                  target="_blank"
                >
                  View store
                </s-button>
              )}
              <s-button
                href={
                  themeNumericId
                    ? `shopify://admin/themes/${themeNumericId}/editor`
                    : "shopify://admin/themes"
                }
              >
                Customize design
              </s-button>
            </s-stack>
          </s-section>
        )}

        <ImportProgress
          templateName={templateName}
          status={job.status}
          steps={job.steps}
          error={job.error}
        />
      </s-page>
    );
  }

  return (
    <s-page heading="Auto Store Builder">
      <s-section heading="Choose your store template">
        <s-paragraph>
          We set up your store with the template&apos;s products, collections,
          pages, menus and policies. Content you already have is kept.
        </s-paragraph>
        <s-grid
          gridTemplateColumns="repeat(auto-fill, minmax(260px, 1fr))"
          gap="base"
        >
          {templates.map((template) => (
            <s-box
              key={template.id}
              padding="base"
              borderWidth="base"
              borderRadius="base"
            >
              <s-stack direction="block" gap="base">
                {template.preview && (
                  <s-image
                    src={template.preview}
                    alt={`${template.name} template preview`}
                    aspectRatio="16/9"
                    objectFit="cover"
                    borderRadius="base"
                    loading="lazy"
                  />
                )}
                <s-stack direction="inline" gap="small-200" alignItems="center">
                  <s-heading>{template.name}</s-heading>
                  {template.id === chosenTemplate && (
                    <s-badge tone="success">Your choice</s-badge>
                  )}
                </s-stack>
                <s-paragraph>{template.description}</s-paragraph>
                {template.available ? (
                  <s-button
                    variant={
                      !chosenTemplate || template.id === chosenTemplate
                        ? "primary"
                        : "secondary"
                    }
                    onClick={() => {
                      setChoosingNew(false);
                      submit({ intent: "start", template: template.id });
                    }}
                    {...(submitting ? { loading: true } : {})}
                  >
                    Use this template
                  </s-button>
                ) : (
                  <s-badge>Coming soon</s-badge>
                )}
              </s-stack>
            </s-box>
          ))}
        </s-grid>
      </s-section>
    </s-page>
  );
}

function ImportProgress({
  templateName,
  status,
  steps,
  error,
}: {
  templateName: string;
  status: JobStatus;
  steps: StepState[];
  error: string | null;
}) {
  const done = steps.filter(
    (s) => s.status === "DONE" || s.status === "SKIPPED",
  ).length;
  const heading =
    status === "DONE"
      ? `${templateName} template imported`
      : status === "FAILED"
        ? `Setup of ${templateName} stopped`
        : `Setting up your ${templateName} store (${done} of ${steps.length})`;

  return (
    <s-section heading={heading}>
      {status === "FAILED" && error && (
        <s-banner tone="critical" heading="Something went wrong">
          <s-paragraph>{error}</s-paragraph>
          <s-paragraph>
            Retry continues from the step that failed. Nothing already imported
            is duplicated.
          </s-paragraph>
        </s-banner>
      )}
      {(status === "QUEUED" || status === "RUNNING") && (
        <s-paragraph>
          This usually takes 5–15 minutes. You can leave this page; setup
          continues in the background.
        </s-paragraph>
      )}
      <s-stack direction="block" gap="small-200">
        {steps.map((step) => (
          <s-stack
            key={step.key}
            direction="inline"
            gap="small-200"
            alignItems="center"
          >
            <StepBadge status={step.status} />
            <s-text>{STEP_LABELS[step.key]}</s-text>
          </s-stack>
        ))}
      </s-stack>
    </s-section>
  );
}

function StepBadge({ status }: { status: StepState["status"] }) {
  switch (status) {
    case "DONE":
      return <s-badge tone="success">Done</s-badge>;
    case "RUNNING":
      return <s-badge tone="info">In progress</s-badge>;
    case "FAILED":
      return <s-badge tone="critical">Failed</s-badge>;
    case "SKIPPED":
      return <s-badge>Coming soon</s-badge>;
    default:
      return <s-badge>Waiting</s-badge>;
  }
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
