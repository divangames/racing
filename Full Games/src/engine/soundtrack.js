// Музыкальный плеер: отмена старого запуска при смене сцены и честная нулевая громкость.
(() => {
  let generation = 0;
  let element = null;
  /** Создаёт единственный аудиоэлемент с обработчиками текущего трека. */
  function player() {
    if (element) return element;
    if (MUSIC.el) MUSIC.el.pause();
    element = new Audio();
    element.preload = 'auto';
    element.referrerPolicy = 'no-referrer';
    element.addEventListener('ended', () => { if(musicOn())MUSIC.next(); });
    element.addEventListener('error', () => {
      if(musicOn())CHIP.start(MUSIC.curCat);
    });
    MUSIC.el = element;
    return element;
  }
  /** Запускает трек; устаревший Promise не включает резервную музыку поверх нового трека. */
  function playCurrent() {
    const token = ++generation;
    const audio = player();
    audio.volume = clamp((settings.sound.music ?? 50)/100,0,1);
    audio.play().then(() => {
      if(token === generation)CHIP.stop();
    }).catch(error => {
      if(token !== generation || error.name === 'AbortError' || !musicOn())return;
      if(error.name !== 'NotAllowedError')console.warn('Музыкальный файл недоступен:', MUSIC.cur);
      CHIP.start(MUSIC.curCat);
    });
  }
  /** Продолжает существующую случайную очередь, не повторяя последнюю композицию. */
  MUSIC.next = function() {
    if(!musicOn())return;
    if(!this.list(this.curCat).length) { CHIP.start(this.curCat); return; }
    this.playedCount++;
    if(!this.bag?.length)this.reshuffle();
    this.cur=this.bag.shift();
    player().src=bootMediaSrc(this.cur);
    playCurrent();
  };
  MUSIC.stopEl = function() {
    generation++;
    if(this.el) { this.el.pause();this.el.currentTime=0; }
  };
  MUSIC.resume = function() {
    if(!musicOn())return;
    if(element?.src)playCurrent();else if(this.curCat)this.play(this.curCat);
  };
  /** Микшер применяет выключатель эффектов ко всему каналу, включая двигатель. */
  DiVANEngine.wrap('applyAudioSettings', function (applyBase) {
    return function() {
    applyBase();
    const sound=settings.sound,sfx=clamp((sound.sfx??80)/100,0,1),music=clamp((sound.music??50)/100,0,1);
    if(AU.sfx)AU.sfx.gain.value=sound.sfxOn?sfx*.9:0;
    if(MUSIC.el)MUSIC.el.volume=music;
    if(introAudio)introAudio.volume=music;
    if(window.WORLD_INTRO&&WORLD_INTRO.audio)WORLD_INTRO.audio.volume=music;
    if(voiceEl)voiceEl.volume=sound.sfxOn?sfx:0;
    if(typeof VOICE!=='undefined'&&VOICE.audio)VOICE.audio.volume=sound.sfxOn?sfx*.92:0;
  };
  });
  if(typeof SFX!=='undefined') {
    const play=SFX.play;
    SFX.play=function(id) { if(settings.sound.sfx===0)return;return play.call(this,id); };
  }
})();
