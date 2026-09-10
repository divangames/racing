////////////////////////////////////////////////////////
//
// DiVANEngine: тюнинг и навык ИИ по дивизиону.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /**
   * Тюнинг босса: в 1 дивизионе сток, к 6 — не выше V.
   * @param {number} div
   * @returns {object}
   */
  function aiBossTuneEngine(div) {
    const t = Math.max(0, (div | 0) - 1);
    return {
      arm: Math.min(5, t),
      eng: Math.min(5, t),
      tir: Math.min(4, Math.floor(t * .75)),
      shk: Math.min(3, Math.floor(t * .4)),
      nit: Math.min(2, Math.max(0, Math.floor((t - 1) * .5))),
      wep: Math.min(4, Math.max(0, Math.floor(t * .8))),
      ult: Math.min(3, Math.max(0, Math.floor(t * .55)))
    };
  }

  /**
   * Заполнители сетки: на шаг слабее боссов, без нитро-бака.
   * @param {number} div
   * @returns {object}
   */
  function aiFillerTuneEngine(div) {
    const t = Math.max(0, (div | 0) - 2);
    return {
      arm: Math.min(3, t),
      eng: Math.min(3, t),
      tir: Math.min(2, Math.max(0, t - 1)),
      shk: Math.min(2, Math.max(0, Math.floor(t * .4))),
      nit: 0,
      wep: Math.min(2, Math.max(0, t - 1)),
      ult: Math.min(1, Math.max(0, t - 2))
    };
  }

  /**
   * Уровень личного скила ИИ: не открывает максимум вместе с дивизионом.
   * @param {number} div
   * @returns {number}
   */
  function aiSkillLvlEngine(div) {
    return clamp(1 + Math.floor(Math.max(0, (div | 0) - 1) * .4), 1, 4);
  }

  /**
   * Ловкость пилотажа: ранняя сетка ошибается, поздняя не становится читами.
   * @param {number} div
   * @param {boolean} boss
   * @returns {number}
   */
  function aiDriveSkillEngine(div, boss) {
    const d = Math.max(0, (div | 0) - 1);
    if (boss) return clamp(.7 + Math.random() * .2 + d * .05, .7, 1.12);
    return clamp(.52 + Math.random() * .18 + d * .04, .5, .95);
  }

  /**
   * Гандикап кузова ИИ: танки не сносят сток в первом сезоне.
   * @param {number} div
   * @returns {{hp:number,spd:number,acc:number}}
   */
  function aiPerfScaleEngine(div) {
    const d = Math.max(0, (div | 0) - 1);
    return {
      hp: clamp(.78 + d * .04, .78, .96),
      spd: clamp(.90 + d * .025, .90, 1),
      acc: clamp(.88 + d * .03, .88, 1)
    };
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.raceAi = { bossTune: aiBossTuneEngine, fillerTune: aiFillerTuneEngine, skillLvl: aiSkillLvlEngine, perfScale: aiPerfScaleEngine };
  engine.replace('aiBossTune', aiBossTuneEngine);
  engine.replace('aiFillerTune', aiFillerTuneEngine);
  engine.replace('aiSkillLvl', aiSkillLvlEngine);
  engine.replace('aiDriveSkill', aiDriveSkillEngine);
  engine.replace('aiPerfScale', aiPerfScaleEngine);
})(typeof window !== 'undefined' ? window : globalThis);
