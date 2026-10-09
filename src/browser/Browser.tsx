// Browser, as far as S1 takes it: View results in the Object Explorer opens the set here, listed down the left the way
// Gotham's Browser lists results (the G-Cloud 14 service definition, page 6). Each row is the title, the type and the
// first two properties it has a value for. A click opens that object beside the list (?object= in the address bar):
// its title, its type and every property it has a value for, and the menu bar names it. Links, relationships and
// evidence join it with S2.
import { AnchorButton, Button, Callout, H4, H5, H6, NonIdealState, Spinner } from '@blueprintjs/core';
import { ArrowLeft } from '@blueprintjs/icons';
import { Fragment, type MouseEvent, type ReactElement } from 'react';
import { useCatalog, useCount, useObjectView, useRows, type Catalog, type CatalogType, type Exploration, type Row } from '../data/index.ts';
import { openExploration, useOpenExploration } from '../explorer/exploration';
import { BrokenLink, Connecting, CountText, EngineDown } from '../explorer/parts';
import { showValue } from '../explorer/steps';
import { findView, paletteVar } from '../shell/nav';
import { navigate, OBJECT_PARAM, useSearchParam, viewHref } from '../shell/route';
import { useDocumentTitle } from '../shell/title';

export function Browser({ investigation }: { investigation: string }) {
  const { data: catalog, error } = useCatalog();
  if (error) return <EngineDown />;
  if (!catalog) return <Connecting />;
  return <BrowserScreen catalog={catalog} investigation={investigation} />;
}

/** Open an object beside the list. Replaces the address, so Back still returns to the exploration. */
function openObject(pk: string) {
  const params = new URLSearchParams(window.location.search);
  params.set(OBJECT_PARAM, pk);
  navigate(`${window.location.pathname}?${params}`, { replace: true });
}

function BrowserScreen({ catalog, investigation }: { catalog: Catalog; investigation: string }) {
  const open = useOpenExploration(catalog);
  const picked = useSearchParam(OBJECT_PARAM);
  if (open.kind === 'broken') return <BrokenLink investigation={investigation} />;
  if (open.kind === 'none') {
    return (
      <div className="view-panel">
        <NoObject description="Open a set from the Object Explorer with View results." action={<Button text="Open Object Explorer" onClick={() => openExploration(investigation, 'explorer', null)} />} />
      </div>
    );
  }
  const def = catalog.types[open.type];
  const back = viewHref(investigation, 'explorer', open.encoded);
  return (
    <div className="browser">
      <ResultList def={def} exp={open.exp} back={back} picked={picked} />
      {picked ? (
        <Profile key={picked} def={def} pk={picked} />
      ) : (
        <div className="view-panel">
          <NoObject description="Click an object in the list to open it here." />
        </div>
      )}
    </div>
  );
}

function NoObject({ description, action }: { description: string; action?: ReactElement }) {
  const view = findView('browser');
  return <NonIdealState icon={view && <view.Icon size={48} color={paletteVar(view.color)} />} title="No object open" description={description} action={action} />;
}

/** The properties a row or profile shows: visible, with a value, and (with `skip`) not the ones named. */
function shown(def: CatalogType, values: (apiName: string) => unknown, skip: string[] = []) {
  return def.properties.filter((p) => !p.hidden && !skip.includes(p.apiName) && showValue(values(p.apiName)) !== '');
}

/** The first two properties a row has a value for, past its title and key. */
function preview(def: CatalogType, row: Row) {
  return shown(def, (n) => row.properties[n], [def.titleProperty, def.primaryKey]).slice(0, 2);
}

function ResultList({ def, exp, back, picked }: { def: CatalogType; exp: Exploration; back: string; picked: string | null }) {
  const rows = useRows(exp);
  const count = useCount(exp);
  const follow = (e: MouseEvent<HTMLElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(back);
  };
  const list = rows.data ?? [];
  return (
    <section className="view-panel result-list" aria-label="Results">
      <header className="result-list__head">
        {/* In capitals, so D-DIN Bold like every all-caps heading (the owner's Figma edit, 09.10.2026). */}
        <AnchorButton className="caps-heading" variant="minimal" icon={<ArrowLeft />} text="Back to exploration" href={back} role="link" onClick={follow} />
        <div className="result-list__title">
          <H5>{def.pluralDisplayName}</H5>
          <span className="bp6-text-muted">
            Showing {list.length} of <CountText state={count} />
          </span>
        </div>
      </header>
      <div className="result-list__items">
        {rows.error ? (
          <Callout intent="danger" compact>
            {rows.error.message}
          </Callout>
        ) : (
          list.map((row) => {
            const open = row.pk === picked;
            // The open row wears the same blue outline as a picked bar in the Object Explorer.
            return (
              <div key={row.pk} className="result-item">
                <Button
                  className="result-item__open"
                  variant={open ? 'outlined' : 'minimal'}
                  intent={open ? 'primary' : 'none'}
                  alignText="start"
                  fill
                  aria-pressed={open}
                  onClick={() => openObject(row.pk)}
                  text={
                    <span className="result-item__cells">
                      <strong>{row.title}</strong>
                      <span className="bp6-text-muted">{def.displayName}</span>
                      <span className="result-item__props">
                        {preview(def, row).map((p) => (
                          <Fragment key={p.apiName}>
                            <span className="bp6-text-muted">{p.displayName}</span>
                            <span>{showValue(row.properties[p.apiName])}</span>
                          </Fragment>
                        ))}
                      </span>
                    </span>
                  }
                />
              </div>
            );
          })
        )}
        {rows.loading && <Spinner size={20} className="result-list__spinner" />}
        {!rows.loading && !rows.error && !list.length && <NonIdealState description="Nothing in this set." />}
        {rows.hasMore && !rows.loading && <Button variant="minimal" fill text="Load more" onClick={rows.loadMore} />}
      </div>
    </section>
  );
}

/** The open object: its title and type, then every property it has a value for. */
function Profile({ def, pk }: { def: CatalogType; pk: string }) {
  const view = useObjectView(def.apiName, pk);
  useDocumentTitle(view.data?.title ?? null);
  const values = new Map(view.data?.properties.map((p) => [p.apiName, p.value]));
  return (
    <section className="view-panel profile" aria-label="Profile">
      {view.error ? (
        <Callout intent="danger" compact>
          {view.error.message}
        </Callout>
      ) : !view.data ? (
        <Spinner size={20} className="result-list__spinner" />
      ) : (
        <>
          <header className="profile__head">
            <H4>{view.data.title}</H4>
            <span className="bp6-text-muted">{def.displayName}</span>
          </header>
          <div className="profile__body">
            <H6 className="caps-heading bp6-text-muted">Properties</H6>
            <dl className="profile__props">
              {shown(def, (n) => values.get(n)).map((p) => (
                <Fragment key={p.apiName}>
                  <dt className="bp6-text-muted">{p.displayName}</dt>
                  <dd>{showValue(values.get(p.apiName))}</dd>
                </Fragment>
              ))}
            </dl>
          </div>
        </>
      )}
    </section>
  );
}
