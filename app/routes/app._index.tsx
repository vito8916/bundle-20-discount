import { useEffect } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";

const DISCOUNT_TITLE = "Bundle 20% (Core + 3 Patches)";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  const dbRecord = await prisma.appDiscount.findUnique({
    where: { shop: session.shop },
  });

  if (!dbRecord) {
    return { discount: null, shopifyDiscount: null, error: null };
  }

  // Verify the discount still exists and is active in Shopify
  try {
    const response = await admin.graphql(
      `#graphql
        query GetDiscount($id: ID!) {
          automaticDiscountNode(id: $id) {
            id
            ... on DiscountAutomaticApp {
              title
              status
              startsAt
            }
          }
        }`,
      { variables: { id: dbRecord.discountId } },
    );
    const data = await response.json();
    const shopifyDiscount = data?.data?.automaticDiscountNode ?? null;
    return { discount: dbRecord, shopifyDiscount, error: null };
  } catch {
    return { discount: dbRecord, shopifyDiscount: null, error: null };
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "delete") {
    // Remove from DB only (merchant can delete from Shopify Admin)
    await prisma.appDiscount.deleteMany({ where: { shop: session.shop } });
    return { success: true, deleted: true };
  }

  // Find the deployed discount function for this app
  const functionsResponse = await admin.graphql(
    `#graphql
      query {
        shopifyFunctions(first: 25) {
          nodes {
            id
            title
            apiType
          }
        }
      }`,
  );
  const functionsData = await functionsResponse.json();
  const functions: Array<{ id: string; title: string; apiType: string }> =
    functionsData?.data?.shopifyFunctions?.nodes ?? [];

  const discountFunction = functions.find(
    (f) => f.apiType === "discount" || f.title.toLowerCase().includes("bundle"),
  );

  if (!discountFunction) {
    return {
      success: false,
      error:
        "Discount function not found. Make sure the app is deployed with `shopify app deploy`.",
    };
  }

  // Create the automatic app discount
  const discountResponse = await admin.graphql(
    `#graphql
      mutation CreateBundleDiscount($input: DiscountAutomaticAppInput!) {
        discountAutomaticAppCreate(automaticAppDiscount: $input) {
          automaticAppDiscount {
            discountId
            title
            status
            startsAt
          }
          userErrors {
            field
            message
          }
        }
      }`,
    {
      variables: {
        input: {
          title: DISCOUNT_TITLE,
          functionId: discountFunction.id,
          startsAt: new Date().toISOString(),
          discountClasses: ["PRODUCT"],
          combinesWith: {
            orderDiscounts: false,
            productDiscounts: false,
            shippingDiscounts: false,
          },
        },
      },
    },
  );

  const discountData = await discountResponse.json();
  const userErrors =
    discountData?.data?.discountAutomaticAppCreate?.userErrors ?? [];

  if (userErrors.length > 0) {
    return { success: false, error: userErrors[0].message };
  }

  const created = discountData?.data?.discountAutomaticAppCreate?.automaticAppDiscount;

  if (!created) {
    return { success: false, error: "Failed to create discount." };
  }

  await prisma.appDiscount.upsert({
    where: { shop: session.shop },
    update: {
      discountId: created.discountId,
      functionId: discountFunction.id,
      title: created.title,
      status: created.status,
    },
    create: {
      shop: session.shop,
      discountId: created.discountId,
      functionId: discountFunction.id,
      title: created.title,
      status: created.status,
    },
  });

  return { success: true, discount: created };
};

