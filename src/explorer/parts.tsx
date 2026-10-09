// Small pieces the Object Explorer and Browser share: a phrase with its names in bold, a count that shimmers while it
// loads, and the three whole-screen states (connecting, engine not running, broken link). All Blueprint.
import { Button, Classes, NonIdealState, Spinner } from '@blueprintjs/core';
import { Error as ErrorIcon, Offline } from '@blueprintjs/icons';
import type { AsyncState } from '../data/index.ts';
import { navigate, viewHref } from '../shell/route';
import type { Phrase } from './steps';

export function Sentence({ phrase }: { phrase: Phrase }) {
  return (
    <>
      {phrase.map((part, i) => (typeof part === 'string' ? part : <strong key={i}>{part.strong}</strong>))}
    </>
  );
}

export function formatCount(n: number): string {
  return n.toLocaleString('en-US');
}

/** A count from a read, with its noun when given ("1 object", "11 objects"): a skeleton while it loads, a question
 * mark if the read failed. */
export function CountText({ state, noun }: { state: Pick<AsyncState<number>, 'data' | 'loading' | 'error'>; noun?: string }) {
  const unit = (n: number) => (noun ? ` ${noun}${n === 1 ? '' : 's'}` : '');
  if (state.data != null) return <>{formatCount(state.data) + unit(state.data)}</>;
  if (state.error) return <>?</>;
  return <span className={Classes.SKELETON}>{'00' + unit(0)}</span>;
}

export function Connecting() {
  return (
    <div className="view-panel">
      <NonIdealState icon={<Spinner size={48} />} title="Connecting to the engine" />
    </div>
  );
}

export function EngineDown() {
  return (
    <div className="view-panel">
      <NonIdealState
        icon={<Offline size={48} />}
        title="The engine isn't running"
        description="BARGHEST reads everything from its engine on this machine. Start it, then try again."
        action={<Button text="Try again" onClick={() => window.location.reload()} />}
      />
    </div>
  );
}

export function BrokenLink({ investigation }: { investigation: string }) {
  return (
    <div className="view-panel">
      <NonIdealState
        icon={<ErrorIcon size={48} />}
        title="This exploration link is broken"
        description="It names a type, link or property this investigation doesn't have."
        action={<Button text="Start a new exploration" onClick={() => navigate(viewHref(investigation, 'explorer'))} />}
      />
    </div>
  );
}
