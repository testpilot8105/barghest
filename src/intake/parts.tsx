// Pieces Files and Data Sources share: a file's status, its name cut to fit, the "…" menu every row carries (the same
// menu right-click opens), the Import files button and the drop zone. Status is quiet when all is well: only Reading,
// Done with gaps and Failed carry colour (owner, 09.10.2026).
import { Alert, Button, Classes, ContextMenu, Intent, Menu, MenuDivider, MenuItem, Popover, ProgressBar, Spinner, Tag, Tooltip } from '@blueprintjs/core';
import { Document as DocumentIcon, Import, More, SmallTick, Th, Time, Trash, WarningSign } from '@blueprintjs/icons';
import { useRef, useState, type DragEvent, type ReactElement, type ReactNode } from 'react';
import { deleteDocument, EngineError, useDataClient } from '../data/index.ts';
import { toast } from './toaster.ts';
import { NO_TEXT } from './useIntake.ts';
import type { IntakeFile } from './status.ts';

const ICON = 16;

export function StatusCell({ file, onRunAgain }: { file: IntakeFile; onRunAgain: (f: IntakeFile) => void }) {
  switch (file.status) {
    case 'importing':
      return (
        <span className="intake-status">
          <Spinner size={ICON} />
          <span className={Classes.TEXT_MUTED}>Importing…</span>
        </span>
      );
    case 'waiting':
      return (
        <span className="intake-status">
          <Time size={ICON} color="var(--bp-palette-gray-4)" />
          <span className={Classes.TEXT_MUTED}>Waiting</span>
        </span>
      );
    case 'unread':
      return (
        <span className="intake-status">
          <Time size={ICON} color="var(--bp-palette-gray-4)" />
          <span className={Classes.TEXT_MUTED}>Not read yet</span>
        </span>
      );
    case 'reading':
      return (
        <span className="intake-status intake-status--reading">
          <ProgressBar intent={Intent.PRIMARY} animate={false} stripes={false} value={file.passages ? file.read / file.passages : 0} />
          <span>
            {file.read} of {file.passages ?? '?'}
          </span>
        </span>
      );
    case 'done':
      return (
        <span className="intake-status">
          <SmallTick size={ICON} color="var(--bp-palette-green-5)" />
          <span className={Classes.TEXT_MUTED}>Done</span>
        </span>
      );
    case 'gaps': {
      const n = file.failedPassages.length || 1;
      return (
        <Tooltip content={`The model couldn't read ${n} of ${file.passages ?? '?'} passages.`} placement="top">
          <span className="intake-status intake-status--gaps">
            <WarningSign size={ICON} color="var(--bp-palette-orange-5)" />
            <span>Done with gaps</span>
          </span>
        </Tooltip>
      );
    }
    case 'failed': {
      const which = file.failedPassages.length ? `passage ${file.failedPassages[file.failedPassages.length - 1]}` : 'this file';
      return (
        <span className="intake-status">
          <Tooltip content={`The model didn't finish ${which}. Run again reads the file again.`} placement="top">
            <Tag intent={Intent.DANGER} minimal size="large">
              Failed
            </Tag>
          </Tooltip>
          <Button variant="minimal" text="Run again" onClick={() => onRunAgain(file)} />
        </span>
      );
    }
    case 'notext':
      return (
        <Tooltip content={NO_TEXT} placement="top">
          <Tag intent={Intent.DANGER} minimal size="large">
            No text
          </Tag>
        </Tooltip>
      );
  }
}

/** A file's icon by format: a table for rows, a page for text. */
export function FormatIcon({ format }: { format: string }) {
  const table = format === 'csv' || format === 'json';
  return table ? <Th size={ICON} color="var(--bp-palette-gray-4)" /> : <DocumentIcon size={ICON} color="var(--bp-palette-gray-4)" />;
}

/** A name that may not fit: cut with an ellipsis, the whole name in a tooltip. */
export function FitName({ name, children }: { name: string; children?: ReactNode }) {
  return (
    <Tooltip content={name} placement="top" hoverOpenDelay={500} className="intake-fit" targetTagName="span">
      <span className="intake-fit__text">{children ?? name}</span>
    </Tooltip>
  );
}

