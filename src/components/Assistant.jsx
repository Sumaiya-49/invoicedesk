import { useEffect, useRef } from 'react';
import { useApp } from '../store.jsx';
import { Icon, Button, IconButton, Segmented, cx } from './ui.jsx';

export function Assistant() {
  const { s, a } = useApp();
  const { open, mode, messages, text, thinking } = s.chat;
  const engine = s.aiProviders.length ? `AI by ${s.aiProviders.join(', then ')}` : 'Simple mode: no AI key set';
  const listRef = useRef(null);
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length, open, thinking]);

  if (!open) {
    return (
      <button type="button" onClick={a.chat.toggle} aria-label="Open assistant"
        className="fixed z-40 inline-flex h-14 w-14 items-center justify-center gap-2 rounded-full bg-accent font-semibold text-accent-ink shadow-xl hover:brightness-110 cursor-pointer sm:w-auto sm:pl-4 sm:pr-5"
        style={{ right: 'calc(20px + env(safe-area-inset-right, 0px))', bottom: 'calc(20px + env(safe-area-inset-bottom, 0px))' }}>
        <Icon name="sparkle" size={20} /><span className="hidden sm:inline">Ask assistant</span>
      </button>
    );
  }

  const write = mode === 'write';
  return (
    <aside aria-label="Invoice assistant"
      className="fixed z-40 flex w-[min(420px,100%)] flex-col border-l border-line bg-surface shadow-2xl"
      style={{ top: 'env(safe-area-inset-top, 0px)', bottom: 0, right: 0, paddingRight: 'env(safe-area-inset-right, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="flex flex-col gap-3 border-b border-line p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-accent"><Icon name="sparkle" size={18} /></div>
            <div>
              <div className="font-display font-semibold leading-tight">Invoice assistant</div>
              <div className="text-xs text-muted">{engine}</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 1 && <Button size="sm" variant="ghost" onClick={a.chat.clear}>Clear chat</Button>}
            <IconButton icon="close" label="Close assistant" onClick={a.chat.toggle} />
          </div>
        </div>
        <Segmented label="Assistant mode" value={mode} onChange={a.chat.setMode} className="w-full" stretch
          options={[['read', 'Read'], ['write', 'Write']]} />
        <div className={cx('flex items-start gap-2 rounded-xl px-3 py-2 text-xs leading-relaxed', write ? 'bg-warn-soft text-warn' : 'bg-ok-soft text-ok')}>
          <Icon name={write ? 'edit' : 'lock'} size={14} className="mt-0.5" />
          <span>{write
            ? 'Write mode: I can create, update and delete records. You’ll see a preview and confirm before anything is saved.'
            : 'Read mode: I only look things up in your invoices, quotes and expenses. I can’t change anything.'}</span>
        </div>
      </div>

      <div ref={listRef} className="flex flex-1 flex-col gap-3 overflow-y-auto bg-bg/60 p-4">
        {messages.map((m) => m.from === 'user'
          ? <div key={m.id} className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-accent px-3.5 py-2.5 text-sm text-accent-ink">{m.text}</div>
          : <BotMessage key={m.id} m={m} />)}
        {thinking && (
          <div className="flex items-center gap-2 self-start rounded-2xl rounded-bl-md border border-line bg-surface px-3.5 py-2.5 text-sm text-muted" role="status">
            <span className="typing-dots flex gap-1" aria-hidden="true"><i /><i /><i /></span>Looking at your records…
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2.5 border-t border-line p-4">
        <div className="flex flex-wrap gap-1.5">
          {a.chat.suggestions(mode).map(([label, run]) => (
            <button key={label} type="button" onClick={run} disabled={thinking}
              className="rounded-full border border-line bg-surface px-3 py-1.5 text-left text-[13px] text-ink hover:border-accent hover:text-accent cursor-pointer">{label}</button>
          ))}
        </div>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); a.chat.send(); }}>
          <label htmlFor="chat-input" className="sr-only">Message the assistant</label>
          <input id="chat-input" value={text} onChange={(e) => a.chat.setText(e.target.value)}
            placeholder={write ? 'e.g. Mark INV-0010 as paid' : 'e.g. Which invoices are overdue?'}
            className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25" />
          <button type="submit" aria-label="Send" disabled={thinking} className="disabled:opacity-50 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-ink hover:brightness-110 cursor-pointer"><Icon name="send" size={18} /></button>
        </form>
      </div>
    </aside>
  );
}

