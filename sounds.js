////////////////////////////////////////////////////////
//
// Каталог звуковых эффектов.
// Менять URL только в этом файле.
// Играть: SFX.play('ключ')
//
////////////////////////////////////////////////////////

/** Карта id → ссылка на клип. */
var SFX_TRACKS = {
 // Поднятие денег на трассе
 money: 'https://ikrinka24.com/ROCK/sounds/FX/money.mp3',
 // Любая покупка (машина, тренажёрка, скилл)
 buy: 'https://ikrinka24.com/ROCK/sounds/FX/CashBay.mp3',
 // Любая покупка тюнинга авто
 tune: 'https://ikrinka24.com/ROCK/sounds/FX/carPay.wav'
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
 /** Прогреть все клипы из каталога. */
 preload: function(){
  if(typeof SFX_TRACKS!=='object'||!SFX_TRACKS)return;
  for(const id in SFX_TRACKS){
   if(!Object.prototype.hasOwnProperty.call(SFX_TRACKS,id))continue;
   const src=SFX_TRACKS[id];
   if(!src)continue;
   const a=new Audio();
   a.preload='auto';
   a.referrerPolicy='no-referrer';
   a.src=src;
   this._cache[id]=a;
  }
 },
 /**
  * Играть клип по ключу из SFX_TRACKS.
  * Учитывает выключатель и громкость SFX.
  */
 play: function(id){
  const snd=this._snd();
  if(!snd||snd.sfxOn===false)return;
  const src=SFX_TRACKS[id];
  if(!src)return;
  const a=new Audio();
  a.referrerPolicy='no-referrer';
  a.src=src;
  a.volume=Math.max(0,Math.min(1,(snd.sfx||80)/100));
  a.play().catch(function(){});
 }
};
