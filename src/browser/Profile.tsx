// The object profile, S2: Gotham's Browser object view (G-Cloud 14 service definition, pages 5 and 6). A header with
// the name, the type and the jumps to Graph, Timeline and the Assistant, then the overview: Properties with their
// ownership at the right of each row, Sources (the spellings it was resolved from), How it was resolved, Links grouped
// by type, Relationships with their evidence, History. One column on a narrow panel; on a wide one, two, the object
// on the left and its connections on the right, as Gotham lays it out. Evidence opens in the drawer.
import { AnchorButton, Button, Callout, H4, NonIdealState, Section, SectionCard, Spinner, Tag, type Intent } from '@blueprintjs/core';
import { ArrowLeft, ChevronRight, Document, Error as ErrorIcon } from '@blueprintjs/icons';
import { Fragment, useState, type ReactNode } from 'react';
import { encodeExploration, useObjectView, type AuditEntry, type Catalog, type CatalogType, type ObjectView, type RelationshipView, type ResolutionView } from '../data/index.ts';
import { EvidenceDrawer } from '../evidence/EvidenceDrawer';
import { usePassageFiles, type EvidencePassage } from '../evidence/passages';
import { formatCount } from '../explorer/parts';
import { ObjectPicture, ProfilePhotos } from '../photos';
import { showValue } from '../explorer/steps';
import { findView, paletteVar } from '../shell/nav';
import { viewHref } from '../shell/route';
import { useDocumentTitle } from '../shell/title';
import { assistantHref, follow, graphHref, profileHref, timelineHref } from './links';
import './profile.css';

/** Below this the profile says plainly that a link is unsure. */
const SURE = 0.9;

/** Links that have their own section here, so the Links section leaves them out. */
const OWN_SECTION_LINKS = new Set(['candidates', 'relationshipsFrom', 'relationshipsTo']);

interface Evidence {
  ids: string[];
  title: string;
}

export function Profile({ catalog, type, pk, investigation, onBack }: { catalog: Catalog; type: string; pk: string; investigation: string; onBack?: () => void }) {
  const def = catalog.types[type];
  const view = useObjectView(def ? type : null, pk);
  useDocumentTitle(view.data?.title ?? null);
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const openEvidence = (ids: string[], title: string) => {
    setEvidence({ ids, title });
    setDrawerOpen(true);
  };

  let body: ReactNode;
  if (!def || (view.error && isNotFound(view.error))) body = <ObjectNotFound investigation={investigation} />;
  else if (view.error) {
    body = (
      <Callout intent="danger" compact className="profile-error">
        {view.error.message}
      </Callout>
    );
  } else if (!view.data) body = <Spinner size={20} className="profile-spinner" />;
  else body = <Overview catalog={catalog} def={def} view={view.data} investigation={investigation} openEvidence={openEvidence} />;

  return (
    <section className="view-panel profile-panel" aria-label="Profile">
      {onBack && (
        <div className="profile-back">
          <Button className="caps-heading" variant="minimal" icon={<ArrowLeft />} text="Back" onClick={onBack} />
        </div>
      )}
      {body}
      {/* The drawer keeps its passages through its closing fade; a new open replaces them. */}
      <EvidenceDrawer passageIds={evidence?.ids ?? []} title={evidence?.title} isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </section>
  );
}

/** faux answers a missing object with "Expected a single result but got 0". */
function isNotFound(error: Error): boolean {
  return /single result but got 0|not ?found/i.test(error.message);
}

function ObjectNotFound({ investigation }: { investigation: string }) {
  const explorer = viewHref(investigation, 'explorer');
  return (
    <NonIdealState
      icon={<ErrorIcon size={48} />}
      title="This object isn't here"
      description="The link names an object this investigation doesn't hold. It may have been merged into another one or deleted."
      action={<AnchorButton text="Open Object Explorer" href={explorer} role="link" onClick={follow(explorer)} />}
    />
  );
}

function Overview({ catalog, def, view, investigation, openEvidence }: { catalog: Catalog; def: CatalogType; view: ObjectView; investigation: string; openEvidence: (ids: string[], title: string) => void }) {
  return (
    <>
      <Header def={def} view={view} investigation={investigation} />
      <div className="profile-body">
        <div className="profile-columns">
          <div className="profile-column">
            <Properties def={def} view={view} />
            <Sources catalog={catalog} view={view} investigation={investigation} openEvidence={openEvidence} />
            <Resolutions view={view} />
            <History entries={view.audit} />
          </div>
          <div className="profile-column">
            <Links def={def} view={view} investigation={investigation} />
            <Relationships catalog={catalog} view={view} investigation={investigation} openEvidence={openEvidence} />
            {/* Last in the source on purpose: profile.css orders the first two, so Photos keeps order 0 and leads. */}
            <ProfilePhotos investigation={investigation} objectKey={`${view.type}:${view.pk}`} title={view.title} />
          </div>
        </div>
      </div>
    </>
  );
}

