import { authenticate } from "../shopify.server";
import db from "../db.server";

const WEBHOOK_SITE_URL = "https://webhook.site/11d802a9-caaa-472d-a310-22505fd8916e";

const DEFAULT_REFUND_TEMPLATE =
  "Hi {{customer_name}}, your refund of {{currency}} {{refund_amount}} for order {{order_number}} has been processed.";

function fillTemplate(template, vars) {
  let message = template;
  Object.entries(vars).forEach(([key, value]) => {
    message = message.replaceAll(`{{${key}}}`, value ?? "N/A");
  });
  return message;
}

export const action = async ({ request }) => {
  const { shop, topic, payload } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);

  let refund;
  let status = "success";
  let errorMessage = null;

  try {
    // Find the existing order so we can grab the customer name + order number
    const order = await db.order.findFirst({
      where: { shopifyId: String(payload.order_id), shop },
    });

    // Fetch the currently active refund template saved from the UI
    const activeTemplate = await db.smsTemplate.findFirst({
      where: { type: "refund", isActive: true },
      orderBy: { updatedAt: "desc" },
    });

    const templateText = activeTemplate?.content || DEFAULT_REFUND_TEMPLATE;

    const refundAmount = payload.transactions?.[0]?.amount || "0";
    const refundCurrency = payload.transactions?.[0]?.currency || "USD";
    const refundReason = payload.note || "No reason provided";

    const smsMessage = fillTemplate(templateText, {
      customer_name: order?.customerName || "Customer",
      order_number: order?.orderNumber || payload.order_id,
      refund_amount: refundAmount,
      currency: refundCurrency,
      refund_reason: refundReason,
      refund_id: payload.id,
    });

    console.log(`Refund SMS Template used: "${activeTemplate?.title || "default"}"`);
    console.log(`Refund SMS Message: ${smsMessage}`);

    // Save the refund record
    refund = await db.refund.upsert({
      where: { shopifyRefundId: String(payload.id) },
      update: {},
      create: {
        shopifyRefundId: String(payload.id),
        shopifyOrderId: String(payload.order_id),
        shop,
        refundAmount,
        currency: refundCurrency,
        reason: refundReason,
        payload: JSON.stringify(payload),
      },
    });

    // Send to webhook.site (placeholder SMS gateway for Phase 1)
    const response = await fetch(WEBHOOK_SITE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: order?.customerEmail || "N/A",
        channel: "sms",
        message: smsMessage,
        order_id: payload.order_id,
        shop,
      }),
    });

    if (!response.ok) throw new Error(`webhook.site responded with ${response.status}`);

    console.log(`SMS sent to webhook.site`);

    if (order) {
      await db.notificationLog.create({
        data: {
          orderId: order.id,
          channel: "sms",
          status: "success",
          message: smsMessage,
          destination: WEBHOOK_SITE_URL,
        },
      });
      console.log(`Notification log saved — status: success`);
    }

  } catch (err) {
    console.error("Refund notification error:", err);
    status = "failed";
    errorMessage = err.message;
  }

  return new Response("OK", { status: 200 });
};