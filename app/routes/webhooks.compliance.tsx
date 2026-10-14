import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

// Mandatory privacy webhooks for public apps:
// customers/data_request, customers/redact and shop/redact.
// The app never reads or stores customer data, so the customer topics need
// no work beyond acknowledging. shop/redact arrives 48 hours after uninstall
// and must remove everything stored for that shop.
export const action = async ({ request }: ActionFunctionArgs) => {
  // Throws a 401 response if the HMAC signature is invalid.
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  if (topic === "SHOP_REDACT") {
    await db.session.deleteMany({ where: { shop } });
  }

  return new Response();
};
