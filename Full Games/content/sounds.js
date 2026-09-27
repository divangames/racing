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
 tune: sfxFile('carPay.wav'),
 // Эмбиент дождя: титул и дождевой биом
 ambientRain: 'assets/sounds/embirnt/rain.mp3',
 // Эмбиент снега
 ambientSnow: 'assets/sounds/embirnt/Snow.mp3',
 // Удар грома при молнии
 thunder: 'assets/sounds/embirnt/grom.mp3',
 // Трибуна арены (первые клипы; полный набор — arena/index.json)
 arenaCheer: 'assets/sounds/embirnt/arena/aplodisment_01.mp3',
 arenaBoo: 'assets/sounds/embirnt/arena/nedovolny_01.mp3',
 // Контакт машин и препятствий
 carHit1: 'assets/sounds/cars/hit/A_CarHit_01.WAV',
 carHit2: 'assets/sounds/cars/hit/A_CarHit_02.WAV',
 carHit3: 'assets/sounds/cars/hit/A_CarHit_03.WAV',
 // Попадание урона в кузов
 carBody1: 'assets/sounds/cars/hit/A_Car_HitBody_01.WAV',
 carBody2: 'assets/sounds/cars/hit/A_Car_HitBody_02.WAV',
 carBody3: 'assets/sounds/cars/hit/A_Car_HitBody_03.WAV',
 // Приземление после прыжка
 carLand1: 'assets/sounds/cars/hit/A_Car_Land_01.WAV',
 carLand2: 'assets/sounds/cars/hit/A_Car_Land_02.WAV'
};

var CAR_IMPACT_TRACKS = {
 collision: ['carHit1', 'carHit2', 'carHit3'],
 damage: ['carBody1', 'carBody2', 'carBody3'],
 land: ['carLand1', 'carLand2']
};
var carImpactTimes = typeof WeakMap !== 'undefined' ? new WeakMap() : null;

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
 play: function(id,options){
  const snd=this._snd();
  if(!snd||snd.sfxOn===false)return false;
  const urls=this._urls(id);
  if(!urls.length)return false;
  const level=Math.max(0,Math.min(1,(snd.sfx??80)/100));
  if(!level)return false;
  const opt=options&&typeof options==='object'?options:{};
  const scale=Math.max(0,Math.min(1.5,Number.isFinite(opt.volume)?opt.volume:1));
  const pan=Math.max(-1,Math.min(1,Number.isFinite(opt.pan)?opt.pan:0));
  const rate=Math.max(.75,Math.min(1.3,Number.isFinite(opt.rate)?opt.rate:1));
  const mixed=window.DiVANEngine&&DiVANEngine.audioMix&&AU.ctx;
  const vol=Math.min(1,(mixed ? .65 : level)*scale);
  if(!vol)return false;
  this._playAt(urls,0,vol,pan,rate);
  return true;
 },
 /** Пробует URL по порядку, пока клип не стартует. */
 _playAt: function(urls,i,vol,pan,rate){
  if(i>=urls.length)return;
  const a=new Audio();
  const mix=window.DiVANEngine&&DiVANEngine.audioMix;
  let next=false;
  const fail=()=>{
   if(mix)mix.releaseMedia(a);
   if(next)return;
   next=true;
   SFX._playAt(urls,i+1,vol,pan,rate);
  };
  a.referrerPolicy='no-referrer';
  a.volume=vol;
  try{a.playbackRate=rate||1;}catch(err){}
  a.addEventListener('error',fail);
  a.src=(typeof bootMediaSrc==='function')?bootMediaSrc(urls[i]):urls[i];
  if(mix){mix.routeMedia(a,pan||0);a.addEventListener('ended',()=>mix.releaseMedia(a),{once:true});}
  a.play().catch(fail);
 }
};

/**
 * Озвучивает физику автомобиля подписанными клипами из cars/hit.
 * kind: collision | damage | land. strength ожидается в диапазоне 0..1.
 */
function carImpactPlay(kind,racer,strength,position){
 const ids=CAR_IMPACT_TRACKS[kind];
 if(!ids||!ids.length||!SFX)return false;
 const pos=position&&typeof position==='object'?position:{};
 const now=(typeof performance!=='undefined'&&performance.now)?performance.now():Date.now();
 const gap=kind==='damage'?65:(kind==='collision'?90:140);
 if(racer&&carImpactTimes){
  let times=carImpactTimes.get(racer);
  if(!times){times={};carImpactTimes.set(racer,times);}
  if(times[kind]!=null&&now-times[kind]<gap)return false;
  times[kind]=now;
 }
 const force=Math.max(0,Math.min(1,Number.isFinite(strength)?strength:.5));
 let idx=Math.min(ids.length-1,Math.floor(force*ids.length));
 if(ids.length>2&&force>.2&&force<.85&&Math.random()<.34)idx=Math.max(0,Math.min(ids.length-1,idx+(Math.random()<.5?-1:1)));
 let volume=.42+force*.58,pan=0;
 const listener=typeof P!=='undefined'&&P?P:null;
 const x=Number.isFinite(pos.x)?pos.x:(racer&&Number.isFinite(racer.x)?racer.x:null);
 const y=Number.isFinite(pos.y)?pos.y:(racer&&Number.isFinite(racer.y)?racer.y:null);
 const local=!!pos.local||!!(racer&&racer.isP);
 if(!local&&listener&&x!=null&&y!=null){
  const dist=Math.hypot(x-listener.x,y-listener.y);
  if(dist>=920)return false;
  volume*=Math.pow(1-dist/920,1.25);
  pan=Math.max(-.8,Math.min(.8,(x-listener.x)/520));
 }
 if(volume<.035)return false;
 return SFX.play(ids[idx],{volume:volume,pan:pan,rate:.96+Math.random()*.08});
}
