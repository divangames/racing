# -*- coding: utf-8 -*-
"""Создаёт пустые MP3-заготовки и листы озвучки из lines.json."""

from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1] / 'assets' / 'data' / 'players'


def write_script(bank_path, data):
    """Лист для записи: текст и имя файла."""
    folder = '/'.join(bank_path.parent.relative_to(ROOT).parts)
    lines = [
        f"# Озвучка: {data['name']}",
        '',
        f"- Папка: `assets/data/players/{folder}`",
        f"- Роль: {data['role']}",
        f"- Голос: {data['voice']}",
        '',
        'Каждая реплика — три дубля. Имена файлов не менять.',
        'Формат: MP3, моно или стерео, 48 кГц, без длинной тишины по краям.',
        '',
        '| Файл | Когда | Текст |',
        '|------|-------|-------|',
    ]
    for cue in data['cues']:
        for take in cue['takes']:
            text = take['text'].replace('|', '\\|')
            lines.append(f"| `{take['file']}` | {cue['event']} | {text} |")
    lines.append('')
    (bank_path.parent / 'СЧИТАТЬ.md').write_text('\n'.join(lines), encoding='utf-8')


def main():
    """Обходит все lines.json и пишет заготовки."""
    count = 0
    for lines_json in sorted(ROOT.glob('**/voice/lines.json')):
        data = json.loads(lines_json.read_text(encoding='utf-8'))
        write_script(lines_json, data)
        for cue in data['cues']:
            for take in cue['takes']:
                mp3 = lines_json.parent / take['file']
                if not mp3.exists():
                    mp3.write_bytes(b'')
                    count += 1
    print('placeholders', count)


if __name__ == '__main__':
    main()
