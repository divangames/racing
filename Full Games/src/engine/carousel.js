////////////////////////////////////////////////////////
//
// DiVANEngine: кольцо карусели кузовов (магазин и автопарк).
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /**
   * Кратчайший сдвиг по кольцу, чтобы край ленты не мотал через все карты.
   * @param {number} from
   * @param {number} to
   * @param {number} n
   * @returns {number}
   */
  function wrapDelta(from, to, n) {
    let d = to - from;
    d = ((d % n) + n) % n;
    if (d > n / 2) d -= n;
    return d;
  }

  /**
   * Карточки в кадре: дальние сзади, выбранная сверху.
   * @param {number} scroll
   * @param {number} n
   * @param {number} [limit]
   * @returns {Array<{pos:number,d:number}>}
   */
  function visibleCards(scroll, n, limit) {
    const maxAbs = limit == null ? 1.65 : limit;
    const items = [];
    for (let p = 0; p < n; p++) {
      const d = wrapDelta(scroll, p, n);
      if (Math.abs(d) > maxAbs) continue;
      items.push({ pos: p, d });
    }
    items.sort(function (a, b) { return Math.abs(b.d) - Math.abs(a.d); });
    return items;
  }

  /**
   * Карусель: kind shop — покупка, park — смена из гаража.
   * @param {string} kind
   */
  function drawCarCarouselEngine(kind) {
    const park = kind === 'park';
    const order = carCatalogOrder();
    const n = order.length;
    const selI = park ? autoparkSel : selCar;
    const selPos = carCatalogPos(selI);
    if (park) {
      parkScroll += wrapDelta(parkScroll, selPos, n) * 0.18;
      parkScroll = ((parkScroll % n) + n) % n;
    } else {
      carSelScroll += wrapDelta(carSelScroll, selPos, n) * 0.18;
      carSelScroll = ((carSelScroll % n) + n) % n;
    }
    const scroll = park ? parkScroll : carSelScroll;
    const driveT = park ? parkDriveT : carSelDriveT;
    const hits = park ? (g._park = []) : (g._carSel = []);
    const reduce = introReduceMotion;
    drawHubBackdrop(park ? 'rgba(53,224,255,.04)' : 'rgba(53,224,255,.04)');
    drawHubHeader(park ? 'АВТОПАРК' : 'ВЫБЕРИ МАШИНУ',
      park ? '← →  листать   ·   ENTER  детали' : '← →  листать   ·   свои и ближайшие',
      park ? '#35e0ff' : '#ffd23f');
    const stageY = HUB_TOP, stageH = HUB_FOOT - HUB_TOP, pitch = 410;
    const cardH = stageH;
    g.save();
    g.beginPath(); g.rect(24, stageY - 4, W - 48, stageH + 8); g.clip();
    const items = visibleCards(scroll, n, 1.65).map(function (it) {
      return { i: order[it.pos], d: it.d };
    });
    const ch = save ? CHARS[save.char] : CHARS[0];
    items.forEach(function (item) {
      const i = item.i, d = item.d;
      const car = CARS[i];
      const focus = clamp(1 - Math.abs(d), 0, 1);
      const f2 = focus * focus;
      const sel = i === selI;
      const cw = 268 + 172 * f2;
      const x = W / 2 + d * pitch - cw / 2;
      const y = stageY;
      const owned = carIsOwned(i);
      const foreign = isForeignSignature(i);
      const unlocked = carUnlocked(i);
      const stroke = sel ? '#35e0ff' : (Math.abs(d) < 0.55 ? '#5a5468' : 'rgba(255,255,255,.08)');
      drawHubCard(x, y, cw, cardH, stroke);
      if (sel) {
        g.fillStyle = 'rgba(53,224,255,.06)'; g.fillRect(x + 2, y + 2, cw - 4, 48);
      }
      hits.push({ x: x, y: y, w: cw, h: cardH, i: i });
      txt(g, car.name, x + cw / 2, y + 28, sel ? 18 : 14, unlocked ? car.col : '#5a5468', 'center');
      const artX = x + 16, artY = y + 48, artW = cw - 32, artH = sel ? 268 : 168;
      rr(g, artX, artY, artW, artH, 10); g.fillStyle = '#1a1510'; g.fill();
      const drive = sel && !reduce && unlocked;
      const burst = drive ? Math.max(0, 1.05 - (gt - driveT)) : 0;
      const a = carPreviewAnim();
      const wr = drive ? a.wr + burst * 22 * gt : 0;
      const wa = drive ? a.wa : 0;
      const bob = drive ? a.bob : 0;
      g.save();
      rr(g, artX, artY, artW, artH, 10); g.clip();
      g.translate(artX + artW / 2, artY + artH / 2 + bob);
      drawPreviewRoad(artW, artH, drive, burst);
      const sc = previewFitScale(car, artW, artH);
      g.scale(sc, sc);
      drawCar(g, { x: 0, y: 0, ang: 0, car: car, ch: ch, nitro: drive && burst > 0.4 ? 0.5 : 0, wheelRot: wr, wheelAngle: wa }, 1);
      g.restore();
      drawVhsView(artX, artY, artW, artH, 10);
      if (!sel || !unlocked) {
        g.fillStyle = unlocked ? 'rgba(8,7,12,.42)' : 'rgba(8,7,12,.72)';
        rr(g, artX, artY, artW, artH, 10); g.fill();
      } else {
        g.strokeStyle = 'rgba(53,224,255,.4)'; g.lineWidth = 1.5;
        rr(g, artX, artY, artW, artH, 10); g.stroke();
      }
      if (!unlocked) {
        txt(g, 'ЗАБЛОКИРОВАНО', x + cw / 2, artY + artH / 2 - 8, sel ? 18 : 14, '#c4bdce', 'center');
        txt(g, 'этап ' + (CAR_UNLOCK[i].race + 1), x + cw / 2, artY + artH / 2 + 16, 12, '#6f6880', 'center', F_B);
      }
      const ow = carOwnerIdx(i);
      const by = artY + artH + (sel ? 26 : 14);
      g.save();
      g.globalAlpha = unlocked ? (sel ? 1 : 0.36) : 0.22;
      if (!sel) txt(g, 'ХАРАКТЕРИСТИКИ', x + 18, by + 8, 11, '#c4bdce', 'left', F_B);
      const barsY = by + (sel ? 0 : 20);
      const bars = [['МАКС', carBarPips(car.top, 0.9, 1.3), '#ff6b4a'], ['РАЗГОН', carBarPips(car.acc, 0.9, 1.25), '#ffd23f'], ['РУЛЬ', carBarPips(car.crn, 0.9, 1.35), '#35e0ff'], ['КОРПУС', carBarPips(car.hp, 80, 180), '#58ff6b']];
      bars.forEach(function (b, bi) {
        const ly = barsY + bi * (sel ? 22 : 20);
        txt(g, b[0], x + 18, ly, sel ? 12 : 11, '#9a93a8', 'left', F_B);
        statPips(g, x + (sel ? 108 : 86), ly - 5, b[1], b[2]);
      });
      let tx = x + 18, ty = barsY + (sel ? 100 : 88);
      const tagMax = x + cw - (ow != null ? (sel ? 168 : 96) : 16);
      car.traits.forEach(function (tr) {
        const tag = (tr.split(':')[0] || tr).trim();
        g.font = (sel ? 12 : 11) + 'px ' + F_B;
        const tw = Math.ceil(g.measureText(tag).width) + 16;
        if (tx + tw > tagMax) { tx = x + 18; ty += 26; }
        if (ty > y + cardH - 56) return;
        rr(g, tx, ty - 11, tw, sel ? 22 : 20, 6); g.fillStyle = 'rgba(255,210,63,.1)'; g.fill();
        txt(g, tag, tx + 8, ty, sel ? 12 : 11, '#d8c89a', 'left', F_B, false);
        tx += tw + 8;
      });
      g.restore();
      const st = carSelStatus(i, owned);
      if (ow != null) txt(g, st.t, x + 22, y + cardH - 22, sel ? 14 : 12, st.col, 'left', F_B);
      else txt(g, st.t, x + cw / 2, y + cardH - 22, sel ? 14 : 12, st.col, 'center', F_B);
      if (sel && !owned && !foreign && unlocked && save.cash < CARS[i].price)
        txt(g, 'не хватает $' + (CARS[i].price - save.cash), x + cw / 2, y + cardH - 42, 11, '#ff3d2e', 'center', F_B);
      if (ow != null) drawCarOwnerCorner(x, y, cw, cardH, ow, sel ? 228 : 110);
    });
    g.restore();
    const pulse = 0.6 + 0.4 * Math.sin(gt * 3.2);
    g.globalAlpha = n > 1 ? pulse : 0.3;
    g.fillStyle = '#35e0ff';
    g.beginPath(); g.moveTo(34, H / 2 - 16); g.lineTo(16, H / 2); g.lineTo(34, H / 2 + 16); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(W - 34, H / 2 - 16); g.lineTo(W - 16, H / 2); g.lineTo(W - 34, H / 2 + 16); g.closePath(); g.fill();
    g.globalAlpha = 1;
    hits.push({ x: 6, y: H / 2 - 36, w: 40, h: 72, act: 'prev' });
    hits.push({ x: W - 46, y: H / 2 - 36, w: 40, h: 72, act: 'next' });
    const gap = 22, dotsW = n * gap, dx = W / 2 - dotsW / 2, dy = H - 48;
    for (let p = 0; p < n; p++) {
      const on = p === selPos;
      g.fillStyle = on ? '#35e0ff' : '#3a3548';
      g.beginPath(); g.arc(dx + p * gap + gap / 2, dy, on ? 5 : 3.5, 0, TAU); g.fill();
      hits.push({ x: dx + p * gap, y: dy - 12, w: gap, h: 24, i: order[p] });
    }
    const hint = park
      ? (carUnlocked(selI) ? 'ENTER — детали   ·   ESC — в гараж' : 'закрыто   ·   ESC — в гараж')
      : (carConfirmed ? 'ENTER — НА СТАРТ!' : (isForeignSignature(selCar) ? 'только просмотр   ·   ESC — назад' : 'ENTER — купить/выбрать   ·   ESC — назад'));
    txt(g, hint, W / 2, H - 20, 13, (!park && carConfirmed) ? '#58ff6b' : '#6f6880', 'center', F_B);
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.carousel = { wrapDelta, visibleCards };
  engine.replace('carSelWrapDelta', wrapDelta);
  engine.replace('drawCarCarousel', drawCarCarouselEngine);
})(typeof window !== 'undefined' ? window : globalThis);