export default function Index() {
  const { discount, shopifyDiscount, error } =
    useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const isCreating =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST" &&
    fetcher.formData?.get("intent") !== "delete";

  const isDeleting =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formData?.get("intent") === "delete";

  const actionData = fetcher.data;
  const isActive =
    shopifyDiscount?.status === "ACTIVE" ||
    (actionData && "discount" in actionData && actionData.discount);
  const hasDiscount = !!(discount || (actionData && "discount" in actionData && actionData.discount));
  const actionError =
    error ||
    (actionData && "error" in actionData ? actionData.error : null);

  useEffect(() => {
    if (actionData && "success" in actionData && actionData.success && !("deleted" in actionData)) {
      shopify.toast.show("Discount created successfully!");
    }
    if (actionData && "deleted" in actionData && actionData.deleted) {
      shopify.toast.show("Discount record cleared.");
    }
  }, [actionData, shopify]);

  const createDiscount = () =>
    fetcher.submit({ intent: "create" }, { method: "POST" });

  const clearDiscount = () =>
    fetcher.submit({ intent: "delete" }, { method: "POST" });

  const discountAdminUrl = discount?.discountId
    ? `https://admin.shopify.com/discounts/${discount.discountId.replace("gid://shopify/DiscountAutomaticApp/", "")}`
    : null;

  return (
    <s-page heading="Bundle 20% Discount">
      {/* Primary action slot */}
      {!hasDiscount && (
        <s-button
          slot="primary-action"
          onClick={createDiscount}
          {...(isCreating ? { loading: true } : {})}
        >
          Create Discount
        </s-button>
      )}

      {/* Error banner */}
      {actionError && (
        <s-banner tone="critical">
          <s-paragraph>{actionError}</s-paragraph>
        </s-banner>
      )}

      {/* Discount Status Card */}
      <s-section heading="Discount Status">
        {hasDiscount ? (
          <s-stack direction="block" gap="base">
            <s-stack direction="inline" gap="small" blockAlignment="center">
              <s-badge tone={isActive ? "success" : "warning"}>
                {isActive ? "ACTIVE" : shopifyDiscount?.status ?? "UNKNOWN"}
              </s-badge>
              <s-text emphasis="bold">{DISCOUNT_TITLE}</s-text>
            </s-stack>
            <s-paragraph>
              This automatic discount is applied at checkout whenever a complete
              bundle is detected in the cart.
            </s-paragraph>
            <s-stack direction="inline" gap="small">
              {discountAdminUrl && (
                <s-button
                  variant="secondary"
                  href={discountAdminUrl}
                  target="_blank"
                >
                  View in Admin
                </s-button>
              )}
              <s-button
                variant="tertiary"
                tone="critical"
                onClick={clearDiscount}
                {...(isDeleting ? { loading: true } : {})}
              >
                Clear Record
              </s-button>
            </s-stack>
          </s-stack>
        ) : (
          <s-stack direction="block" gap="base">
            <s-banner tone="warning">
              <s-paragraph>
                No active discount found. Click <strong>Create Discount</strong>{" "}
                to activate the bundle discount on this store.
              </s-paragraph>
            </s-banner>
            <s-button
              onClick={createDiscount}
              {...(isCreating ? { loading: true } : {})}
            >
              Create Discount
            </s-button>
          </s-stack>
        )}
      </s-section>

      {/* How It Works */}
      <s-section heading="How It Works">
        <s-stack direction="block" gap="base">
          <s-paragraph>
            Customers get <s-text emphasis="bold">20% off</s-text> every
            complete bundle added to their cart. A bundle is{" "}
            <s-text emphasis="bold">1 Core + 3 Patches</s-text>.
          </s-paragraph>
          <s-box
            padding="base"
            borderWidth="base"
            borderRadius="base"
            background="subdued"
          >
            <s-stack direction="block" gap="tight">
              <s-paragraph>
                <s-text emphasis="bold">Bundle formula:</s-text>
              </s-paragraph>
              <s-paragraph>
                bundleCount = min(cores, floor(patches ÷ 3))
              </s-paragraph>
              <s-paragraph>
                Discount applies to: bundleCount × 1 core + bundleCount × 3 patches
              </s-paragraph>
              <s-paragraph>
                Extra items that don't complete a bundle get no discount.
              </s-paragraph>
            </s-stack>
          </s-box>
        </s-stack>
      </s-section>

      {/* Examples */}
      <s-section heading="Examples">
        <s-stack direction="block" gap="tight">
          <s-box
            padding="base"
            borderWidth="base"
            borderRadius="base"
            background="subdued"
          >
            <s-stack direction="block" gap="tight">
              <s-stack direction="inline" gap="base">
                <s-badge tone="success">1 bundle</s-badge>
                <s-text>
                  1 Core + 3 Patches → 4 items discounted at 20%
                </s-text>
              </s-stack>
              <s-stack direction="inline" gap="base">
                <s-badge tone="success">2 bundles</s-badge>
                <s-text>
                  2 Cores + 6 Patches → 8 items discounted at 20%
                </s-text>
              </s-stack>
              <s-stack direction="inline" gap="base">
                <s-badge tone="info">partial</s-badge>
                <s-text>
                  1 Core + 4 Patches → 1 bundle (4 items discounted, 1 patch at full price)
                </s-text>
              </s-stack>
              <s-stack direction="inline" gap="base">
                <s-badge tone="neutral">no discount</s-badge>
                <s-text>
                  1 Core + 2 Patches → 0 bundles (patches &lt; 3)
                </s-text>
              </s-stack>
            </s-stack>
          </s-box>
        </s-stack>
      </s-section>

      {/* Aside: Setup Guide */}
      <s-section slot="aside" heading="Product Setup">
        <s-stack direction="block" gap="base">
          <s-paragraph>
            Products must have the <s-text emphasis="bold">custom.bundle_role</s-text>{" "}
            metafield set to identify them as part of a bundle.
          </s-paragraph>
          <s-stack direction="block" gap="tight">
            <s-paragraph>
              <s-text emphasis="bold">core</s-text> — The main product (1 per bundle)
            </s-paragraph>
            <s-paragraph>
              <s-text emphasis="bold">patch</s-text> — Add-on products (3 per bundle)
            </s-paragraph>
          </s-stack>
          <s-link href="/app/additional">View setup guide</s-link>
        </s-stack>
      </s-section>

      {/* Aside: Discount Rules */}
      <s-section slot="aside" heading="Discount Rules">
        <s-stack direction="block" gap="tight">
          <s-paragraph>Discount: 20% off</s-paragraph>
          <s-paragraph>Discount class: Product</s-paragraph>
          <s-paragraph>Combines with: None</s-paragraph>
          <s-paragraph>Starts: Immediately upon creation</s-paragraph>
          <s-paragraph>Ends: Never (ongoing)</s-paragraph>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
