// The frame every view sits in, after the owner's Gotham reference and the owner's Figma version (09.10.2026): a narrow
// rail down the left, two short dark bars across the top (the app bar with the BARGHEST mark, name and search, then
// the menu bar with the document title), and the main screen taking everything else. Only main scrolls; the document
// never does.
import { Button, InputGroup, Intent, Menu, MenuDivider, MenuItem, Navbar, NavbarGroup, NonIdealState, Popover, Tooltip } from '@blueprintjs/core';
import { Blank, Refresh, Search, Tick } from '@blueprintjs/icons';
import { useEffect, useState, type ComponentType } from 'react';
import { Assistant } from '../assistant/Assistant';
import { Browser } from '../browser/Browser';
import { Explorer } from '../explorer/Explorer';
import { EngineError } from '../data/index.ts';
import { Connecting, EngineDown } from '../explorer/parts';
import { Files } from '../files/Files';
import { Graph } from '../graph/Graph';
import { DataSources } from '../sources/DataSources';
import { Timeline } from '../timeline/Timeline';
import { InvestigationsProvider, useInvestigationList } from './investigations';
import { CHROME_ICON, DEFAULT_VIEW, findView, paletteVar } from './nav';
import { Placeholder } from './Placeholder';
import { Rail } from './Rail';
import { navigate, parseRoute, usePath, viewHref } from './route';
import { TitleContext } from './title';

// The dog, from the brand kit's barghest-mark-white.svg (viewBox 0 0 100 100; the dog spans 15 to 86 by 9 to 91).
const MARK_PATH = 'M15 91L15 41L29 9L41 29L55 33L86 45V58L57 64L47 91Z M43 38L61 43L46 47Z';

// Only the menus the engine can back (owner, 09.10.2026; checked against engine/server.mjs): File imports a document
// or re-runs extraction; Investigation switches investigation, runs resolution and indexes passages. Edit, View,
// Window and Help had nothing behind them and were removed. Each opens its menu when the view that uses it lands.

/** Every view's screen, by its slug. Each view lives in its own folder, so nobody edits this file for their view. */
const SCREENS: Record<string, ComponentType<{ investigation: string }>> = {
  files: Files,
  sources: DataSources,
  explorer: Explorer,
  browser: Browser,
  graph: Graph,
  timeline: Timeline,
  assistant: Assistant,
};

export function Shell() {
  return (
    <InvestigationsProvider>
      <Frame />
    </InvestigationsProvider>
  );
}

function Frame() {
  const route = parseRoute(usePath());
  const { view: slug } = route;
  const view = findView(slug);
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState<string | null>(null);
  const list = useInvestigationList();
  const first = list.data?.investigations[0] ?? null;

  // A bare address opens the first investigation the engine lists, in place, so history never holds the short form.
  useEffect(() => {
    if (!route.investigation && first) navigate(viewHref(first.id, slug) + window.location.search, { replace: true });
  }, [route.investigation, first, slug]);
  const investigation = route.investigation ?? first?.id ?? '';
  const known = !list.data || !!list.find(investigation);
  const Screen = view ? SCREENS[view.slug] : undefined;

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
          <Button variant="minimal" text="File" />
          <InvestigationMenu current={investigation} view={slug} />
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
          {list.error && !list.data ? (
            list.error instanceof EngineError && list.error.status === 404 ? <EngineOutOfDate /> : <EngineDown />
          ) : list.data && !list.data.investigations.length ? (
            <NoInvestigations onNew={list.openNew} />
          ) : !investigation ? (
            <Connecting />
          ) : !known ? (
            <NoSuchInvestigation view={slug} />
          ) : !view ? (
            <NotFound investigation={investigation} />
          ) : Screen ? (
            <Screen investigation={investigation} />
          ) : (
            <Placeholder view={view} />
          )}
        </TitleContext.Provider>
      </main>
    </div>
  );
}

/** Every investigation deleted: say so, and offer the way to start one. */
function NoInvestigations({ onNew }: { onNew: () => void }) {
  return (
    <div className="view-panel">
      <NonIdealState title="No investigations yet" description="Start one, then drop its files into Files." action={<Button intent={Intent.PRIMARY} text="New investigation" onClick={onNew} />} />
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

/** Switch investigation, keeping the view; or start a new one. Names only, never ids. */
function InvestigationMenu({ current, view }: { current: string; view: string }) {
  const { data, openNew } = useInvestigationList();
  const menu = (
    <Menu className="investigation-menu">
      {(data?.investigations ?? []).map((inv) => (
        <MenuItem
          key={inv.id}
          text={inv.name}
          icon={inv.id === current ? <Tick /> : <Blank />}
          onClick={() => navigate(viewHref(inv.id, findView(view) ? view : DEFAULT_VIEW))}
        />
      ))}
      <MenuDivider />
      <MenuItem text="New investigation…" onClick={openNew} />
    </Menu>
  );
  return (
    <Popover content={menu} placement="bottom-start" minimal>
      <Button variant="minimal" text="Investigation" />
    </Popover>
  );
}

function NoSuchInvestigation({ view }: { view: string }) {
  const { data } = useInvestigationList();
  const first = data?.investigations[0];
  return (
    <div className="view-panel">
      <NonIdealState
        title="No such investigation"
        description="This link names an investigation the engine doesn't hold."
        action={first ? <Button text={`Open ${first.name}`} onClick={() => navigate(viewHref(first.id, findView(view) ? view : DEFAULT_VIEW))} /> : undefined}
      />
    </div>
  );
}

/** An engine started before investigations existed answers 404 for them; a restart picks up the current code. */
function EngineOutOfDate() {
  return (
    <div className="view-panel">
      <NonIdealState
        title="The engine needs a restart"
        description="It's running an older version that doesn't know about investigations yet. Restart it, then try again."
        action={<Button text="Try again" onClick={() => window.location.reload()} />}
      />
    </div>
  );
}
