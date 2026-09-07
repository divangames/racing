// Ограниченная история отдельного документа с отсечением ветки после новой правки.
class StudioHistory {
  constructor(limit = 80) { this.list = []; this.at = -1; this.limit = limit; }
  /** Добавляет снимок; повтор текущего состояния сохраняет доступный redo. */
  record(snapshot) {
    if (this.list[this.at] === snapshot) return;
    this.list = this.list.slice(0, this.at + 1);
    this.list.push(snapshot);
    if (this.list.length > this.limit) this.list.shift();
    this.at = this.list.length - 1;
  }
}
