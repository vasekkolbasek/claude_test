import type { App } from '../../app/App';
import { t } from '../../i18n';
import { h } from '../dom';
import { icon } from '../icons';

export interface ReviveOptions {
  freeLeft: number;
  adAvailable: boolean;
  onFree: () => void;
  onAd: () => Promise<boolean>;
  onDecline: () => void;
}

export function openRevive(app: App, o: ReviveOptions): void {
  let busy = false;
  const close = () => app.ui.closeModal(m);
  const btns = h('div', { cls: 'btns' });
  if (o.freeLeft > 0) {
    btns.appendChild(
      h('button', {
        cls: 'btn primary',
        onClick: () => {
          if (busy) return;
          busy = true;
          close();
          o.onFree();
        },
      }, icon('heal'), t('revive.free', { n: o.freeLeft })),
    );
  }
  if (o.adAvailable) {
    const b = h('button', { cls: `btn ad ${o.freeLeft > 0 ? '' : 'primary'}`, attrs: { 'data-test': 'revive-ad' } }, icon('video', 'video'), t('revive.ad'));
    b.addEventListener('click', async () => {
      if (busy) return;
      busy = true;
      b.disabled = true;
      const ok = await o.onAd();
      busy = false;
      if (ok) close();
      else b.disabled = false;
    });
    btns.appendChild(b);
  }
  btns.appendChild(
    h('button', {
      cls: 'btn ghost',
      attrs: { 'data-test': 'revive-decline' },
      onClick: () => {
        if (busy) return;
        busy = true;
        close();
        o.onDecline();
      },
    }, t('revive.decline')),
  );
  const m = app.ui.openModal(h('div', null, h('div', { cls: 'dialog panel' }, h('h3', { text: t('revive.title') }), h('p', { text: t('revive.text') }), btns)));
}
