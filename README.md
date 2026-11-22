# Surco Discos

Tienda de vinilos en español con Next.js, Stripe Checkout y la API REST de Supabase. Los precios del catálogo de muestra están en pesos mexicanos. En la base de datos se guardan en centavos.

## Desarrollo local

1. Instala Node.js 22 LTS o posterior y ejecuta `npm ci`.
2. Copia `.env.example` a `.env.local`.
3. Ejecuta `supabase/setup.sql` en el editor SQL de tu proyecto Supabase. Crea el catálogo, los pedidos y los permisos del servidor.
4. Configura SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY. Conserva esta clave exclusivamente en el servidor.
5. Configura STRIPE_SECRET_KEY con una clave de prueba. Ejecuta `stripe listen --events checkout.session.completed --forward-to localhost:3000/api/webhook` y usa el secreto de firma que imprime como STRIPE_WEBHOOK_SECRET.
6. Define SITE_URL como http://localhost:3000 y ejecuta `npm run dev`.

Sin credenciales, el catálogo de ejemplo permite explorar los discos y guardar el carrito en el navegador. El servidor requiere la configuración de los dos servicios para iniciar un pago.

## Verificar una compra

Añade dos discos, cambia una cantidad y continúa al pago. En modo de prueba de Stripe, usa 4242 4242 4242 4242 con una fecha futura y un CVC de tres dígitos. El retorno consulta la sesión a Stripe. El webhook verifica la firma y guarda en orders una fila por sesión, con los productos, total y datos de envío. Si Stripe repite el evento, la restricción primaria evita duplicar el pedido.

## Despliegue

Usa `npm run build` y `npm start` en un servidor compatible con Next.js. Configura las variables de entorno en el alojamiento, fija SITE_URL al origen HTTPS definitivo y registra el evento checkout.session.completed en Stripe para la URL pública /api/webhook. Stripe debe poder acceder directamente a ese endpoint, incluso cuando la vista previa de la tienda sea privada. Verifica primero una compra de prueba y su fila en Supabase antes de cambiar a las claves y al secreto de webhook de producción.

Para Sites, `npm run build:site` exporta el frontend Next.js y empaqueta los mismos endpoints y recursos en un Worker. La selección inicial y los precios son ilustrativos. Las portadas corresponden a las ediciones del catálogo de iTunes.
