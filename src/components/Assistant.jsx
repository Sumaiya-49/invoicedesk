import { useEffect, useRef } from 'react';
import { useApp } from '../store.jsx';
import { Icon, Button, IconButton, Segmented, cx } from './ui.jsx';
import { burst } from '../lib/effects.js';

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
        className="fx-fab fixed z-40 inline-flex h-14 w-14 items-center justify-center gap-2 rounded-full text-[15px] font-extrabold cursor-pointer sm:w-auto sm:pl-5 sm:pr-6"
        style={{ right: 'calc(20px + env(safe-area-inset-right, 0px))', bottom: 'calc(20px + env(safe-area-inset-bottom, 0px))' }}>
        <Icon name="sparkle" size={22} className="fx-twinkle" /><span className="hidden sm:inline">Ask assistant</span>
      </button>
    );
  }

  const write = mode === 'write';
  return (
    <aside aria-label="Invoice assistant"
      className="fx-drawer fixed z-40 flex w-[min(430px,100%)] flex-col border-l border-white/10 shadow-[-20px_0_60px_rgba(0,0,0,.6)]"
      style={{ top: 'env(safe-area-inset-top, 0px)', bottom: 0, right: 0, paddingRight: 'env(safe-area-inset-right, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="flex flex-col gap-3 border-b border-line p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="fx-brand flex h-9 w-9 items-center justify-center rounded-xl"><Icon name="sparkle" size={18} /></div>
            <div>
              <div className="font-display font-semibold leading-tight">Invoice assistant</div>
              <div className="flex items-center gap-1.5 text-xs text-muted">{s.aiProviders.length > 0 && <span className="fx-live h-1.5 w-1.5" aria-hidden="true" />}{engine}</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 1 && <Button size="sm" variant="ghost" onClick={a.chat.clear}>Clear chat</Button>}
            <IconButton icon="close" label="Close assistant" onClick={a.chat.toggle} />
          </div>
        </div>
        <Segmented label="Assistant mode" value={mode} onChange={a.chat.setMode} className="w-full" stretch
          options={[['read', 'Read'], ['write', 'Write']]} />
        <div className={cx('flex items-start gap-2 rounded-xl border px-3 py-2 text-xs leading-relaxed transition-colors duration-300', write ? 'border-warn/30 bg-warn-soft text-warn' : 'border-ok/25 bg-ok-soft text-ok')}>
          <Icon name={write ? 'edit' : 'lock'} size={14} className="mt-0.5" />
          <span>{write
            ? 'Write mode: I can create, update and delete records. You’ll see a preview and confirm before anything is saved.'
            : 'Read mode: I only look things up in your invoices, quotes and expenses. I can’t change anything.'}</span>
        </div>
      </div>

      <div ref={listRef} className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        {messages.map((m) => m.from === 'user'
          ? <div key={m.id} className="fx-msg fx-user-msg max-w-[85%] self-end rounded-2xl rounded-br-md px-3.5 py-2.5 text-sm">{m.text}</div>
          : <BotMessage key={m.id} m={m} />)}
        {thinking && (
          <div className="fx-msg flex items-center gap-2.5 self-start rounded-2xl rounded-bl-md border border-line bg-sunken px-3.5 py-2.5 text-sm text-muted" role="status">
            <span className="fx-typing flex gap-1" aria-hidden="true"><i /><i /><i /></span>Looking at your records…
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2.5 border-t border-line p-4">
        <div className="flex flex-wrap gap-1.5">
          {a.chat.suggestions(mode).map(([label, run]) => (
            <button key={label} type="button" onClick={run} disabled={thinking}
              className="fx-chip rounded-full border border-white/15 bg-transparent px-3 py-1.5 text-left text-[13px] text-muted transition-all cursor-pointer">{label}</button>
          ))}
        </div>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); a.chat.send(); }}>
          <label htmlFor="chat-input" className="sr-only">Message the assistant</label>
          <input id="chat-input" value={text} onChange={(e) => a.chat.setText(e.target.value)}
            placeholder={write ? 'e.g. Mark INV-0010 as paid' : 'e.g. Which invoices are overdue?'}
            className="fx-input h-11 min-w-0 flex-1 rounded-full border-[1.5px] border-white/15 bg-transparent px-4 text-sm text-ink placeholder:text-muted focus:outline-none" />
          <button type="submit" aria-label="Send" disabled={thinking} className="fx-send inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(45deg,#FF357A,#FFF172)] text-[#1A1A1A] transition-all disabled:opacity-50 cursor-pointer"><Icon name="send" size={18} /></button>
        </form>
      </div>
    </aside>
  );
}

