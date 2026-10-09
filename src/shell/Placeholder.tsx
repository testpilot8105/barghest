// What a view shows until it is built: its icon in its own colour and its name.
import { NonIdealState } from '@blueprintjs/core';
import type { ViewDef } from './nav';
import { paletteVar } from './nav';

export function Placeholder({ view }: { view: ViewDef }) {
  return (
    <div className="view-panel">
      <NonIdealState icon={<view.Icon size={48} color={paletteVar(view.color)} />} title={view.label} description="Placeholder. The view lands here." />
    </div>
  );
}
