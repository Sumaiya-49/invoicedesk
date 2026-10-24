// Small UI effects shared by every page (the matching styles are the "fx-" classes in index.css).
// - spotlight: cards with .fx-card get a soft light that follows the mouse
// - tilt: cards with .fx-tilt lean towards the mouse in 3D
// - ripple: buttons with .fx-btn show a ripple where you click
// - burst: neon sparks, used when the assistant's change is confirmed
// - useCountUp: numbers count up from 0 when a page opens
import { useEffect, useState } from 'react';

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Installs the mouse effects once for the whole app. Returns a cleanup function. */
export function installEffects() {
  const onMove = (e) => {
    const card = e.target.closest?.('.fx-card');
    if (!card) return;
    const r = card.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    card.style.setProperty('--mx', `${x}px`);
    card.style.setProperty('--my', `${y}px`);
    if (card.classList.contains('fx-tilt') && !reducedMotion() && e.pointerType === 'mouse') {
      card.style.transform = `rotateX(${(r.height / 2 - y) / 14}deg) rotateY(${(x - r.width / 2) / 18}deg) translateY(-3px)`;
    }
  };
  const onLeave = (e) => {
    if (e.target.classList?.contains('fx-tilt')) e.target.style.transform = '';
  };
  const onDown = (e) => {
    const btn = e.target.closest?.('.fx-btn');
    if (!btn || btn.disabled || reducedMotion()) return;
    const r = btn.getBoundingClientRect(), size = Math.max(r.width, r.height);
    const dot = document.createElement('span');
    dot.className = 'fx-ripple';
    Object.assign(dot.style, { width: `${size}px`, height: `${size}px`, left: `${e.clientX - r.left - size / 2}px`, top: `${e.clientY - r.top - size / 2}px` });
    btn.appendChild(dot);
    setTimeout(() => dot.remove(), 650);
  };
  document.addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerleave', onLeave, { capture: true, passive: true }); // capture: pointerleave doesn't bubble
  document.addEventListener('pointerdown', onDown);
  return () => {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerleave', onLeave, { capture: true });
    document.removeEventListener('pointerdown', onDown);
  };
}

/** Neon sparks flying out from a point on the screen. */
export function burst(x, y) {
  if (reducedMotion()) return;
  const colours = ['#3DFF6E', '#FFF15C', '#FF3D7F'];
  for (let i = 0; i < 22; i++) {
    const p = document.createElement('span');
    const angle = Math.random() * Math.PI * 2, dist = 40 + Math.random() * 70, c = colours[i % 3];
    p.className = 'fx-spark';
    Object.assign(p.style, { left: `${x}px`, top: `${y}px`, background: c, boxShadow: `0 0 8px ${c}` });
    p.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
    p.style.setProperty('--dy', `${Math.sin(angle) * dist}px`);
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 950);
  }
}

/** Counts from 0 up to `target` (eases out). Re-runs when the target changes. */
export function useCountUp(target, ms = 1300) {
  const [value, setValue] = useState(reducedMotion() ? target : 0);
  useEffect(() => {
    if (reducedMotion()) { setValue(target); return undefined; }
    let frame, start;
    const step = (t) => {
      start ??= t;
      const p = Math.min(1, (t - start) / ms);
      setValue(target * (1 - Math.pow(1 - p, 4)));
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, ms]);
  return value;
}

/** True on phone-sized screens (under 768px). Pages show card lists instead of wide tables there. */
export function useIsPhone() {
  const query = '(max-width: 767.98px)';
  const [phone, setPhone] = useState(() => window.matchMedia?.(query).matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setPhone(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return phone;
}
