import { createContext, useContext, type AnchorHTMLAttributes, type MouseEvent } from 'react';

export const NavigationContext = createContext<(href: string) => void>(() => {});

export default function RouteLink({ href = '/', onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const navigate = useContext(NavigationContext);
  function follow(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || props.target || props.download) return;
    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin || !['/', '/gli-algoritmi', '/come-funziona'].includes(url.pathname)) return;
    event.preventDefault();
    navigate(url.pathname + url.search + url.hash);
  }
  return <a {...props} href={href} onClick={follow} />;
}
