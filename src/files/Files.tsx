// Files: what we have, and where it is (Foundry's Compass, in BARGHEST's look). The investigations down the left,
// the open one's files on the right. Folders, the file view, rename, move and delete land here as the engine's file
// manager routes become real (docs/engine-api.md); until then the list is flat and every action shown is one the
// engine can do. Dropped files land in the open investigation.
import { Breadcrumbs, Button, Classes, HTMLTable, NonIdealState, Tooltip, Tree, type TreeNodeInfo } from '@blueprintjs/core';
import { Import, Plus, Projects } from '@blueprintjs/icons';
import { fileUrl, useDataClient } from '../data/index.ts';
import { Connecting, EngineDown } from '../explorer/parts';
import { FileMenu, FitName, FormatIcon, ImportButton, MenuRow, RowMenu, SkeletonRows, StatusCell, useDropZone } from '../intake/parts';
import { importedLabel, type IntakeFile } from '../intake/status';
import { useIntake, type Intake } from '../intake/useIntake';
import { useInvestigationList } from '../shell/investigations';
import { navigate, viewHref } from '../shell/route';
import { useDocumentTitle } from '../shell/title';

export function Files({ investigation }: { investigation: string }) {
  const { dc, error } = useDataClient();
  const name = useInvestigationList().find(investigation)?.name ?? null;
  useDocumentTitle(name);
  if (error) return <EngineDown />;
  if (!dc) return <Connecting />;
  return <FilesScreen investigation={investigation} name={name} />;
}

function FilesScreen({ investigation, name }: { investigation: string; name: string | null }) {
  const intake = useIntake(investigation);
  const drop = useDropZone((files) => intake.importFiles(files));
  const files = [...intake.files].sort((a, b) => a.name.localeCompare(b.name));
  const place = name ?? 'this investigation';

  return (
    <div className={`files${drop.dragging ? ' intake-dropping' : ''}`} {...drop.props}>
      <InvestigationList current={investigation} />
      <section className="view-panel intake-card">
        <header className="intake-card__head">
          <div className="intake-card__title">
            <Breadcrumbs className="files__crumbs" items={[{ text: name ?? '' }]} />
          </div>
          <ImportButton onFiles={intake.importFiles} />
        </header>
        <div className="intake-card__scroll">
          {intake.loading ? (
            <SkeletonRows />
          ) : !files.length && !intake.pending.length ? (
            <NonIdealState icon={<Import size={48} />} title="No files yet" description="Drop files here or use Import files." action={<ImportButton onFiles={intake.importFiles} primary={false} />} />
          ) : (
            <HTMLTable compact interactive className="intake-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th className="intake-table__register">Register</th>
                  <th className="intake-num">Passages</th>
                  <th className="intake-table__status">Status</th>
                  <th className="intake-num">Imported</th>
                  <th className="intake-table__menu" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {[...intake.pending, ...files].map((f) => (
                  <FileRow key={f.id} file={f} intake={intake} />
                ))}
              </tbody>
            </HTMLTable>
          )}
        </div>
        <footer className="explorer__selection intake-card__foot">
          <span className={Classes.TEXT_MUTED}>Drop files here to import them into {place}.</span>
        </footer>
      </section>
    </div>
  );
}

function FileRow({ file, intake }: { file: IntakeFile; intake: Intake }) {
  const { dc } = useDataClient();
  const pending = file.status === 'importing';
  const menu = <FileMenu file={file} onRunAgain={intake.runAgain} originalUrl={dc && !pending ? fileUrl(dc, file.id) : null} />;
  const cells = (
    <>
      <td>
        <span className="intake-name">
          <FormatIcon format={file.format} />
          <FitName name={file.name} />
        </span>
      </td>
      <td>
        <span className="intake-name">
          <FitName name={file.register} />
        </span>
      </td>
      <td className="intake-num">{file.passages ?? ''}</td>
      <td>
        <StatusCell file={file} onRunAgain={intake.runAgain} />
      </td>
      <td className="intake-num">{importedLabel(file.importedAt)}</td>
      <td className="intake-table__menu">{!pending && <RowMenu menu={menu} label={file.name} />}</td>
    </>
  );
  return pending ? <tr>{cells}</tr> : <MenuRow menu={menu}>{cells}</MenuRow>;
}

/** The investigations, down the left like Compass's projects. Folders nest under them once the engine has them. */
function InvestigationList({ current }: { current: string }) {
  const { data, openNew } = useInvestigationList();
  const nodes: TreeNodeInfo<string>[] = (data?.investigations ?? []).map((inv) => ({
    id: inv.id,
    nodeData: inv.id,
    label: <FitName name={inv.name} />,
    icon: <Projects className={Classes.TREE_NODE_ICON} />,
    isSelected: inv.id === current,
    secondaryLabel: <span className={Classes.TEXT_MUTED}>{inv.documents}</span>,
  }));
  return (
    <aside className="dock files__side" aria-label="Investigations">
      <div className="files__side-head">
        <h6 className="caps-heading">Investigations</h6>
        <Tooltip content="New investigation" placement="right">
          <Button variant="minimal" icon={<Plus />} aria-label="New investigation" onClick={openNew} />
        </Tooltip>
      </div>
      <Tree contents={nodes} className="files__tree" onNodeClick={(node) => node.nodeData && navigate(viewHref(node.nodeData, 'files'))} />
    </aside>
  );
}