function BotMessage({ m }) {
  const { a } = useApp();
  return (
    <div className="flex max-w-[94%] flex-col gap-2 self-start">
      <div className="whitespace-pre-line rounded-2xl rounded-bl-md border border-line bg-surface px-3.5 py-2.5 text-sm leading-relaxed">{m.text.replace(/\*\*(.+?)\*\*/g, '$1')}</div>
      {m.table?.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-line bg-surface text-[13px]">
          {m.table.map((r, i) => (
            <div key={i} className="flex items-center gap-3 border-b border-line/70 px-3 py-2 last:border-0">
              <span className="font-semibold">{r[0]}</span><span className="min-w-0 flex-1 truncate text-muted">{r[1]}</span><span className="tabular-nums font-medium">{r[2]}</span>
            </div>
          ))}
        </div>
      )}
      {m.card && (
        <div className="overflow-hidden rounded-xl border border-accent/30 bg-surface">
          <div className="flex items-center justify-between gap-2 bg-accent-soft px-3 py-2 text-[13px] font-semibold text-accent">
            <span>{m.card.title}</span><span className="text-xs font-medium opacity-80">Preview · not saved</span>
          </div>
          <div className="px-3 py-1">
            {m.card.rows.map(([k, v, strong], i) => (
              <div key={i} className="flex justify-between gap-3 border-b border-line/60 py-1.5 text-[13px] last:border-0">
                <span className="text-muted">{k}</span><span className={cx('text-right tabular-nums', strong ? 'font-bold' : 'font-medium')}>{v}</span>
              </div>
            ))}
          </div>
          {m.card.warning && <div className="mx-3 mb-2 rounded-lg bg-danger-soft px-2.5 py-1.5 text-xs font-medium text-danger">{m.card.warning}</div>}
          {m.status === 'pending' && (
            <div className="flex gap-2 p-3 pt-1">
              <Button variant="primary" size="sm" className="flex-1" onClick={() => a.chat.confirm(m.id)}>Confirm</Button>
              <Button size="sm" className="flex-1" onClick={() => a.chat.cancel(m.id)}>Cancel</Button>
            </div>
          )}
          {m.status === 'saving' && <div className="bg-sunken px-3 py-2 text-[13px] font-semibold text-muted" role="status">Saving…</div>}
          {m.status === 'done' && <div className="flex items-center gap-1.5 bg-ok-soft px-3 py-2 text-[13px] font-semibold text-ok"><Icon name="check" size={15} />Confirmed and saved</div>}
          {m.status === 'expired' && <div className="bg-sunken px-3 py-2 text-[13px] font-semibold text-muted">Preview expired · nothing was changed. Ask again to make this change.</div>}
          {m.status === 'cancelled' && <div className="bg-sunken px-3 py-2 text-[13px] font-semibold text-muted">Cancelled · nothing changed</div>}
        </div>
      )}
      {(m.whatsapp || m.openNo) && (
        <div className="flex flex-wrap gap-2">
          {m.whatsapp && (
            <a href={m.whatsapp} target="_blank" rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-accent px-3 text-[13px] font-semibold text-accent-ink shadow-sm hover:brightness-110">
              <Icon name="chat" size={15} />Open WhatsApp
            </a>
          )}
          {m.openNo && <Button size="sm" icon="eye" onClick={() => a.viewInvoice(m.openNo)}>Open {m.openNo}</Button>}
        </div>
      )}
      {(m.engine || m.source) && (
        <div className="flex items-center gap-1.5 text-[11px] text-muted">
          <Icon name="db" size={12} />{[m.engine, m.source && `used ${m.source}`].filter(Boolean).join(' · ')}
        </div>
      )}
    </div>
  );
}
