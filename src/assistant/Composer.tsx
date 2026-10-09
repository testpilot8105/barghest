// The input under the conversation: the question, Ask, and under them the model switcher and the keys. Enter sends,
// Shift+Enter adds a line. Local models come first in the switcher; an online model is optional, off by default, and
// says plainly that passages would leave this Mac (owner, 09.10.2026: "it should be local AI", with a way to switch).
import type { Ref } from 'react';
import { Button, Menu, MenuDivider, MenuItem, Popover, Tag, TextArea } from '@blueprintjs/core';
import { CaretDown, Cog, Desktop, SendMessage } from '@blueprintjs/icons';

export interface ComposerProps {
  draft: string;
  onDraft: (text: string) => void;
  onAsk: () => void;
  busy: boolean;
  placeholder: string;
  inputRef: Ref<HTMLTextAreaElement>;
  /** The local chat model the engine runs, or null while the engine has it off. */
  model: string | null;
  modelOff: boolean;
}

export function Composer({ draft, onDraft, onAsk, busy, placeholder, inputRef, model, modelOff }: ComposerProps) {
  const ready = draft.trim().length > 0 && !busy;
  return (
    <footer className="assistant-composer">
      <div className="assistant-composer__row">
        <TextArea
          inputRef={inputRef}
          className="assistant-composer__input"
          fill
          aria-label="Question"
          placeholder={placeholder}
          value={draft}
          onChange={(e) => onDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
            e.preventDefault();
            if (ready) onAsk();
          }}
        />
        <Button className="assistant-composer__ask" intent="primary" icon={<SendMessage />} text="Ask" disabled={!ready} onClick={onAsk} />
      </div>
      <div className="assistant-composer__footer">
        <ModelSwitcher model={model} modelOff={modelOff} />
        <span className="bp6-text-muted">Enter sends, Shift+Enter adds a new line</span>
      </div>
    </footer>
  );
}

function ModelSwitcher({ model, modelOff }: { model: string | null; modelOff: boolean }) {
  const name = model ?? 'Local model';
  const menu = (
    <Menu className="assistant-models" aria-label="Models">
      <MenuDivider title={<span className="caps-heading">On this Mac</span>} />
      <MenuItem
        roleStructure="listoption"
        selected
        multiline
        text={<ModelText name={name} detail={modelOff ? 'The engine has the local model off.' : 'Nothing leaves this Mac.'} />}
      />
      <MenuDivider title={<span className="caps-heading">Online</span>} />
      <MenuItem disabled multiline text={<ModelText name="No online model set up" detail="Optional and off by default. An online model sends passages off this Mac." />} />
      <MenuDivider />
      <MenuItem disabled icon={<Cog />} text="Set up online models…" />
    </Menu>
  );
  return (
    <Popover content={menu} placement="top-start">
      <Button className="assistant-composer__model" variant="outlined" icon={<Desktop />} endIcon={<CaretDown />} aria-label={`Model: ${name}`}>
        {name}
        <Tag size="large" minimal intent={modelOff ? 'none' : 'success'}>
          {modelOff ? 'Off' : 'On this Mac'}
        </Tag>
      </Button>
    </Popover>
  );
}

function ModelText({ name, detail }: { name: string; detail: string }) {
  return (
    <span className="assistant-models__text">
      <span>{name}</span>
      <span className="bp6-text-muted">{detail}</span>
    </span>
  );
}
