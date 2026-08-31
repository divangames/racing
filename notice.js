////////////////////////////////////////////////////////
//
// Донесение: браузерный образ заканчивается, будет клиент.
// Показ один раз на титуле, пока игрок не закроет.
//
////////////////////////////////////////////////////////
'use strict';

const CLIENT_NOTICE_KEY = 'rnr_client_notice_v1';

const CLIENT_NOTICE = {
 open: false,
 t0: 0,
 btn: null
};

/** Уже закрывали это донесение. */
function clientNoticeSeen() {
 try {
  return localStorage.getItem(CLIENT_NOTICE_KEY) === '1';
 } catch (e) {
  return false;
 }
}

/** Запоминает закрытие, чтобы не крутить окно каждый заход. */
function clientNoticeMarkSeen() {
 try {
  localStorage.setItem(CLIENT_NOTICE_KEY, '1');
 } catch (e) {}
}

/** Открыть после загрузки, если ещё не читали. */
function clientNoticeOpenIfNeeded() {
 if (typeof labTest !== 'undefined' && labTest) return;
 if (CLIENT_NOTICE.open || clientNoticeSeen()) return;
 CLIENT_NOTICE.open = true;
 CLIENT_NOTICE.t0 = typeof performance !== 'undefined' ? performance.now() : 0;
}

/** Закрыть и отдать управление меню. */
function clientNoticeClose() {
 if (!CLIENT_NOTICE.open) return;
 CLIENT_NOTICE.open = false;
 CLIENT_NOTICE.btn = null;
 clientNoticeMarkSeen();
 if (typeof sClick === 'function') sClick();
}

/** Клавиши, пока висит донесение. true — событие съедено. */
function clientNoticePress(c) {
 if (!CLIENT_NOTICE.open) return false;
 if (typeof isConfirm === 'function' && isConfirm(c)) {
  clientNoticeClose();
  return true;
 }
 if (typeof isBack === 'function' && isBack(c)) {
  clientNoticeClose();
  return true;
 }
 return true;
}

/** Клик по кнопке. */
function clientNoticeClick(x, y) {
 if (!CLIENT_NOTICE.open) return false;
 const b = CLIENT_NOTICE.btn;
 if (!b) return true;
 if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) clientNoticeClose();
 return true;
}

/** Карточка: грязно-гламурная, не админ-плашка. */
function drawClientNotice() {
 if (!CLIENT_NOTICE.open) return;
 const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
 const now = typeof performance !== 'undefined' ? performance.now() : 0;
 const age = Math.max(0, (now - CLIENT_NOTICE.t0) / 1000);
 const fade = reduce ? 1 : Math.min(1, age / 0.28);
 const bob = reduce ? 0 : Math.sin(age * 1.15) * 3;

 g.save();
 g.globalAlpha = fade;

 g.fillStyle = 'rgba(4,2,8,.72)';
 g.fillRect(0, 0, W, H);
 const vg = g.createRadialGradient(W / 2, H * 0.42, 40, W / 2, H * 0.48, H * 0.78);
 vg.addColorStop(0, 'rgba(0,0,0,0)');
 vg.addColorStop(1, 'rgba(2,1,6,.55)');
 g.fillStyle = vg;
 g.fillRect(0, 0, W, H);

 const mw = Math.min(820, W - 80);
 const mh = 448;
 const mx = (W - mw) / 2;
 const my = (H - mh) / 2 + bob;

 g.save();
 g.shadowColor = 'rgba(0,0,0,.65)';
 g.shadowBlur = 28;
 g.shadowOffsetY = 14;
 panel(g, mx, my, mw, mh, 'rgba(12,8,16,.97)', '#ff9d2e', 18);
 g.restore();

 const shine = g.createLinearGradient(mx, my, mx, my + 70);
 shine.addColorStop(0, 'rgba(255,210,63,.12)');
 shine.addColorStop(1, 'rgba(255,210,63,0)');
 g.fillStyle = shine;
 g.fillRect(mx + 18, my + 2, mw - 36, 56);

 g.fillStyle = '#ff9d2e';
 g.fillRect(mx + 18, my + 22, 10, 46);

 txt(g, 'ДОНЕСЕНИЕ СТУДИИ', mx + 44, my + 44, 13, '#8f88a0', 'left', F_B);
 txt(g, 'СКОРО — КЛИЕНТ', W / 2, my + 96, 36, '#ffd23f', 'center');
 txt(g, 'Браузерный образ заканчивается', W / 2, my + 132, 16, '#c8c2d4', 'center', F_B);

 const inner = mw - 96;
 const p1 = 'Игра выходит из вкладки. Придётся качать. Дополнения клиент подтянет сам — руками ничего ловить не надо.';
 const p2 = 'Контент тяжелеет: комиксы, машины, музыка. Для стабильности это станет обычной игрой. Зато появится смысл в онлайне — рекорды, заезды с друзьями, общий стол очков.';
 const y1 = my + 178;
 const lines1 = layoutLines(g, p1, inner, 16, F_B);
 lines1.forEach(function (ln, i) {
  txt(g, ln, W / 2, y1 + i * 22, 16, '#e8e2d0', 'center', F_B);
 });
 const y2 = y1 + lines1.length * 22 + 18;
 const lines2 = layoutLines(g, p2, inner, 16, F_B);
 lines2.forEach(function (ln, i) {
  txt(g, ln, W / 2, y2 + i * 22, 16, '#b8b0c4', 'center', F_B);
 });

 const bw = 280, bh = 54;
 const bx = W / 2 - bw / 2;
 const by = my + mh - 86;
 const pulse = reduce ? 1 : 0.85 + Math.sin(age * 3.2) * 0.15;
 panel(g, bx, by, bw, bh, 'rgba(255,157,46,' + (0.16 * pulse).toFixed(3) + ')', '#ff9d2e', 12);
 txt(g, 'ПОНЯТНО', bx + bw / 2, by + 27, 22, '#ffd23f', 'center');
 txt(g, 'ENTER / ESC', W / 2, my + mh - 28, 12, '#6f6880', 'center', F_B);

 CLIENT_NOTICE.btn = { x: bx, y: by, w: bw, h: bh };
 g.restore();
}
