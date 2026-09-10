// Звук двигателя и шин: семплы кузова, иначе осциллятор; корректное отключение эффектов.
(() => {
  let tire = null;
  /** Создаёт один переиспользуемый источник шума шин в существующем аудиомикшере. */
  function tireBus() {
    if (tire || !AU.ctx || !noiseBuf) return tire;
    const source = AU.ctx.createBufferSource();
    source.buffer = noiseBuf;
    source.loop = true;
    const filter = AU.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1350;
    filter.Q.value = .8;
    const gain = AU.ctx.createGain();
    gain.gain.value = 0;
    source.connect(filter).connect(gain).connect(AU.sfx);
    source.start();
    tire = {source, filter, gain};
    return tire;
  }
  /** Семплы кузова глушат пилу; без файлов остаётся прежний тон. */
  DiVANEngine.replace('updEngine', function(player, isPaused, screen) {
    if (screen === 'title' || screen === 'press') {
      if (typeof carEngineHalt === 'function') carEngineHalt();
      if (AU.ctx && AU.engG) AU.engG.gain.setTargetAtTime(0, AU.ctx.currentTime, .04);
      const quiet = tireBus();
      if (quiet) quiet.gain.gain.setTargetAtTime(0, AU.ctx.currentTime, .04);
      return;
    }
    if (typeof tickCarEngine === 'function') tickCarEngine(player, isPaused, screen);
    const sampled = typeof carEngineLive === 'function' && carEngineLive();
    if (!AU.ctx || !AU.engG) return;
    const now = AU.ctx.currentTime;
    const active = screen === 'race' && !isPaused && !document.hidden && player && !player.dead && settings.sound.sfxOn;
    if (sampled) {
      AU.engG.gain.setTargetAtTime(0, now, .04);
    } else {
      const speed = active ? Math.abs(player.spd) / Math.max(1, player.st.top) : 0;
      const gear = Math.min(5, Math.floor(speed * 5));
      const rev = clamp(speed * 5 - gear, 0, 1);
      const pitch = 48 + rev * 72 + gear * 9 + (active && player.nitro > 0 ? 18 : 0);
      AU.engO.frequency.setTargetAtTime(pitch, now, .065);
      AU.engO2.frequency.setTargetAtTime(pitch * 1.503, now, .08);
      AU.engF.frequency.setTargetAtTime(260 + speed * 1050, now, .09);
      AU.engG.gain.setTargetAtTime(active ? .026 + Math.min(speed, 1) * .045 : 0, now, .05);
    }
    const bus = tireBus();
    if (bus) {
      const sampledTires = typeof carTiresLive === 'function' && carTiresLive();
      if (sampledTires) {
        bus.gain.gain.setTargetAtTime(0, now, .05);
      } else {
        const slip = active && !player.air && !player.car.hov ? clamp((Math.abs(player.lat || 0) - 12) / 95, 0, 1) : 0;
        bus.gain.gain.setTargetAtTime(slip * .055 * Math.min((active ? Math.abs(player.spd) / Math.max(1, player.st.top) : 0) * 3, 1), now, .08);
      }
    }
  });
  // Потеря фокуса глушит непрерывный звук даже при остановленном RAF.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && AU.ctx) {
      AU.engG?.gain.setTargetAtTime(0, AU.ctx.currentTime, .025);
      tire?.gain.gain.setTargetAtTime(0, AU.ctx.currentTime, .025);
      if (typeof carEngineHalt === 'function') carEngineHalt();
    }
  });
})();
