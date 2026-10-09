// The menu bar names the open document. A view that has one (Browser, with an object open) names it here; otherwise
// the menu bar shows the view's `untitled` name from nav.ts.
import { createContext, useContext, useEffect } from 'react';

export const TitleContext = createContext<(title: string | null) => void>(() => {});

/** Name the open document in the menu bar while this component is on screen; null keeps the view's own name. */
export function useDocumentTitle(title: string | null): void {
  const set = useContext(TitleContext);
  useEffect(() => {
    set(title);
    return () => set(null);
  }, [set, title]);
}
