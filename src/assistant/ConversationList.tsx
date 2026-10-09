// The investigation's conversations, the most recent first. Each row names the conversation (its first question until
// renamed), how many questions it holds and when it last changed. Right-click a row, or its "…" button, for Rename
// (in place: Enter keeps, Escape drops) and Delete (asked once). Both go to the engine; the list reloads after.
import { useRef, useState } from 'react';
import { Alert, Button, ContextMenu, InputGroup, Menu, MenuItem, Popover } from '@blueprintjs/core';
import { Edit, More, Plus, Trash } from '@blueprintjs/icons';
import type { ConversationRow } from './conversations';

const questions = (n: number) => `${n} question${n === 1 ? '' : 's'}`;

function when(at: Date): string {
  const time = at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(at).setHours(0, 0, 0, 0)) / 86400000);
  if (days === 0) return `today ${time}`;
  if (days === 1) return 'yesterday';
  return at.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export interface ConversationListProps {
  conversations: ConversationRow[];
  openId: string | null;
  onOpen: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

export function ConversationList({ conversations, openId, onOpen, onNew, onRename, onDelete }: ConversationListProps) {
  const [renaming, setRenaming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<ConversationRow | null>(null);

  return (
    <aside className="assistant-list" aria-label="Conversations">
      <div className="assistant-list__head">
        <Button variant="outlined" fill icon={<Plus />} text="New conversation" onClick={onNew} />
      </div>
      <div className="assistant-list__body">
        <h6 className="caps-heading assistant-list__heading">Conversations</h6>
        {conversations.length === 0 && <p className="bp6-text-muted assistant-list__empty">Your first question starts a conversation.</p>}
        {conversations.map((c) => {
          const open = c.id === openId;
          const name = c.name;
          const meta = c.questions != null ? `${questions(c.questions)}, ${when(c.updatedAt)}` : when(c.updatedAt);
          const menu = (
            <Menu>
              <MenuItem icon={<Edit />} text="Rename" onClick={() => setRenaming(c.id)} />
              <MenuItem icon={<Trash />} intent="danger" text="Delete" onClick={() => setDeleting(c)} />
            </Menu>
          );
          if (renaming === c.id) {
            return (
              <div key={c.id} className={`assistant-list__row assistant-list__row--editing${open ? ' assistant-list__row--open' : ''}`}>
                <RenameInput
                  name={name}
                  onDone={(value) => {
                    if (value != null && value.trim() !== name) onRename(c.id, value);
                    setRenaming(null);
                  }}
                />
                <span className="bp6-text-muted">{meta}</span>
              </div>
            );
          }
          return (
            <ContextMenu key={c.id} content={menu} className={`assistant-list__row${open ? ' assistant-list__row--open' : ''}`}>
              <button type="button" className="assistant-list__open" aria-current={open || undefined} onClick={() => onOpen(c.id)} onDoubleClick={() => setRenaming(c.id)}>
                <span className="assistant-list__name">{name}</span>
                <span className="bp6-text-muted">{meta}</span>
              </button>
              <Popover content={menu} placement="bottom-end" className="assistant-list__more-wrap">
                <Button className="assistant-list__more" variant="minimal" icon={<More />} aria-label={`Rename or delete ${name}`} />
              </Popover>
            </ContextMenu>
          );
        })}
      </div>
      <Alert
        isOpen={deleting != null}
        intent="danger"
        icon={<Trash />}
        confirmButtonText="Delete"
        cancelButtonText="Cancel"
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) onDelete(deleting.id);
          setDeleting(null);
        }}
      >
        <p>
          Delete “{deleting?.name ?? ''}”?{' '}
          {deleting?.questions == null || deleting.questions === 0
            ? 'This can’t be undone.'
            : deleting.questions > 1
              ? `Its ${questions(deleting.questions)} and their answers go with it.`
              : 'Its question and answer go with it.'}
        </p>
      </Alert>
    </aside>
  );
}

function RenameInput({ name, onDone }: { name: string; onDone: (value: string | null) => void }) {
  const [value, setValue] = useState(name);
  const done = useRef(false);
  const finish = (v: string | null) => {
    if (done.current) return;
    done.current = true;
    onDone(v);
  };
  return (
    <InputGroup
      autoFocus
      aria-label="Conversation name"
      value={value}
      onValueChange={setValue}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={() => finish(value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') finish(value);
        if (e.key === 'Escape') finish(null);
      }}
    />
  );
}
