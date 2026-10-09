import { createContext, useContext, type AnchorHTMLAttributes, type MouseEvent } from 'react';
import { fromBasePath, isAppRoute, withBasePath } from '../navigation/paths';

export const NavigationContext = createContext<(href: string) => void>(() => {});

export default function RouteLink({ href = '/', onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const navigate = useContext(NavigationContext);
  const resolvedHref = withBasePath(href);
  function follow(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || props.target || (props.download != null && props.download !== false)) return;
    const url = new URL(resolvedHref, window.location.href);
    if (url.origin !== window.location.origin) return;
    const appHref = fromBasePath(url.pathname + url.search + url.hash);
    if (appHref === null || !isAppRoute(appHref)) return;
    event.preventDefault();
    navigate(appHref);
  }
  return <a {...props} href={resolvedHref} onClick={follow} />;
}
