import Stripe from 'stripe';
import seed from './catalog.json' with {type:'json'};

const reply = (body,status=200) => Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
async function database(env,path,options={}) {
  const key=env.SUPABASE_SERVICE_ROLE_KEY;
  const response=await fetch(env.SUPABASE_URL.replace(/\/$/,'')+'/rest/v1/'+path,{
    ...options,headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',...options.headers}
  });
  if(!response.ok) throw new Error('Database request failed');
  return response;
}
const configured = env => env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY;
async function products(env){
  if(!configured(env)) return seed;
  return (await database(env,'products?active=eq.true&select=id,title,artist,genre,year,price&order=position')).json();
}
export async function api(request,env){
  const url=new URL(request.url), path=url.pathname;
  try {
    if(path==='/api/products' && request.method==='GET') return reply(await products(env));
    if(!configured(env)||!env.STRIPE_SECRET_KEY||!env.STRIPE_WEBHOOK_SECRET||!env.SITE_URL)
      return reply({error:'Los pagos aún no están habilitados. Tu carrito está guardado.'},503);
    const stripe=new Stripe(env.STRIPE_SECRET_KEY,{httpClient:Stripe.createFetchHttpClient()});
    if(path==='/api/checkout' && request.method==='POST'){
      const body=await request.json().catch(()=>null);
      const items=body?.items;
      if(!Array.isArray(items)||!items.length||items.length>50||items.some(x=>!x||typeof x.id!=='string'||!Number.isInteger(x.quantity)||x.quantity<1||x.quantity>10)||new Set(items.map(x=>x.id)).size!==items.length)
        return reply({error:'Revisa las cantidades del carrito.'},400);
      const list=await products(env);
      const lines=[];
      for(const item of items){
        const p=list.find(x=>x.id===item.id);
        if(!p) return reply({error:'Un disco ya no está disponible. Actualiza el catálogo.'},409);
        lines.push({quantity:item.quantity,price_data:{currency:'mxn',unit_amount:p.price,product_data:{name:p.artist+' — '+p.title,metadata:{product_id:p.id}}}});
      }
      const origin=new URL(env.SITE_URL).origin;
      const session=await stripe.checkout.sessions.create({mode:'payment',payment_method_types:['card'],locale:'es',line_items:lines,shipping_address_collection:{allowed_countries:['MX']},metadata:{shop:'surco'},success_url:origin+'/?pedido={CHECKOUT_SESSION_ID}',cancel_url:origin+'/?carrito=1'});
      return reply({url:session.url});
    }
    if(path==='/api/webhook' && request.method==='POST'){
      let event;
      try{event=await stripe.webhooks.constructEventAsync(await request.text(),request.headers.get('stripe-signature')||'',env.STRIPE_WEBHOOK_SECRET,undefined,Stripe.createSubtleCryptoProvider())}catch{return reply({error:'Firma inválida'},400)}
      const s=event.data.object;
      if(event.type==='checkout.session.completed'&&s.metadata?.shop==='surco'&&s.payment_status==='paid'){
        const items=await stripe.checkout.sessions.listLineItems(s.id,{limit:100,expand:['data.price.product']});
        await database(env,'orders?on_conflict=session_id',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates'},body:JSON.stringify({session_id:s.id,total:s.amount_total,currency:s.currency,email:s.customer_details?.email,shipping:s.collected_information?.shipping_details??s.shipping_details,items:items.data.map(l=>({id:l.price.product.metadata.product_id,title:l.description,quantity:l.quantity,total:l.amount_total}))})});
      }
      return reply({received:true});
    }
    if(path==='/api/order'&&request.method==='GET'){
      const id=url.searchParams.get('id')||'';
      if(!/^cs_(live|test)_[a-zA-Z0-9]+$/.test(id))return reply({error:'Pedido inválido.'},400);
      const session=await stripe.checkout.sessions.retrieve(id);
      return reply({paid:session.metadata?.shop==='surco'&&session.payment_status==='paid'});
    }
    return reply({error:'Ruta no disponible.'},404);
  }catch{return reply({error:'No se pudo completar la solicitud. Inténtalo de nuevo.'},502)}
}
