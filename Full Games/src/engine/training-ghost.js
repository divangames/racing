// Призрак чистого лучшего круга: только визуальная запись, без участника в физике гонки.
(function (global) {
  'use strict';
  const engine = global.DiVANEngine;
  if (!engine || !engine.insights) return;
  const KEY = 'rnr.trainingGhost.v1', VERSION = 1, HZ = 20;
  const MAX_SECONDS = 300, MAX_SAMPLES = MAX_SECONDS * HZ + 2, MAX_RECORDS = 4, MAX_BYTES = 1500000;
  const wrap = (name, factory) => { if (typeof global[name] === 'function') engine.wrap(name, factory); };
  const round = (n, digits = 3) => +n.toFixed(digits);
  const angle = n => Math.atan2(Math.sin(n), Math.cos(n));
  let store = null, race = null, key = '', best = null, recording = null, newRecord = false, storageError = false;

  function isTraining(value) {
    return !!value && !value.demo && (!!(typeof labTest !== 'undefined' && labTest) || value.replay === true || value.training === true || value.practice === true);
  }
  function hash(text) {
    let a = 2166136261, b = 2246822519;
    for (let i = 0; i < text.length; i++) { a = Math.imul(a ^ text.charCodeAt(i), 16777619); b = Math.imul(b ^ text.charCodeAt(i), 3266489917); }
    return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
  }
  /** Порядок полей не меняет ключ: сравниваются данные сценария, а не способ их сериализации. */
  function canonical(value) {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
    return value;
  }
  /** Геометрия, сценарий арены и реальные характеристики исключают несовместимые рекорды. */
  function keyFor(current, player) {
    if (!current || !current.T || !Array.isArray(current.S) || !player || !player.car) return '';
    const tune = player.lvl || {}, st = player.st || {}, T = current.T;
    const geometry = current.S.map(p => [round(Number(p.x) || 0, 2), round(Number(p.y) || 0, 2)]);
    return 'g1-' + hash(JSON.stringify({ physics: 2, track: T.id || current.tIdx || T.idx || 0, geometry,
      gaps: T.gaps || [], decks: T.decks || [], zones: T.zones || [], road: typeof ROADW === 'number' ? ROADW : 95,
      tactics: hash(JSON.stringify(canonical(T.tactics || null))),
      objects: hash(JSON.stringify(canonical(T.labObjects || []))),
      seed: current.startSpec && current.startSpec.seed != null ? current.startSpec.seed : null,
      terrain: T.theme && T.theme.map || null,
      car: player.car.idx, hover: !!player.car.hov, pilot: player.chIdx, skill: player.skillLvl,
      tune: ['arm','eng','tir','shk','nit','wep','ult'].map(k => tune[k] || 0),
      stats: ['top','acc','crn','grip','sharp','off','maxhp'].map(k => st[k] || 0),
      levels: [player.nitLvl || 0, player.wepLvl || 0, player.ultLvl || 0],
      weather: current.weather ? [current.weather.id, current.weather.mod] : null,
      theme: T.theme && T.theme.deco || null }));
  }
  function validRecord(record) {
    if (!record || typeof record.key !== 'string' || !/^g1-[a-f0-9]{16}$/.test(record.key) ||
      !Number.isFinite(record.bestLap) || record.bestLap <= 0 || record.bestLap > MAX_SECONDS ||
      !Array.isArray(record.samples) || record.samples.length < 2 || record.samples.length > MAX_SAMPLES) return false;
    let previous = -1;
    for (const sample of record.samples) {
      if (!Array.isArray(sample) || sample.length !== 5 || sample.some(n => !Number.isFinite(n))) return false;
      const [t, x, y, a, z] = sample;
      if (t < 0 || t > MAX_SECONDS || t <= previous || (previous >= 0 && t - previous > .081) ||
        Math.abs(x) > 1000000 || Math.abs(y) > 1000000 || Math.abs(a) > Math.PI + .00001 || z < 0 || z > 10000) return false;
      previous = t;
    }
    return record.samples[0][0] === 0 && Math.abs(previous - record.bestLap) < .002;
  }
  function readStore() {
    if (store) return store;
    store = { version: VERSION, enabled: true, records: [] };
    try {
      const raw = typeof persistRead === 'function' ? persistRead(KEY) : null;
      if (!raw || raw.length > MAX_BYTES) return store;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== VERSION || !Array.isArray(parsed.records) || parsed.records.length > MAX_RECORDS) return store;
      store.enabled = parsed.enabled !== false;
      store.records = parsed.records.filter(validRecord).map(record => ({ key: record.key, bestLap: record.bestLap,
        samples: record.samples, at: Number.isFinite(record.at) ? record.at : 0 }));
    } catch (_) { storageError = true; }
    return store;
  }
  function writeStore() {
    const data = readStore();
    data.records.sort((a, b) => b.at - a.at);
    data.records.length = Math.min(MAX_RECORDS, data.records.length);
    let text = JSON.stringify(data);
    while (text.length > MAX_BYTES && data.records.length > 1) { data.records.pop(); text = JSON.stringify(data); }
    if (text.length > MAX_BYTES) { storageError = true; return; }
    try { if (typeof persistWrite === 'function') persistWrite(KEY, text); storageError = false; }
    catch (_) { storageError = true; }
  }
  function sync() {
    const current = typeof R !== 'undefined' ? R : null;
    if (current === race) return;
    race = current; recording = null; newRecord = false; best = null; key = '';
    if (!isTraining(race) || typeof P === 'undefined' || !P) return;
    key = keyFor(race, P);
    best = readStore().records.find(record => record.key === key) || null;
    if (best) engine.insights.setPersonalBest(P, best.bestLap);
  }
  function point(r, t) { return [round(t, 4), round(r.x), round(r.y), round(angle(r.ang), 6), round(Math.max(0, r.z || 0))]; }
  function begin(r) {
    recording = { racer: r, start: r.lapStart, next: 1 / HZ, samples: [point(r, 0)], previous: point(r, 0), valid: true, reason: '' };
  }
  function invalidate(reason) {
    sync();
    if (recording) { recording.valid = false; recording.reason = reason || 'КРУГ НЕ ЗАСЧИТАН'; recording.samples.length = 0; }
  }
  function observe(r) {
    sync();
    if (!isTraining(race) || !recording || recording.racer !== r || !recording.valid || race.phase !== 'go' || r.finished) return;
    if (r.dead || r._lapInvalid) { invalidate('КРУГ НЕ ЗАСЧИТАН'); return; }
    const elapsed = race.time - recording.start, previous = recording.previous;
    const delta = elapsed - previous[0];
    if (elapsed > MAX_SECONDS || recording.samples.length >= MAX_SAMPLES) { invalidate('КРУГ ДЛИННЕЕ 5 МИНУТ'); return; }
    if (delta <= 0) return;
    const limit = Math.max(120, (Math.abs(r.spd || 0) + Math.abs(r.lat || 0)) * delta * 3 + 20);
    if (delta > .26 || Math.hypot(r.x - previous[1], r.y - previous[2]) > limit) {
      invalidate('ПЕРЕМЕЩЕНИЕ ВНЕ ТРАССЫ'); engine.insights.invalidateLap(r, 'ПЕРЕМЕЩЕНИЕ ВНЕ ТРАССЫ'); return;
    }
    const current = point(r, elapsed);
    while (recording.next <= elapsed + 1e-7) {
      const fraction = Math.max(0, Math.min(1, (recording.next - previous[0]) / delta));
      const sample = [round(recording.next, 4), round(previous[1] + (current[1] - previous[1]) * fraction),
        round(previous[2] + (current[2] - previous[2]) * fraction),
        round(angle(previous[3] + angle(current[3] - previous[3]) * fraction), 6), round(previous[4] + (current[4] - previous[4]) * fraction)];
      recording.samples.push(sample); recording.next += 1 / HZ;
    }
    recording.previous = current;
  }
  engine.insights.onLap(event => {
    sync();
    if (event.racer !== (typeof P !== 'undefined' ? P : null) || !isTraining(race)) return;
    const r = event.racer;
    if (!event.started && event.clean && recording && recording.valid && (!best || event.elapsed < best.bestLap)) {
      const samples = recording.samples.slice(), end = point(r, event.elapsed);
      if (samples.length && Math.abs(samples[samples.length - 1][0] - end[0]) < .0001) samples[samples.length - 1] = end;
      else samples.push(end);
      const record = { key, bestLap: end[0], samples, at: Date.now() };
      if (validRecord(record)) {
        const data = readStore(); data.records = data.records.filter(item => item.key !== key); data.records.push(record);
        best = record; newRecord = true; writeStore();
      }
    }
    if (!event.finished) begin(r); else recording = null;
  });
  /** Интерполяция ищет соседние 20-Гц точки и проходит через ±π без разворота на полный круг. */
  function interpolate(record, seconds) {
    if (!validRecordShape(record) || !Number.isFinite(seconds) || seconds < 0 || seconds > record.bestLap) return null;
    const samples = record.samples;
    let lo = 0, hi = samples.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (samples[mid][0] <= seconds) lo = mid; else hi = mid; }
    const a = samples[lo], b = samples[hi], t = Math.max(0, Math.min(1, (seconds - a[0]) / Math.max(.00001, b[0] - a[0])));
    return { x: a[1] + (b[1] - a[1]) * t, y: a[2] + (b[2] - a[2]) * t,
      ang: angle(a[3] + angle(b[3] - a[3]) * t), z: a[4] + (b[4] - a[4]) * t };
  }
  // Полная проверка выполняется при чтении/записи, а не для тысяч точек каждый кадр.
  function validRecordShape(record) { return record && Array.isArray(record.samples) && record.samples.length >= 2; }
  function pose() {
    sync();
    if (!isTraining(race) || !readStore().enabled || !best || !recording || typeof P === 'undefined' || P.dead) return null;
    return interpolate(best, race.time - P.lapStart);
  }
  function status() {
    sync();
    const live = typeof P !== 'undefined' && P ? engine.insights.snapshot(P) : null;
    const lapValid = (!recording || recording.valid) && (!live || live.lapValid);
    return { supported: isTraining(race), enabled: readStore().enabled, available: !!best, bestLap: best ? best.bestLap : 0,
      recording: !!recording && lapValid, lapValid, newRecord,
      reason: recording && recording.reason || live && live.invalidReason || '', storageError, key };
  }
  function setEnabled(value) { readStore().enabled = !!value; writeStore(); return readStore().enabled; }
  function drawWorld(c) {
    const p = pose();
    if (!p || typeof drawCar !== 'function' || typeof P === 'undefined') return;
    // Этот объект никогда не попадает в R.racers, подбор предметов, цели оружия или SAT.
    const ghost = Object.assign({}, P, p, { isP: false, dead: false, hp: P.maxhp, nitro: 0, bolt: 0, cloak: 1,
      shield: 0, bubble: 0, invuln: 0, haze: 0, bob: 0, rockAmp: 0, _isGhost: true });
    c.save(); c.globalAlpha = .26; drawCar(c, ghost, 1);
    c.globalAlpha = .64; c.translate(p.x, p.y - p.z); c.rotate(p.ang);
    c.strokeStyle = '#a0edff'; c.lineWidth = 1.2; c.setLineDash([5, 5]);
    const half = typeof carHitHalf === 'function' ? carHitHalf(P) : { hw: 27, hh: 16 };
    c.strokeRect(-half.hw - 4, -half.hh - 3, half.hw * 2 + 8, half.hh * 2 + 6); c.restore();
  }
  /** Статус под объявлением ведущего оставляет свободными левую колонку реплик и нижние приборы. */
  function drawStatus(c, width) {
    const info = status();
    if (!info.supported || typeof state !== 'undefined' && state !== 'race' || typeof paused !== 'undefined' && paused) return;
    const w = Math.min(306, Math.max(180, width - 32)), x = (width - w) / 2, y = 120;
    const controls = typeof settings !== 'undefined' && settings.controls || {};
    const bound = Object.values(controls).some(keys => Array.isArray(keys) && keys.includes('KeyG'));
    const hint = bound ? '' : ' · G';
    c.save(); c.fillStyle = 'rgba(5,16,23,.86)'; c.fillRect(x, y, w, 53);
    c.fillStyle = info.lapValid ? '#73e8ef' : '#f2c66d'; c.fillRect(x, y, 2, 53);
    c.font = '600 11px ' + (typeof F_B !== 'undefined' ? F_B : 'sans-serif');
    c.textAlign = 'left'; c.textBaseline = 'middle';
    c.fillText('ПРИЗРАК: ' + (info.enabled ? 'ВКЛ' : 'ВЫКЛ') + hint, x + 12, y + 15, w - 24);
    c.fillStyle = '#d1e1e8'; c.font = '11px ' + (typeof F_B !== 'undefined' ? F_B : 'sans-serif');
    const time = typeof fmtLap === 'function' ? fmtLap(info.bestLap) : info.bestLap.toFixed(2) + ' с';
    const detail = !info.lapValid ? info.reason || 'ЭТОТ КРУГ БЕЗ РЕКОРДА' : info.available
      ? (info.newRecord ? 'НОВЫЙ РЕКОРД · ' : 'ЛУЧШИЙ КРУГ · ') + time : 'ПРОЕДЬТЕ ПОЛНЫЙ ЧИСТЫЙ КРУГ';
    c.fillText(detail, x + 12, y + 36, w - 24); c.restore();
  }
  wrap('buildRace', previous => function () { const result = previous.apply(this, arguments); sync(); return result; });
  wrap('stepVehicle', previous => function (r) { const result = previous.apply(this, arguments); if (r.isP) observe(r); return result; });
  wrap('drawRaceArena', previous => function () { const result = previous.apply(this, arguments); drawWorld(g); return result; });
  wrap('drawHUD', previous => function () {
    const result = previous.apply(this, arguments);
    if (typeof viewW !== 'undefined' && typeof viewS !== 'undefined') {
      const ui = engine.cyberHud && engine.cyberHud.viewport ? engine.cyberHud.viewport() : { scale: viewS, width: viewW };
      g.save(); g.setTransform(ui.scale, 0, 0, ui.scale, 0, 0); drawStatus(g, ui.width); g.restore();
    }
    return result;
  });
  engine.trainingGhost = { status, pose, setEnabled, invalidate, drawWorld, drawStatus, keyFor, validRecord, interpolate,
    limits: Object.freeze({ hz: HZ, seconds: MAX_SECONDS, samples: MAX_SAMPLES, records: MAX_RECORDS, bytes: MAX_BYTES }) };
})(typeof window !== 'undefined' ? window : globalThis);
