// Инструменты лаборатории: диагностика геометрии, обмен JSON и восстановление черновиков.
window.StudioCheck = {
  /** Проверяет исходный документ до нормализации и оценивает геометрию петли. */
  track(doc) {
    const errors=[],warnings=[];
    if(!doc || typeof doc!=='object' || Array.isArray(doc))return {errors:['Нужен JSON-объект трассы'],warnings,length:0,turns:0};
    const points=doc.cps;
    if(!Array.isArray(points)||points.length<4||points.length>2048)return {errors:['Нужно от 4 до 2048 точек трассы'],warnings,length:0,turns:0};
    if(points.some(p=>!Array.isArray(p)||p.length<2||!p.slice(0,2).every(n=>Number.isFinite(n)&&Math.abs(n)<=100000))) {
      return {errors:['Координаты должны быть конечными числами в пределах ±100000'],warnings,length:0,turns:0};
    }
    if(new Set(points.map(p=>p[0]+','+p[1])).size<4)errors.push('Нужны хотя бы четыре различные точки');
    if(typeof doc.name!=='string'||!doc.name.trim()||doc.name.length>120)errors.push('Название: от 1 до 120 символов');
    for(const key of ['decals','items','zones','shortcuts'])if(doc[key]!=null&&(!Array.isArray(doc[key])||doc[key].length>10000||doc[key].some(p=>!p||typeof p!=='object'||Array.isArray(p))))errors.push('Некорректный список: '+key);
    if(doc.hazards!=null && (typeof doc.hazards!=='object'||Array.isArray(doc.hazards)||Object.values(doc.hazards).some(a=>!Array.isArray(a)||a.length>10000||a.some(p=>!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)))))errors.push('Некорректные опасности');
    if(!errors.length) {
      for(const key of ['decals','items'])if((doc[key]||[]).some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))errors.push('Некорректные координаты: '+key);
      if((doc.shortcuts||[]).some(p=>![p.entry,p.exit].every(a=>Array.isArray(a)&&a.length>=2&&a.slice(0,2).every(Number.isFinite))))errors.push('Некорректные координаты среза');
    }
    let length=0,turns=0,short=0;
    points.forEach((p,i)=>{
      const next=points[(i+1)%points.length],prev=points[(i+points.length-1)%points.length];
      const segment=Math.hypot(next[0]-p[0],next[1]-p[1]); length+=segment;
      if(segment<8)short++;
      const a=Math.atan2(p[1]-prev[1],p[0]-prev[0]),b=Math.atan2(next[1]-p[1],next[0]-p[0]);
      if(Math.abs(Math.atan2(Math.sin(b-a),Math.cos(b-a)))>Math.PI*.55)turns++;
    });
    if(short)warnings.push(short+' слишком коротких сегментов: возможны заломы сплайна');
    if(turns)warnings.push(turns+' резких поворотов: проверьте проезд на полигоне');
    return {errors,warnings,length,turns};
  }
};
(() => {
  const MAX_TEXTURE_SIZE = 32 * 1024 * 1024;

  /** Создаёт доступную кнопку с действием. */
  function button(text, action) {
    const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=action;return b;
  }

  /** Имя файла без расширения для стабильного id в библиотеке. */
  function textureId(file) {
    return String(file && file.name || 'texture').replace(/\.[^.]+$/, '').toLowerCase()
      .replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, '').slice(0, 32) || 'texture';
  }

  /** Ждёт, пока Chromium действительно декодирует только что записанную картинку. */
  function waitTexture(src) {
    return new Promise((resolve, reject) => {
      MapTex.forget(src);
      const image=MapTex.img(src, null, true);
      if (!image) { reject(new Error('Файл не загрузился')); return; }
      const done=()=>image.naturalWidth>1?resolve(image):reject(new Error('Изображение повреждено'));
      image.addEventListener('load',done,{once:true});
      image.addEventListener('error',()=>reject(new Error('Формат изображения не поддерживается')),{once:true});
      if (image.complete) done();
    });
  }

  /** Передаёт исходные байты текстуры без Base64 и применяет файл после декодирования. */
  async function uploadTrackTexture(file, kind, property, title, replaceId) {
    if (!file) return;
    if (file.size>MAX_TEXTURE_SIZE) throw new Error('Максимальный размер текстуры — 32 МБ');
    const ext=(file.name.split('.').pop()||'png').toLowerCase().replace('jpeg','jpg');
    const query=new URLSearchParams({kind,id:replaceId||textureId(file),ext});
    const response=await fetch('/__save-texture-file?'+query.toString(),{
      method:'POST',headers:{'Content-Type':file.type||'application/octet-stream'},body:file
    });
    if(!response.ok)throw new Error('Не удалось записать файл ('+response.status+')');
    const out=await response.json();
    if(!out.ok||!out.src)throw new Error('Редактор не вернул путь текстуры');
    await MapTex.list();
    await waitTexture(out.src);
    const doc=MapApp.getDocument();
    doc.theme[property]=out.src;
    if(window.MapPreview&&MapPreview.invalidateRoad)MapPreview.invalidateRoad();
    MapPanel.paint();
    MapView.draw();
    MapApp.commit();
    const status=document.getElementById('mapSaveState');
    if(status)status.textContent=title+' применены · '+file.name;
  }

  /** Подменяет медленную загрузку дороги и бортов на прямую передачу файла. */
  function bindFastTextures() {
    const specs=[
      ['mapRoadFile','road','roadSrc','Дорога'],
      ['mapRailFile','rail','railSrc','Борта']
    ];
    specs.forEach(([id,kind,property,title])=>{
      const input=document.getElementById(id);if(!input)return;
      input.onchange=async()=>{
        const file=input.files&&input.files[0];input.value='';if(!file)return;
        const run=()=>uploadTrackTexture(file,kind,property,title);
        try {
          if(window.LabBusy&&LabBusy.run)await LabBusy.run('Применяю: '+file.name,run);
          else await run();
        } catch(error) {
          const status=document.getElementById('mapSaveState');
          if(status)status.textContent=title+': '+error.message;
        }
      };
    });
    const roadInput=document.getElementById('mapRoadFile');
    const roadLabel=roadInput&&roadInput.closest('label');
    if(roadLabel&&!document.getElementById('mapRoadReplaceBtn')){
      const replaceInput=document.createElement('input');replaceInput.type='file';replaceInput.accept=roadInput.accept;replaceInput.hidden=true;
      const replaceBtn=button('Заменить выбранную дорогу',()=>{
        const src=MapApp.getDocument().theme.roadSrc||'';
        if(!/\/Textures\/road\//i.test(src)){
          const status=document.getElementById('mapSaveState');
          if(status)status.textContent='Сначала выберите дорогу из библиотеки';
          return;
        }
        replaceInput.click();
      });
      replaceBtn.id='mapRoadReplaceBtn';replaceBtn.className='texture-replace';
      replaceInput.onchange=async()=>{
        const file=replaceInput.files&&replaceInput.files[0];replaceInput.value='';if(!file)return;
        const src=MapApp.getDocument().theme.roadSrc||'';
        const name=src.split('/').pop()||'';
        const replaceId=name.replace(/\.[^.]+$/,'');
        try{
          const run=()=>uploadTrackTexture(file,'road','roadSrc','Дорога заменена',replaceId);
          if(window.LabBusy&&LabBusy.run)await LabBusy.run('Заменяю дорогу: '+replaceId,run);else await run();
        }catch(error){const status=document.getElementById('mapSaveState');if(status)status.textContent='Замена дороги: '+error.message;}
      };
      roadLabel.after(replaceBtn,replaceInput);
    }
  }

  /** Делит обычные и сюжетные трассы на самостоятельные режимы списка. */
  function splitTrackLists() {
    const ownList=document.getElementById('mapList');
    const chapterList=document.getElementById('mapChapterList');
    const section=ownList&&ownList.closest('.section');
    if(!section||!chapterList||section.querySelector('.map-source-tabs'))return;
    const own=document.createElement('div');own.className='map-source-view';own.dataset.source='own';
    const campaign=document.createElement('div');campaign.className='map-source-view';campaign.dataset.source='campaign';
    const ownActions=document.getElementById('mapNewBtn')?.closest('.actions');
    const stock=document.getElementById('mapStock')?.closest('.field');
    const chapterTitle=chapterList.previousElementSibling;
    const chapterHint=chapterList.nextElementSibling;
    [ownList,ownActions,stock].forEach(node=>{if(node)own.append(node);});
    [chapterTitle,chapterList,chapterHint].forEach(node=>{if(node)campaign.append(node);});
    const tabs=document.createElement('div');tabs.className='map-source-tabs';tabs.setAttribute('role','tablist');
    const ownBtn=button('Мои трассы',()=>show('own'));
    const campaignBtn=button('Кампания',()=>show('campaign'));
    ownBtn.setAttribute('role','tab');campaignBtn.setAttribute('role','tab');
    tabs.append(ownBtn,campaignBtn);section.append(tabs,own,campaign);
    function show(source) {
      const campaignOn=source==='campaign';
      own.hidden=campaignOn;campaign.hidden=!campaignOn;
      ownBtn.classList.toggle('is-on',!campaignOn);campaignBtn.classList.toggle('is-on',campaignOn);
      ownBtn.setAttribute('aria-selected',String(!campaignOn));campaignBtn.setAttribute('aria-selected',String(campaignOn));
      try{localStorage.setItem('rnr.studio.trackSource',source);}catch(error){}
    }
    let saved='own';try{saved=localStorage.getItem('rnr.studio.trackSource')||'own';}catch(error){}
    show(saved==='campaign'?'campaign':'own');
  }

  /** Добавляет в инспектор быстрые действия и навигацию по длинной панели. */
  function enhanceInspector() {
    const panel=document.querySelector('#workMap .panel');if(!panel||panel.querySelector('.map-inspector-head'))return;
    splitTrackLists();
    const head=document.createElement('div');head.className='map-inspector-head';
    const title=document.createElement('div');title.className='map-inspector-title';title.innerHTML='<strong>Инструменты трассы</strong><span>Правки применяются к выбранной трассе</span>';
    const actions=document.createElement('div');actions.className='map-inspector-actions';
    const save=button('Сохранить',()=>document.getElementById('mapSaveBtn')?.click());save.className='primary';
    const test=button('Тест',()=>document.getElementById('mapTestBtn')?.click());
    actions.append(save,test);head.append(title,actions);
    const nav=document.createElement('nav');nav.className='map-inspector-nav';nav.setAttribute('aria-label','Разделы инструментов');
    const labels=[
      ['mapList','Трассы'],['mapName','Карточка'],['mapRoadFile','Текстуры'],['mapZones','Покрытие'],['mapSaveBtn','Сохранение']
    ];
    labels.forEach(([id,label])=>{
      const target=document.getElementById(id)?.closest('.section');if(!target)return;
      target.classList.add('map-panel-card');
      const link=button(label,()=>target.scrollIntoView({behavior:'smooth',block:'start'}));
      nav.append(link);
    });
    panel.prepend(nav);panel.prepend(head);
  }
  /** Устанавливает инструменты после готовности исходного интерфейса. */
  function start() {
    if (typeof MapApp === 'undefined' || typeof MapApp.getDocument !== 'function') {
      const notice=document.createElement('p');notice.className='studio-report';notice.setAttribute('role','status');
      notice.textContent='Базовый редактор доступен. Для расширенной истории и импорта этой версии контента обновите клиент.';
      document.querySelector('#workMap .stage-card')?.append(notice);
      return;
    }
    document.querySelector('.eyebrow').textContent='DIVAN GAMES  /  ENGINE WORKSPACE';
    document.querySelector('.title').textContent='DiVANEngine';
    try { document.title = 'DiVANEngine'; } catch (err) {}
    const actions=document.createElement('div');actions.className='studio-actions';
    const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.hidden=true;
    const status=document.createElement('p');status.className='studio-report';status.setAttribute('role','status');
    const summary=document.createElement('div');summary.className='studio-summary';
    const exportBtn=button('Экспорт JSON',()=>{
      const doc=MapData.fileTrack(MapApp.getDocument());
      const url=URL.createObjectURL(new Blob([JSON.stringify(doc,null,2)],{type:'application/json'}));
      const a=document.createElement('a');a.href=url;a.download=doc.id+'.json';a.click();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
      status.textContent='JSON подготовлен для сохранения';
    });
    input.onchange=async()=>{
      const file=input.files[0];input.value='';if(!file)return;
      const apply=async()=>{
        if(file.size>2000000)throw new Error('Размер JSON ограничен 2 МБ');
        const doc=JSON.parse(await file.text()),report=StudioCheck.track(doc);
        if(report.errors.length)throw new Error(report.errors.join(' · '));
        MapApp.importDocument(doc);status.textContent='Импортирован отдельный черновик. Сохраните его для игры.';
      };
      try {
        if(window.LabBusy&&LabBusy.run) await LabBusy.run('Импортирую трассу',apply);
        else await apply();
      } catch(error) {status.textContent='Импорт: '+error.message;}
    };
    const restore=button('Восстановить черновик',()=>{
      try {
        const raw=localStorage.getItem('rnr.studio.draft.'+MapApp.getDocument().id);
        if(!raw)throw new Error('Черновик не найден');
        const doc=JSON.parse(raw),report=StudioCheck.track(doc);
        if(report.errors.length)throw new Error(report.errors[0]);
        MapApp.restoreDocument(doc);status.textContent='Черновик восстановлен. Ctrl+Z отменяет восстановление.';
      } catch(error){status.textContent=error.message;}
    });
    actions.append(button('Импорт JSON',()=>input.click()),exportBtn,restore,input);
    const card=document.querySelector('#workMap .stage-card');
    const tools=card && card.querySelector('.stage-tools');
    if(tools) tools.after(actions);
    else if(card) card.append(actions);
    const diagnostics=document.createElement('section');diagnostics.className='section studio-diagnostics';
    const heading=document.createElement('div');heading.className='section-title';heading.textContent='ПРОВЕРКА ТРАССЫ';
    diagnostics.append(heading,summary,status);
    document.querySelector('#workMap .panel').prepend(diagnostics);
    const note=card?.querySelector('.stage-note');
    if(note) {
      const help=document.createElement('details'),title=document.createElement('summary');
      title.textContent='Управление холстом';help.className='studio-help';note.before(help);help.append(title,note);
    }
    bindFastTextures();
    enhanceInspector();
    /** Обновляет диагностику только при изменении документа и после загрузки редактора. */
    let previous='';
    setInterval(()=>{
      if(!MapApp.mapOn())return;
      const doc=MapApp.getDocument(),snapshot=JSON.stringify(MapData.fileTrack(doc));
      try { const raw=localStorage.getItem('rnr.studio.draft.'+doc.id);restore.disabled=!raw||raw===snapshot; } catch(error){restore.disabled=true;}
      if(snapshot===previous)return;previous=snapshot;
      const report=StudioCheck.track(doc),hazards=Object.values(doc.hazards||{}).reduce((n,a)=>n+(Array.isArray(a)?a.length:0),0);
      summary.textContent=`${doc.cps.length} ТОЧЕК  /  ${Math.round(report.length)} ЕД. ПО КОНТРОЛЬНОЙ ЛИНИИ  /  ${hazards} ОПАСНОСТЕЙ  /  ${doc.published?'ОПУБЛИКОВАНА':'ЧЕРНОВИК'}`;
      summary.dataset.valid=report.errors.length?'false':'true';
      status.textContent=report.errors.concat(report.warnings).join(' · ')||'Геометрия прошла базовую проверку. Полигон проверит трассу в движении.';
    },750);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