function Header({ def, view, investigation }: { def: CatalogType; view: ObjectView; investigation: string }) {
  const browser = findView('browser');
  const jumps = [
    { slug: 'graph', text: 'Open in Graph', href: graphHref(investigation, view.type, view.pk) },
    { slug: 'timeline', text: 'Open in Timeline', href: timelineHref(investigation, view.type, view.pk) },
    { slug: 'assistant', text: 'Ask about this', href: assistantHref(investigation, `What do the files say about ${view.title}?`) },
  ];
  return (
    <header className="profile-head">
      <div className="profile-head__name">
        <ObjectPicture objectKey={`${view.type}:${view.pk}`} fallback={browser && <browser.Icon size={20} color={paletteVar(browser.color)} />} />
        <div className="profile-head__titles">
          <H4>{view.title}</H4>
          <div className="profile-head__type">
            <span className="bp6-text-muted">{def.displayName}</span>
            {view.candidates.length > 0 && (
              <Tag minimal size="large">
                Resolved from {formatCount(view.candidates.length)} {view.candidates.length === 1 ? 'source' : 'sources'}
              </Tag>
            )}
          </div>
        </div>
      </div>
      <div className="profile-head__actions">
        {jumps.map((j) => {
          const v = findView(j.slug);
          return <AnchorButton key={j.slug} variant="minimal" icon={v && <v.Icon color={paletteVar(v.color)} />} text={j.text} href={j.href} role="link" onClick={follow(j.href)} />;
        })}
      </div>
    </header>
  );
}

function Heading({ text }: { text: string }) {
  return <span className="caps-heading">{text}</span>;
}

function Count({ n }: { n: number }) {
  return <span className="bp6-text-muted profile-count">{formatCount(n)}</span>;
}

function Empty({ text }: { text: string }) {
  return <p className="bp6-text-muted profile-empty">{text}</p>;
}

function Properties({ def, view }: { def: CatalogType; view: ObjectView }) {
  const hidden = new Set(def.properties.filter((p) => p.hidden).map((p) => p.apiName));
  const rows = view.properties.filter((p) => !hidden.has(p.apiName) && showValue(p.value) !== '');
  return (
    <Section compact className="profile-section" title={<Heading text="Properties" />} rightElement={<Count n={rows.length} />}>
      <SectionCard>
        {rows.length ? (
          <dl className="profile-props">
            {rows.map((p) => (
              <Fragment key={p.apiName}>
                <dt className="bp6-text-muted">{p.displayName}</dt>
                <dd>{showValue(p.value)}</dd>
                <dd className="profile-props__owner">
                  <Tag minimal size="large">
                    {p.ownership}
                  </Tag>
                </dd>
              </Fragment>
            ))}
          </dl>
        ) : (
          <Empty text="No property has a value." />
        )}
      </SectionCard>
    </Section>
  );
}

/** The spellings it was resolved from, each in its file; or, for one spelling, the passage it was read in. */
function Sources({ catalog, view, investigation, openEvidence }: { catalog: Catalog; view: ObjectView; investigation: string; openEvidence: (ids: string[], title: string) => void }) {
  const fromCandidates = view.candidates.length > 0;
  const items = fromCandidates
    ? view.candidates.map((c) => ({ key: c.pk, spelling: c.title, passageId: c.passageId }))
    : view.passages.map((p) => ({ key: p.pk, spelling: view.title, passageId: p.pk }));
  const files = usePassageFiles(items.flatMap((i) => (i.passageId ? [i.passageId] : [])));
  const byId = new Map((files.data ?? []).map((p) => [p.pk, p]));
  const canonicalHref = view.canonical && profileHref(investigation, view.type, view.canonical.pk);
  return (
    <Section compact className="profile-section" title={<Heading text="Sources" />} rightElement={<Count n={items.length} />}>
      <SectionCard className="profile-rows">
        {view.canonical && canonicalHref && (
          <p className="profile-note">
            One of the spellings of{' '}
            <a href={canonicalHref} onClick={follow(canonicalHref)}>
              {view.canonical.title}
            </a>
            .
          </p>
        )}
        {items.map((item) => {
          const file = item.passageId ? byId.get(item.passageId) : undefined;
          return (
            <Button
              key={item.key}
              className="profile-row"
              variant="minimal"
              alignText="start"
              fill
              endIcon={item.passageId ? <ChevronRight /> : undefined}
              disabled={!item.passageId}
              onClick={() => item.passageId && openEvidence([item.passageId], `“${item.spelling}”${file ? ` in ${file.fileName}` : ''}`)}
              text={
                <span className="profile-row__cells">
                  <strong>{item.spelling}</strong>
                  <FileLine file={file} passageId={item.passageId} loading={files.loading} />
                </span>
              }
            />
          );
        })}
        {!items.length && !view.canonical && <Empty text={`No other spelling has been resolved into this ${(catalog.types[view.type]?.displayName ?? 'object').toLowerCase()} yet.`} />}
      </SectionCard>
    </Section>
  );
}

