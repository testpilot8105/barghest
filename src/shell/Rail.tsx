// The rail: the expand toggle on top, one entry per view, the engine status at the foot (the owner's Figma version,
// 09.10.2026). Icon only and narrow by default so the main screen keeps the width; expanded, each entry shows its
// label. Every entry always carries its label, pinned beside an icon that never moves; shell.css fades the labels
// with the rail's width, so icons and text open and close as one. Each view's icon wears its own colour, unchanged
// when the view is open; the open view's highlight is Blueprint's own grey. Collapsed tooltips go through
// renderTarget, never a wrapping <Tooltip>, whose span breaks the column layout: the target's props are spread first
// and the className merged last, so the entry keeps its own classes.
import { AnchorButton, Button, Tooltip, type TooltipProps } from '@blueprintjs/core';
import { DoubleChevronLeft, DoubleChevronRight, Dot } from '@blueprintjs/icons';
import type { MouseEvent, Ref } from 'react';
import { CHROME_ICON, VIEWS, paletteVar } from './nav';
import { navigate, viewHref } from './route';

const ICON = 18;

interface RailProps {
  investigation: string;
  view: string;
  expanded: boolean;
  onToggle: () => void;
}

export function Rail({ investigation, view, expanded, onToggle }: RailProps) {
  return (
    <nav className="rail" aria-label="Views">
      <div className="rail__top">
        <RailTip label={expanded ? 'Collapse' : 'Expand'} expanded={expanded}>
          {({ isOpen: _isOpen, ref, ...target }) => (
            <Button
              {...target}
              ref={ref as Ref<HTMLButtonElement>}
              onClick={onToggle}
              variant="minimal"
              alignText="start"
              aria-expanded={expanded}
              aria-label={expanded ? 'Collapse' : 'Expand'}
              icon={expanded ? <DoubleChevronLeft size={ICON} color={CHROME_ICON} /> : <DoubleChevronRight size={ICON} color={CHROME_ICON} />}
              text={expanded ? 'Collapse' : 'Expand'}
              className={join(target.className, 'rail__entry')}
            />
          )}
        </RailTip>
      </div>

      <div className="rail__views">
        {VIEWS.map((v) => {
          const href = viewHref(investigation, v.slug);
          const active = v.slug === view;
          const follow = (e: MouseEvent<HTMLElement>) => {
            if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            e.preventDefault();
            navigate(href);
          };
          return (
            <RailTip key={v.slug} label={v.label} expanded={expanded}>
              {({ isOpen: _isOpen, ref, ...target }) => (
                <AnchorButton
                  {...target}
                  ref={ref as Ref<HTMLAnchorElement>}
                  href={href}
                  role="link"
                  onClick={follow}
                  variant="minimal"
                  alignText="start"
                  active={active}
                  aria-current={active ? 'page' : undefined}
                  aria-label={v.label}
                  icon={<v.Icon size={ICON} color={paletteVar(v.color)} />}
                  text={v.label}
                  className={join(target.className, 'rail__entry')}
                />
              )}
            </RailTip>
          );
        })}
      </div>

      <div className="rail__foot">
        {/* Placeholder: wired to GET /barghest/health once the engine serves it (P5). */}
        <RailTip label="Engine status (placeholder)" expanded={expanded}>
          {({ isOpen: _isOpen, ref, ...target }) => (
            <Button
              {...target}
              ref={ref as Ref<HTMLButtonElement>}
              variant="minimal"
              alignText="start"
              aria-label="Engine status"
              icon={<Dot size={ICON} color="var(--bp-palette-gray-3)" />}
              text="Engine"
              className={join(target.className, 'rail__entry')}
            />
          )}
        </RailTip>
      </div>
    </nav>
  );
}

function RailTip({ label, expanded, children }: { label: string; expanded: boolean; children: TooltipProps['renderTarget'] }) {
  return <Tooltip content={label} placement="right" disabled={expanded} renderTarget={children} />;
}

function join(...names: (string | undefined)[]): string {
  return names.filter(Boolean).join(' ');
}
