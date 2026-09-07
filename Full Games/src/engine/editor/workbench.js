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
  /** Создаёт доступную кнопку с действием. */
  function button(text, action) {
    const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=action;return b;
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
    document.querySelector('.title').textContent='Лаборатория';
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
      try {
        if(file.size>2000000)throw new Error('Размер JSON ограничен 2 МБ');
        const doc=JSON.parse(await file.text()),report=StudioCheck.track(doc);
        if(report.errors.length)throw new Error(report.errors.join(' · '));
        MapApp.importDocument(doc);status.textContent='Импортирован отдельный черновик. Сохраните его для игры.';
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
