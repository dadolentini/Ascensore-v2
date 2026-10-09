import { Component, Suspense, lazy, useCallback, useEffect, useRef, useState, type ErrorInfo, type ReactNode } from 'react';
import Landing from './pages/Landing';
import RouteLink, { NavigationContext } from './components/RouteLink';

const Algorithms = lazy(() => import('./pages/Algorithms'));
const HowItWorks = lazy(() => import('./pages/HowItWorks'));

class RouteBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Pagina algoritmi non disponibile', error, info.componentStack); }
  render() { return this.state.failed ? <div className="route-message container" role="alert"><h1>La pagina non è disponibile.</h1><p>Il caricamento dell'approfondimento non è riuscito. La bozza del simulatore è conservata.</p><button className="button" onClick={() => window.location.reload()}>Ricarica la pagina</button><RouteLink className="text-link" href="/#simulatore">Torna al simulatore</RouteLink></div> : this.props.children; }
}

function focusLocation() {
  const target = window.location.hash ? document.getElementById(decodeURIComponent(window.location.hash.slice(1))) : document.querySelector<HTMLElement>('main:not([hidden])');
  if (target && !target.closest('[hidden]')) {
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
    if (window.location.hash) target.scrollIntoView({ block:'start', behavior:'instant' });
    else window.scrollTo({ top:0, behavior:'instant' });
  }
}

export default function App() {
  const [location, setLocation] = useState(() => window.location.pathname + window.location.search + window.location.hash);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const algorithms = location.split(/[?#]/)[0].replace(/\/$/, '') === '/gli-algoritmi';
  const how = location.split(/[?#]/)[0].replace(/\/$/, '') === '/come-funziona';
  const secondary = algorithms || how;
  const navigate = useCallback((href: string) => {
    if (href !== window.location.pathname + window.location.search + window.location.hash) window.history.pushState(null, '', href);
    setLocation(window.location.pathname + window.location.search + window.location.hash);
    setMenuOpen(false);
    window.requestAnimationFrame(focusLocation);
  }, []);

  useEffect(() => {
    const handlePop = () => { setLocation(window.location.pathname + window.location.search + window.location.hash); setMenuOpen(false); window.requestAnimationFrame(focusLocation); };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);
  useEffect(() => {
    document.title = algorithms ? 'Gli algoritmi — Elevator' : how ? 'Come funziona — Elevator' : "Elevator — Il tempo, tra un piano e l'altro";
    if (window.location.hash) window.requestAnimationFrame(focusLocation);
  }, [algorithms, how]);
  useEffect(() => {
    if (!menuOpen) return;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setMenuOpen(false); menuButton.current?.focus(); } };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [menuOpen]);

  return <NavigationContext.Provider value={navigate}>
    <a className="skip-link" href={secondary ? '#information-main' : '#landing-main'}>Vai al contenuto</a>
    <header className="site-header"><div className="header-inner container">
      <RouteLink className="brand" href="/" aria-label="Elevator — Home"><span className="brand-mark" aria-hidden="true"><i/><i/><i/></span><span>Elevator</span></RouteLink>
      <button ref={menuButton} className="menu-toggle" aria-expanded={menuOpen} aria-controls="main-navigation" onClick={()=>setMenuOpen(!menuOpen)}>{menuOpen ? 'Chiudi' : 'Menu'} <span aria-hidden="true">{menuOpen ? '−' : '+'}</span></button>
      <nav id="main-navigation" className={menuOpen ? 'main-nav is-open' : 'main-nav'} aria-label="Navigazione principale">
        <RouteLink href="/come-funziona" aria-current={how ? 'page' : undefined}>Come funziona</RouteLink><RouteLink href="/#simulatore">Simulatore</RouteLink><RouteLink href="/gli-algoritmi" aria-current={algorithms ? 'page' : undefined}>Gli algoritmi</RouteLink><RouteLink className="nav-cta" href="/#simulatore">Configura uno scenario <span aria-hidden="true">↗︎</span></RouteLink>
      </nav>
    </div></header>
    <main id="landing-main" tabIndex={-1} hidden={secondary}><Landing/></main>
    {secondary && <main id="information-main" tabIndex={-1}><RouteBoundary key={algorithms ? 'algorithms' : 'how'}><Suspense fallback={<div className="route-message container" role="status"><p className="eyebrow">{algorithms ? 'Gli algoritmi' : 'Come funziona'}</p><h1>Caricamento dell'approfondimento…</h1></div>}>{algorithms ? <Algorithms onReady={focusLocation}/> : <HowItWorks onReady={focusLocation}/>}</Suspense></RouteBoundary></main>}
    <footer className="site-footer"><div className="container"><div className="footer-top"><RouteLink className="brand" href="/">Elevator</RouteLink><p>La mobilità verticale,<br/>letta attraverso un modello.</p><div><RouteLink className="text-link" href="/gli-algoritmi#fonti">Modello, ipotesi e fonti <span aria-hidden="true">↗︎</span></RouteLink><a className="text-link footer-pdf" href="/model/rapporto_ascensori.pdf" target="_blank" rel="noreferrer">Apri il PDF matematico <span aria-hidden="true">↗︎</span><span className="sr-only"> (nuova scheda)</span></a></div></div><div className="footer-bottom"><p>Scenari sintetici. Uno strumento di studio, non un controllo hardware né una certificazione impiantistica.</p><p>Le immagini sono riferimenti architettonici illustrativi.</p></div></div></footer>
  </NavigationContext.Provider>;
}