/** The quiet "…" at the end of a row: the same menu as right-click, so no action lives only behind right-click. */
export function RowMenu({ menu, label }: { menu: ReactElement; label: string }) {
  return (
    <Popover content={menu} placement="bottom-end" minimal>
      <Button variant="minimal" icon={<More color="var(--bp-palette-gray-4)" />} aria-label={`Actions for ${label}`} />
    </Popover>
  );
}

/** A table row that opens `menu` on right-click. */
export function MenuRow({ menu, children, className, onOpen }: { menu: ReactElement; children: ReactNode; className?: string; onOpen?: () => void }) {
  return (
    <ContextMenu content={menu} tagName="tr" className={className} onDoubleClick={onOpen}>
      {children}
    </ContextMenu>
  );
}

interface FileMenuProps {
  file: IntakeFile;
  onRunAgain: (f: IntakeFile) => void;
  originalUrl: string | null;
  /** Open the file in Files; the label says where. */
  onOpen?: () => void;
  openLabel?: string;
  onDelete?: (f: IntakeFile) => void;
}

/** The menu a file row carries, from right-click and from its "…". */
export function FileMenu({ file, onRunAgain, originalUrl, onOpen, openLabel = 'Open', onDelete }: FileMenuProps) {
  const reading = file.status === 'reading' || file.status === 'importing';
  return (
    <Menu className="intake-menu">
      {onOpen && <MenuItem text={openLabel} onClick={onOpen} />}
      {originalUrl && <MenuItem text="Open original" href={originalUrl} target="_blank" />}
      <MenuItem text="Run the model again" disabled={file.status === 'notext' || reading} onClick={() => onRunAgain(file)} />
      {onDelete && (
        <>
          <MenuDivider />
          <MenuItem text="Delete…" intent={Intent.DANGER} disabled={reading} onClick={() => onDelete(file)} />
        </>
      )}
    </Menu>
  );
}

/** Delete a file after Blueprint's own confirm, never a browser dialog. `alert` goes somewhere in the view. */
export function useDeleteFile(onDeleted: (id: string) => void) {
  const { dc } = useDataClient();
  const [file, setFile] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const confirm = () => {
    if (!dc || !file) return;
    setBusy(true);
    deleteDocument(dc, file.id)
      .then(() => onDeleted(file.id))
      .catch((e: Error) => toast(`${file.name}: ${e instanceof EngineError ? e.message : 'the engine did not answer.'}`))
      .finally(() => {
        setBusy(false);
        setFile(null);
      });
  };
  return {
    ask: (f: { id: string; name: string }) => setFile(f),
    alert: (
      <Alert
        isOpen={!!file}
        intent={Intent.DANGER}
        icon={<Trash size={40} color="var(--bp-palette-red-5)" />}
        confirmButtonText="Delete"
        cancelButtonText="Cancel"
        loading={busy}
        onConfirm={confirm}
        onCancel={() => setFile(null)}
        className="intake-alert"
      >
        <p>Delete {file?.name}? What the model pulled from it goes too.</p>
      </Alert>
    ),
  };
}

/** Import files: Blueprint's button over a hidden file picker that takes several files at once. */
export function ImportButton({ onFiles, primary = true }: { onFiles: (files: File[]) => void; primary?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button intent={primary ? Intent.PRIMARY : Intent.NONE} icon={<Import />} text="Import files" onClick={() => input.current?.click()} />
      <input
        ref={input}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = '';
          if (files.length) onFiles(files);
        }}
      />
    </>
  );
}

/** Drop files anywhere on the element: outlined while dragging, files handed over on drop. */
export function useDropZone(onFiles: (files: File[]) => void) {
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);
  const hasFiles = (e: DragEvent) => [...e.dataTransfer.types].includes('Files');
  return {
    dragging,
    props: {
      onDragEnter: (e: DragEvent) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        depth.current += 1;
        setDragging(true);
      },
      onDragOver: (e: DragEvent) => {
        if (hasFiles(e)) e.preventDefault();
      },
      onDragLeave: () => {
        depth.current = Math.max(0, depth.current - 1);
        if (!depth.current) setDragging(false);
      },
      onDrop: (e: DragEvent) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        depth.current = 0;
        setDragging(false);
        const files = [...e.dataTransfer.files];
        if (files.length) onFiles(files);
      },
    },
  };
}

/** Rows that shimmer while the first read is on its way. */
export function SkeletonRows() {
  return (
    <div className="intake-skeleton">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className={Classes.SKELETON}>
          &nbsp;
        </div>
      ))}
    </div>
  );
}
