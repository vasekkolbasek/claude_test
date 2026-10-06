import type { App } from '../../app/App';
import { t } from '../../i18n';
import type { QualitySetting } from '../../meta/save';
import { h } from '../dom';
import { scheduleRefit } from '../fit';
import { icon } from '../icons';

/** Settings dialog. `inRun` hides destructive actions. */
export function openSettings(app: App, inRun: boolean, onReset?: () => void): void {
  const s = app.save.data.settings;
  const persist = () => {
    app.applySettings();
    app.save.save();
  };

  const slider = (value: number, onInput: (v: number) => void) => {
    const el = h('input', { cls: 'slider', attrs: { type: 'range', min: '0', max: '100', step: '1' } });
    el.value = String(Math.round(value * 100));
    el.style.setProperty('--v', `${el.value}%`);
    el.addEventListener('input', () => {
      el.style.setProperty('--v', `${el.value}%`);
      onInput(Number(el.value) / 100);
    });
    el.addEventListener('change', () => {
      persist();
      app.sfx('click');
    });
    return el;
  };
  const toggle = (on: boolean, onChange: (v: boolean) => void) => {
    const el = h('button', { cls: `toggle ${on ? 'on' : ''}`, attrs: { role: 'switch', 'aria-checked': String(on) } });
    el.addEventListener('click', () => {
      const v = !el.classList.contains('on');
      el.classList.toggle('on', v);
      el.setAttribute('aria-checked', String(v));
      onChange(v);
      persist();
    });
    return el;
  };
  const row = (ico: string, label: string, ctrl: HTMLElement) => h('div', { cls: 'set-row' }, icon(ico), h('span', { cls: 'sl', text: label }), ctrl);

  const qualities: QualitySetting[] = ['auto', 0, 1, 2];
  const seg = h('div', { cls: 'seg fit-row', style: { width: '100%' } });
  const renderSeg = () => {
    seg.textContent = '';
    for (const q of qualities) {
      const b = h('button', { cls: `fit-text ${s.quality === q ? 'on' : ''}`, text: t(q === 'auto' ? 'set.q.auto' : `set.q.${q}`) });
      b.addEventListener('click', () => {
        s.quality = q;
        persist();
        renderSeg();
      });
      seg.appendChild(b);
    }
    // large system fonts: shrink a label rather than cut it with «…»
    scheduleRefit();
  };
  renderSeg();

  const body = h(
    'div',
    { cls: 'col set-body', style: { 'text-align': 'left' } },
    row('music', t('set.music'), slider(s.music, (v) => {
      s.music = v;
      app.audio.setVolumes(s.music, s.sfx);
    })),
    row('sound', t('set.sfx'), slider(s.sfx, (v) => {
      s.sfx = v;
      app.audio.setVolumes(s.music, s.sfx);
    })),
    row('vibration', t('set.vibration'), toggle(s.vibration, (v) => {
      s.vibration = v;
      if (v) app.vibrate(60);
    })),
    row('area', t('set.shake'), toggle(s.shake, (v) => (s.shake = v))),
    h('div', { cls: 'section-h', text: t('set.quality') }),
    seg,
  );

  if (app.platform.kind === 'yandex' || import.meta.env.DEV) {
    body.appendChild(h('div', { cls: 'section-h', text: t('set.account') }));
    if (app.platform.isAuthorized()) body.appendChild(h('div', { cls: 'note row' }, icon('check'), t('set.loggedIn')));
    else {
      body.appendChild(
        h('button', {
          cls: 'btn small',
          onClick: async () => {
            const ok = await app.platform.openAuth();
            if (ok) {
              await app.save.resync();
              app.applySettings();
              app.ui.closeModal(m);
              onReset?.();
            }
          },
        }, icon('user'), t('set.loginCta')),
      );
    }
  }
  body.appendChild(h('div', { cls: 'note', text: t('set.controls') }));
  if (!inRun) {
    body.appendChild(
      h('button', {
        cls: 'btn danger small',
        onClick: async () => {
          const ok = await app.ui.confirm(t('set.reset'), t('set.resetConfirm'), t('set.reset'), t('common.cancel'), true);
          if (!ok) return;
          app.save.reset();
          app.applySettings();
          app.ui.toast(t('set.resetDone'), 'info', 'check');
          app.ui.closeModal(m);
          onReset?.();
        },
      }, t('set.reset')),
    );
  }

  const m = app.ui.openModal(
    h(
      'div',
      null,
      h(
        'div',
        { cls: 'dialog panel set-dialog' },
        h('h3', { text: t('set.title') }),
        body,
        h('div', { cls: 'btns' }, h('button', { cls: 'btn', text: t('common.close'), onClick: () => app.ui.closeModal(m) })),
      ),
    ),
  );
}
