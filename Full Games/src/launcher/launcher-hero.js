////////////////////////////////////////////////////////
//
// Фон лаунчера: ролик → вспышка на весь экран → кадр.
//
////////////////////////////////////////////////////////

'use strict';

(function startLauncherHero() {
  const HOLD_MS = 5000;
  const FLASH_LEAD_S = 0.28;
  const WHITE_PEAK_MS = 240;
  const VIDEO_SRC = 'media/launcher-hero.mp4';

  const video = document.getElementById('hero-video');
  const flash = document.getElementById('hero-flash');
  if (!video || !flash) return;

  const reduce = typeof matchMedia === 'function'
    && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;

  /** play | flash | hold */
  let phase = 'hold';
  let holdTimer = 0;
  let peakTimer = 0;
  let restarting = false;

  /**
   * Сбрасывает таймер паузы на кадре.
   */
  function clearHold() {
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = 0;
    }
  }

  /**
   * Снимает таймер смены ролика на webp в пике белого.
   */
  function clearPeak() {
    if (peakTimer) {
      clearTimeout(peakTimer);
      peakTimer = 0;
    }
  }

  /**
   * Прячет ролик: под ним уже webp.
   */
  function hideVideo() {
    video.classList.remove('is-live');
  }

  /**
   * Fade всего экрана в белый и обратно.
   */
  function playScreenFade() {
    if (phase === 'flash') return;
    phase = 'flash';
    flash.classList.remove('is-burst');
    void flash.offsetWidth;
    flash.classList.add('is-burst');
    clearPeak();
    peakTimer = window.setTimeout(() => {
      video.pause();
      hideVideo();
    }, WHITE_PEAK_MS);
  }

  /**
   * Пять секунд кадра, затем снова ролик.
   */
  function holdStill() {
    phase = 'hold';
    flash.classList.remove('is-burst');
    hideVideo();
    clearHold();
    holdTimer = window.setTimeout(restartVideo, HOLD_MS);
  }

  /**
   * Показывает и запускает ролик с нуля.
   */
  function showAndPlay() {
    restarting = false;
    flash.classList.remove('is-burst');
    video.classList.add('is-live');
    phase = 'play';
    const start = video.play();
    if (start && typeof start.catch === 'function') {
      start.catch(() => {
        hideVideo();
        phase = 'hold';
      });
    }
  }

  /**
   * После паузы снова крутит ролик без чёрного кадра.
   */
  function restartVideo() {
    if (restarting) return;
    restarting = true;
    clearHold();
    const go = () => {
      showAndPlay();
    };
    if (video.currentTime > 0.001) {
      video.addEventListener('seeked', go, { once: true });
      video.currentTime = 0;
      return;
    }
    go();
  }

  /**
   * Чуть раньше конца — белый fade закрывает стык.
   */
  function onTime() {
    if (phase !== 'play') return;
    const duration = video.duration;
    if (!duration || !isFinite(duration)) return;
    if (duration - video.currentTime <= FLASH_LEAD_S) playScreenFade();
  }

  /**
   * Если кадры не успели, вспышка всё равно идёт с ended.
   */
  function onEnded() {
    video.pause();
    playScreenFade();
  }

  /**
   * После спада белого держим webp.
   */
  function onFlashDone(event) {
    if (event.animationName !== 'hero-screen-fade') return;
    holdStill();
  }

  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = VIDEO_SRC;
  video.addEventListener('timeupdate', onTime);
  video.addEventListener('ended', onEnded);
  video.addEventListener('error', () => {
    clearHold();
    clearPeak();
    hideVideo();
    flash.classList.remove('is-burst');
    phase = 'hold';
  });
  flash.addEventListener('animationend', onFlashDone);

  if (video.readyState >= 2) showAndPlay();
  else video.addEventListener('canplay', showAndPlay, { once: true });
}());
