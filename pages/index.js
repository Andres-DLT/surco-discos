import Head from 'next/head';
import { useEffect, useRef, useState } from 'react';
import seed from '../lib/catalog.json';

const CART_KEY = 'tctrk-bag-v1';
const SESSION_KEY = 'tctrk-checkout';
const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2, minimumFractionDigits: 0 });
const money = cents => currency.format(cents / 100);
const photo = product => '/shop/' + encodeURIComponent(product.id) + '.jpg';
const sameVariant = (a, b) => a.id === b.id && a.size === b.size;

function Icon({ name, size = 20 }) {
  const paths = {
    search: <><circle cx="10" cy="10" r="6.7"/><path d="m15 15 6 6"/></>,
    bag: <><path d="m4 8-1 13h18L20 8Z"/><path d="M8 9V6a4 4 0 0 1 8 0v3"/></>,
    close: <path d="m5 5 14 14M19 5 5 19"/>,
    plus: <path d="M12 4v16M4 12h16"/>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7" fill="none">{paths[name]}</svg>;
}

function Wordmark() {
  return <a className="wordmark" href="#inicio" aria-label="TCT$RK, inicio">TCT$RK</a>;
}

function Dialog({ title, close, children, drawer = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    el.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { el.close(); document.body.style.overflow = overflow; };
  }, []);
  return <dialog ref={ref} className={drawer ? 'drawer' : 'dialog'} aria-label={title}
    onCancel={close} onClick={event => {
      if (event.target !== ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
    }}>
    <div className="dialog-heading"><b>{title}</b><button onClick={close} aria-label="Cerrar" className="icon"><Icon name="close"/></button></div>
    {children}
  </dialog>;
}

function ProductDetail({ product, close, add }) {
  const [size, select] = useState(product.sizes.length === 1 ? product.sizes[0] : '');
  return <Dialog title="Detalle de la prenda" close={close}>
    <div className="product-detail"><img src={photo(product)} alt={product.title + ' en ' + product.color}/>
      <div className="detail-info"><span className="eyebrow">{product.category}</span><h2>{product.title}</h2>
        <strong>{money(product.price)} MXN</strong><p>{product.description}</p><p>Color · {product.color}</p>
        <fieldset><legend>Talla</legend><div className="size-options">{product.sizes.map(option =>
          <button type="button" key={option} aria-pressed={option === size} onClick={() => select(option)}>{option}</button>)}</div></fieldset>
        <button className="cta full" disabled={!size} onClick={() => add(product, size)}>{size ? 'Agregar a la bolsa' : 'Selecciona una talla'}</button>
      </div>
    </div>
  </Dialog>;
}

function loadBag() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    if (Array.isArray(parsed)) return parsed.filter(item => item && typeof item.id === 'string' && typeof item.size === 'string' && Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 10);
  } catch {}
  return [];
}