function FileLine({ file, passageId, loading }: { file: EvidencePassage | undefined; passageId: string | null; loading: boolean }) {
  if (!passageId) return <span className="bp6-text-muted">From a table row</span>;
  if (file) return <span className="bp6-text-muted">{[file.fileName, file.register].filter(Boolean).join(' · ')}</span>;
  if (loading) return <span className="bp6-skeleton">file name · register</span>;
  return <span className="bp6-text-muted">The passage is gone</span>;
}

const DECIDED_BY: Record<string, { text: string; intent: Intent }> = {
  rule: { text: 'rule', intent: 'none' },
  'local-model': { text: 'local model', intent: 'primary' },
  pending: { text: 'pending', intent: 'warning' },
};

function confidenceText(c: number | null): string {
  return c == null ? 'no confidence' : c.toFixed(2);
}

function Resolutions({ view }: { view: ObjectView }) {
  return (
    <Section compact className="profile-section" title={<Heading text="How it was resolved" />} rightElement={<Count n={view.resolutions.length} />}>
      <SectionCard className="profile-rows">
        {view.resolutions.length ? view.resolutions.map((r) => <ResolutionRow key={r.pk} r={r} />) : <Empty text="No resolution decision names this yet." />}
      </SectionCard>
    </Section>
  );
}

function ResolutionRow({ r }: { r: ResolutionView }) {
  const by = DECIDED_BY[r.decidedBy] ?? { text: r.decidedBy || 'unknown', intent: 'none' as Intent };
  return (
    <div className="profile-line">
      <strong>{r.label}</strong>
      <span className="profile-row__meta">
        <span>{r.decision}</span>
        <span className="profile-num">{confidenceText(r.confidence)}</span>
        <Tag minimal size="large" intent={by.intent}>
          {by.text}
        </Tag>
        {r.method && <span className="bp6-text-muted">{r.method}</span>}
      </span>
      {r.reason && <span className="bp6-text-muted">{r.reason}</span>}
    </div>
  );
}

function Links({ def, view, investigation }: { def: CatalogType; view: ObjectView; investigation: string }) {
  const groups = view.links.filter((g) => g.count > 0 && !OWN_SECTION_LINKS.has(g.link));
  const total = groups.reduce((n, g) => n + g.count, 0);
  return (
    <Section compact className="profile-section" title={<Heading text="Links" />} rightElement={<Count n={total} />}>
      <SectionCard className="profile-rows">
        {groups.length ? (
          groups.map((g) => {
            const all = viewHref(
              investigation,
              'explorer',
              encodeExploration({ start: view.type, steps: [{ filter: { property: def.primaryKey, op: 'eq', value: view.pk } }, { pivot: g.link }] }),
            );
            return (
              <div key={g.link} className="profile-link-group">
                <div className="profile-link-group__head">
                  {/* Gotham's form: the link's name, its count in brackets. */}
                  <strong>{g.displayName}</strong>
                  <span className="bp6-text-muted profile-num">({formatCount(g.count)})</span>
                  {g.count > g.first.length && <AnchorButton className="profile-link-group__all" variant="minimal" text={`Show all ${formatCount(g.count)}`} href={all} role="link" onClick={follow(all)} />}
                </div>
                <div className="profile-link-group__items">
                  {g.first.map((o) => {
                    const href = profileHref(investigation, g.targetType, o.pk);
                    return <AnchorButton key={o.pk} variant="minimal" text={o.title} href={href} role="link" onClick={follow(href)} />;
                  })}
                </div>
              </div>
            );
          })
        ) : (
          <Empty text="Nothing is linked to this." />
        )}
      </SectionCard>
    </Section>
  );
}

const STATUS_INTENT: Record<string, Intent> = { confirmed: 'success', rejected: 'danger', review: 'warning', proposed: 'none' };

