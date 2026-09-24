////////////////////////////////////////////////////////
//
// Финиш: две сторожевые башни и рваные флаги, вид строго сверху.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  const TAU_LOCAL = Math.PI * 2;
  const RED = ['#8d3027', '#a34330', '#742a25'];
  const BONE = ['#b9a783', '#c8b894', '#a99a7e'];
  const towerSprite = typeof Image === 'undefined' ? null : new Image();
  if (towerSprite) towerSprite.src = '/__engine/sprites/finish-tower.png';
  const clothRed = typeof Image === 'undefined' ? null : new Image();
  const clothBone = typeof Image === 'undefined' ? null : new Image();
  if (clothRed) clothRed.src = '/__engine/sprites/finish-cloth-red.png';
  if (clothBone) clothBone.src = '/__engine/sprites/finish-cloth-bone.png';

  function clothReady(image) { return image && image.complete && image.naturalWidth >= 512; }

  function line(c, points, color, width) {
    c.strokeStyle = color;
    c.lineWidth = width;
    c.beginPath();
    c.moveTo(points[0], points[1]);
    for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]);
    c.stroke();
  }

  function plate(c, x, y, w, h, fill, rim) {
    c.fillStyle = '#17191a';
    c.fillRect(x - 3, y - 3, w + 6, h + 6);
    c.fillStyle = rim;
    c.fillRect(x - 1, y - 1, w + 2, h + 2);
    c.fillStyle = fill;
    c.fillRect(x + 2, y + 2, w - 4, h - 4);
  }

  function lamp(c, x, y, time) {
    const pulse = .78 + .22 * Math.sin(time * 3.1);
    c.fillStyle = 'rgba(8,7,7,.46)';
    c.beginPath(); c.ellipse(x + 3, y + 4, 13, 11, 0, 0, TAU_LOCAL); c.fill();
    c.fillStyle = '#17191a';
    c.beginPath(); c.arc(x, y, 10, 0, TAU_LOCAL); c.fill();
    c.strokeStyle = '#a76536'; c.lineWidth = 2;
    c.beginPath(); c.arc(x, y, 8, 0, TAU_LOCAL); c.stroke();
    c.fillStyle = 'rgba(255,125,34,' + pulse + ')';
    c.beginPath(); c.arc(x, y, 5.5, 0, TAU_LOCAL); c.fill();
    c.fillStyle = '#ffd986';
    c.fillRect(x - 2, y - 3, 3, 3);
    c.strokeStyle = 'rgba(31,17,10,.48)'; c.lineWidth = 1;
    line(c, [x - 7, y, x + 7, y], c.strokeStyle, 1);
    line(c, [x, y - 7, x, y + 7], c.strokeStyle, 1);
  }

  function tower(c, y, side, time) {
    if (towerSprite && towerSprite.complete && towerSprite.naturalWidth) {
      c.save();
      c.translate(-27, y);
      if (side < 0) c.rotate(Math.PI);
      c.drawImage(towerSprite, -53, -53, 106, 106);
      c.restore();
      return;
    }
    c.save();
    c.translate(-27, y);
    // All roof details are plan view. Only the short offset shadow suggests height.
    c.fillStyle = 'rgba(10,8,7,.38)';
    c.fillRect(-39, -37, 82, 80);
    plate(c, -42, -40, 78, 76, '#3a332d', '#9a5937');
    c.fillStyle = '#1f2324';
    c.fillRect(-39, -37, 72, 70);
    c.strokeStyle = '#855139'; c.lineWidth = 5;
    c.strokeRect(-35, -33, 64, 62);
    line(c, [-33, -31, 29, 28], '#ab6842', 4);
    line(c, [29, -31, -33, 28], '#573b2d', 4);
    // Uneven corrugated roof with welded repairs and rust.
    plate(c, -30, -27, 55, 48, '#655b4a', '#a97445');
    c.fillStyle = '#514d43'; c.fillRect(-25, -22, 45, 37);
    for (let i = 0; i < 7; i++) {
      line(c, [-25 + i * 7, -22, -25 + i * 7, 15], i % 2 ? '#9a7652' : '#292c2b', 1.5);
    }
    c.fillStyle = '#302d2a';
    c.beginPath(); c.moveTo(-21, -10); c.lineTo(-13, -16); c.lineTo(-8, -9); c.lineTo(-17, -4); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(9, 3); c.lineTo(16, -1); c.lineTo(18, 8); c.closePath(); c.fill();
    plate(c, -34, 16, 24, 14, '#833a2c', '#af7450');
    plate(c, 8, -30, 19, 15, '#8d3d2d', '#ab6b45');
    // Sandbags on the road-facing edge.
    for (let i = 0; i < 3; i++) {
      c.fillStyle = i % 2 ? '#95805d' : '#b09a72';
      c.beginPath(); c.ellipse(-23 + i * 18, -side * 28, 10, 5, -.1, 0, TAU_LOCAL); c.fill();
      line(c, [-23 + i * 18, -side * 28, -17 + i * 18, -side * 28], '#6c5b44', 1);
    }
    // Rivets and chipped edges stay legible at race zoom.
    for (const px of [-34, 28]) for (const py of [-31, 29]) {
      c.fillStyle = '#d09152'; c.fillRect(px, py, 3, 3);
      c.fillStyle = '#261d18'; c.fillRect(px + 1, py + 1, 1, 1);
    }
    for (let i = 0; i < 12; i++) {
      const x = -30 + (i * 23 % 54), yy = -26 + (i * 31 % 47);
      c.fillStyle = i % 3 ? 'rgba(29,24,21,.34)' : 'rgba(175,88,43,.33)';
      c.fillRect(x, yy, 2 + i % 3, 1 + i % 2);
    }
    // Mast foot and warning light, anchored to the tower rather than swaying with fabric.
    c.fillStyle = '#16191a'; c.beginPath(); c.arc(0, -side * 19, 8, 0, TAU_LOCAL); c.fill();
    c.strokeStyle = '#ad784c'; c.lineWidth = 2;
    c.beginPath(); c.arc(0, -side * 19, 6, 0, TAU_LOCAL); c.stroke();
    lamp(c, 28, side * 21, time);
    c.restore();
  }

  function cableX(t) { return -27 + 34 * t * (1 - t); }

  function cable(c, near, far) {
    c.beginPath(); c.moveTo(-27, near);
    c.quadraticCurveTo(-10, 0, -27, far);
    c.strokeStyle = 'rgba(7,6,6,.48)'; c.lineWidth = 5; c.stroke();
    c.beginPath(); c.moveTo(-27, near);
    c.quadraticCurveTo(-10, 0, -27, far);
    c.strokeStyle = '#342922'; c.lineWidth = 2.6; c.stroke();
    c.beginPath(); c.moveTo(-27, near);
    c.quadraticCurveTo(-10, 0, -27, far);
    c.strokeStyle = 'rgba(184,128,72,.48)'; c.lineWidth = .65; c.stroke();
  }

  function pennant(c, index, count, near, far, time) {
    const t = (index + .5) / count;
    const y = near + (far - near) * t;
    const x = cableX(t);
    // The wave travels along the cable; each scrap has a smaller local flutter.
    const wave = Math.sin(time * 2.35 - index * .57);
    const flutter = Math.sin(time * 4.1 - index * .83);
    const tipX = x + 23 + wave * 2.8 + flutter * 1.3;
    const tipY = y + wave * 1.7 + flutter * .8;
    const half = (far - near) / count * .39;
    const colors = index % 3 === 1 ? BONE : RED;
    c.save();
    // An even-odd cutout leaves the road visible through each torn hole.
    c.beginPath();
    c.moveTo(x, y - half);
    c.lineTo(x + 7, y - half + 1);
    c.lineTo(tipX - 7, tipY - 5);
    c.lineTo(tipX - 3, tipY - 2);
    c.lineTo(tipX - 9, tipY + (index % 2 ? -1 : 1));
    c.lineTo(tipX, tipY + 2);
    c.lineTo(tipX - 8, tipY + 5);
    c.lineTo(x + 9, y + half - 2);
    c.lineTo(x + 4, y + half - 1);
    c.lineTo(x, y + half);
    c.closePath();
    const holeX = x + 10 + index % 2;
    const holeY = y + (index % 2 ? 1.8 : -1.8);
    c.moveTo(holeX + 2.4 * Math.cos(.25), holeY + 2.4 * Math.sin(.25));
    c.ellipse(holeX, holeY, 2.4, 1.8, .25, 0, TAU_LOCAL);
    const slitX = x + 15, slitY = y + (index % 2 ? -1 : 1);
    c.moveTo(slitX + 1.25, slitY);
    c.ellipse(slitX, slitY, 1.25, 1, 0, 0, TAU_LOCAL);
    c.fillStyle = colors[index % 3]; c.fill('evenodd');
    c.save();
    c.clip('evenodd');
    const fabric = index % 3 === 1 ? clothBone : clothRed;
    if (clothReady(fabric)) {
      const sourceW = 300, sourceH = 300;
      const sx = (index * 97) % (fabric.naturalWidth - sourceW);
      const sy = (index * 181) % (fabric.naturalHeight - sourceH);
      c.globalAlpha = index % 3 === 1 ? .83 : .66;
      c.drawImage(fabric, sx, sy, sourceW, sourceH, x, y - half, tipX - x + 1, half * 2);
      c.globalAlpha = 1;
    }
    for (let j = 0; j < 10; j++) {
      const px = x + 3 + (index * 11 + j * 7) % 18;
      const py = y - half + 2 + (index * 5 + j * 11) % Math.max(3, Math.floor(half * 2 - 3));
      c.fillStyle = j % 2 ? 'rgba(27,20,17,.3)' : 'rgba(224,188,136,.35)';
      c.fillRect(px, py, 1 + j % 4, 1 + j % 3);
    }
    line(c, [x + 4, y - half + 4, x + 13, y + half - 3], 'rgba(34,24,20,.22)', 1.2);
    c.restore();
    c.strokeStyle = index % 3 === 1 ? '#75634b' : '#b26749';
    c.lineWidth = .8;
    c.beginPath(); c.moveTo(x, y - half); c.lineTo(x + 7, y - half + 1);
    c.lineTo(tipX - 7, tipY - 5); c.lineTo(tipX - 3, tipY - 2);
    c.lineTo(tipX - 9, tipY + (index % 2 ? -1 : 1));
    c.lineTo(tipX, tipY + 2); c.lineTo(tipX - 8, tipY + 5);
    c.lineTo(x + 9, y + half - 2); c.lineTo(x, y + half); c.stroke();
    c.globalAlpha = .48;
    line(c, [x + 3, y - half + 3, x + 8, y + half - 4], '#e2bb82', 1);
    line(c, [x + 6, y + 4, x + 15, y + 6 + flutter], '#3f2a24', 1);
    c.globalAlpha = 1;
    c.fillStyle = '#b8804c';
    c.beginPath(); c.arc(x, y - half + 2, 1.8, 0, TAU_LOCAL); c.fill();
    c.beginPath(); c.arc(x, y + half - 2, 1.8, 0, TAU_LOCAL); c.fill();
    c.restore();
  }

  function banner(c, time, roadAngle) {
    const anchor = cableX(.5) + 4;
    const x = 0;
    const wave = Math.sin(time * 2.35 - 6 * .57);
    const tip = x + 51 + wave * 2;
    c.save();
    c.translate(anchor, 0);
    c.scale(.62, .62);
    c.beginPath();
    c.moveTo(x, -52); c.lineTo(tip - 6, -52 + wave);
    c.lineTo(tip, -42); c.lineTo(tip - 3, -25);
    c.lineTo(tip + 1, -8); c.lineTo(tip - 5, 10);
    c.lineTo(tip, 27); c.lineTo(tip - 7, 49 + wave);
    c.lineTo(x + 7, 51); c.lineTo(x, 48); c.closePath();
    c.moveTo(x + 38, -35); c.ellipse(x + 36, -35, 2.1, 2.8, -.2, 0, TAU_LOCAL);
    c.moveTo(x + 42, 36); c.ellipse(x + 40, 36, 2.4, 1.9, .3, 0, TAU_LOCAL);
    c.shadowColor = 'rgba(9,7,6,.35)';
    c.shadowBlur = 3; c.shadowOffsetX = 3; c.shadowOffsetY = 3;
    c.fillStyle = '#b8a98b'; c.fill('evenodd');
    c.shadowColor = 'transparent'; c.shadowBlur = 0;
    c.shadowOffsetX = 0; c.shadowOffsetY = 0;
    c.save(); c.clip('evenodd');
    if (clothReady(clothBone)) {
      c.globalAlpha = .7;
      c.drawImage(clothBone, 240, 110, 650, 990, x, -52, 53, 104);
      c.globalAlpha = 1;
    }
    c.fillStyle = 'rgba(101,52,36,.43)';
    c.fillRect(x + 3, -47, 5, 96);
    c.fillStyle = 'rgba(43,32,26,.13)';
    for (let j = 0; j < 18; j++) {
      const px = x + 9 + (j * 23 % 39), py = -45 + (j * 37 % 90);
      c.fillRect(px, py, 2 + j % 5, 1 + j % 3);
    }
    for (const bandY of [-48, 38]) {
      for (let row = 0; row < 2; row++) for (let col = 0; col < 6; col++) {
        c.fillStyle = (row + col) % 2 ? 'rgba(40,34,29,.76)' : 'rgba(230,213,178,.56)';
        c.fillRect(x + 9 + col * 7, bandY + row * 5, 7, 5);
      }
    }
    line(c, [x + 12, -48, x + 16, 47], 'rgba(255,229,180,.18)', 2);
    c.restore();
    c.strokeStyle = '#64513c'; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(x, -52); c.lineTo(tip - 6, -52 + wave);
    c.lineTo(tip, -42); c.lineTo(tip - 7, 49 + wave); c.lineTo(x, 48); c.stroke();
    // Keep the word upright when the track runs in the opposite direction.
    c.translate(x + 28, 0);
    c.rotate(Math.cos(roadAngle + Math.PI / 2) < 0 ? -Math.PI / 2 : Math.PI / 2);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = 'bold 17px ' + (typeof F_D === 'undefined' ? 'sans-serif' : F_D);
    c.fillStyle = '#2b2521'; c.fillText('ФИНИШ', 0, 1);
    c.fillStyle = 'rgba(58,42,33,.34)';
    c.fillRect(-29, -9, 2, 19); c.fillRect(16, -9, 2, 19);
    c.restore();
  }

  function finishLine(c, halfRoad) {
    const tileH = 12, tileW = 12, top = -halfRoad + 6, bottom = halfRoad - 6;
    const wear = (row, col, salt) => (((row * 73 + col * 151 + salt * 37) % 97) + 97) % 97 / 97;
    for (let row = 0; top + row * tileH < bottom; row++) {
      const y = top + row * tileH, h = Math.min(tileH, bottom - y);
      for (let col = 0; col < 4; col++) {
        const x = -2 * tileW + col * tileW;
        const a = wear(row, col, 1), b = wear(row, col, 2), d = wear(row, col, 3);
        const gouge = wear(row, col, 9) > .86 ? 1.5 + d * 1.5 : 0;
        c.save();
        c.globalAlpha = wear(row, col, 8) > .96 ? .49 : .76 + wear(row, col, 4) * .16;
        c.beginPath();
        c.moveTo(x + a * .35, y + b * .3);
        c.lineTo(x + tileW - d * .3, y + a * .25);
        c.lineTo(x + tileW - gouge, y + h * .54);
        c.lineTo(x + tileW - a * .35, y + h - d * .3);
        c.lineTo(x + b * .3, y + h - a * .35);
        c.lineTo(x + d * .25, y + h * .43);
        c.closePath();
        // Sparse chips reveal the road; most squares stay connected to the pattern.
        if (wear(row, col, 6) > .72) {
          const hx = x + 3 + b * 5, hy = y + 2.5 + d * Math.max(1, h - 5);
          const rx = .5 + a * .7, ry = .4 + b * .6, angle = a * .4;
          c.moveTo(hx + rx * Math.cos(angle), hy + rx * Math.sin(angle));
          c.ellipse(hx, hy, rx, ry, angle, 0, TAU_LOCAL);
        }
        c.fillStyle = (row + col) % 2 ? '#201d1c' : '#c8bca2';
        c.fill('evenodd');
        c.clip('evenodd');
        c.fillStyle = (row + col) % 2 ? 'rgba(171,103,58,.34)' : 'rgba(70,47,36,.34)';
        c.fillRect(x + 1 + d * 5, y + a * h, .7 + b * 1.2, 1 + d * 2);
        c.globalAlpha = .16;
        c.fillRect(x + 1 + b * 4, y + 2 + a * Math.max(1, h - 4), 2 + d * 3, .45);
        c.restore();
      }
    }
    // Rust at the edges is broken into short, uneven remnants.
    for (const side of [-1, 1]) {
      for (let i = 0; i < 7; i++) {
        if (i === 2 || i === 5) continue;
        const y = top + i * 27 + wear(i, side, 3) * 4;
        c.globalAlpha = .23 + wear(i, side, 5) * .24;
        line(c, [side * (2 * tileW + 1), y, side * (2 * tileW + 1.5), Math.min(bottom, y + 10 + wear(i, side, 7) * 12)], '#a26c43', 1.4);
      }
    }
    c.globalAlpha = 1;
  }

  function drawFinishGate(c, point) {
    const halfRoad = ROADW;
    c.save(); c.translate(point.x, point.y); c.rotate(point.ang);
    finishLine(c, halfRoad);
    c.restore();
    const points = global.DiVANEngine.render.finishLabelPoints(point, halfRoad);
    for (const label of points) global.DiVANEngine.render.paintFinishLabel(c, label);
  }

  function drawFinishGateArtLine(c, point, halfRoad) {
    c.save(); c.translate(point.x, point.y); c.rotate(point.ang);
    finishLine(c, halfRoad);
    c.restore();
  }

  function drawFinishGateArtLabels(c, point, halfRoad) {
    const along = halfRoad * 1.18;
    const tx = Math.cos(point.ang), ty = Math.sin(point.ang);
    const labels = [
      { text: 'СТАРТ', x: point.x - tx * along, y: point.y - ty * along, seed: 3 },
      { text: 'ФИНИШ', x: point.x + tx * along, y: point.y + ty * along, seed: 7 }
    ];
    for (const label of labels) {
      c.save(); c.translate(label.x, label.y);
      c.globalAlpha = .6;
      c.font = '18px ' + (global.F_D || 'sans-serif');
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.strokeStyle = '#292118'; c.lineWidth = 3; c.lineJoin = 'round';
      c.strokeText(label.text, 0, 0);
      c.globalAlpha = .86; c.fillStyle = '#b59a46'; c.fillText(label.text, 0, 0);
      c.globalAlpha = .24; c.fillStyle = '#fff0a0'; c.fillText(label.text, -1, -1);
      c.globalAlpha = .3; c.fillStyle = '#24242a';
      for (let i = 0; i < 14; i++) {
        const q = (label.seed * 17 + i * 31) % 97;
        c.fillRect(-18 * .45 + (q % 13) * 18 / 15,
          -18 * .48 + ((q * 7) % 11) * 18 / 13, 2 + (q % 3), 1 + (q % 2));
      }
      c.restore();
    }
  }

  function drawFinishGateArtOverhead(c, point, halfRoad, time) {
    const edge = halfRoad + 82;
    const near = -edge + 34, far = edge - 34;
    c.save(); c.translate(point.x, point.y); c.rotate(point.ang);
    cable(c, near, far);
    for (let i = 0; i < 13; i++) {
      if (i < 5 || i > 7) pennant(c, i, 13, near, far, time);
    }
    banner(c, time, point.ang);
    tower(c, -edge, -1, time);
    tower(c, edge, 1, time);
    c.restore();
  }

  function drawFinishGateOverhead(c, point) {
    if (!R || !R.T || R.T.lab) return;
    const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Race time stops on pause; the global clock keeps advancing for menus.
    const time = reduceMotion ? 0 : Number.isFinite(R.time) ? R.time : 0;
    drawFinishGateArtOverhead(c, point, ROADW, time);
  }

  global.FinishGateArt = {
    drawLine: drawFinishGateArtLine,
    drawLabels: drawFinishGateArtLabels,
    drawOverhead: drawFinishGateArtOverhead
  };
  if (global.__DIVAN_ENGINE_META__ && global.__DIVAN_ENGINE_META__.host === 'lab') return;
  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.render.drawFinishGate = drawFinishGate;
  engine.render.drawFinishGateOverhead = drawFinishGateOverhead;
  engine.wrap('drawFinishZone', function (original) {
    return function (context, point) {
      if (!R || !R.T || R.T.lab) return original(context, point);
      return drawFinishGate(context, point);
    };
  });
})(typeof window !== 'undefined' ? window : globalThis);
