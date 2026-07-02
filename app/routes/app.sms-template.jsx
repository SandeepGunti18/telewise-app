import { useState } from "react";
import { useLoaderData, useFetcher } from "react-router";
import {
  Page,
  Card,
  Text,
  Button,
  BlockStack,
  InlineStack,
  TextField,
  Banner,
  Divider,
  Badge,
  Box,
  ButtonGroup,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import db from "../db.server";

const ORDER_TEMPLATES = [
  {
    id: "order_confirmation",
    title: "Order Confirmation",
    template:
      "Hi {{customer_name}}, your order {{order_number}} for {{currency}} {{total_price}} has been placed!",
  },
  {
    id: "order_with_product",
    title: "Order with Product",
    template:
      "Dear {{customer_name}}, your order {{order_number}} for {{product_name}} (Qty {{quantity}}) worth {{currency}} {{total_price}} is confirmed!",
  },
  {
    id: "friendly_confirmation",
    title: "Friendly Confirmation",
    template:
      "Thank you {{customer_name}}! Order {{order_number}} worth {{currency}} {{total_price}} is confirmed and will be delivered soon.",
  },
];

const REFUND_TEMPLATES = [
  {
    id: "refund_confirmation",
    title: "Refund Confirmation",
    template:
      "Hi {{customer_name}}, your refund of {{currency}} {{refund_amount}} for order {{order_number}} has been processed.",
  },
  {
    id: "refund_with_reason",
    title: "Refund with Reason",
    template:
      "Dear {{customer_name}}, we've refunded {{currency}} {{refund_amount}} for order {{order_number}}. Reason: {{refund_reason}}.",
  },
  {
    id: "refund_apology",
    title: "Refund with Apology",
    template:
      "Hi {{customer_name}}, we're sorry for the inconvenience. Your refund of {{currency}} {{refund_amount}} for order {{order_number}} is on its way and should reflect in 3-5 business days.",
  },
];

const ORDER_VARIABLES = [
  "{{customer_name}}", "{{order_number}}", "{{total_price}}", "{{currency}}",
  "{{email}}", "{{shipping_address}}", "{{product_name}}", "{{quantity}}",
];

const REFUND_VARIABLES = [
  "{{refund_amount}}", "{{refund_reason}}", "{{refund_id}}",
];

const SAMPLE_DATA = {
  "{{customer_name}}": "Gunti Sandeep",
  "{{order_number}}": "1072",
  "{{total_price}}": "28.00",
  "{{currency}}": "USD",
  "{{email}}": "sandeep@example.com",
  "{{shipping_address}}": "Guntur, Andhra Pradesh",
  "{{product_name}}": "Heavyweight Hoodie",
  "{{quantity}}": "1",
  "{{refund_amount}}": "28.00",
  "{{refund_reason}}": "Customer changed their mind",
  "{{refund_id}}": "RF-2031",
};

function renderPreview(template) {
  let preview = template;
  Object.entries(SAMPLE_DATA).forEach(([key, value]) => {
    preview = preview.replaceAll(key, value);
  });
  return preview;
}

// Loader — fetch the currently active templates for both types from Prisma
export const loader = async ({ request }) => {
  await authenticate.admin(request);

  const orderTemplate = await db.smsTemplate.findFirst({
    where: { type: "order", isActive: true },
    orderBy: { updatedAt: "desc" },
  });

  const refundTemplate = await db.smsTemplate.findFirst({
    where: { type: "refund", isActive: true },
    orderBy: { updatedAt: "desc" },
  });

  return { orderTemplate, refundTemplate };
};

// Action — save whichever template (order/refund) was submitted
export const action = async ({ request }) => {
  await authenticate.admin(request);

  const formData = await request.formData();
  const type = formData.get("type");
  const title = formData.get("title") || "Custom Template";
  const content = formData.get("content");

  if (!type || !content) {
    return { error: "type and content are required" };
  }

  await db.smsTemplate.updateMany({
    where: { type, isActive: true },
    data: { isActive: false },
  });

  const saved = await db.smsTemplate.create({
    data: { type, title, content, isActive: true },
  });

  return { success: true, template: saved };
};

export default function SmsTemplate() {
  const { orderTemplate, refundTemplate } = useLoaderData();
  const fetcher = useFetcher();

  const [activeTab, setActiveTab] = useState("order");
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  const [orderContent, setOrderContent] = useState(
    orderTemplate?.content || ORDER_TEMPLATES[2].template
  );
  const [refundContent, setRefundContent] = useState(
    refundTemplate?.content || REFUND_TEMPLATES[0].template
  );

  const customTemplate = activeTab === "order" ? orderContent : refundContent;
  const setCustomTemplate = activeTab === "order" ? setOrderContent : setRefundContent;

  const templatesToShow = activeTab === "order" ? ORDER_TEMPLATES : REFUND_TEMPLATES;
  const activeVariables = activeTab === "order" ? ORDER_VARIABLES : REFUND_VARIABLES;

  const saved = fetcher.data?.success && fetcher.state === "idle";

  const handleSelectTemplate = (template) => {
    setSelectedTemplate(template.id);
    setCustomTemplate(template.template);
  };

  const handleInsertVariable = (variable) => {
    setCustomTemplate((prev) => prev + " " + variable);
  };

  const handleSave = () => {
    fetcher.submit(
      {
        type: activeTab,
        title: selectedTemplate || `Custom ${activeTab} template`,
        content: customTemplate,
      },
      { method: "post" }
    );
  };

  const preview = renderPreview(customTemplate);

  return (
    <Page
      title="SMS Template Manager"
      subtitle="Customize the SMS messages sent to customers for orders and refunds — saved live to your database"
    >
      <BlockStack gap="500">

        {saved && (
          <Banner tone="success" title={`${activeTab === "order" ? "Order" : "Refund"} template saved! It will now be used by the live webhook.`} />
        )}

        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between" blockAlign="center">
              <Text variant="headingMd" as="h2">
                Choose a Pre-built Template
              </Text>
              <ButtonGroup variant="segmented">
                <Button
                  pressed={activeTab === "order"}
                  onClick={() => { setActiveTab("order"); setSelectedTemplate(null); }}
                >
                  Order Templates
                </Button>
                <Button
                  pressed={activeTab === "refund"}
                  onClick={() => { setActiveTab("refund"); setSelectedTemplate(null); }}
                >
                  Refund Templates
                </Button>
              </ButtonGroup>
            </InlineStack>

            {activeTab === "refund" && refundTemplate && (
              <Banner tone="info">
                Currently live in production: "{refundTemplate.title}" — last updated{" "}
                {new Date(refundTemplate.updatedAt).toLocaleString()}
              </Banner>
            )}
            {activeTab === "order" && orderTemplate && (
              <Banner tone="info">
                Currently live in production: "{orderTemplate.title}" — last updated{" "}
                {new Date(orderTemplate.updatedAt).toLocaleString()}
              </Banner>
            )}

            <BlockStack gap="300">
              {templatesToShow.map((template) => (
                <div
                  key={template.id}
                  onClick={() => handleSelectTemplate(template)}
                  style={{ cursor: "pointer" }}
                >
                  <Box
                    padding="400"
                    borderWidth="025"
                    borderRadius="200"
                    borderColor={selectedTemplate === template.id ? "border-focus" : "border"}
                    background={selectedTemplate === template.id ? "bg-surface-selected" : "bg-surface"}
                  >
                    <BlockStack gap="100">
                      <InlineStack align="space-between">
                        <Text variant="headingSm" as="h3">{template.title}</Text>
                        {selectedTemplate === template.id && <Badge tone="success">Selected</Badge>}
                      </InlineStack>
                      <Text variant="bodyMd" tone="subdued">{template.template}</Text>
                    </BlockStack>
                  </Box>
                </div>
              ))}
            </BlockStack>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2">
              Edit {activeTab === "order" ? "Order" : "Refund"} Template
            </Text>

            <TextField
              value={customTemplate}
              onChange={(value) => setCustomTemplate(value)}
              multiline={4}
              autoComplete="off"
              placeholder="Write your custom SMS template here..."
            />

            <Text variant="bodySm" tone={customTemplate.length > 160 ? "critical" : "subdued"}>
              {customTemplate.length} / 160 characters
              {customTemplate.length > 160 ? " — this will be sent as multiple SMS segments" : ""}
            </Text>

            <BlockStack gap="200">
              <Text variant="headingSm" as="h3">
                Insert Variable
              </Text>
              <InlineStack gap="200" wrap>
                {activeVariables.map((v) => (
                  <Button
                    key={v}
                    size="slim"
                    tone={activeTab === "refund" ? "critical" : undefined}
                    onClick={() => handleInsertVariable(v)}
                  >
                    {v}
                  </Button>
                ))}
              </InlineStack>
            </BlockStack>

            <Divider />

            <BlockStack gap="200">
              <Text variant="headingSm" as="h3">Preview</Text>
              <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                <Text variant="bodyMd">{preview}</Text>
              </Box>
            </BlockStack>

            <InlineStack align="end">
              <Button
                variant="primary"
                onClick={handleSave}
                loading={fetcher.state !== "idle"}
              >
                Save {activeTab === "order" ? "Order" : "Refund"} Template
              </Button>
            </InlineStack>
          </BlockStack>
        </Card>

      </BlockStack>
    </Page>
  );
}