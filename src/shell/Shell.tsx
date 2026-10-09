// The frame every view sits in, after the owner's Gotham reference and the owner's Figma version (09.10.2026): a narrow
// rail down the left, two short dark bars across the top (the app bar with the BARGHEST mark, name and search, then
// the menu bar with the document title), and the main screen taking everything else. Only main scrolls; the document
// never does.
import { Button, InputGroup, Navbar, NavbarGroup, NonIdealState, Tooltip } from '@blueprintjs/core';
import { Refresh, Search } from '@blueprintjs/icons';
import { useState } from 'react';
import { Browser } from '../browser/Browser';
import { Explorer } from '../explorer/Explorer';
import { CHROME_ICON, DEFAULT_VIEW, findView, paletteVar, type ViewDef } from './nav';
import { Rail } from './Rail';
import { navigate, parseRoute, usePath, viewHref } from './route';
import { TitleContext } from './title';

// The dog, from the brand kit's barghest-mark-white.svg (viewBox 0 0 100 100; the dog spans 15 to 86 by 9 to 91).
const MARK_PATH = 'M15 91L15 41L29 9L41 29L55 33L86 45V58L57 64L47 91Z M43 38L61 43L46 47Z';

// Only the menus the engine can back (owner, 09.10.2026; checked against engine/server.mjs): File imports a document
// or re-runs extraction; Investigation switches scenario, runs resolution and indexes passages. Edit, View, Window and
// Help had nothing behind them and were removed. Each opens its menu when the view that uses it lands.
const MENUS = ['File', 'Investigation'];

export function Shell() {
  const { investigation, view: slug } = parseRoute(usePath());
  const view = findView(slug);
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState<string | null>(null);

  return (
    <div className="app-shell" data-rail={expanded ? 'expanded' : 'collapsed'}>
      <Rail investigation={investigation} view={slug} expanded={expanded} onToggle={() => setExpanded((x) => !x)} />

      <Navbar className="appbar">
        <NavbarGroup align="start">
          {/* The brand kit's mark, drawn inline and cropped to the dog, then the name as D-DIN text. */}
          <div className="appbar__brand">
            <svg className="appbar__mark" viewBox="15 9 71 82" aria-hidden="true">
              <path fill="currentColor" fillRule="evenodd" d={MARK_PATH} />
            </svg>
            <span className="appbar__wordmark">BARGHEST</span>
          </div>
          <InputGroup className="appbar__search" leftIcon={<Search color={CHROME_ICON} />} placeholder="Search" aria-label="Search" />
        </NavbarGroup>
      </Navbar>

      <div className="menubar">
        <div className="menubar__menus">
          {MENUS.map((m) => (
            <Button key={m} variant="minimal" text={m} />
          ))}
        </div>
        <div className="menubar__title">
          {view && <view.Icon color={paletteVar(view.color)} />}
          <span>{view ? (title ?? view.untitled) : 'Not found'}</span>
        </div>
        <div className="menubar__end">
          <Tooltip content="Refresh (placeholder)" placement="bottom">
            <Button variant="minimal" icon={<Refresh color={CHROME_ICON} />} aria-label="Refresh" />
          </Tooltip>
        </div>
      </div>

      <main className="app-shell__main">
        <TitleContext.Provider value={setTitle}>
          {!view ? (
            <NotFound investigation={investigation} />
          ) : view.slug === 'explorer' ? (
            <Explorer investigation={investigation} />
          ) : view.slug === 'browser' ? (
            <Browser investigation={investigation} />
          ) : (
            <Placeholder view={view} />
          )}
        </TitleContext.Provider>
      </main>
    </div>
  );
}

function Placeholder({ view }: { view: ViewDef }) {
  return (
    <div className="view-panel">
      <NonIdealState
        icon={<view.Icon size={48} color={paletteVar(view.color)} />}
        title={view.label}
        description="Placeholder. The view lands here."
      />
    </div>
  );
}

function NotFound({ investigation }: { investigation: string }) {
  const home = viewHref(investigation, DEFAULT_VIEW);
  return (
    <div className="view-panel">
      <NonIdealState
        title="No such view"
        action={<Button text="Open Object Explorer" onClick={() => navigate(home)} />}
      />
    </div>
  );
}
