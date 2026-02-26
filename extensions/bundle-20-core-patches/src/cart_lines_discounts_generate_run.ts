import {
  ProductDiscountSelectionStrategy,
  CartInput,
  CartLinesDiscountsGenerateRunResult,
} from '../generated/api';

const BUNDLE_DISCOUNT_PERCENTAGE = 20;
const PATCHES_PER_BUNDLE = 3;

export function cartLinesDiscountsGenerateRun(
  input: CartInput,
): CartLinesDiscountsGenerateRunResult {
  const { lines } = input.cart;

  if (!lines.length) {
    return { operations: [] };
  }

  // Separate lines by bundle role metafield
  const coreLines: Array<{ id: string; quantity: number }> = [];
  const patchLines: Array<{ id: string; quantity: number }> = [];

  for (const line of lines) {
    if (line.merchandise.__typename !== 'ProductVariant') {
      continue;
    }

    const bundleRole = line.merchandise.product.bundleRole?.value;

    if (bundleRole === 'core') {
      coreLines.push({ id: line.id, quantity: line.quantity });
    } else if (bundleRole === 'patch') {
      patchLines.push({ id: line.id, quantity: line.quantity });
    }
    // Lines without bundle_role metafield or with other values are ignored
  }

  const coreCount = coreLines.reduce((sum, l) => sum + l.quantity, 0);
  const patchCount = patchLines.reduce((sum, l) => sum + l.quantity, 0);

  console.log(
    `[bundle-discount] cores=${coreCount}, patches=${patchCount}`,
  );

  const bundleCount = Math.min(coreCount, Math.floor(patchCount / PATCHES_PER_BUNDLE));

  console.log(`[bundle-discount] bundleCount=${bundleCount}`);

  if (bundleCount === 0) {
    return { operations: [] };
  }

  // Build discount targets for core items (up to bundleCount units total)
  const targets: Array<{ cartLine: { id: string; quantity: number } }> = [];

  let coresRemaining = bundleCount;
  for (const line of coreLines) {
    if (coresRemaining <= 0) break;
    const qty = Math.min(line.quantity, coresRemaining);
    targets.push({ cartLine: { id: line.id, quantity: qty } });
    coresRemaining -= qty;
    console.log(`[bundle-discount] targeting core line ${line.id} qty=${qty}`);
  }

  // Build discount targets for patch items (up to bundleCount * 3 units total)
  let patchesRemaining = bundleCount * PATCHES_PER_BUNDLE;
  for (const line of patchLines) {
    if (patchesRemaining <= 0) break;
    const qty = Math.min(line.quantity, patchesRemaining);
    targets.push({ cartLine: { id: line.id, quantity: qty } });
    patchesRemaining -= qty;
    console.log(`[bundle-discount] targeting patch line ${line.id} qty=${qty}`);
  }

  const bundleLabel = bundleCount === 1 ? '1 bundle' : `${bundleCount} bundles`;

  return {
    operations: [
      {
        productDiscountsAdd: {
          candidates: [
            {
              message: `Bundle 20% Off (${bundleLabel})`,
              targets,
              value: {
                percentage: {
                  value: BUNDLE_DISCOUNT_PERCENTAGE,
                },
              },
            },
          ],
          selectionStrategy: ProductDiscountSelectionStrategy.First,
        },
      },
    ],
  };
}
