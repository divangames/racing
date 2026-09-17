////////////////////////////////////////////////////////
//
// DiVANEngine: пункты главного меню — id, подписи, действия.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /**
   * Id пункта: объект или старая строка.
   * @param {object|string|null} it
   * @returns {string}
   */
  function titleItemId(it) {
    if (!it) return '';
    if (typeof it === 'string') return it;
    return it.id || '';
  }

  /**
   * Подпись на кнопке.
   * @param {object|string|null} it
   * @returns {string}
   */
  function titleItemLabel(it) {
    if (!it) return '';
    if (typeof it === 'string') return it;
    return it.label || '';
  }

  /**
   * Мелкая строка справа/снизу (этап свободного заезда).
   * @param {object|string|null} it
   * @returns {string}
   */
  function titleItemHint(it) {
    if (!it || typeof it === 'string') return '';
    return it.hint || '';
  }

  /**
   * Есть сюжетный сейв кампании.
   * @param {object|null} storyObj
   * @returns {boolean}
   */
  function hasCampaignSave(storyObj) {
    return !!(storyObj && storyObj.storyCampaign);
  }

  /**
   * Пункты титула. Служебное — только dev / читы.
   * @param {object|null} saveObj
   * @param {boolean} dev
   * @param {object|null} storyObj
   * @returns {Array<{id:string,label:string,hint?:string}>}
   */
  function titleItems(saveObj, dev, storyObj) {
    const items = [];
    const story = hasCampaignSave(storyObj);
    const free = !!saveObj;
    if (story) items.push({ id: 'campaign-continue', label: 'ПРОДОЛЖИТЬ КАМПАНИЮ' });
    items.push({ id: 'campaign-new', label: story ? 'НОВАЯ КАМПАНИЯ' : 'КАМПАНИЯ' });
    if (free) {
      items.push({
        id: 'free-continue',
        label: 'ПРОДОЛЖИТЬ СВОБОДНЫЙ ЗАЕЗД',
        hint: 'этап ' + ((saveObj.race | 0) + 1)
      });
    }
    items.push({ id: 'free-new', label: free ? 'НОВЫЙ СВОБОДНЫЙ ЗАЕЗД' : 'СВОБОДНЫЙ ЗАЕЗД' });
    items.push({ id: 'settings', label: 'НАСТРОЙКИ' });
    items.push({ id: 'achievements', label: 'ДОСТИЖЕНИЯ' });
    if (typeof cheatsAllowed !== 'function' || cheatsAllowed()) items.push({ id: 'cheats', label: 'ЧИТЫ' });
    if (dev) {
      items.push({ id: 'tracks', label: 'ВЫБОР ТРАССЫ' });
      items.push({ id: 'lab', label: 'DIVANENGINE' });
    }
    items.push({ id: 'exit', label: 'ВЫХОД' });
    return items;
  }

  /**
   * Курсор: сначала «продолжить», иначе первый пункт.
   * @param {Array} items
   * @returns {number}
   */
  function titleDefaultIndex(items) {
    const list = items || [];
    for (let i = 0; i < list.length; i++) {
      const id = titleItemId(list[i]);
      if (id === 'campaign-continue' || id === 'free-continue') return i;
    }
    return 0;
  }

  /** Новый свободный заезд: камера, затем пилот. */
  function startFreeNew() {
    if (typeof newSave === 'function') save = newSave();
    if (typeof persist === 'function') persist();
    selChar = 0;
    selCar = 0;
    carConfirmed = false;
    if (typeof enterCameraSetup === 'function') enterCameraSetup();
  }

  /**
   * Подтверждённый старт «новой» ветки.
   * @param {string} kind
   */
  function confirmTitleWipe(kind) {
    switch (kind) {
      case 'campaign-new':
        if (typeof storyStartNewCampaign === 'function') storyStartNewCampaign();
        break;
      case 'free-new':
        startFreeNew();
        break;
      default: {
        const neverKind = kind;
        void neverKind;
        break;
      }
    }
  }

  /**
   * Enter по id. Новая кампания/заезд при живом сейве — модалка.
   * @param {string} id
   * @param {{story?:object|null,free?:object|null}} peek
   */
  function applyTitleAction(id, peek) {
    const story = peek && peek.story;
    const free = peek && peek.free;
    switch (id) {
      case 'campaign-continue':
        if (typeof storyContinueCampaign === 'function') storyContinueCampaign();
        break;
      case 'campaign-new':
        if (hasCampaignSave(story) && typeof openTitleConfirm === 'function') openTitleConfirm('campaign-new');
        else if (typeof storyStartNewCampaign === 'function') storyStartNewCampaign();
        break;
      case 'free-continue':
        if (typeof loadSave === 'function') loadSave();
        state = 'garage';
        break;
      case 'free-new':
        if (free && typeof openTitleConfirm === 'function') openTitleConfirm('free-new');
        else startFreeNew();
        break;
      case 'settings':
        if (typeof openSettings === 'function') openSettings('title');
        break;
      case 'achievements':
        if (typeof openAchievements === 'function') openAchievements('title');
        break;
      case 'cheats':
        state = 'cheats';
        cheatMsgT = 0;
        break;
      case 'tracks':
        if (typeof enterTrackPick === 'function') enterTrackPick('title');
        break;
      case 'lab':
        if (typeof openLabWarn === 'function') openLabWarn();
        break;
      case 'exit':
        if (typeof openExitWarn === 'function') openExitWarn();
        break;
      default: {
        const neverId = id;
        void neverId;
        break;
      }
    }
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.titleMenu = {
    titleItems,
    titleItemId,
    titleItemLabel,
    titleItemHint,
    titleDefaultIndex,
    applyTitleAction,
    confirmTitleWipe,
    startFreeNew
  };
})(typeof window !== 'undefined' ? window : globalThis);
