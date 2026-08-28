# Локальный сервер: статика проекта и запись car.json из лаборатории.
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(os.environ.get('PORT', '8765'))


def write_car(path, car):
    """Пишет JSON машины с переводом строки в конце."""
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(car, f, ensure_ascii=False, indent=2)
        f.write('\n')


class Handler(SimpleHTTPRequestHandler):
    """Раздаёт файлы из корня игры и принимает POST /__save-car."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_POST(self):
        path = self.path.split('?', 1)[0]
        if path != '/__save-car':
            self.send_error(404)
            return
        n = int(self.headers.get('Content-Length') or 0)
        if n <= 0 or n > 2_000_000:
            self.send_error(400)
            return
        try:
            data = json.loads(self.rfile.read(n).decode('utf-8'))
        except Exception:
            self.send_error(400)
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
        body = b'{"ok":true}'
        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        sys.stderr.write('%s - %s\n' % (self.address_string(), fmt % args))


if __name__ == '__main__':
    os.chdir(ROOT)
    httpd = ThreadingHTTPServer(('127.0.0.1', PORT), Handler)
    print('RNR http://127.0.0.1:%s/  POST /__save-car -> assets/data/cars' % PORT, flush=True)
    httpd.serve_forever()
