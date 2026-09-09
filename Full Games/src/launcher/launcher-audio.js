////////////////////////////////////////////////////////
//
// Музыка лаунчера из assets/music/Load, mute в углу.
//
////////////////////////////////////////////////////////

'use strict';

const MUTE_KEY = 'rnr-launcher-muted';

/**
 * Запускает плейлист Load и кнопку динамика.
 */
function startLauncherAudio() {
  const btn = document.getElementById('btn-mute');
  if (!btn) return;
  const audio = document.createElement('audio');
  audio.preload = 'auto';
  audio.setAttribute('playsinline', '');
  const ready = document.createElement('audio');
  ready.preload = 'auto';
  ready.src = 'media/play-ready.mp3';
  ready.setAttribute('playsinline', '');
  let tracks = [];
  let index = 0;
  let muted = localStorage.getItem(MUTE_KEY) === '1';

  /**
   * Рисует состояние кнопки.
   */
  function paintMute() {
    btn.classList.toggle('is-muted', muted);
    btn.setAttribute('aria-pressed', muted ? 'true' : 'false');
    btn.setAttribute('aria-label', muted ? 'Включить музыку' : 'Выключить музыку');
    audio.muted = muted;
    ready.muted = muted;
  }

  /**
   * Ставит текущий трек.
   */
  function playCurrent() {
    if (!tracks.length) return;
    audio.src = tracks[index % tracks.length];
    audio.loop = tracks.length === 1;
    const start = audio.play();
    if (start && typeof start.catch === 'function') start.catch(() => {});
  }

  paintMute();
  fetch('media/tracks.json')
    .then((res) => (res.ok ? res.json() : []))
    .then((list) => {
      tracks = Array.isArray(list) ? list.filter(Boolean) : [];
      if (!tracks.length) tracks = ['media/load/01.mp3'];
      playCurrent();
    })
    .catch(() => {
      tracks = ['media/load/01.mp3'];
      playCurrent();
    });

  audio.addEventListener('ended', () => {
    if (tracks.length < 2) return;
    index = (index + 1) % tracks.length;
    playCurrent();
  });

  btn.addEventListener('click', () => {
    muted = !muted;
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    paintMute();
    if (!muted && audio.paused && tracks.length) playCurrent();
  });

  /**
   * Останавливает музыку, пока открыт заезд.
   */
  function hush() {
    audio.pause();
    ready.pause();
  }

  /**
   * Возвращает музыку, если игрок её не выключал.
   */
  function wake() {
    if (muted || !tracks.length) return;
    const start = audio.play();
    if (start && typeof start.catch === 'function') start.catch(() => {});
  }

  /**
   * Короткий сигнал: обновление легло, «Играть» ожила.
   */
  function playReady() {
    if (muted) return;
    ready.currentTime = 0;
    const start = ready.play();
    if (start && typeof start.catch === 'function') start.catch(() => {});
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) hush();
    else wake();
  });

  window.rnrLauncherAudio = { hush, wake, playReady };
}

startLauncherAudio();
