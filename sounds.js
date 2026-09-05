////////////////////////////////////////////////////////
//
// Каталог звуковых эффектов.
// Файлы в assets/sounds/FX/ — те же имена, что раньше на CDN.
// Если локального клипа нет, загрузчик берёт тот же путь с хоста.
// Играть: SFX.play('ключ')
//
////////////////////////////////////////////////////////

/** Корень локальных эффектов. */
var SFX_DIR = 'assets/sounds/FX/';

/** Сброс кэша браузера для запасного URL на хосте. */
var SFX_CDN_VER = '20260904-sfx';

/** Локальный путь клипа: money.mp3 → assets/sounds/FX/money.mp3. */
function sfxFile(path) {
 return SFX_DIR + path;
}

/** Запасной URL на CDN с тем же относительным путём. */
function sfxCdn(path) {
 return 'https://ikrinka24.com/ROCK/sounds/FX/' + path + '?v=' + SFX_CDN_VER;
}

/** Локальный URL и запасной CDN — в десктопе только диск. */
function sfxSources(url) {
 const u = String(url || '');
 if (!u) return [];
 if (u.indexOf(SFX_DIR) !== 0) return [u];
 const path = u.slice(SFX_DIR.length);
 if (typeof window !== 'undefined' && window.__RNR_DESKTOP__) return [u];
 return [u, sfxCdn(path)];
}

/** Карта id → локальный путь или список путей. */
var SFX_TRACKS = {
 // Поднятие денег на трассе
 money: sfxFile('money.mp3'),
 // Любая покупка (машина, тренажёрка, скилл)
 buy: sfxFile('CashBay.mp3'),
 // Любая покупка тюнинга авто
 tune: sfxFile('carPay.wav')
};

////////////////////////////////////////////////////////
//
// Проигрыватель: настройки из игры, оверлап клипов
//
////////////////////////////////////////////////////////
var SFX = {
 _cache: {},
 /** Настройки звука: settings — let, на window его нет. */
 _snd: function(){
  if(typeof settings==='undefined'||!settings||!settings.sound)return null;
  return settings.sound;
 },
 /** Список URL для ключа: локальный файл, затем хост. */
 _urls: function(id){
  const v=SFX_TRACKS[id];
  if(!v)return [];
  const list=(Array.isArray(v)?v:[v]).filter(Boolean);
  const out=[];
  for(let i=0;i<list.length;i++){
   const src=(typeof sfxSources==='function')?sfxSources(list[i]):[list[i]];
   for(let j=0;j<src.length;j++){
    if(src[j])out.push(src[j]);
   }
  }
  return out;
 },
 /** Прогреть все клипы из каталога. */
 preload: function(){
  if(typeof SFX_TRACKS!=='object'||!SFX_TRACKS)return;
  for(const id in SFX_TRACKS){
   if(!Object.prototype.hasOwnProperty.call(SFX_TRACKS,id))continue;
   const urls=this._urls(id);
   if(!urls.length)continue;
   const a=new Audio();
   a.preload='auto';
   a.referrerPolicy='no-referrer';
   a.src=(typeof bootMediaSrc==='function')?bootMediaSrc(urls[0]):urls[0];
   this._cache[id]=a;
  }
 },
 /**
  * Играть клип по ключу из SFX_TRACKS.
  * Если локальный файл не найден — пробует следующий URL.
  */
 play: function(id){
  const snd=this._snd();
  if(!snd||snd.sfxOn===false)return;
  const urls=this._urls(id);
  if(!urls.length)return;
  const vol=Math.max(0,Math.min(1,(snd.sfx||80)/100));
  this._playAt(urls,0,vol);
 },
 /** Пробует URL по порядку, пока клип не стартует. */
 _playAt: function(urls,i,vol){
  if(i>=urls.length)return;
  const a=new Audio();
  let next=false;
  const fail=()=>{
   if(next)return;
   next=true;
   SFX._playAt(urls,i+1,vol);
  };
  a.referrerPolicy='no-referrer';
  a.volume=vol;
  a.addEventListener('error',fail);
  a.src=(typeof bootMediaSrc==='function')?bootMediaSrc(urls[i]):urls[i];
  a.play().catch(fail);
 }
};
