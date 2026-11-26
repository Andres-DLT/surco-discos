# TCT$RK

Tienda de streetwear en español con Next.js, Stripe Checkout y Supabase. La colección de muestra incluye sudadera, playera, pantalón cargo y gorra. Los precios se muestran en pesos mexicanos y se almacenan en centavos.

## Desarrollo local

1. Con Node.js 22.12 o posterior, ejecuta `npm ci`.
2. Copia `.env.example` a `.env.local`.
3. Ejecuta `supabase/setup.sql` en el editor SQL de tu proyecto Supabase. El script crea el catálogo de prendas en `apparel_products` y reutiliza la tabla `orders` en instalaciones anteriores.
4. Configura `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`. Conserva la clave en el servidor.
5. Configura `STRIPE_SECRET_KEY` con una clave de prueba. Ejecuta `stripe listen --events checkout.session.completed --forward-to localhost:3000/api/webhook` y usa su secreto de firma como `STRIPE_WEBHOOK_SECRET`.
6. Define `SITE_URL=http://localhost:3000` y ejecuta `npm run dev`.

El catálogo de muestra y la bolsa funcionan sin credenciales. Para iniciar un pago se necesita la configuración de ambos servicios.

## Prueba de compra

Añade una prenda en dos tallas distintas y cambia la cantidad de una de ellas. Al continuar, Stripe debe mostrar las dos tallas, sus precios y el total en MXN. Completa la compra en modo de prueba y comprueba que existe una fila en `orders` con ambas variantes y la dirección de entrega. El servidor calcula el total con los precios del catálogo y el webhook registra cada sesión pagada una sola vez.

## Despliegue

Usa `npm run build` y `npm start` en un servidor compatible con Next.js. Para Sites, `npm run build:site` genera el frontend y empaqueta los endpoints y los recursos en un Worker.

Configura las variables de entorno en el alojamiento y fija `SITE_URL` al origen HTTPS definitivo. Registra `checkout.session.completed` en Stripe para la URL pública `/api/webhook`. Verifica una compra de prueba y su pedido en Supabase antes de activar las credenciales de producción. Las imágenes, las prendas y los precios de esta colección son de muestra.
