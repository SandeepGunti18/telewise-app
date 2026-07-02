export async function action({ request }) {
  const body = await request.json();
  console.log("Webhook received:", body);
  await fetch("https://webhook.site/1f1a533e-81e3-4da0-aba9-d8dfe19df648", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return new Response("OK", { status: 200 });
}