// The Graph's toolbar, after Gotham's (G-Cloud 14 service definition, page 12), cut to what the canvas can do without
// styling or annotation storage: Layout, Select, Search around on the selection, and when links show their names.
import { Button, Menu, MenuDivider, MenuItem, Popover } from '@blueprintjs/core';
import { CaretDown, Label, LayoutAuto, LayoutCircle, LayoutGrid, SearchAround, Select, Tick, ZoomToFit } from '@blueprintjs/icons';
import type { ReactElement } from 'react';

export type LabelMode = 'hover' | 'always' | 'never';

const LABEL_WORDS: Record<LabelMode, string> = { hover: 'on hover', always: 'always', never: 'never' };

function Drop({ icon, text, menu }: { icon: ReactElement; text: string; menu: ReactElement }) {
  return (
    <Popover content={menu} placement="bottom-start" minimal>
      <Button variant="minimal" icon={icon} endIcon={<CaretDown />} text={text} />
    </Popover>
  );
}

interface ToolbarProps {
  onRing: () => void;
  onGrid: () => void;
  onFit: () => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
  onSelectNeighbours: () => void;
  boxSelect: boolean;
  onBoxSelect: () => void;
  /** Search around's items for what is selected */
  searchAround: ReactElement;
  labels: LabelMode;
  onLabels: (m: LabelMode) => void;
  /** the open file's save state, at the far end */
  status?: ReactElement;
}

export function GraphToolbar(p: ToolbarProps) {
  return (
    <div className="graph__toolbar">
      <Drop
        icon={<LayoutAuto />}
        text="Layout"
        menu={
          <Menu className="graph-toolmenu">
            <MenuItem icon={<LayoutCircle />} text="Ring around the focus" onClick={p.onRing} />
            <MenuItem icon={<LayoutGrid />} text="Grid, by type" onClick={p.onGrid} />
            <MenuDivider />
            <MenuItem icon={<ZoomToFit />} text="Fit to screen" onClick={p.onFit} />
          </Menu>
        }
      />
      <Drop
        icon={<Select />}
        text="Select"
        menu={
          <Menu className="graph-toolmenu">
            <MenuItem text="Select all" onClick={p.onSelectAll} />
            <MenuItem text="Select none" onClick={p.onSelectNone} />
            <MenuItem text="Add their neighbours" onClick={p.onSelectNeighbours} />
            <MenuDivider />
            <MenuItem text="Box select (drag on the canvas)" icon={p.boxSelect ? <Tick /> : undefined} onClick={p.onBoxSelect} />
          </Menu>
        }
      />
      <Drop icon={<SearchAround />} text="Search around" menu={<Menu className="graph-toolmenu">{p.searchAround}</Menu>} />
      <span className="graph__toolbar-divider" />
      <Drop
        icon={<Label />}
        text={`Link labels: ${LABEL_WORDS[p.labels]}`}
        menu={
          <Menu className="graph-toolmenu">
            {(['hover', 'always', 'never'] as LabelMode[]).map((m) => (
              <MenuItem key={m} text={LABEL_WORDS[m][0].toUpperCase() + LABEL_WORDS[m].slice(1)} icon={p.labels === m ? <Tick /> : undefined} onClick={() => p.onLabels(m)} />
            ))}
          </Menu>
        }
      />
      {p.status && (
        <>
          <span className="graph__toolbar-spacer" />
          {p.status}
        </>
      )}
    </div>
  );
}
