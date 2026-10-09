// Finding an object by its name, for the Graph's "Find objects to add", its first object, Find path to… and the
// Timeline's subject. One search across every type (useSearchAll), the top five of each type, grouped under the
// type's name. Evidence and resolution records never show: they aren't things.
import { Classes, InputGroup, Menu, MenuDivider, MenuItem, Popover, Spinner } from '@blueprintjs/core';
import { Search } from '@blueprintjs/icons';
import { useEffect, useState, type ReactNode } from 'react';
import { useCatalog, useSearchAll } from '../data/index.ts';
import { isGraphType } from './canvas';
import { objectKey, typeIcon } from './icons';

export interface Found {
  key: string;
  type: string;
  pk: string;
  title: string;
}

function useDebounced(value: string, ms = 250): string {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return settled;
}

/** The results for one query, as a menu: a heading per type, a row per object. `first` goes above the search. */
export function SearchResults({ query, onPick, first, firstHeading }: { query: string; onPick: (f: Found) => void; first?: Found[]; firstHeading?: string }) {
  const q = useDebounced(query.trim());
  const { data: catalog } = useCatalog();
  const found = useSearchAll(q);
  const shownFirst = (first ?? []).filter((f) => !query.trim() || f.title.toLowerCase().includes(query.trim().toLowerCase()));
  const groups = catalog && found.data && q ? catalog.order.filter((t) => isGraphType(t) && found.data?.[t]?.top.length) : [];
  const rows: ReactNode[] = [];
  if (shownFirst.length) {
    rows.push(<MenuDivider key="first" title={firstHeading} />);
    for (const f of shownFirst) rows.push(<Row key={`first:${f.key}`} found={f} onPick={onPick} />);
  }
  for (const type of groups) {
    const def = catalog!.types[type];
    rows.push(<MenuDivider key={type} title={def.pluralDisplayName || def.displayName} />);
    for (const t of found.data![type].top) rows.push(<Row key={objectKey(type, t.pk)} found={{ key: objectKey(type, t.pk), type, pk: t.pk, title: t.title }} onPick={onPick} />);
  }
  return (
    <Menu className="graph-search__menu">
      {rows}
      {q && found.loading && <MenuItem disabled text="Searching…" icon={<Spinner size={16} />} />}
      {q && !found.loading && !groups.length && <MenuItem disabled text="Nothing by that name." />}
      {!q && !shownFirst.length && <MenuItem disabled text="Type a name to search." />}
    </Menu>
  );
}

function Row({ found, onPick }: { found: Found; onPick: (f: Found) => void }) {
  const Icon = typeIcon(found.type);
  return <MenuItem icon={<Icon />} text={found.title} onClick={() => onPick(found)} />;
}

/** A search box whose results drop down under it. */
export function SearchBox({ placeholder, onPick, className }: { placeholder: string; onPick: (f: Found) => void; className?: string }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  return (
    <Popover
      className={className}
      isOpen={open && !!query.trim()}
      autoFocus={false}
      enforceFocus={false}
      minimal
      placement="bottom-start"
      onInteraction={(next) => !next && setOpen(false)}
      content={
        <SearchResults
          query={query}
          onPick={(f) => {
            setOpen(false);
            setQuery('');
            onPick(f);
          }}
        />
      }
    >
      <InputGroup
        leftIcon={<Search />}
        placeholder={placeholder}
        aria-label={placeholder}
        value={query}
        onValueChange={(v) => {
          setQuery(v);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        className={Classes.FILL}
      />
    </Popover>
  );
}