function BotMessage({ m }) {
  const { a } = useApp();
  return (
    <div className="fx-msg flex max-w-[94%] flex-col gap-2 self-start">
      <div className="whitespace-pre-line rounded-2xl rounded-bl-md border border-line bg-sunken px-3.5 py-2.5 text-sm leading-relaxed">{m.text.replace(/\*\*(.+?)\*\*/g, '$1')}</div>
      {m.table?.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-line bg-sunken text-[13px]">
          {m.table.map((r, i) => (
            <div key={i} className="flex items-center gap-3 border-b border-line/70 px-3 py-2 last:border-0">
              <span className="font-semibold">{r[0]}</span><span className="min-w-0 flex-1 truncate text-muted">{r[1]}</span><span className="tabular-nums font-medium">{r[2]}</span>
            </div>
          ))}
        </div>
      )}
      {m.card && (
        <div className={cx('fx-preview overflow-hidden rounded-xl border-[1.5px] bg-[rgba(61,255,110,.04)]', m.status === 'pending' && 'fx-preview-scan')}>
          <div className="flex items-center justify-between gap-2 border-b border-accent/20 bg-accent-soft/60 px-3 py-2 text-[13px] font-semibold text-accent">
            <span>{m.card.title}</span><span className="text-xs font-medium opacity-80">Preview · not saved</span>
          </div>
          <div className="px-3 py-1">
            {m.card.rows.map(([k, v, strong], i) => (
              <div key={i} className="flex justify-between gap-3 border-b border-line/60 py-1.5 text-[13px] last:border-0">
                <span className="text-muted">{k}</span><span className={cx('text-right tabular-nums', strong ? 'fx-glow font-extrabold text-[#FFF15C]' : 'font-medium')}>{v}</span>
              </div>
            ))}
          </div>
          {m.card.warning && <div className="mx-3 mb-2 rounded-lg bg-danger-soft px-2.5 py-1.5 text-xs font-medium text-danger">{m.card.warning}</div>}
          {m.status === 'pending' && (
            <div className="relative z-[1] flex gap-2 p-3 pt-1">
              <Button variant="confirm" size="sm" icon="check" className="flex-1" onClick={(e) => { burst(e.clientX, e.clientY); a.chat.confirm(m.id); }}>Confirm</Button>
              <Button size="sm" className="flex-1" onClick={() => a.chat.cancel(m.id)}>Cancel</Button>
            </div>
          )}
          {m.status === 'saving' && <div className="flex items-center gap-2 bg-sunken px-3 py-2 text-[13px] font-semibold text-muted" role="status"><span className="fx-typing flex gap-1" aria-hidden="true"><i /><i /><i /></span>Saving…</div>}
          {m.status === 'done' && <div className="fx-glow flex items-center gap-1.5 bg-ok-soft px-3 py-2 text-[13px] font-bold text-ok"><Icon name="check" size={15} stroke={3} />Confirmed and saved</div>}
          {m.status === 'expired' && <div className="bg-sunken px-3 py-2 text-[13px] font-semibold text-muted">Preview expired · nothing was changed. Ask again to make this change.</div>}
          {m.status === 'cancelled' && <div className="bg-sunken px-3 py-2 text-[13px] font-semibold text-muted">Cancelled · nothing changed</div>}
        </div>
      )}
      {m.openNo && <div><Button size="sm" icon="eye" onClick={() => a.viewInvoice(m.openNo)}>Open {m.openNo}</Button></div>}
      {(m.engine || m.source) && (
        <div className="flex items-center gap-1.5 text-[11px] text-muted">
          <Icon name="db" size={12} />{[m.engine, m.source && `used ${m.source}`].filter(Boolean).join(' · ')}
        </div>
      )}
    </div>
  );
}
