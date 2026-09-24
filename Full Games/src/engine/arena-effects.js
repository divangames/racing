////////////////////////////////////////////////////////
// Shared race and editor effects for track objects.
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  const PICKUP_COLORS = {
    money: [255, 204, 65], wrench: [104, 235, 120], wep: [255, 106, 76],
    ult: [181, 127, 255], nit: [255, 155, 53], shield: [76, 221, 255],
    bolt: [111, 239, 255]
  };

  // Keep every boost pad usable and visible when a ramp occupies its original spot.
  function separateRampPads(hazards) {
    const ramps = hazards.ramps || [];
    const pads = hazards.pads || [];
    for (const pad of pads) {
      const ramp = ramps.find((r) => Math.hypot(pad.x - r.x, pad.y - r.y) < 85);
      if (!ramp) continue;
      const angle = Number.isFinite(+ramp.ang) ? +ramp.ang : 0;
      for (let distance = 115; distance <= 1000; distance += 35) {
        let placed = false;
        for (const direction of [-1, 1]) {
          const x = ramp.x + Math.cos(angle) * distance * direction;
          const y = ramp.y + Math.sin(angle) * distance * direction;
          if (ramps.some((r) => Math.hypot(x - r.x, y - r.y) < 85)) continue;
          if (pads.some((other) => other !== pad && Math.hypot(x - other.x, y - other.y) < 60)) continue;
          pad.x = x; pad.y = y; pad.ang = angle;
          placed = true;
          break;
        }
        if (placed) break;
      }
    }
    return hazards;
  }

  function canLaunchRamp(car, ramp) {
    const angle = Number.isFinite(+ramp.ang) ? +ramp.ang : 0;
    const forward = Math.cos(angle), side = Math.sin(angle);
    const dx = car.x - ramp.x, dy = car.y - ramp.y;
    const along = dx * forward + dy * side;
    const across = -dx * side + dy * forward;
    const need = ramp.gap ? 95 : 140;
    return car.spd > need && Math.cos(car.ang - angle) > .55 &&
      along >= (ramp.gap ? -12 : -4) && along <= 36 && Math.abs(across) <= 32;
  }

  function chevron(ctx, x) {
    ctx.beginPath();
    ctx.moveTo(x - 7, -12); ctx.lineTo(x + 4, 0); ctx.lineTo(x - 7, 12);
    ctx.lineTo(x - 12, 12); ctx.lineTo(x - 1, 0); ctx.lineTo(x - 12, -12);
    ctx.closePath(); ctx.fill();
  }

  function drawPadLights(ctx, x, y, angle, time, ready) {
    const lit = ((Math.floor(Math.max(0, time) * 5) % 3) + 3) % 3;
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle || 0);
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = 'rgba(12,29,29,.48)';
      chevron(ctx, -13 + i * 14);
      ctx.globalCompositeOperation = 'screen';
      const active = ready && i === lit;
      ctx.fillStyle = active ? 'rgba(183,255,245,.98)' : 'rgba(45,160,163,.15)';
      ctx.shadowColor = '#7cfaff'; ctx.shadowBlur = active ? 18 : 0;
      chevron(ctx, -13 + i * 14);
      ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0;
    }
    ctx.restore();
    return lit;
  }

  function drawMineLight(ctx, x, y, time, phase) {
    const lit = Math.floor(Math.max(0, time) * 3 + (phase || 0)) % 2 === 0;
    ctx.save();
    ctx.fillStyle = lit ? '#ff6643' : '#49231e';
    ctx.shadowColor = '#ff3d2e'; ctx.shadowBlur = lit ? 13 : 0;
    ctx.beginPath(); ctx.arc(x, y, lit ? 3.2 : 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return lit;
  }

  function drawPickupGlow(ctx, type, x, y, time, phase) {
    const rgb = PICKUP_COLORS[type];
    if (!rgb) return false;
    const pulse = .85 + .15 * Math.sin(time * 5 + (phase || 0));
    const color = (alpha) => 'rgba(' + rgb.join(',') + ',' + alpha + ')';
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    const glow = ctx.createRadialGradient(x, y, 6, x, y, 39);
    glow.addColorStop(0, color(.48 * pulse));
    glow.addColorStop(.45, color(.22 * pulse));
    glow.addColorStop(1, color(0));
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(x, y, 39, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return true;
  }

  global.RnRArenaEffects = { separateRampPads, canLaunchRamp, drawPadLights, drawMineLight, drawPickupGlow };
})(typeof window !== 'undefined' ? window : globalThis);
