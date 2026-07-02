import { authenticate } from "../shopify.server";
import db from "../db.server";

const WEBHOOK_SITE_URL = "https://webhook.site/11d802a9-caaa-472d-a310-22505fd8916e";

function buildSmsMessage(order) {
  const itemCount = order.line_items?.length || 0;
  return `Hi Customer! Your order #${order.order_number} has been received. Items: ${itemCount}, Total: ${order.total_price} ${order.currency}. Thank you for shopping with us!`;
}

export const action = async ({ request }) => {
  const { shop, topic, payload } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);

  let order;
  let status = "success";
  let errorMessage = null;

  try {
    order = await db.order.upsert({
      where: { shopifyId: String(payload.id) },
      update: {},
      create: {
        shopifyId:     String(payload.id),
        shop,
        orderNumber:   payload.order_number,
        customerName:  payload.billing_address?.name || payload.email || "Unknown",
        customerEmail: payload.email || null,
        totalPrice:    payload.total_price,
        currency:      payload.currency,
        payload:       JSON.stringify(payload),
      },
    });

    const smsMessage = buildSmsMessage({ ...payload, shop });

    // ✅ Added this log — shows SMS template in terminal
    console.log(`SMS Template: ${smsMessage}`);

    const response = await fetch(WEBHOOK_SITE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to:       payload.billing_address?.phone || "N/A",
        channel:  "sms",
        message:  smsMessage,
        order_id: payload.order_number,
        shop,
      }),
    });

    if (!response.ok) throw new Error(`webhook.site responded with ${response.status}`);

    // ✅ Added this log — confirms SMS sent
    console.log(`SMS sent to webhook.site`);

  } catch (err) {
    console.error("Notification error:", err);
    status = "failed";
    errorMessage = err.message;
  }

  if (order) {
    await db.notificationLog.create({
      data: {
        orderId:     order.id,
        channel:     "sms",
        status,
        message:     errorMessage || "SMS sent successfully",
        destination: WEBHOOK_SITE_URL,
      },
    });

    // ✅ Added this log — confirms log saved
    console.log(`Notification log saved — status: ${status}`);
  }

  return new Response("OK", { status: 200 });
};