export default function Shop() {
  const [products, setProducts] = useState(seed);
  const [cart, setCart] = useState([]);
  const [ready, setReady] = useState(false);
  const [category, setCategory] = useState('Todo');
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [detail, setDetail] = useState(null);
  const [panel, setPanel] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [catalogError, setCatalogError] = useState(false);
  const searchInput = useRef(null);

  useEffect(() => {
    setCart(loadBag());
    setReady(true);
    fetch('/api/products').then(r => {
      if (!r.ok) throw Error();
      return r.json();
    }).then(setProducts).catch(() => setCatalogError(true));
    const params = new URLSearchParams(location.search);
    if (params.has('carrito')) setPanel('bag');
    const id = params.get('pedido');
    if (!id) return;
    setPanel('order');
    setMessage('Verificando tu pago…');
    fetch('/api/order?id=' + encodeURIComponent(id)).then(r => r.json()).then(data => {
      if (!data.paid) { setMessage('Aún no pudimos confirmar el pago. Vuelve a consultar esta página.'); return; }
      setMessage('Pago confirmado. Gracias por comprar en TCT$RK.');
      if (sessionStorage.getItem(SESSION_KEY) === id) {
        setCart([]);
        sessionStorage.removeItem(SESSION_KEY);
      }
      history.replaceState(null, '', location.pathname);
    }).catch(() => setMessage('No pudimos verificar el pago. Vuelve a consultar esta página.'));
  }, []);
  useEffect(() => {
    if (ready) { try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch {} }
  }, [cart, ready]);

  const featured = products.find(p => p.id === 'hoodie');
  const visible = products.filter(p => (category === 'Todo' || category === p.category)
    && (p.title + ' ' + p.category + ' ' + p.color).toLocaleLowerCase('es').includes(query.trim().toLocaleLowerCase('es')));
  const lines = cart.map(item => ({ ...item, product: products.find(p => p.id === item.id && p.sizes.includes(item.size)) })).filter(item => item.product);
  const count = lines.reduce((sum, item) => sum + item.quantity, 0);
  const total = lines.reduce((sum, item) => sum + item.quantity * item.product.price, 0);

  function adjust(variant, amount) {
    setMessage('');
    setCart(prev => {
      if (!prev.some(item => sameVariant(item, variant))) return amount > 0 ? [...prev, { ...variant, quantity: 1 }] : prev;
      return prev.map(item => sameVariant(item, variant) ? { ...item, quantity: Math.min(10, item.quantity + amount) } : item).filter(item => item.quantity > 0);
    });
  }
  function openBag() { setMessage(''); setPanel('bag'); }
  function add(product, size) { adjust({ id: product.id, size }, 1); setDetail(null); openBag(); }
  function openSearch() {
    setSearching(true);
    requestAnimationFrame(() => { searchInput.current?.focus({ preventScroll: true }); document.getElementById('coleccion')?.scrollIntoView(); });
  }
  async function checkout() {
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: lines.map(({ id, size, quantity }) => ({ id, size, quantity })) }) });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || 'No pudimos iniciar el pago.');
      sessionStorage.setItem(SESSION_KEY, data.id);
      location.assign(data.url);
    } catch (error) { setMessage(error.message); setBusy(false); }
  }

  return <>
    <Head><title>{'TCT$RK · Streetwear | Asfalto'}</title><meta name="description" content="Conoce Asfalto, la colección de streetwear de TCT$RK. Explora las prendas, elige tu talla y arma tu look."/></Head>
    <header id="inicio"><div className="header-inner">
      <Wordmark/><nav aria-label="Navegación principal"><a href="#coleccion">Tienda</a><button onClick={() => setPanel('campaign')}>Campaña</button></nav>
      <div className="actions"><span className="currency">MX / MXN</span><button className="icon" aria-label="Buscar prendas" onClick={openSearch}><Icon name="search"/></button>
        <button className="bag-button" onClick={openBag}><Icon name="bag"/><span>Bolsa ({count})</span></button></div>
    </div></header>
    <main>
      <section className="hero" aria-label="Campaña Asfalto"><img className="campaign-photo" src="/shop/campaign.jpg" alt="Modelo de espaldas con la sudadera TCT$RK bajo un puente de concreto" fetchPriority="high"/><div className="hero-shade"/>
        <div className="hero-copy"><div className="hero-label"><i/> DROP 001</div><h1>ASFALTO</h1>
          <p>Streetwear de siluetas amplias y tonos de concreto.</p><a className="cta hero-cta" href="#coleccion">Explorar colección</a></div>
        {featured && <button className="photo-link" onClick={() => setDetail(featured)}><span className="target"><Icon name="plus" size={16}/></span> Hoodie Sombra</button>}
      </section>
      <section className="collection" id="coleccion">
        <div className="catalog-heading"><h2>LA COLECCIÓN</h2><span className="piece-count">{String(visible.length).padStart(2, '0')} PIEZAS</span></div>
        <div className="toolbar"><div className="filters" aria-label="Categorías">{['Todo', ...new Set(products.map(p => p.category))].map(c => <button key={c} aria-pressed={category === c} onClick={() => setCategory(c)}>{c}</button>)}</div>
          {searching && <div className="searchbox"><input ref={searchInput} type="search" placeholder="Buscar prendas" aria-label="Buscar en la colección" value={query} onChange={e => setQuery(e.target.value)}/><button className="icon" onClick={() => { setQuery(''); setSearching(false); }} aria-label="Cerrar búsqueda"><Icon name="close" size={16}/></button></div>}
        </div>
        {catalogError && <p role="alert">No se pudo actualizar el catálogo. Recarga la página para consultar la disponibilidad.</p>}
        <div className="product-grid">{visible.map(p => <article key={p.id}>
          <button className="product-photo" aria-label={'Ver ' + p.title} onClick={() => setDetail(p)}><img src={photo(p)} alt={p.title + ' en ' + p.color}/><span className="quick-add"><Icon name="plus" size={19}/></span></button>
          <div className="product-row"><button onClick={() => setDetail(p)}>{p.title}</button><strong>{money(p.price)}</strong></div><p className="product-color">{p.color}</p>
        </article>)}</div>
        {visible.length === 0 && <p>No encontramos prendas con esos filtros. <button className="underline" onClick={() => { setCategory('Todo'); setQuery(''); }}>Ver toda la colección</button></p>}
      </section>
    </main>
    <footer><Wordmark/><span>Streetwear · México</span><a href="#inicio">Volver arriba</a></footer>

    {detail && <ProductDetail key={detail.id} product={detail} close={() => setDetail(null)} add={add}/>}
    {panel === 'campaign' && <Dialog title="Campaña Asfalto" close={() => setPanel('')}><img className="lookbook" src="/shop/campaign.jpg" alt="Campaña Asfalto, sudadera negra con estampado gráfico en espalda"/><div className="campaign-info"><span className="eyebrow">Drop 001</span><h2>ASFALTO</h2><p>El negro lavado, el blanco gráfico y el verde oliva dan forma al primer drop de TCT$RK.</p><a className="cta" href="#coleccion" onClick={() => setPanel('')}>Ver la colección</a></div></Dialog>}
    {panel === 'bag' && <Dialog drawer title={'Tu bolsa (' + count + ')'} close={() => setPanel('')}>
      {lines.length === 0 ? <div className="empty"><Icon name="bag" size={38}/><h2>Tu bolsa está vacía</h2><a href="#coleccion" className="cta" onClick={() => setPanel('')}>Explorar colección</a></div> : <>
        <div className="bag-lines">{lines.map(({ product, id, size, quantity }) => <div className="bag-line" key={JSON.stringify([id, size])}>
          <img src={photo(product)} alt={product.title}/><div><b>{product.title}</b><p>{product.color} · Talla {size}</p><div className="qty">
            <button disabled={busy} aria-label={'Quitar una unidad de ' + product.title + ', talla ' + size} onClick={() => adjust({ id, size }, -1)}>−</button><span>{quantity}</span>
            <button disabled={busy || quantity >= 10} aria-label={'Añadir una unidad de ' + product.title + ', talla ' + size} onClick={() => adjust({ id, size }, 1)}>+</button></div></div><strong>{money(product.price * quantity)}</strong>
        </div>)}</div><div className="checkout"><div><b>Total</b><strong>{money(total)} MXN</strong></div>
          <button className="cta full" disabled={busy || catalogError} onClick={checkout}>{busy ? 'Abriendo Stripe…' : 'Continuar al pago'}</button>
          <small>Pago con Stripe · Envíos a México</small>{message && <p role="alert">{message}</p>}</div>
      </>}
    </Dialog>}
    {panel === 'order' && <Dialog title="Estado del pedido" close={() => setPanel('')}><p className="order-status" role="status">{message}</p></Dialog>}
  </>;
}
