# Локальный сервер: статика проекта, запись car.json и трасс из лаборатории.
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
import re
import shutil
import sys
import base64

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rnr_objects

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(os.environ.get('PORT', '8765'))
MUSIC_CATS = ('main', 'change', 'garage', 'intro', 'racing')
MUSIC_EXTS = {'.mp3', '.ogg', '.wav', '.m4a'}


def natural_key(name):
    """Сортировка как в проводнике: 2.mp3 перед 10.mp3."""
    return [int(p) if p.isdigit() else p.lower() for p in re.split(r'(\d+)', name)]


def music_index():
    """Имена треков в assets/music/{категория}/ без подпапок."""
    out = {}
    root = os.path.join(ROOT, 'assets', 'music')
    for cat in MUSIC_CATS:
        folder = os.path.join(root, cat)
        names = []
        if os.path.isdir(folder):
            for name in os.listdir(folder):
                full = os.path.join(folder, name)
                if not os.path.isfile(full):
                    continue
                ext = os.path.splitext(name)[1].lower()
                if ext in MUSIC_EXTS:
                    names.append(name)
            names.sort(key=natural_key)
        out[cat] = names
    return out


IMG_EXT = {'.png', '.jpg', '.jpeg', '.webp', '.gif'}
TEX_ID = re.compile(r'^[a-z0-9_]{2,32}$')
TRACK_ID = re.compile(r'^[a-z0-9_]{2,40}$')


def tex_root():
    """Библиотека текстур трасс."""
    return os.path.join(ROOT, 'assets', 'data', 'tracks', 'Textures')


def stock_map_root():
    """Стоковые тайлы земли."""
    return os.path.join(ROOT, 'assets', 'image', 'textures', 'map')


def first_image(folder):
    """Первый кадр в папке."""
    if not os.path.isdir(folder):
        return None
    names = [n for n in os.listdir(folder) if os.path.splitext(n)[1].lower() in IMG_EXT]
    names.sort(key=natural_key)
    return names[0] if names else None


def list_textures():
    """Каталог биомов, дорог и объектов."""
    biomes = []
    stock = stock_map_root()
    if os.path.isdir(stock):
        for name in os.listdir(stock):
            folder = os.path.join(stock, name)
            if not os.path.isdir(folder):
                continue
            file = first_image(folder)
            if not file:
                continue
            biomes.append({
                'id': name,
                'src': 'assets/image/textures/map/%s/%s' % (name, file),
                'stock': True
            })
    custom = os.path.join(tex_root(), 'biomes')
    if os.path.isdir(custom):
        for name in os.listdir(custom):
            folder = os.path.join(custom, name)
            if not os.path.isdir(folder):
                continue
            file = first_image(folder)
            if not file:
                continue
            biomes.append({
                'id': name,
                'src': 'assets/data/tracks/Textures/biomes/%s/%s' % (name, file),
                'stock': False
            })
    out = {'biomes': biomes, 'roads': [], 'objects': []}
    for kind in ('road', 'objects'):
        folder = os.path.join(tex_root(), kind)
        if not os.path.isdir(folder):
            continue
        for name in os.listdir(folder):
            ext = os.path.splitext(name)[1].lower()
            if ext not in IMG_EXT:
                continue
            out['road' if kind == 'road' else 'objects'].append({
                'id': os.path.splitext(name)[0],
                'src': 'assets/data/tracks/Textures/%s/%s' % (kind, name)
            })
    return out


def write_texture(data):
    """Пишет файл земли, дороги или объекта. Возвращает dict или None."""
    kind = data.get('kind')
    dest = data.get('dest') or 'library'
    tid = data.get('id')
    ext = str(data.get('ext') or 'png').lower().replace('jpeg', 'jpg')
    payload = data.get('data') or ''
    if not isinstance(tid, str) or not TEX_ID.match(tid) or ('.' + ext) not in IMG_EXT:
        return None
    if not isinstance(payload, str) or 'base64,' not in payload:
        return None
    raw = base64.b64decode(payload.split('base64,', 1)[1])
    if not raw:
        return None
    rel = None
    if kind == 'ground' and dest == 'current':
        stock_dir = os.path.join(stock_map_root(), tid)
        if os.path.isdir(stock_dir):
            rel = 'assets/image/textures/map/%s/lab.%s' % (tid, ext)
        else:
            os.makedirs(os.path.join(tex_root(), 'biomes', tid), exist_ok=True)
            rel = 'assets/data/tracks/Textures/biomes/%s/01.%s' % (tid, ext)
    elif kind == 'ground':
        os.makedirs(os.path.join(tex_root(), 'biomes', tid), exist_ok=True)
        rel = 'assets/data/tracks/Textures/biomes/%s/01.%s' % (tid, ext)
    elif kind == 'road':
        os.makedirs(os.path.join(tex_root(), 'road'), exist_ok=True)
        rel = 'assets/data/tracks/Textures/road/%s.%s' % (tid, ext)
    elif kind == 'object':
        os.makedirs(os.path.join(tex_root(), 'objects'), exist_ok=True)
        rel = 'assets/data/tracks/Textures/objects/%s.%s' % (tid, ext)
    else:
        return None
    full = os.path.join(ROOT, rel.replace('/', os.sep))
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, 'wb') as f:
        f.write(raw)
    return {'ok': True, 'src': rel.replace('\\', '/'), 'id': tid}


