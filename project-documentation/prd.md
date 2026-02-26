Objetivo del sistema

Crear una Shopify App que implemente un Automatic App Discount (20%) para un bundle:

Bundle = 1 Core + 3 Patches

Identificación por metafield de producto: custom.bundle_role ∈ { core, patch }

Soporta múltiples bundles en el mismo carrito:

bundleCount = min(coreCount, floor(patchCount / 3))

Se descuenta A) Core + 3 patches por cada bundle detectado

Parches extra o cores extra que no completen bundle → sin descuento

Descuento = 20%

Tipo de App (lo que DEBE construir el agente)
Opción recomendada (completa y correcta)

Shopify App pública / custom distribution con backend OAuth + Discount Function (Shopify Functions).

Por qué:
Sin backend OAuth no podrás ejecutar discountAutomaticAppCreate en la tienda del cliente de forma confiable (te quedas sin token con write_discounts), y depender de “GraphiQL App” no sirve porque no tiene esos permisos.

Componentes:

Backend OAuth App (Remix o Node, típico scaffold de Shopify CLI)

Discount Function Extension (Discount Function API) para aplicar descuento en runtime

(Opcional) UI Admin para configurar % — no requerida por ahora (hardcoded 20%)

Requerimientos funcionales
F1. Instalación de la app

La app debe ser instalable en una tienda Shopify del cliente vía install link (custom distribution / single store).

En instalación, solicitar scopes mínimos.

F2. Crear/activar el descuento automático

Al instalar (o vía endpoint interno / comando admin), la app debe crear un Automatic App Discount usando discountAutomaticAppCreate con:

discountClasses: [PRODUCT]

functionId correspondiente a la function instalada en esa tienda

title: “Bundle 20% (Core + 3 Patches)”

startsAt: now

combinesWith: false para order/product/shipping (según política)

Nota: La app debe poder crear el descuento en la tienda real, no solo en dev store.

F3. Lógica del descuento (Discount Function)

Entrada: líneas del carrito

Por cada línea, obtener el metafield del producto:

product.metafield(namespace:"custom", key:"bundle_role").value

Contar cantidades:

coreCount: suma qty de líneas con value core

patchCount: suma qty de líneas con value patch

Calcular:

bundleCount = min(coreCount, floor(patchCount / 3))

Aplicar 20%:

A bundleCount unidades de core

A bundleCount * 3 unidades de patch

Si un producto no tiene metafield o value distinto → ignóralo

Regla estricta: exactamente 3 patches por bundle, pero soporta multiples bundles (6 patches + 2 cores = 2 bundles).

F4. Observabilidad mínima

Logging/debug (en dev) para confirmar:

cores encontrados, patches encontrados, bundleCount calculado

líneas seleccionadas para descuento

F5. Metafield

El sistema depende de que exista (y esté seteado en productos):

custom.bundle_role como product metafield (choice list o text)

valores: core, patch

La app NO necesita crear productos, pero sí puede incluir docs/validation.

Requerimientos no funcionales
NF1. Seguridad / permisos mínimos

Scopes requeridos (mínimo):

write_discounts (obligatorio para crear el automatic discount)

read_products (si necesitas validar metafields desde backend; la function de runtime usa input)

(Opcional) write_products si quieres que la app pueda setear metafields automáticamente, pero no es necesario si lo haces manualmente.

NF2. Compatibilidad

Shopify Admin GraphQL API version estable (ej. 2026-01 como ya usaste).

La Discount Function debe usar el Discount Function API (nuevo discounts api type), y por eso en la mutación es obligatorio discountClasses.

NF3. Despliegue

Soportar shopify app deploy

Instalación en tienda del cliente via Partner Dashboard install link (custom distribution).

NF4. Confiabilidad

La function debe ser determinística y rápida.

No depender de servicios externos.

Manejar carritos grandes (escala lineal por número de líneas).

NF5. UX (por ahora)

No se requiere UI admin.

El % es fijo (20%).

(Opcional futuro): admin UI para configurar %.

“Definition of Done” (criterios de éxito)

App instalada en tienda del cliente.

La app crea un automatic app discount (ACTIVE).

Con un carrito:

1 core + 3 patches → aplica 20% sobre esos 4 items

2 core + 6 patches → aplica 2 bundles

1 core + 4 patches → aplica 1 bundle y 1 patch queda sin descuento

Descuento visible en checkout.