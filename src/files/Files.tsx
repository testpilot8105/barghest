// Files: what we have, and where it is (Foundry's Compass, in BARGHEST's look). The investigations down the left with
// the open one's folders under it; the open folder's folders and files on the right, its path above them. `?folder=`
// opens a folder, `?document=` swaps the list for the file itself (FileView), `&passage=` at one passage. Double-click
// or Open opens a file or a folder; every row's "…" and its right-click carry the same menu. Dropped files land in the
// open folder.
import { Button, Classes, HTMLTable, Intent, NonIdealState, showContextMenu, Tooltip, Tree, type TreeNodeInfo } from '@blueprintjs/core';
import { Error as ErrorIcon, FolderClose, FolderNew, FolderOpen, Import, Plus, Projects } from '@blueprintjs/icons';
import { useState, type MouseEvent, type ReactNode } from 'react';
import { EngineError, fileUrl, moveDocument, useDataClient, useFolders, type FolderEntry } from '../data/index.ts';
import { FileView } from './FileView';
import { FolderCrumbs, MoveTo, pathTo, useFolderActions, within } from './folders';
import { useInvestigationActions } from './investigation';
import { Connecting, EngineDown } from '../explorer/parts';
import { useFileActions } from '../intake/fileActions';
import { FileMenu, FitName, FormatIcon, ImportButton, MenuRow, RenameField, RowMenu, SkeletonRows, StatusCell, useDropZone } from '../intake/parts';
import { importedLabel, type IntakeFile } from '../intake/status';
import { toast } from '../intake/toaster';
import { useIntake, type Intake } from '../intake/useIntake';
import { useInvestigationList } from '../shell/investigations';
import { DOCUMENT_PARAM, fileHref, FOLDER_PARAM, folderHref, navigate, PASSAGE_PARAM, useSearchParam } from '../shell/route';
import { useDocumentTitle } from '../shell/title';

type FolderActions = ReturnType<typeof useFolderActions>;
type FileActions = ReturnType<typeof useFileActions>;

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
const fail = (e: Error) => toast(e instanceof EngineError ? e.message : 'The engine did not answer.', e instanceof EngineError && e.status === 409 ? Intent.WARNING : Intent.DANGER);

export function Files({ investigation }: { investigation: string }) {
  const { dc, error } = useDataClient();
  const name = useInvestigationList().find(investigation)?.name ?? null;
  if (error) return <EngineDown />;
  if (!dc) return <Connecting />;
  return <FilesScreen investigation={investigation} name={name} />;
}

function FilesScreen({ investigation, name }: { investigation: string; name: string | null }) {
  const intake = useIntake(investigation);
  const tree = useFolders(investigation);
  const foldersReady = tree.data?.investigation === investigation;
  const folders = foldersReady ? tree.data!.folders : [];
  const documentId = useSearchParam(DOCUMENT_PARAM);
  const passageId = useSearchParam(PASSAGE_PARAM);
  const folderParam = useSearchParam(FOLDER_PARAM) ?? '';
  // With a file open, the folder is the file's own, so the tree and the path show where it lives.
  const here = documentId ? (intake.files.find((f) => f.id === documentId)?.folderId ?? folderParam) : folderParam;
  const path = pathTo(folders, here);
  const counts = fileCounts(folders, intake.files);
  const holds = (f: FolderEntry) => (counts.get(f.id) ?? 0) > 0 || folders.some((g) => g.parentId === f.id) || intake.pending.some((p) => p.folderId === f.id);
  const actions = useFolderActions({ investigation, folders, here, holds, reload: tree.reload });
  const invActions = useInvestigationActions({ current: investigation, intake, newFolder: actions.newFolder });
  const drop = useDropZone((files) => intake.importFiles(files, here || undefined));
  const top = name ?? '';

  return (
    <div className={`files${drop.dragging ? ' intake-dropping' : ''}`} {...drop.props}>
      <FilesTree investigation={investigation} top={top} folders={folders} here={here} counts={counts} total={intake.files.length} actions={actions} invActions={invActions} />
      <section className="view-panel intake-card">
        {documentId ? (
          <FileView
            key={documentId}
            investigation={investigation}
            documentId={documentId}
            passageId={passageId}
            crumbs={<FolderCrumbs investigation={investigation} name={name} path={path} linkLast />}
            listHref={folderHref(investigation, here)}
            onDeleted={intake.refresh}
          />
        ) : here && foldersReady && !path.length ? (
          <NonIdealState
            icon={<ErrorIcon size={48} />}
            title="This folder is not here"
            description="It may have been deleted."
            action={<Button text="Back to the files" onClick={() => navigate(folderHref(investigation))} />}
          />
        ) : (
          <FileList investigation={investigation} top={top} here={here} path={path} folders={folders} counts={counts} intake={intake} actions={actions} />
        )}
      </section>
      {actions.dialog}
      {invActions.alerts}
    </div>
  );
}

