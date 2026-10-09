// What the canvas draws, in Gotham's look (G-Cloud 14 service definition, pages 12 and 13): an object is a tile with
// its type's icon and its name underneath; a link is a thin line with an arrow at the far end, its name shown only
// while it's hovered, picked or on a lit path (or always, from the toolbar). Lines run between tile centres and stop
// at the tile's edge. Right-clicking an object opens Gotham's menu, cut to what the engine can do.
import { ContextMenu, Menu, MenuDivider, MenuItem, Spinner } from '@blueprintjs/core';
import { BaseEdge, EdgeLabelRenderer, Handle, Position, useInternalNode, type Edge, type EdgeProps, type InternalNode, type Node, type NodeProps } from '@xyflow/react';
import { createContext, useContext } from 'react';
import type { ObjectView } from '../data/index.ts';
import { PhotoThumb } from '../photos';
import { graphLinks, ICON_BOX, kindText, NODE_W, relationshipsOf, type EdgeModel } from './canvas';
import { typeIcon } from './icons';

export interface ObjectNodeData extends Record<string, unknown> {
  type: string;
  pk: string;
  title: string;
  /** the title is still the key: the view hasn't loaded */
  pending: boolean;
  busy: boolean;
  /** a path is lit and this object isn't on it */
  dim: boolean;
  /** the object's picture (the first photo linked to it), shown in the tile in place of its type icon */
  photoUrl?: string;
}

export type ObjectNodeType = Node<ObjectNodeData, 'object'>;

export interface GraphEdgeData extends Record<string, unknown> {
  model: EdgeModel;
  dim: boolean;
  lit: boolean;
  picked: boolean;
  /** the name on the line: hovered, picked, lit, or the toolbar says always */
  showLabel: boolean;
}

export type GraphEdgeType = Edge<GraphEdgeData, 'graph'>;

/** What a node's menu can do; the screen provides it. `only` narrows Search around to one link or one kind. */
export interface GraphActions {
  view: (key: string) => ObjectView | undefined;
  expand: (key: string, only?: { link?: string; kind?: string }) => void;
  remove: (key: string) => void;
  findPath: (key: string) => void;
  openProfile: (key: string) => void;
}

export const GraphActionsContext = createContext<GraphActions | null>(null);

export function ObjectNode({ id, data, selected }: NodeProps<ObjectNodeType>) {
  const actions = useContext(GraphActionsContext);
  const Icon = typeIcon(data.type);
  const classes = ['graph-node', selected && 'graph-node--picked', data.dim && 'graph-node--dim'].filter(Boolean).join(' ');
  return (
    <ContextMenu content={actions ? <NodeMenu id={id} actions={actions} /> : <Menu />} className={classes}>
      {/* Edges need a handle at each end; they are hidden, since lines run between tile centres. */}
      <Handle type="target" position={Position.Top} className="graph-node__handle" isConnectable={false} />
      <div className={`graph-node__tile${data.photoUrl && !data.busy ? ' graph-node__tile--photo' : ''}`}>{data.busy ? <Spinner size={18} /> : data.photoUrl ? <PhotoThumb url={data.photoUrl} name="photo.jpg" size={38} /> : <Icon size={20} />}</div>
      <div className={`graph-node__label${data.pending ? ' bp6-skeleton' : ''}`}>{data.title}</div>
      <Handle type="source" position={Position.Bottom} className="graph-node__handle" isConnectable={false} />
    </ContextMenu>
  );
}

/** Search around's submenu for one object: each link and relationship kind with its count, then everything. */
export function searchAroundItems(view: ObjectView | undefined, onPick: (only?: { link?: string; kind?: string }) => void) {
  if (!view) return <MenuItem text="Loading…" disabled />;
  const links = graphLinks(view).filter((g) => g.count > 0);
  const kinds = new Map<string, number>();
  for (const r of relationshipsOf(view)) kinds.set(r.kind, (kinds.get(r.kind) ?? 0) + 1);
  if (!links.length && !kinds.size) return <MenuItem text="Nothing linked" disabled />;
  return (
    <>
      {links.map((g) => (
        <MenuItem key={g.link} text={g.displayName} label={String(g.count)} onClick={() => onPick({ link: g.link })} />
      ))}
      {[...kinds].map(([kind, count]) => (
        <MenuItem key={`kind:${kind}`} text={kindText(kind)} label={String(count)} onClick={() => onPick({ kind })} />
      ))}
      <MenuDivider />
      <MenuItem text="Everything" onClick={() => onPick()} />
    </>
  );
}

