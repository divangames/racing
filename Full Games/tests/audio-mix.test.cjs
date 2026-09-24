'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=file=>fs.readFileSync(path.resolve(__dirname,'..',file),'utf8');
function boot(){
  const param=()=>({value:0,cancelScheduledValues(){},setTargetAtTime(value){this.value=value;}});
  const node=()=>({gain:param(),pan:param(),connect(to){this.dest=to;return to;},disconnect(){this.dest=null;}});
  const ctx={currentTime:1,createGain:node,createStereoPanner:node,createMediaElementSource:node,
    createDynamicsCompressor:()=>({...node(),threshold:param(),knee:param(),ratio:param(),attack:param(),release:param()})};
  const g={state:'race',paused:false,R:{},settings:{sound:{sfx:80,sfxOn:true,music:50,musicOn:true}},document:{hidden:false,addEventListener(){}},
    AU:{ctx,master:node(),sfx:node()},MUSIC:{el:{volume:1}},audioInit(){},applyAudioSettings(){},updEngine(){},press(){},
    DiVANEngine:{wrap(name,factory){g[name]=factory(g[name]);}}};
  g.window=g;vm.createContext(g);vm.runInContext(read('src/engine/audio-mix.js'),g);return {g,m:g.DiVANEngine.audioMix};
}
test('Мир замолкает в паузе и демонстрациях, канал меню остаётся слышен',()=>{
  const {g,m}=boot();m.sync(true);assert(g.AU.sfx.gain.value>0);const ui=g.AU.ui.gain.value;
  for(const state of ['settings','cameraSetup','car','autopark','detail','garage']){
    g.state=state;m.sync(true);assert.equal(g.AU.sfx.gain.value,0);assert.equal(g.AU.ui.gain.value,ui);
  }
  g.state='race';g.paused=true;m.sync(true);assert.equal(g.AU.sfx.gain.value,0);assert(g.AU.ui.gain.value>0);
  g.paused=false;g.R.demo=true;m.sync(true);assert.equal(g.AU.sfx.gain.value,0);
});
test('Mute, нулевая громкость и потеря видимости глушат обе шины; возврат восстанавливает микс',()=>{
  const {g,m}=boot();m.sync(true);g.settings.sound.sfx=0;m.sync(true);assert.equal(g.AU.ui.gain.value,0);assert.equal(g.AU.sfx.gain.value,0);
  g.settings.sound.sfx=80;g.settings.sound.sfxOn=false;m.sync(true);assert.equal(g.AU.ui.gain.value,0);
  g.settings.sound.sfxOn=true;g.document.hidden=true;m.sync(true);assert.equal(g.AU.sfx.gain.value,0);assert.equal(g.AU.ui.gain.value,0);assert.equal(m.musicLevel(),0);
  g.document.hidden=false;m.sync(true);assert(g.AU.ui.gain.value>0);assert(g.AU.sfx.gain.value>0);
});
test('Музыка уступает интерфейсу в настройках и паузе без изменения сохранённой громкости',()=>{
  const {g,m}=boot();const race=m.musicLevel();g.state='settings';const settings=m.musicLevel();g.state='race';g.paused=true;
  assert(m.musicLevel()<settings&&settings<race);assert.equal(g.settings.sound.music,50);
  g.settings.sound.musicOn=false;assert.equal(m.musicLevel(),0);
});
test('HTML и WAV используют общую шину, панорама HTML обновляется без второго источника',()=>{
  const {g,m}=boot(),el={};m.sync(true);const route=m.routeMedia(el,-.6);assert.equal(route.node.dest,g.AU.sfx);
  assert.equal(m.routeMedia(el,.6),route);assert.equal(route.node.pan.value,.6);m.releaseMedia(el);assert.equal(route.node.dest,null);
});
test('Панорама моторов соответствует экрану и не меняется от разворота игрока',()=>{
  const g={carEngineMakeSlot:()=>({}),DiVANEngine:{},settings:{sound:{sfx:80,sfxOn:true}}};g.window=g;vm.createContext(g);
  vm.runInContext(read('content/car-audio.js'),g);
  for(const ang of [0,Math.PI/2,Math.PI,-Math.PI/2]){
    const player={x:0,y:0,ang};assert(g.carEnginePanFrom(player,{x:250,y:0})>0);assert(g.carEnginePanFrom(player,{x:-250,y:0})<0);
    assert.equal(g.carEnginePanFrom(player,{x:0,y:300}),0);assert(Math.abs(g.carEnginePanFrom(player,{x:10000,y:0}))<=.82);
  }
});
