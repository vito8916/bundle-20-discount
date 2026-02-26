export default function SetupGuidePage() {
  return (
    <s-page heading="Product Setup Guide">
      <s-section heading="Overview">
        <s-paragraph>
          The Bundle 20% Discount relies on a product metafield to identify
          which products are part of a bundle. Follow the steps below to tag
          your products correctly so the discount function can detect them at
          checkout.
        </s-paragraph>
      </s-section>

      <s-section heading="Step 1 — Create the metafield definition">
        <s-stack direction="block" gap="base">
          <s-paragraph>
            Go to <s-text emphasis="bold">Settings → Custom data → Products</s-text>{" "}
            in your Shopify Admin and add a new metafield definition with these
            exact values:
          </s-paragraph>
          <s-box
            padding="base"
            borderWidth="base"
            borderRadius="base"
            background="subdued"
          >
            <s-stack direction="block" gap="tight">
              <s-paragraph>
                <s-text emphasis="bold">Namespace:</s-text> custom
              </s-paragraph>
              <s-paragraph>
                <s-text emphasis="bold">Key:</s-text> bundle_role
              </s-paragraph>
              <s-paragraph>
                <s-text emphasis="bold">Type:</s-text> Single line text
                (or use a list with allowed values: core, patch)
              </s-paragraph>
              <s-paragraph>
                <s-text emphasis="bold">Name:</s-text> Bundle Role
              </s-paragraph>
            </s-stack>
          </s-box>
        </s-stack>
      </s-section>

      <s-section heading="Step 2 — Tag your Core product">
        <s-stack direction="block" gap="base">
          <s-paragraph>
            Open the product that acts as the main item in the bundle. Scroll
            down to <s-text emphasis="bold">Metafields</s-text> and set:
          </s-paragraph>
          <s-box
            padding="base"
            borderWidth="base"
            borderRadius="base"
            background="subdued"
          >
            <s-paragraph>
              <s-text emphasis="bold">bundle_role</s-text> = <s-text emphasis="bold">core</s-text>
            </s-paragraph>
          </s-box>
          <s-paragraph>
            Each distinct core product needs this value. Only one core is
            required per bundle.
          </s-paragraph>
        </s-stack>
      </s-section>

      <s-section heading="Step 3 — Tag your Patch products">
        <s-stack direction="block" gap="base">
          <s-paragraph>
            Open each product that acts as an add-on (patch) in the bundle and
            set:
          </s-paragraph>
          <s-box
            padding="base"
            borderWidth="base"
            borderRadius="base"
            background="subdued"
          >
            <s-paragraph>
              <s-text emphasis="bold">bundle_role</s-text> = <s-text emphasis="bold">patch</s-text>
            </s-paragraph>
          </s-box>
          <s-paragraph>
            Three patches are required to complete one bundle. A customer can
            buy the same patch product three times, or three different patch
            products — both count.
          </s-paragraph>
        </s-stack>
      </s-section>

      <s-section heading="Step 4 — Test in checkout">
        <s-stack direction="block" gap="base">
          <s-paragraph>
            Add <s-text emphasis="bold">1 Core</s-text> and{" "}
            <s-text emphasis="bold">3 Patches</s-text> to a cart and proceed to
            checkout. You should see the{" "}
            <s-text emphasis="bold">20% discount</s-text> applied automatically
            to all four items under the name{" "}
            <s-text emphasis="bold">Bundle 20% (Core + 3 Patches)</s-text>.
          </s-paragraph>
          <s-paragraph>
            Products without the metafield (or with a value other than{" "}
            <s-text emphasis="bold">core</s-text> or{" "}
            <s-text emphasis="bold">patch</s-text>) are ignored by the discount
            function and will not affect the bundle count.
          </s-paragraph>
        </s-stack>
      </s-section>

      <s-section slot="aside" heading="Bundle Rules Reference">
        <s-stack direction="block" gap="tight">
          <s-paragraph>
            <s-text emphasis="bold">Formula:</s-text>
          </s-paragraph>
          <s-paragraph>
            bundleCount = min(cores, floor(patches ÷ 3))
          </s-paragraph>
          <s-paragraph>
            <s-text emphasis="bold">Discount:</s-text> 20% on bundleCount
            cores and bundleCount × 3 patches
          </s-paragraph>
          <s-paragraph>
            Leftover items get no discount.
          </s-paragraph>
        </s-stack>
      </s-section>

      <s-section slot="aside" heading="Quick Examples">
        <s-stack direction="block" gap="tight">
          <s-paragraph>1 core + 3 patches → 1 bundle (4 discounted)</s-paragraph>
          <s-paragraph>2 cores + 6 patches → 2 bundles (8 discounted)</s-paragraph>
          <s-paragraph>1 core + 4 patches → 1 bundle (1 patch excluded)</s-paragraph>
          <s-paragraph>1 core + 2 patches → no discount</s-paragraph>
        </s-stack>
      </s-section>
    </s-page>
  );
}