/** Files in each folder, counting the folders inside it too. */
function fileCounts(folders: FolderEntry[], files: IntakeFile[]): Map<string, number> {
  const direct = new Map<string, number>();
  for (const f of files) direct.set(f.folderId, (direct.get(f.folderId) ?? 0) + 1);
  const total = new Map<string, number>();
  for (const f of folders) total.set(f.id, [...within(folders, f.id)].reduce((n, id) => n + (direct.get(id) ?? 0), 0));
  return total;
}

function filesLabel(n: number): string {
  return n ? `${n} ${n === 1 ? 'file' : 'files'}` : 'Empty';
}

interface FileListProps {
  investigation: string;
  top: string;
  here: string;
  path: FolderEntry[];
  folders: FolderEntry[];
  counts: Map<string, number>;
  intake: Intake;
  actions: FolderActions;
}

function FileList({ investigation, top, here, path, folders, counts, intake, actions }: FileListProps) {
  const { dc } = useDataClient();
  const current = path[path.length - 1];
  useDocumentTitle(current?.name ?? (top || null));
  const subfolders = folders.filter((f) => f.parentId === here).sort(byName);
  const files = intake.files.filter((f) => f.folderId === here).sort(byName);
  const pending = intake.pending.filter((p) => p.folderId === here);
  const fileActions = useFileActions({ investigation, intake });
  const importHere = (list: File[]) => intake.importFiles(list, here || undefined);
  const moveToFolder = (f: IntakeFile, folderId: string) => dc && moveDocument(dc, f.id, folderId).then(intake.refresh, fail);

  return (
    <>
      <header className="intake-card__head">
        <div className="intake-card__title">
          <FolderCrumbs investigation={investigation} name={top} path={path} />
        </div>
        <div className="files__actions">
          <Button icon={<FolderNew />} text="New folder" onClick={() => actions.newFolder(here)} />
          <ImportButton onFiles={importHere} />
        </div>
      </header>
      <div className="intake-card__scroll">
        {intake.loading ? (
          <SkeletonRows />
        ) : !subfolders.length && !files.length && !pending.length ? (
          <NonIdealState
            icon={<Import size={48} />}
            title={current ? `Nothing in ${current.name} yet` : 'No files yet'}
            description="Drop files here or use Import files."
            action={<ImportButton onFiles={importHere} primary={false} />}
          />
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
              {subfolders.map((f) => (
                <FolderRow key={f.id} investigation={investigation} folder={f} count={counts.get(f.id) ?? 0} menu={actions.menu(f, top, 'list')} actions={actions} />
              ))}
              {[...pending, ...files].map((f) => (
                <FileRow
                  key={f.id}
                  investigation={investigation}
                  file={f}
                  intake={intake}
                  actions={fileActions}
                  moveTo={<MoveTo top={top} folders={folders} current={f.folderId} onPick={(to) => moveToFolder(f, to)} />}
                />
              ))}
            </tbody>
          </HTMLTable>
        )}
      </div>
      {fileActions.alerts}
    </>
  );
}

function FolderRow({ investigation, folder, count, menu, actions }: { investigation: string; folder: FolderEntry; count: number; menu: JSX.Element; actions: FolderActions }) {
  const open = () => navigate(folderHref(investigation, folder.id));
  return (
    <MenuRow menu={menu} onOpen={open}>
      <td>
        <span className="intake-name">
          <span className="photo-slot">
            <FolderClose color="var(--bp-palette-gray-4)" />
          </span>
          {actions.isRenaming(folder, 'list') ? (
            <RenameField value={folder.name} onRename={(n) => actions.rename(folder, n)} onDone={actions.stopRenaming} />
          ) : (
            <FitName name={folder.name} />
          )}
          <span className={`files__count ${Classes.TEXT_MUTED}`}>{filesLabel(count)}</span>
        </span>
      </td>
      <td />
      <td />
      <td />
      <td />
      <td className="intake-table__menu">
        <RowMenu menu={menu} label={folder.name} />
      </td>
    </MenuRow>
  );
}

function FileRow({ investigation, file, intake, actions, moveTo }: { investigation: string; file: IntakeFile; intake: Intake; actions: FileActions; moveTo: ReactNode }) {
  const { dc } = useDataClient();
  const pending = file.status === 'importing';
  const open = () => navigate(fileHref(investigation, file.id));
  const menu = <FileMenu file={file} onRunAgain={intake.runAgain} originalUrl={dc && !pending ? fileUrl(dc, file.id) : null} onOpen={open} moveTo={moveTo} {...actions.menuProps(file)} />;
  const cells = (
    <>
      <td>
        <span className="intake-name">
          <FormatIcon format={file.format} documentId={file.id} />
          {actions.nameCell(file)}
        </span>
      </td>
      <td>
        <span className="intake-name">{actions.registerCell(file)}</span>
      </td>
      <td className="intake-num">{file.passages ?? ''}</td>
      <td>
        <StatusCell file={file} onRunAgain={intake.runAgain} />
      </td>
      <td className="intake-num">{importedLabel(file.importedAt)}</td>
      <td className="intake-table__menu">{!pending && <RowMenu menu={menu} label={file.name} />}</td>
    </>
  );
  return pending ? <tr>{cells}</tr> : <MenuRow menu={menu} onOpen={open}>{cells}</MenuRow>;
}

