// The evidence drawer: the passages behind a link, a spelling or an answer, each in its file. A Blueprint Drawer on the
// right, as Gotham opens an object's evidence beside the work. Each passage shows its text, its file's name and
// register, "Open in Files" at that passage and "Open original" (the stored file, in a new tab). Every view imports
// it with the props below (the shared note, section 4).
import { AnchorButton, Callout, Card, Classes, Drawer, NonIdealState, Spinner } from '@blueprintjs/core';
import { Document, FolderOpen, Share } from '@blueprintjs/icons';
import { fileUrl, useDataClient } from '../data/index.ts';
import { filesHref, follow } from '../browser/links';
import { formatCount } from '../explorer/parts';
import { parseRoute, usePath } from '../shell/route';
import { usePassageFiles, type EvidencePassage } from './passages';
import './evidence.css';

export interface EvidenceDrawerProps {
  passageIds: string[];
  /** What the evidence is for, such as a link's label; "Evidence" when absent. */
  title?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function EvidenceDrawer({ passageIds, title, isOpen, onClose }: EvidenceDrawerProps) {
  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={title || 'Evidence'} icon={<Document />} position="right" size="var(--evidence-w)" className="evidence-drawer">
      <div className={`${Classes.DRAWER_BODY} evidence-body`}>{isOpen && <EvidenceList ids={passageIds} onClose={onClose} />}</div>
    </Drawer>
  );
}

function EvidenceList({ ids, onClose }: { ids: string[]; onClose: () => void }) {
  const passages = usePassageFiles(ids);
  if (!ids.length) return <NonIdealState icon={<Document size={48} />} title="No passage cites this yet" />;
  if (passages.error) {
    return (
      <Callout intent="danger" compact>
        {passages.error.message}
      </Callout>
    );
  }
  if (!passages.data) return <Spinner size={20} className="evidence-spinner" />;
  if (!passages.data.length) {
    return <NonIdealState icon={<Document size={48} />} title="These passages are gone" description="The file they came from may have been deleted." />;
  }
  const n = passages.data.length;
  return (
    <>
      <p className="bp6-text-muted evidence-count">
        {formatCount(n)} {n === 1 ? 'passage' : 'passages'}
      </p>
      {passages.data.map((p) => (
        <PassageCard key={p.pk} passage={p} onClose={onClose} />
      ))}
    </>
  );
}

function PassageCard({ passage, onClose }: { passage: EvidencePassage; onClose: () => void }) {
  const { dc } = useDataClient();
  const route = parseRoute(usePath());
  const investigation = passage.investigation || route.investigation || '';
  const files = filesHref(investigation, passage.documentId, passage.pk);
  return (
    <Card className="evidence-passage">
      {passage.index != null && <span className="bp6-text-muted">Passage {formatCount(passage.index + 1)}</span>}
      <p className="evidence-passage__text">{passage.text || passage.label}</p>
      <div className="evidence-passage__file">
        <strong>{passage.fileName}</strong>
        {passage.register && <span className="bp6-text-muted">{passage.register}</span>}
      </div>
      <div className="evidence-passage__actions">
        <AnchorButton variant="outlined" icon={<FolderOpen />} text="Open in Files" href={files} role="link" onClick={follow(files, onClose)} />
        {dc && passage.documentId && <AnchorButton variant="minimal" endIcon={<Share />} text="Open original" href={fileUrl(dc, passage.documentId)} target="_blank" rel="noreferrer" />}
      </div>
    </Card>
  );
}
