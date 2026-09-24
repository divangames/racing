// Короткие механические отклики меню: отфильтрованный шум и низкий корпус, без чип-мелодий.
(function(global){
  'use strict';
  const E=global.DiVANEngine;if(!E)return;
  const presets=Object.freeze({
    move:{duration:.085,body:240,noise:.27,weight:.30,decay:36},
    confirm:{duration:.19,body:125,noise:.25,weight:.4,decay:22},
    back:{duration:.13,body:100,noise:.17,weight:.28,decay:28},
    denied:{duration:.17,body:72,noise:.22,weight:.34,decay:26},
    purchase:{duration:.28,body:145,noise:.23,weight:.36,decay:18}
  });
  let context=null,buffers=new Map(),lastAt=-10,played=0,lastKind='',intent='';
  const sources=new Set();
  function render(kind,sampleRate){
    const p=presets[kind]||presets.move,n=Math.ceil(sampleRate*p.duration),data=new Float32Array(n);
    let seed=48721,filtered=0;
    for(let i=0;i<n;i++){
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      filtered+=(seed/2147483648-1-filtered)*.19;
      const t=i/sampleRate,attack=Math.min(1,t/.003),end=Math.min(1,(n-1-i)/(sampleRate*.012));
      const body=Math.sin(2*Math.PI*p.body*t)*Math.exp(-t*p.decay);
      const latch=filtered*Math.exp(-t*65);
      const tail=kind==='purchase'?Math.sin(2*Math.PI*218*t)*Math.exp(-t*24)*.1:0;
      data[i]=attack*end*(p.weight*body+p.noise*latch+tail)*.72;
    }
    data[0]=0;data[n-1]=0;return data;
  }
  function isMenu(){return typeof state!=='undefined'&&(state!=='race'||typeof paused!=='undefined'&&paused);}
  function play(kind){
    if(typeof R!=='undefined'&&R&&R.demo)return false;
    kind=kind||intent||'move';if(!presets[kind])kind='move';
    const snd=typeof settings!=='undefined'&&settings.sound;
    if(!snd||snd.sfxOn===false||Number(snd.sfx)===0||typeof AU==='undefined'||!AU.ctx||!AU.sfx)return false;
    const c=AU.ctx;if(c.state&&c.state!=='running')return false;
    if(E.audioMix)E.audioMix.sync();
    if(context!==c){context=c;buffers=new Map();lastAt=-10;sources.clear();}
    const t=c.currentTime;
    if(kind==='move'&&lastKind==='move'&&t-lastAt<.055)return false;
    if(sources.size>=4){const oldest=sources.values().next().value;try{oldest.stop();}catch(_){}sources.delete(oldest);}
    if(!buffers.has(kind)){
      const samples=render(kind,c.sampleRate),b=c.createBuffer(1,samples.length,c.sampleRate);b.copyToChannel(samples,0);buffers.set(kind,b);
    }
    const s=c.createBufferSource();s.buffer=buffers.get(kind);s.connect(AU.ui||AU.sfx);sources.add(s);
    s.onended=()=>{sources.delete(s);s.disconnect();};s.start(t);lastAt=t;played++;lastKind=kind;return true;
  }
  function action(kind,fn,self,args){const old=intent;intent=kind;try{return fn.apply(self,args);}finally{intent=old;}}
  E.wrap('press',previous=>function(code){return action(code==='Escape'?'back':/^Arrow/.test(code)?'move':'confirm',previous,this,arguments);});
  for(const name of ['hubClick','clickSettings','clickCameraSetup'])E.wrap(name,previous=>function(){return action('confirm',previous,this,arguments);});
  if(global.SFX&&typeof SFX.play==='function'){
    const previous=SFX.play;SFX.play=function(id){if(isMenu()&&(id==='buy'||id==='tune'))return play('purchase');return previous.apply(this,arguments);};
  }
  E.menuAudio={play,render,isMenu,presets,status:()=>({played,lastKind,voices:sources.size})};
})(typeof window!=='undefined'?window:globalThis);
