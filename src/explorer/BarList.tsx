// One list of bars, the Object Explorer's only chart: a D-DIN heading in capitals with a search toggle, then a row per
// item (label, an optional second column, count, bar). The value chart shows its search bar outright, in the toggle's
// place on the heading's line (owner, 09.10.2026); every other list keeps the toggle. Rows are Blueprint buttons; a picked row is Blueprint's
// outlined primary button, the blue outline in Gotham's figures. Bars are Blueprint progress bars, hidden from
// screen readers since the count beside them says the same.
import { Button, Callout, Classes, H6, InputGroup, NonIdealState, ProgressBar, Spinner } from '@blueprintjs/core';
import { Search } from '@blueprintjs/icons';
import { useState } from 'react';
import { formatCount } from './parts';

export interface BarItem {
  key: string;
  label: string;
  /** a second column, such as a link's target type */
  detail?: string;
  /** null while the count loads */
  count: number | null;
  /** a row that can't be picked (the "other values" row, or the one type of a set) */
  fixed?: boolean;
}

interface BarListProps {
  heading: string;
  items: BarItem[] | null;
  error?: Error | null;
  /** the count a full bar stands for */
  max: number;
  picked: string[];
  /** `more` is true when Shift, Command or Control was held: add to the pick instead of acting on this row alone */
  onPick?: (key: string, more: boolean) => void;
  /** short: a narrow column (count, short bar); long: label, count, wide bar; links: plus the target type */
  layout: 'short' | 'long' | 'links';
  /** the search bar always showing on the heading's line, instead of the toggle */
  searchBar?: boolean;
  empty: string;
}

export function BarList({ heading, items, error, max, picked, onPick, layout, empty, searchBar }: BarListProps) {
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const shown = items?.filter((i) => !q || i.label.toLowerCase().includes(q) || i.detail?.toLowerCase().includes(q)) ?? null;

  return (
    <div className={`bar-list bar-list--${layout}`}>
      <div className="bar-list__heading">
        <H6 className={`caps-heading ${Classes.TEXT_MUTED}`}>{heading}</H6>
        {searchBar ? (
          <InputGroup className="bar-list__search" leftIcon={<Search />} placeholder="Search" aria-label={`Search ${heading.toLowerCase()}`} value={query} onValueChange={setQuery} />
        ) : (
          <Button
            variant="minimal"
            icon={<Search />}
            active={searching}
            aria-label={`Search ${heading.toLowerCase()}`}
            aria-expanded={searching}
            onClick={() => {
              setSearching((s) => !s);
              setQuery('');
            }}
          />
        )}
      </div>
      {!searchBar && searching && (
        <InputGroup className="bar-list__search" autoFocus placeholder="Search" aria-label={`Search ${heading.toLowerCase()}`} value={query} onValueChange={setQuery} />
      )}
      <div className="bar-list__rows">
        {error ? (
          <Callout intent="danger" compact>
            {error.message}
          </Callout>
        ) : !shown ? (
          <Spinner size={20} className="bar-list__spinner" />
        ) : !shown.length ? (
          <NonIdealState description={q ? 'Nothing matches.' : empty} />
        ) : (
          shown.map((item) => <BarRow key={item.key} item={item} max={max} picked={picked.includes(item.key)} onPick={item.fixed ? undefined : onPick} />)
        )}
      </div>
    </div>
  );
}

function BarRow({ item, max, picked, onPick }: { item: BarItem; max: number; picked: boolean; onPick?: (key: string, more: boolean) => void }) {
  const cells = (
    <span className="bar-row__cells">
      <span className={`bar-row__label${item.count === 0 ? ` ${Classes.TEXT_MUTED}` : ''}`}>{item.label}</span>
      {item.detail != null && <span className={`bar-row__detail ${Classes.TEXT_MUTED}`}>{item.detail}</span>}
      <span className={`bar-row__count ${Classes.TEXT_MUTED}`}>
        {item.count == null ? <span className={Classes.SKELETON}>00</span> : formatCount(item.count)}
      </span>
      <span className="bar-row__bar" aria-hidden="true">
        <ProgressBar value={max > 0 && item.count ? item.count / max : 0} animate={false} stripes={false} intent="primary" />
      </span>
    </span>
  );
  if (!onPick) return <div className="bar-row bar-row--fixed">{cells}</div>;
  return (
    <Button
      className="bar-row"
      variant={picked ? 'outlined' : 'minimal'}
      intent={picked ? 'primary' : 'none'}
      alignText="start"
      fill
      aria-pressed={picked}
      onClick={(e) => onPick(item.key, e.shiftKey || e.metaKey || e.ctrlKey)}
      text={cells}
    />
  );
}