type TreeItem = { kind: 'investigation' | 'folder'; id: string };

/** The investigations down the left like Compass's projects, the open one's folders under it. */
interface FilesTreeProps {
  investigation: string;
  top: string;
  folders: FolderEntry[];
  here: string;
  counts: Map<string, number>;
  total: number;
  actions: FolderActions;
  invActions: ReturnType<typeof useInvestigationActions>;
}

function FilesTree({ investigation, top, folders, here, counts, total, actions, invActions }: FilesTreeProps) {
  const { data, openNew } = useInvestigationList();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  // The open folder and the folders above it start open, so the tree always shows where you are.
  const onPath = new Set(pathTo(folders, here).map((f) => f.id));
  const count = (n: number) => <span className={Classes.TEXT_MUTED}>{n}</span>;
  const byId = new Map(folders.map((f) => [f.id, f]));
  // A tree item's end: its count, then its "…"; a click on the "…" stays out of the tree's own click.
  const end = (n: number, menu: JSX.Element, label: string) => (
    <span className="files__tree-end">
      {count(n)}
      <span onClick={(e) => e.stopPropagation()}>
        <RowMenu menu={menu} label={label} />
      </span>
    </span>
  );

  const folderNodes = (parent: string): TreeNodeInfo<TreeItem>[] =>
    folders
      .filter((f) => f.parentId === parent)
      .sort(byName)
      .map((f) => {
        const childNodes = folderNodes(f.id);
        const isExpanded = expanded[`f:${f.id}`] ?? onPath.has(f.id);
        return {
          id: `f:${f.id}`,
          nodeData: { kind: 'folder', id: f.id },
          label: actions.isRenaming(f, 'tree') ? <RenameField value={f.name} onRename={(n) => actions.rename(f, n)} onDone={actions.stopRenaming} /> : <FitName name={f.name} />,
          icon: isExpanded && childNodes.length ? <FolderOpen className={Classes.TREE_NODE_ICON} /> : <FolderClose className={Classes.TREE_NODE_ICON} />,
          hasCaret: childNodes.length > 0,
          isExpanded,
          childNodes,
          // The highlight steps aside while the name is a field, so the field reads like any other input.
          isSelected: f.id === here && !actions.isRenaming(f, 'tree'),
          secondaryLabel: end(counts.get(f.id) ?? 0, actions.menu(f, top, 'tree'), f.name),
        };
      });

  const nodes: TreeNodeInfo<TreeItem>[] = (data?.investigations ?? []).map((inv) => {
    const current = inv.id === investigation;
    const childNodes = current ? folderNodes('') : [];
    return {
      id: `i:${inv.id}`,
      nodeData: { kind: 'investigation', id: inv.id },
      label: invActions.isRenaming(inv) ? <RenameField value={inv.name} onRename={(n) => invActions.rename(inv, n)} onDone={invActions.stopRenaming} /> : <FitName name={inv.name} />,
      icon: <Projects className={Classes.TREE_NODE_ICON} />,
      hasCaret: childNodes.length > 0,
      isExpanded: current && (expanded[`i:${inv.id}`] ?? true),
      childNodes,
      isSelected: current && here === '' && !invActions.isRenaming(inv),
      secondaryLabel: end(current ? total : inv.documents, invActions.menu(inv), inv.name),
    };
  });

  const toggle = (node: TreeNodeInfo<TreeItem>, open: boolean) => setExpanded((e) => ({ ...e, [node.id]: open }));
  const contextMenu = (node: TreeNodeInfo<TreeItem>, _path: number[], e: MouseEvent<HTMLElement>) => {
    const item = node.nodeData;
    const f = item?.kind === 'folder' ? byId.get(item.id) : undefined;
    const inv = item?.kind === 'investigation' ? data?.investigations.find((i) => i.id === item.id) : undefined;
    const content = f ? actions.menu(f, top, 'tree') : inv ? invActions.menu(inv) : null;
    if (!content) return;
    e.preventDefault();
    showContextMenu({ content, targetOffset: { left: e.clientX, top: e.clientY }, isDarkTheme: true });
  };

  return (
    <aside className="dock files__side" aria-label="Investigations">
      <div className="files__side-head">
        <h6 className="caps-heading">Investigations</h6>
        <Tooltip content="New investigation" placement="right">
          <Button variant="minimal" icon={<Plus />} aria-label="New investigation" onClick={openNew} />
        </Tooltip>
      </div>
      <Tree
        contents={nodes}
        className="files__tree"
        onNodeClick={(node) => node.nodeData && navigate(node.nodeData.kind === 'investigation' ? folderHref(node.nodeData.id) : folderHref(investigation, node.nodeData.id))}
        onNodeExpand={(node) => toggle(node, true)}
        onNodeCollapse={(node) => toggle(node, false)}
        onNodeContextMenu={contextMenu}
      />
    </aside>
  );
}
