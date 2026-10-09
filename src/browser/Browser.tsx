// Browser: View results in the Object Explorer opens the set here, listed down the left the way Gotham's Browser lists
// results (the G-Cloud 14 service definition, page 6). Each row is the title, the type and the first two properties it
// has a value for. A click opens that object's profile beside the list (?object=<key> in the address bar). Any other
// view opens a profile on its own with ?object=<Type>:<key> and no exploration: full width, with a Back that goes back
// in history. The menu bar names the open object.
import { AnchorButton, Button, Callout, H5, NonIdealState, Spinner } from '@blueprintjs/core';
import { ArrowLeft } from '@blueprintjs/icons';
import { Fragment, type MouseEvent, type ReactElement } from 'react';
import { useCatalog, useCount, useRows, type Catalog, type CatalogType, type Exploration, type Row } from '../data/index.ts';
import { openExploration, useOpenExploration } from '../explorer/exploration';
import { BrokenLink, Connecting, CountText, EngineDown } from '../explorer/parts';
import { showValue } from '../explorer/steps';
import { findView, paletteVar } from '../shell/nav';
import { navigate, OBJECT_PARAM, useSearchParam, viewHref } from '../shell/route';
import { Profile } from './Profile';

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

/** `?object=` as an object: `Type:key` names its type; a bare key is one of the list's type. Null when neither. */
function pickedObject(catalog: Catalog, value: string | null, listType: string | null): { type: string; pk: string } | null {
  if (!value) return null;
  const colon = value.indexOf(':');
  if (colon > 0 && catalog.types[value.slice(0, colon)]) return { type: value.slice(0, colon), pk: value.slice(colon + 1) };
  return listType ? { type: listType, pk: value } : null;
}

function BrowserScreen({ catalog, investigation }: { catalog: Catalog; investigation: string }) {
  const open = useOpenExploration(catalog);
  const value = useSearchParam(OBJECT_PARAM);
  const picked = pickedObject(catalog, value, open.kind === 'ok' ? open.type : null);
  if (open.kind === 'broken') return <BrokenLink investigation={investigation} />;
  if (open.kind === 'none') {
    // Opened on its own from another view; a value that names no type still gets the not-found state.
    if (value) {
      const ref = picked ?? { type: '', pk: value };
      return (
        <div className="profile-solo">
          <Profile key={`${ref.type}:${ref.pk}`} catalog={catalog} type={ref.type} pk={ref.pk} investigation={investigation} onBack={() => window.history.back()} />
        </div>
      );
    }
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
      <ResultList def={def} exp={open.exp} back={back} picked={picked && picked.type === open.type ? picked.pk : null} />
      {picked ? (
        <Profile key={`${picked.type}:${picked.pk}`} catalog={catalog} type={picked.type} pk={picked.pk} investigation={investigation} />
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
