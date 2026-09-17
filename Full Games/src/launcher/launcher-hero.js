////////////////////////////////////////////////////////
//
// Фон лаунчера: ролик один раз → вспышка → статичный кадр.
//
////////////////////////////////////////////////////////

'use strict';

(function startLauncherHero() {
  const FLASH_LEAD_S = 0.28;
  const WHITE_PEAK_MS = 240;
  const VIDEO_SRC = 'media/launcher-hero.mp4';

  const stage = document.querySelector('.stage');
  const video = document.getElementById('hero-video');
  const flash = document.getElementById('hero-flash');
  if (!video || !flash) return;

  const reduce = typeof matchMedia === 'function'
    && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** play | flash | done */
  let phase = 'play';
  let peakTimer = 0;
  let revealTimer = 0;

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
   * Снимает запасной таймер открытия UI.
   */
  function clearReveal() {
    if (revealTimer) {
      clearTimeout(revealTimer);
      revealTimer = 0;
    }
  }

  /**
   * Прячет ролик: под ним уже webp.
   */
  function hideVideo() {
    video.classList.remove('is-live');
  }

  /**
   * После вспышки открывает UI и больше не крутит ролик.
   */
  function finishIntro() {
    if (phase === 'done') return;
    phase = 'done';
    clearPeak();
    clearReveal();
    flash.classList.remove('is-burst');
    hideVideo();
    video.pause();
    if (stage) {
      stage.classList.remove('is-intro');
      stage.classList.add('is-ready');
    }
    document.dispatchEvent(new CustomEvent('launcher:intro-done'));
  }

  /**
   * Сразу без ролика (reduced-motion или ошибка).
   */
  function skipIntro() {
    clearPeak();
    clearReveal();
    hideVideo();
    flash.classList.remove('is-burst');
    finishIntro();
  }

  if (reduce) {
    skipIntro();
    return;
  }

  if (stage) stage.classList.add('is-intro');

  /**
   * Fade всего экрана в белый и обратно.
   */
  function playScreenFade() {
    if (phase === 'flash' || phase === 'done') return;
    phase = 'flash';
    flash.classList.remove('is-burst');
    void flash.offsetWidth;
    flash.classList.add('is-burst');
    clearPeak();
    peakTimer = window.setTimeout(() => {
      video.pause();
      hideVideo();
    }, WHITE_PEAK_MS);
    clearReveal();
    revealTimer = window.setTimeout(finishIntro, 1400);
  }

  /**
   * Показывает и запускает ролик с нуля.
   */
  function showAndPlay() {
    if (phase === 'done') return;
    flash.classList.remove('is-burst');
    video.classList.add('is-live');
    phase = 'play';
    const start = video.play();
    if (start && typeof start.catch === 'function') {
      start.catch(() => skipIntro());
    }
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
   * После спада белого открываем лаунчер.
   */
  function onFlashDone(event) {
    if (event.animationName !== 'hero-screen-fade') return;
    finishIntro();
  }

  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = VIDEO_SRC;
  video.addEventListener('timeupdate', onTime);
  video.addEventListener('ended', onEnded);
  video.addEventListener('error', skipIntro);
  flash.addEventListener('animationend', onFlashDone);

  if (video.readyState >= 2) showAndPlay();
  else video.addEventListener('canplay', showAndPlay, { once: true });
}());
