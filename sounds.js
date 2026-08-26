////////////////////////////////////////////////////////
//
// Каталог звуковых эффектов.
// Менять пути только в этом файле.
// Сначала локальный файл (GitHub Pages), затем запасной URL.
// Играть: SFX.play('ключ')
//
////////////////////////////////////////////////////////

/** Карта id → один путь или список (первый рабочий). */
var SFX_TRACKS = {
 // Поднятие денег на трассе
 money: [
  'assets/sounds/FX/money.mp3',
  'https://ikrinka24.com/ROCK/sounds/FX/money.mp3'
 ],
 // Любая покупка (машина, тренажёрка, скилл)
 buy: [
  'assets/sounds/FX/CashBay.mp3',
  'https://ikrinka24.com/ROCK/sounds/FX/CashBay.mp3'
 ],
 // Любая покупка тюнинга авто
 tune: [
  'assets/sounds/FX/carPay.wav',
  'https://ikrinka24.com/ROCK/sounds/FX/carPay.wav'
 ]
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
 /** Список URL для ключа. */
 _urls: function(id){
  const v=SFX_TRACKS[id];
  if(!v)return [];
  return (Array.isArray(v)?v:[v]).filter(Boolean);
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
   a.src=urls[0];
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
  a.src=urls[i];
  a.play().catch(fail);
 }
};
