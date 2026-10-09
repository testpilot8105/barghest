// Link to…: search this investigation's objects by name and pick the one a photo shows. Arrow keys move, Enter links
// the highlighted one, Escape closes. An object already linked is greyed with a tick. Only the analyst links a photo;
// the model never looks at one.
import { useEffect, useState, type KeyboardEvent } from 'react';
import { Button, InputGroup, Menu, MenuItem, Popover, Spinner } from '@blueprintjs/core';
import { Link, Search, Tick } from '@blueprintjs/icons';
import { useDataClient } from '../data/index.ts';
import { typeIcon } from '../graph/icons';
import { searchObjects, type ObjectHit } from './reads';
import './photos.css';

export function LinkTo({ investigation, linked, onPick }: { investigation: string; linked: Set<string>; onPick: (hit: ObjectHit) => Promise<void> }) {
  const { dc } = useDataClient();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<ObjectHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [active, setActive] = useState(0);
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    if (!open || !dc) return;
    const text = q.trim();
    if (!text) {
      setHits([]);
      return;
    }
    let live = true;
    setSearching(true);
    const t = window.setTimeout(() => {
      searchObjects(dc, investigation, text)
        .then((found) => {
          if (!live) return;
          setHits(found);
          setActive(Math.max(0, found.findIndex((h) => !linked.has(`${h.type}:${h.pk}`))));
        })
        .finally(() => live && setSearching(false));
    }, 200);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [q, open, dc, investigation]); // eslint-disable-line react-hooks/exhaustive-deps

  async function pick(hit: ObjectHit | undefined) {
    if (!hit || linked.has(`${hit.type}:${hit.pk}`) || linking) return;
    setLinking(true);
    try {
      await onPick(hit);
      setOpen(false);
      setQ('');
    } finally {
      setLinking(false);
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') setActive((a) => Math.min(hits.length - 1, a + 1));
    else if (e.key === 'ArrowUp') setActive((a) => Math.max(0, a - 1));
    else if (e.key === 'Enter') void pick(hits[active]);
    else return;
    e.preventDefault();
  }

  const content = (
    <div className="photo-link-to">
      <InputGroup
        autoFocus
        aria-label="Search this investigation’s objects"
        leftIcon={<Search />}
        rightElement={searching || linking ? <Spinner size={16} /> : undefined}
        placeholder="Search this investigation’s objects"
        value={q}
        onValueChange={setQ}
        onKeyDown={onKeyDown}
      />
      {hits.length > 0 && (
        <Menu className="photo-link-to__results">
          {hits.map((h, i) => {
            const key = `${h.type}:${h.pk}`;
            const done = linked.has(key);
            const Icon = typeIcon(h.type);
            return (
              <MenuItem
                key={key}
                active={i === active && !done}
                disabled={done}
                icon={<Icon />}
                text={h.title}
                labelElement={
                  done ? (
                    <span className="photo-link-to__linked">
                      Linked <Tick />
                    </span>
                  ) : (
                    dc?.catalog.types[h.type]?.displayName ?? h.type
                  )
                }
                onClick={() => void pick(h)}
              />
            );
          })}
        </Menu>
      )}
      {q.trim() && !searching && hits.length === 0 && <p className="bp6-text-muted">Nothing in this investigation by that name.</p>}
      <p className="bp6-text-muted">Enter links the highlighted one. Esc closes.</p>
    </div>
  );

  return (
    <Popover isOpen={open} onInteraction={setOpen} content={content} placement="bottom-start" fill className="photo-link-to__wrap">
      <Button variant="outlined" fill icon={<Link />} text="Link to…" />
    </Popover>
  );
}
