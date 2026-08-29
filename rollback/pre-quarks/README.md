# Откат эксперимента three.quarks

Снимок `rnr.html` до слоя VFX. Сам слой живёт в `vfx/` и подключается из игры.

## Вернуть как было

Из корня репозитория:

```bat
restore-quarks-rollback.bat
```

Или вручную: скопировать `rollback\pre-quarks\rnr.html` поверх `rnr.html`. Папку `vfx/` можно не трогать — без тега `import` она не грузится.