function Relationships({ catalog, view, investigation, openEvidence }: { catalog: Catalog; view: ObjectView; investigation: string; openEvidence: (ids: string[], title: string) => void }) {
  const { out, in: into } = view.relationships;
  const n = out.length + into.length;
  return (
    <Section compact className="profile-section" title={<Heading text="Relationships" />} rightElement={<Count n={n} />}>
      <SectionCard className="profile-rows">
        {!n && <Empty text="The model hasn't linked this to anything yet." />}
        {out.length > 0 && <span className="caps-heading bp6-text-muted profile-subhead">Out</span>}
        {out.map((r) => (
          <RelationshipRow key={r.pk} catalog={catalog} r={r} direction="out" investigation={investigation} openEvidence={openEvidence} />
        ))}
        {into.length > 0 && <span className="caps-heading bp6-text-muted profile-subhead">In</span>}
        {into.map((r) => (
          <RelationshipRow key={r.pk} catalog={catalog} r={r} direction="in" investigation={investigation} openEvidence={openEvidence} />
        ))}
      </SectionCard>
    </Section>
  );
}

/** What a link's kind reads as: `member_of` is "member of". */
function kindText(kind: string): string {
  return kind.replace(/_/g, ' ');
}

/** Said plainly when a link is unsure: under 0.9, or waiting for review. Null when it is neither. */
function unsureText(r: RelationshipView): string | null {
  const parts: string[] = [];
  if (r.confidence != null && r.confidence < SURE) parts.push(`confidence ${confidenceText(r.confidence)} is under ${SURE}`);
  if (r.status === 'review') parts.push('it is waiting for review');
  return parts.length ? `Check this: ${parts.join(' and ')}.` : null;
}

function RelationshipRow({ catalog, r, direction, investigation, openEvidence }: { catalog: Catalog; r: RelationshipView; direction: 'out' | 'in'; investigation: string; openEvidence: (ids: string[], title: string) => void }) {
  const href = profileHref(investigation, r.otherType, r.otherPk);
  const other = (
    <a href={href} onClick={follow(href)}>
      {r.otherTitle}
    </a>
  );
  const otherType = catalog.types[r.otherType]?.displayName ?? r.otherType;
  const unsure = unsureText(r);
  const ids = r.passages.map((p) => p.pk);
  return (
    <div className="profile-line">
      <span className="profile-rel__sentence">
        {direction === 'out' ? (
          <>
            <span>{kindText(r.kind)}</span> {other}
          </>
        ) : (
          <>
            {other} <span>{kindText(r.kind)}</span>
          </>
        )}{' '}
        <span className="bp6-text-muted">{otherType}</span>
      </span>
      <span className="profile-row__meta">
        <span className="profile-num">{confidenceText(r.confidence)}</span>
        <Tag minimal size="large" intent={STATUS_INTENT[r.status] ?? 'none'}>
          {r.status || 'no status'}
        </Tag>
        {r.method && <span className="bp6-text-muted">{r.method}</span>}
        <Button className="profile-rel__evidence" variant="minimal" icon={<Document />} text={`Evidence ${formatCount(ids.length)}`} disabled={!ids.length} onClick={() => openEvidence(ids, r.label)} />
      </span>
      {unsure && <span className="profile-unsure">{unsure}</span>}
    </div>
  );
}

const when = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** "modifyObjectRelationship" reads as "Modify object relationship". */
function actionText(action: string): string {
  const words = action.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The audit row's parameters as one line: the plain values, in the order the action logged them. */
function summaryText(entry: AuditEntry): string {
  return Object.entries(entry.params ?? {})
    .filter(([, v]) => v != null && v !== '' && typeof v !== 'object')
    .map(([k, v]) => `${k}: ${showValue(v)}`)
    .join(', ');
}

function History({ entries }: { entries: AuditEntry[] }) {
  return (
    <Section compact className="profile-section" title={<Heading text="History" />} rightElement={<Count n={entries.length} />}>
      <SectionCard className="profile-rows">
        {entries.length ? (
          entries.map((e) => (
            <div key={e.id} className="profile-line">
              <span className="profile-history__head">
                <strong>{actionText(e.action)}</strong>
                <span className="bp6-text-muted profile-num">{when.format(new Date(e.at))}</span>
              </span>
              <span className="bp6-text-muted">{[e.actor, e.outcome !== 'applied' ? e.outcome : '', summaryText(e)].filter(Boolean).join(' · ')}</span>
            </div>
          ))
        ) : (
          <Empty text="No changes recorded yet." />
        )}
      </SectionCard>
    </Section>
  );
}
