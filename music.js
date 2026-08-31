////////////////////////////////////////////////////////
//
// Список треков: меню, выбор машины, гараж, гонка, интро.
// MP3 только с ikrinka24.com. После замены файла на CDN увеличьте MUSIC_CDN_VER.
//
////////////////////////////////////////////////////////

/** Сброс кэша браузера, когда на хосте перезаписали MP3 с тем же именем. */
var MUSIC_CDN_VER = '20260829-0355';

/** URL трека на CDN с меткой версии. */
function musicCdn(path) {
 return 'https://ikrinka24.com/ROCK/music/' + path + '?v=' + MUSIC_CDN_VER;
}

var MUSIC_TRACKS = {
 main: [
  musicCdn('main/0.mp3')
 ],
 change: [
  musicCdn('change/1.mp3'),
  musicCdn('change/2.mp3')
 ],
 garage: [
  musicCdn('garage/0.mp3')
 ],
 intro: [
  musicCdn('intro/01.mp3'),
  musicCdn('intro/02.mp3'),
  musicCdn('intro/03.mp3'),
  musicCdn('intro/04.mp3'),
  '',
  musicCdn('intro/06.mp3')
 ],
 racing: [
  musicCdn('racing/0.mp3'),
  musicCdn('racing/1.mp3'),
  musicCdn('racing/2.mp3'),
  musicCdn('racing/3.mp3'),
  musicCdn('racing/4.mp3'),
  musicCdn('racing/5.mp3'),
  musicCdn('racing/6.mp3'),
  musicCdn('racing/7.mp3'),
  musicCdn('racing/8.mp3'),
  musicCdn('racing/9.mp3'),
  musicCdn('racing/10.mp3'),
  musicCdn('racing/11.mp3'),
  musicCdn('racing/12.mp3'),
  musicCdn('racing/13.mp3')
 ]
};
