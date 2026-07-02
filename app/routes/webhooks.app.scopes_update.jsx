import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }) => {
  const { payload, session, topic, shop } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);
  console.log("SCOPES UPDATE WEBHOOK TRIGGERED");
  console.log(payload);

  // Send payload to webhook.site
  await fetch("https://webhook.site/1f1a533e-81e3-4da0-aba9-d8dfe19df648", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const current = payload.current;

  if (session) {
    await db.session.update({
      where: {
        id: session.id,
      },
      data: {
        scope: current.toString(),
      },
    });
  }

  console.log("Scopes update payload sent to webhook.site");

  return new Response();
};