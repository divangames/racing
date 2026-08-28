# Локальный сервер: статика проекта и запись car.json из лаборатории.
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(os.environ.get('PORT', '8765'))


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
        if not isinstance(slot, int) or slot < 0 or slot > 98 or not isinstance(car, dict):
            self.send_error(400)
            return
        folder = '%02d' % (slot + 1)
        dest_dir = os.path.join(ROOT, 'assets', 'data', 'cars', folder)
        os.makedirs(dest_dir, exist_ok=True)
        dest = os.path.join(dest_dir, 'car.json')
        with open(dest, 'w', encoding='utf-8') as f:
            json.dump(car, f, ensure_ascii=False, indent=2)
            f.write('\n')
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
