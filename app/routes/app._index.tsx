import { useEffect } from "react";
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
  parseSteps,
  retryImportJob,
} from "../importer/jobs.server";
import { STEP_LABELS } from "../importer/steps";
import type { JobStatus, StepState } from "../importer/steps";
import { TEMPLATES, isTemplateAvailable } from "../importer/templates.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const job = await latestImportJob(session.shop);

  const templates = await Promise.all(
    TEMPLATES.map(async (t) => ({
      ...t,
      available: await isTemplateAvailable(t.id),
    })),
  );

  return {
    shop: session.shop,
    templates,
    job: job && {
      id: job.id,
      template: job.template,
      status: job.status as JobStatus,
      steps: parseSteps(job.steps),
      error: job.error,
    },
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "retry") {
    await retryImportJob(session.shop, String(form.get("jobId")));
    return null;
  }

  const template = String(form.get("template"));
  const current = await latestImportJob(session.shop);
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
  const { shop, templates, job } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const revalidator = useRevalidator();
  const active = job?.status === "QUEUED" || job?.status === "RUNNING";
  const submitting = fetcher.state !== "idle";

  // Poll for progress while the import runs.
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => revalidator.revalidate(), 2000);
    return () => clearInterval(timer);
  }, [active, revalidator]);

  const startImport = (template: string) =>
    fetcher.submit({ intent: "start", template }, { method: "POST" });

  if (job && (active || job.status === "FAILED" || job.status === "DONE")) {
    const templateName =
      templates.find((t) => t.id === job.template)?.name ?? job.template;
    return (
      <s-page heading="AI Store Builder">
        <ImportProgress
          templateName={templateName}
          status={job.status}
          steps={job.steps}
          error={job.error}
        />
        {job.status === "FAILED" && (
          <s-button
            slot="primary-action"
            onClick={() =>
              fetcher.submit(
                { intent: "retry", jobId: job.id },
                { method: "POST" },
              )
            }
            {...(submitting ? { loading: true } : {})}
          >
            Retry
          </s-button>
        )}
        {job.status === "DONE" && (
          <s-section heading="Your store is ready">
            <s-stack direction="inline" gap="base">
              <s-button
                variant="primary"
                href={`https://${shop}`}
                target="_blank"
              >
                View store
              </s-button>
              <s-button href={`https://${shop}/admin/themes`} target="_blank">
                Customize theme
              </s-button>
            </s-stack>
          </s-section>
        )}
      </s-page>
    );
  }

  return (
    <s-page heading="AI Store Builder">
      <s-section heading="Choose a store template">
        <s-paragraph>
          We copy the template&apos;s products, collections, pages, blog posts,
          menus and policies into your store. Content you already have is kept.
        </s-paragraph>
        <s-grid
          gridTemplateColumns="repeat(auto-fill, minmax(220px, 1fr))"
          gap="base"
        >
          {templates.map((template) => (
            <s-box
              key={template.id}
              padding="base"
              borderWidth="base"
              borderRadius="base"
            >
              <s-stack direction="block" gap="small-200">
                <s-heading>{template.name}</s-heading>
                <s-paragraph>{template.description}</s-paragraph>
                {template.available ? (
                  <s-button
                    variant="primary"
                    onClick={() => startImport(template.id)}
                    {...(submitting ? { loading: true } : {})}
                  >
                    Import this template
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
  const heading =
    status === "DONE"
      ? `${templateName} template imported`
      : status === "FAILED"
        ? `Import of ${templateName} stopped`
        : `Importing the ${templateName} template`;

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
    default:
      return <s-badge>Waiting</s-badge>;
  }
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
