// The dock down the right of the Object Explorer: what the set is and how much of everything it holds ("11 of 41
// objects"), its filter path as one card per step (the sentence, then how many objects went in and came out,
// "41 > 10"), and Results with View results, which opens the set in Browser. Removing a card goes back to the set without it, as a new history entry.
import { AnchorButton, Button, Card, H5, H6, Tooltip } from '@blueprintjs/core';
import { CaretDown, Database, FilterKeep, Refresh, SearchAround, SearchTemplate, SmallCross } from '@blueprintjs/icons';
import type { MouseEvent, ReactElement } from 'react';
import { encodeExploration, useCount, type Catalog, type Exploration } from '../data/index.ts';
import { findView, paletteVar } from '../shell/nav';
import { navigate, viewHref } from '../shell/route';
import { openExploration, prefix, withoutStep, type OpenExploration } from './exploration';
import { CountText, formatCount, Sentence } from './parts';
import { setName, startPhrase, stepPhrase, type Phrase } from './steps';

interface FilterPathProps {
  catalog: Catalog;
  open: OpenExploration;
  investigation: string;
  /** every object in the investigation, the start card's "before" */
  total: number | null;
  onRefresh: () => void;
}

export function FilterPath({ catalog, open, investigation, total, onRefresh }: FilterPathProps) {
  const exp = open.kind === 'ok' ? open.exp : null;
  const view = findView('explorer');
  const go = (next: Exploration | null) => openExploration(investigation, 'explorer', next);

  return (
    <aside className="dock" aria-label="Filter path">
      <div className="dock__intro">
        <span className="dock__name">
          {view && <SearchTemplate color={paletteVar(view.color)} />}
          <H5>{setName(catalog, exp)}</H5>
        </span>
        <span className="bp6-text-muted">{exp ? <SetShare exp={exp} total={total} /> : <>{total == null ? '' : formatCount(total)} objects</>}</span>
      </div>

      <div className="dock__section">
        <div className="dock__path-head">
          <H6>Filter path</H6>
          <Button variant="outlined" text="Clear all" disabled={!exp} onClick={() => go(null)} />
        </div>

        {exp ? (
          <ol className="dock__path">
            <StepCard
              icon={<FilterKeep />}
              phrase={startPhrase(catalog, exp.start)}
              before={<>{total == null ? '' : formatCount(total)}</>}
              after={prefix(exp, 0)}
              removeLabel="Remove this type and clear the path"
              onRemove={() => go(null)}
            />
            {exp.steps.map((step, i) => (
              <StepCard
                key={i}
                icon={'pivot' in step ? <SearchAround /> : <FilterKeep />}
                phrase={stepPhrase(catalog, exp, i)}
                before={<StepCount exp={prefix(exp, i)} />}
                after={prefix(exp, i + 1)}
                removeLabel={'pivot' in step ? 'Remove this search around and every step after it' : 'Remove this filter'}
                onRemove={() => go(withoutStep(exp, i))}
              />
            ))}
          </ol>
        ) : (
          <p className="bp6-text-muted">Click a type to start.</p>
        )}
      </div>

      {exp && open.kind === 'ok' && <Results exp={exp} href={viewHref(investigation, 'browser', encodeExploration(exp))} onRefresh={onRefresh} />}
    </aside>
  );
}

/** "11 of 41 objects": the set against everything in the investigation. */
function SetShare({ exp, total }: { exp: Exploration; total: number | null }) {
  return (
    <>
      <CountText state={useCount(exp)} /> of {total == null ? '' : formatCount(total)} objects
    </>
  );
}

function StepCount({ exp }: { exp: Exploration }) {
  return <CountText state={useCount(exp)} />;
}

interface StepCardProps {
  icon: ReactElement;
  phrase: Phrase;
  before: ReactElement;
  after: Exploration;
  removeLabel: string;
  onRemove: () => void;
}

function StepCard({ icon, phrase, before, after, removeLabel, onRemove }: StepCardProps) {
  const out = useCount(after);
  return (
    <li className="dock__step">
      <Card compact>
        <div className="dock__step-head">
          {icon}
          <span className="dock__step-text">
            <Sentence phrase={phrase} />
          </span>
          <Button variant="minimal" size="small" icon={<SmallCross />} aria-label={removeLabel} onClick={onRemove} />
        </div>
        <div className="dock__step-counts">
          <span className="bp6-text-muted">Objects</span>
          <span>
            {before} &gt; <CountText state={out} />
          </span>
        </div>
      </Card>
      <CaretDown className="dock__connector" color="var(--bp-palette-gray-3)" aria-hidden="true" />
    </li>
  );
}

function Results({ exp, href, onRefresh }: { exp: Exploration; href: string; onRefresh: () => void }) {
  const count = useCount(exp);
  const follow = (e: MouseEvent<HTMLElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(href);
  };
  return (
    <div className="dock__results">
      <div className="dock__results-head">
        <span className="dock__name">
          <Database />
          <H6>Results</H6>
        </span>
        <Tooltip content="Count again" placement="left">
          <Button variant="minimal" icon={<Refresh />} aria-label="Count again" onClick={onRefresh} />
        </Tooltip>
      </div>
      <div className="dock__results-row">
        <AnchorButton variant="outlined" text="View results" href={href} role="link" onClick={follow} />
        <span>
          <CountText state={count} />
        </span>
      </div>
    </div>
  );
}
