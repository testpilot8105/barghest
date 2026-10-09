// Every view the shell knows, in rail order: one place for the slug in the URL, the label, the icon and the view's own
// colour. The rail and the menu bar title both read from here, so a view looks the same in both. Colours are the
// owner's pick (09.10.2026), "Spectrum, vivid": Blueprint's -4 shades stepping through the hues down the rail. None
// is a core intent colour, which already means success, warning or danger. Files sits on top in rose, the hue before
// vermilion on Blueprint's wheel, so the run carries on unbroken (owner, 09.10.2026).
import type { ComponentType } from 'react';
import { Chat, Database, FolderOpen, Graph, IdNumber, SearchTemplate, TimelineEvents, type SVGIconProps } from '@blueprintjs/icons';

export interface ViewDef {
  slug: string;
  label: string;
  Icon: ComponentType<SVGIconProps>;
  /** a `--bp-palette-*` name, without the prefix */
  color: string;
  /** what the menu bar names the open document until the view has a real one */
  untitled: string;
}

export const VIEWS: readonly ViewDef[] = [
  { slug: 'files', label: 'Files', Icon: FolderOpen, color: 'rose-4', untitled: 'All files' },
  { slug: 'sources', label: 'Data Sources', Icon: Database, color: 'vermilion-4', untitled: 'All documents' },
  { slug: 'explorer', label: 'Object Explorer', Icon: SearchTemplate, color: 'gold-4', untitled: 'All objects' },
  { slug: 'browser', label: 'Browser', Icon: IdNumber, color: 'lime-4', untitled: 'No object open' },
  { slug: 'graph', label: 'Graph', Icon: Graph, color: 'forest-4', untitled: 'New graph' },
  { slug: 'timeline', label: 'Timeline', Icon: TimelineEvents, color: 'turquoise-4', untitled: 'New timeline' },
  { slug: 'assistant', label: 'Assistant', Icon: Chat, color: 'cerulean-4', untitled: 'New conversation' },
];

export const DEFAULT_VIEW = 'explorer';

export function findView(slug: string | undefined): ViewDef | undefined {
  return VIEWS.find((v) => v.slug === slug);
}

export function paletteVar(color: string): string {
  return `var(--bp-palette-${color})`;
}

/** The chrome's own icons (toggle, search, refresh), as a CSS variable defined in shell.css. */
export const CHROME_ICON = 'var(--bh-chrome-icon)';