function NodeMenu({ id, actions }: { id: string; actions: GraphActions }) {
  return (
    <Menu className="graph-menu">
      <MenuItem text="Search around">{searchAroundItems(actions.view(id), (only) => actions.expand(id, only))}</MenuItem>
      <MenuItem text="Find path to…" onClick={() => actions.findPath(id)} />
      <MenuItem text="Open profile" onClick={() => actions.openProfile(id)} />
      <MenuDivider />
      <MenuItem text="Remove from graph" onClick={() => actions.remove(id)} />
    </Menu>
  );
}

const HALF = ICON_BOX / 2 + 2;
const ARROW = 8;

function tileCentre(n: InternalNode): { x: number; y: number } {
  return { x: n.internals.positionAbsolute.x + (n.measured.width ?? NODE_W) / 2, y: n.internals.positionAbsolute.y + ICON_BOX / 2 };
}

/** Where the line from `p` toward `q` leaves the tile around `p`. */
function clip(p: { x: number; y: number }, q: { x: number; y: number }, half: number) {
  const ux = q.x - p.x;
  const uy = q.y - p.y;
  const m = Math.max(Math.abs(ux), Math.abs(uy));
  if (!m) return p;
  const t = Math.min(1, half / m);
  return { x: p.x + ux * t, y: p.y + uy * t };
}

export function GraphEdge({ id, source, target, data }: EdgeProps<GraphEdgeType>) {
  const s = useInternalNode(source);
  const t = useInternalNode(target);
  if (!s || !t || !data) return null;
  const a = tileCentre(s);
  const b = tileCentre(t);
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const nx = -(b.y - a.y) / len;
  const ny = (b.x - a.x) / len;
  const off = data.model.offset;
  // A bent edge is a quadratic curve through a control point beside the midpoint.
  const c = { x: (a.x + b.x) / 2 + nx * off * 2, y: (a.y + b.y) / 2 + ny * off * 2 };
  const start = clip(a, off ? c : b, HALF);
  const end = clip(b, off ? c : a, HALF);
  const path = off ? `M ${start.x} ${start.y} Q ${c.x} ${c.y} ${end.x} ${end.y}` : `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
  const from = off ? c : start;
  const dl = Math.hypot(end.x - from.x, end.y - from.y) || 1;
  const ux = (end.x - from.x) / dl;
  const uy = (end.y - from.y) / dl;
  const arrow = `M ${end.x} ${end.y} L ${end.x - ux * ARROW - uy * ARROW * 0.5} ${end.y - uy * ARROW + ux * ARROW * 0.5} L ${end.x - ux * ARROW + uy * ARROW * 0.5} ${end.y - uy * ARROW - ux * ARROW * 0.5} Z`;
  const label = off ? { x: 0.25 * start.x + 0.5 * c.x + 0.25 * end.x, y: 0.25 * start.y + 0.5 * c.y + 0.25 * end.y } : { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  const classes = ['graph-edge', data.model.dashed && 'graph-edge--dashed', data.dim && 'graph-edge--dim', data.lit && 'graph-edge--lit', data.picked && 'graph-edge--picked', data.showLabel && 'graph-edge--named']
    .filter(Boolean)
    .join(' ');
  return (
    <g className={classes}>
      <BaseEdge id={id} path={path} className="graph-edge__line" interactionWidth={14} />
      <path d={arrow} className="graph-edge__arrow" />
      {data.showLabel && (
        <EdgeLabelRenderer>
          <div className={`graph-edge__label ${classes}`} style={{ transform: `translate(-50%, -50%) translate(${label.x}px, ${label.y}px)` }}>
            {data.model.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </g>
  );
}

export const NODE_TYPES = { object: ObjectNode };
export const EDGE_TYPES = { graph: GraphEdge };