def write_json(path, data):
    """Пишет JSON с переводом строки в конце."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write('\n')


def write_car(path, car):
    """Пишет JSON машины с переводом строки в конце."""
    write_json(path, car)


def tracks_dir():
    """Папка своих трасс."""
    return os.path.join(ROOT, 'assets', 'data', 'tracks')


def list_track_files():
    """Имена JSON трасс, кроме индекса."""
    folder = tracks_dir()
    names = []
    if os.path.isdir(folder):
        for name in os.listdir(folder):
            if name.endswith('.json') and name != 'index.json' and TRACK_ID.match(os.path.splitext(name)[0]):
                names.append(name)
        names.sort(key=natural_key)
    return names


def write_track_index():
    """Обновляет index.json для Pages и загрузки без POST."""
    write_json(os.path.join(tracks_dir(), 'index.json'), {'files': list_track_files()})


class Handler(SimpleHTTPRequestHandler):
    """Раздаёт файлы из корня игры и принимает POST /__save-car."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def _json_ok(self, payload):
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.split('?', 1)[0]
        if path == '/__music-index':
            self._json_ok(music_index())
            return
        if path == '/__tracks':
            self._json_ok({'files': list_track_files()})
            return
        if path in ('/__track-textures', '/__textures'):
            self._json_ok(list_textures())
            return
        if path == '/__object-packs':
            self._json_ok(rnr_objects.list_packs(ROOT))
            return
        return super().do_GET()

    def do_POST(self):
        path = self.path.split('?', 1)[0]
        n = int(self.headers.get('Content-Length') or 0)
        limit = 8_000_000 if path in ('/__save-texture', '/__save-oblab') else 2_000_000
        if n <= 0 or n > limit:
            self.send_error(400)
            return
        try:
            data = json.loads(self.rfile.read(n).decode('utf-8'))
        except Exception:
            self.send_error(400)
            return
        if path == '/__save-texture':
            out = write_texture(data)
            if not out:
                self.send_error(400)
                return
            self._json_ok(out)
            return
        if path == '/__save-track':
            self._save_track(data)
            return
        if path == '/__save-pack':
            out = rnr_objects.write_pack(ROOT, data)
            if not out:
                self.send_error(400)
                return
            self._json_ok(out)
            return
        if path == '/__save-oblab':
            out = rnr_objects.write_oblab(ROOT, data)
            if not out:
                self.send_error(400)
                return
            self._json_ok(out)
            return
        if path != '/__save-car':
            self.send_error(404)
            return
        slot = data.get('slot')
        car = data.get('car')
        kind = data.get('kind') or 'work'
        if not isinstance(slot, int) or slot < 0 or slot > 98 or not isinstance(car, dict):
            self.send_error(400)
            return
        folder = '%02d' % (slot + 1)
        dest_dir = os.path.join(ROOT, 'assets', 'data', 'cars', folder)
        os.makedirs(dest_dir, exist_ok=True)
        work = os.path.join(dest_dir, 'car.json')
        base = os.path.join(dest_dir, 'car.base.json')
        backup = os.path.join(dest_dir, 'car.backup.json')
        if kind == 'base':
            if os.path.isfile(base):
                shutil.copy2(base, backup)
            elif os.path.isfile(work):
                shutil.copy2(work, backup)
            write_car(base, car)
            write_car(work, car)
        elif kind == 'backup':
            write_car(backup, car)
        else:
            write_car(work, car)
        self._json_ok({'ok': True})

    def _save_track(self, data):
        """Пишет или стирает JSON трассы."""
        track_id = data.get('id')
        kind = data.get('kind') or 'work'
        if not isinstance(track_id, str) or not TRACK_ID.match(track_id):
            self.send_error(400)
            return
        folder = tracks_dir()
        os.makedirs(folder, exist_ok=True)
        dest = os.path.join(folder, track_id + '.json')
        if kind == 'delete':
            if os.path.isfile(dest):
                os.remove(dest)
            write_track_index()
            self._json_ok({'ok': True})
            return
        track = data.get('track')
        if not isinstance(track, dict) or not isinstance(track.get('cps'), list) or len(track.get('cps')) < 4:
            self.send_error(400)
            return
        track['id'] = track_id
        write_json(dest, track)
        write_track_index()
        self._json_ok({'ok': True})

    def log_message(self, fmt, *args):
        sys.stderr.write('%s - %s\n' % (self.address_string(), fmt % args))


if __name__ == '__main__':
    os.chdir(ROOT)
    httpd = ThreadingHTTPServer(('127.0.0.1', PORT), Handler)
    print('RNR http://127.0.0.1:%s/  POST /__save-car /__save-track /__save-texture /__save-oblab' % PORT, flush=True)
    httpd.serve_forever()
