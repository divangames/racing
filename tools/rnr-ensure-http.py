# Проверяет, что на 8765 отвечает HTTP; мёртвый слушатель снимает и поднимает rnr-http.py.
import os
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(os.environ.get('PORT', '8765'))
HTTP_URL = 'http://127.0.0.1:%s/rnr.html' % PORT


def port_listening():
    """Порт занят (TCP connect)."""
    s = socket.socket()
    s.settimeout(0.8)
    try:
        s.connect(('127.0.0.1', PORT))
        return True
    except OSError:
        return False
    finally:
        s.close()


def http_ok():
    """Сервер отдаёт rnr.html."""
    try:
        with urllib.request.urlopen(HTTP_URL, timeout=2.5) as r:
            return r.status == 200 and int(r.headers.get('Content-Length') or 1) > 0
    except (urllib.error.URLError, TimeoutError, OSError, ValueError):
        return False


def pids_listening():
    """PID процессов в LISTENING на порту игры."""
    pids = []
    try:
        out = subprocess.check_output('netstat -ano', shell=True, text=True, encoding='oem', errors='ignore')
    except Exception:
        return pids
    needle = ':%s' % PORT
    for line in out.splitlines():
        if needle not in line or 'LISTENING' not in line.upper():
            continue
        parts = line.split()
        if not parts:
            continue
        pid = parts[-1]
        if pid.isdigit() and pid != '0':
            pids.append(int(pid))
    return list(dict.fromkeys(pids))


def process_name(pid):
    """Имя exe по PID."""
    try:
        out = subprocess.check_output(
            ['tasklist', '/FI', 'PID eq %s' % pid, '/FO', 'CSV', '/NH'],
            text=True, encoding='oem', errors='ignore'
        )
    except Exception:
        return ''
    line = (out or '').strip().split('\n')[0]
    if line.startswith('"'):
        return line.split('","')[0].strip('"').lower()
    return line.split(',')[0].strip().lower()


def kill_dead_listener():
    """Снимает python на занятом порту, если HTTP не отвечает."""
    for pid in pids_listening():
        name = process_name(pid)
        if 'python' not in name and name != 'py.exe':
            print('Port %s busy: PID %s (%s). Close it and run start.bat again.' % (PORT, pid, name or '?'))
            return False
        print('Restarting dead HTTP PID %s (%s)' % (pid, name or 'python'))
        subprocess.call(['taskkill', '/F', '/PID', str(pid)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    deadline = time.time() + 4
    while time.time() < deadline:
        if not port_listening():
            return True
        time.sleep(0.2)
    return not port_listening()


def start_http():
    """Запускает rnr-http.py в фоне."""
    script = os.path.join(ROOT, 'tools', 'rnr-http.py')
    flags = 0
    if sys.platform == 'win32':
        flags = getattr(subprocess, 'CREATE_NEW_CONSOLE', 0)
    subprocess.Popen(
        [sys.executable, script],
        cwd=ROOT,
        creationflags=flags,
        close_fds=True
    )


def wait_http(seconds):
    """Ждёт живой GET."""
    t0 = time.time()
    while time.time() - t0 < seconds:
        if http_ok():
            return True
        time.sleep(0.35)
    return http_ok()


def main():
    if http_ok():
        return 0
    if port_listening():
        if not kill_dead_listener():
            return 1
        time.sleep(0.4)
    if not http_ok():
        start_http()
        if not wait_http(10):
            print('HTTP on port %s failed.' % PORT)
            return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
