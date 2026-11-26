import Stripe from 'stripe';
import seed from './catalog.json' with { type: 'json' };

const reply = (body, status = 200) => Response.json(body, {
  status,
  headers: { 'Cache-Control': 'no-store' }
});

async function database(env, path, options = {}) {
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const response = await fetch(env.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/' + path, {
    ...options,
    headers: {
      apikey: key,
      Authorization: 'Bearer ' + key,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  if (!response.ok) throw new Error('Database request failed');
  return response;
}

const configured = env => env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY;
async function products(env) {
  if (!configured(env)) return seed;
  const response = await database(env, 'apparel_products?active=eq.true&select=id,title,category,color,price,sizes,description&order=position');
  return response.json();
}

async function checkout(request, env, stripe) {
  const body = await request.json().catch(() => null);
  const items = body?.items;
  if (!Array.isArray(items) || !items.length || items.length > 50) {
    return reply({ error: 'Revisa las prendas de tu bolsa.' }, 400);
  }

  const catalog = await products(env);
  const variants = new Set();
  const lineItems = [];
  for (const item of items) {
    if (!item || typeof item.id !== 'string' || typeof item.size !== 'string' ||
        !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 10) {
      return reply({ error: 'Revisa las tallas y cantidades de tu bolsa.' }, 400);
    }
    const product = catalog.find(product => product.id === item.id);
    if (!product || !product.sizes.includes(item.size)) {
      return reply({ error: 'Una prenda o talla ya no está disponible. Revisa tu bolsa.' }, 409);
    }
    const key = JSON.stringify([product.id, item.size]);
    if (variants.has(key)) return reply({ error: 'Hay una prenda repetida con la misma talla.' }, 400);
    variants.add(key);
    lineItems.push({
      quantity: item.quantity,
      price_data: {
        currency: 'mxn',
        unit_amount: product.price,
        product_data: {
          name: product.title + ' · ' + product.color + ' · Talla ' + item.size,
          metadata: { product_id: product.id, size: item.size, color: product.color }
        }
      }
    });
  }
  const origin = new URL(env.SITE_URL).origin;
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    locale: 'es',
    line_items: lineItems,
    shipping_address_collection: { allowed_countries: ['MX'] },
    metadata: { shop: 'tctrk' },
    success_url: origin + '/?pedido={CHECKOUT_SESSION_ID}',
    cancel_url: origin + '/?carrito=1'
  });
  return reply({ id: session.id, url: session.url });
}

// Older sessions can return or deliver their webhook after the collection changes.
function isPaidShopSession(session) {
  return ['tctrk', 'surco'].includes(session.metadata?.shop) && session.payment_status === 'paid';
}

async function webhook(request, env, stripe) {
  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      await request.text(), request.headers.get('stripe-signature') || '',
      env.STRIPE_WEBHOOK_SECRET, undefined, Stripe.createSubtleCryptoProvider()
    );
  } catch {
    return reply({ error: 'Firma inválida' }, 400);
  }

  const session = event.data.object;
  if (event.type === 'checkout.session.completed' && isPaidShopSession(session)) {
    const items = await stripe.checkout.sessions.listLineItems(session.id, {
      limit: 100,
      expand: ['data.price.product']
    });
    const order = {
      session_id: session.id,
      total: session.amount_total,
      currency: session.currency,
      email: session.customer_details?.email,
      shipping: session.collected_information?.shipping_details ?? session.shipping_details,
      items: items.data.map(line => {
        const metadata = line.price.product.metadata;
        return {
          id: metadata.product_id,
          title: line.description,
          size: metadata.size,
          color: metadata.color,
          quantity: line.quantity,
          total: line.amount_total
        };
      })
    };
    await database(env, 'orders?on_conflict=session_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates' },
      body: JSON.stringify(order)
    });
  }
  return reply({ received: true });
}

export async function api(request, env) {
  const url = new URL(request.url);
  try {
    if (url.pathname === '/api/products' && request.method === 'GET') return reply(await products(env));
    if (!configured(env) || !env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET || !env.SITE_URL) {
      return reply({ error: 'Los pagos aún no están habilitados. Tu bolsa está guardada.' }, 503);
    }

    const stripe = new Stripe(env.STRIPE_SECRET_KEY, { httpClient: Stripe.createFetchHttpClient() });
    if (url.pathname === '/api/checkout' && request.method === 'POST') return await checkout(request, env, stripe);
    if (url.pathname === '/api/webhook' && request.method === 'POST') return await webhook(request, env, stripe);
    if (url.pathname === '/api/order' && request.method === 'GET') {
      const id = url.searchParams.get('id') || '';
      if (!/^cs_(live|test)_[a-zA-Z0-9]+$/.test(id)) return reply({ error: 'Pedido inválido.' }, 400);
      const session = await stripe.checkout.sessions.retrieve(id);
      return reply({ paid: isPaidShopSession(session) });
    }
    return reply({ error: 'Ruta no disponible.' }, 404);
  } catch {
    return reply({ error: 'No se pudo completar la solicitud. Inténtalo de nuevo.' }, 502);
  }
}
