# Пакеты ассетов: папка <id>.labr, объекты *.oblab и картинка.
import json
import os
import re
import base64

IMG_EXT = {'.png', '.jpg', '.jpeg', '.webp', '.gif'}
PACK_ID = re.compile(r'^[a-z0-9_]{2,32}$')
OBJ_ID = re.compile(r'^[a-z0-9_]{2,40}$')


def object_root(root):
    """Корень ассетов мира."""
    return os.path.join(root, 'assets', 'object')


def write_json(path, data):
    """Пишет UTF-8 JSON."""
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def read_json(path):
    """Читает JSON или None."""
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return None


def verts(poly):
    """Вершины полигона."""
    if not isinstance(poly, list):
        return []
    out = []
    for p in poly:
        if isinstance(p, (list, tuple)) and len(p) >= 2:
            out.append([float(p[0]), float(p[1])])
    return out


def collision_of(raw, layer):
    """Коллизия: несколько тел и запасной poly."""
    s = raw if isinstance(raw, dict) else {}
    bodies = []
    src = s.get('bodies')
    if isinstance(src, list):
        for b in src:
            poly = verts(b.get('poly') if isinstance(b, dict) else None)
            if len(poly) >= 3:
                bodies.append({'poly': poly})
    if not bodies:
        poly = verts(s.get('poly'))
        if len(poly) >= 3:
            bodies.append({'poly': poly})
    solid = False if layer == 'under' else (s.get('solid') is not False)
    return {'solid': solid, 'bodies': bodies, 'poly': bodies[0]['poly'] if bodies else []}


def pack_meta(folder, pack_id):
    """Имя пака из pack.labr."""
    meta = read_json(os.path.join(folder, 'pack.labr')) or {}
    name = meta.get('name') if isinstance(meta, dict) else None
    return name or pack_id.upper()


def list_packs(root):
    """Каталог паков и .oblab."""
    base = object_root(root)
    packs = []
    if not os.path.isdir(base):
        return {'packs': packs}
    names = [n for n in os.listdir(base) if n.lower().endswith('.labr')]
    names.sort()
    for name in names:
        folder = os.path.join(base, name)
        if not os.path.isdir(folder):
            continue
        pack_id = name[:-5]
        if not PACK_ID.match(pack_id):
            continue
        rel = 'assets/object/' + name
        objects = []
        files = [n for n in os.listdir(folder) if n.lower().endswith('.oblab')]
        files.sort()
        for fn in files:
            raw = read_json(os.path.join(folder, fn)) or {}
            oid = str(raw.get('id') or os.path.splitext(fn)[0])
            src_raw = str(raw.get('src') or (oid + '.webp')).replace('\\', '/')
            src_name = src_raw.split('/')[-1]
            src = src_raw if src_raw.startswith('assets/') else (rel + '/' + src_name)
            layer = 'over' if raw.get('layer') == 'over' else 'under'
            objects.append({
                'pack': pack_id,
                'id': oid,
                'name': str(raw.get('name') or oid)[:42],
                'src': src,
                'file': src_name,
                'w': max(8, int(float(raw.get('w') or 128))),
                'h': max(8, int(float(raw.get('h') or 128))),
                'lockRatio': raw.get('lockRatio') is not False,
                'layer': layer,
                'collision': collision_of(raw.get('collision'), layer)
            })
        packs.append({
            'id': pack_id,
            'name': pack_meta(folder, pack_id),
            'folder': rel,
            'objects': objects
        })
    return {'packs': packs}


def write_pack(root, data):
    """Создаёт папку пака."""
    pack_id = str(data.get('id') or '').lower()
    if not PACK_ID.match(pack_id):
        return None
    folder = os.path.join(object_root(root), pack_id + '.labr')
    os.makedirs(folder, exist_ok=True)
    name = str(data.get('name') or pack_id)[:42]
    write_json(os.path.join(folder, 'pack.labr'), {'id': pack_id, 'name': name, 'format': 'labr'})
    return {'ok': True, 'id': pack_id, 'folder': 'assets/object/' + pack_id + '.labr'}


def write_oblab(root, data):
    """Пишет .oblab и опционально картинку."""
    pack_id = str(data.get('pack') or '').lower()
    obj_id = str(data.get('id') or '').lower()
    if not PACK_ID.match(pack_id) or not OBJ_ID.match(obj_id):
        return None
    folder = os.path.join(object_root(root), pack_id + '.labr')
    if str(data.get('kind') or '') == 'delete':
        if not os.path.isdir(folder):
            return None
        ob = os.path.join(folder, obj_id + '.oblab')
        meta = read_json(ob) or {}
        src_raw = str(meta.get('src') or '')
        if os.path.isfile(ob):
            os.remove(ob)
        img = os.path.join(folder, src_raw.replace('\\', '/').split('/')[-1]) if src_raw else ''
        if img and os.path.isfile(img) and not str(meta.get('src') or '').replace('\\', '/').startswith('assets/image'):
            os.remove(img)
        return {'ok': True, 'deleted': True, 'id': obj_id}
    if not os.path.isdir(folder):
        made = write_pack(root, {'id': pack_id, 'name': pack_id})
        if not made:
            return None
    ext = str(data.get('ext') or 'webp').lower().replace('jpeg', 'jpg')
    if '.' + ext not in IMG_EXT:
        ext = 'webp'
    payload = str(data.get('data') or '')
    src_in = str(data.get('src') or (obj_id + '.' + ext)).replace('\\', '/')
    src_name = src_in.split('/')[-1]
    if payload and 'base64,' in payload:
        try:
            raw = base64.b64decode(payload.split('base64,', 1)[1])
        except Exception:
            return None
        if not raw:
            return None
        src_name = obj_id + '.' + ext
        src_in = src_name
        with open(os.path.join(folder, src_name), 'wb') as f:
            f.write(raw)
    layer = 'over' if data.get('layer') == 'over' else 'under'
    store_src = src_in if src_in.startswith('assets/') else src_name
    body = {
        'id': obj_id,
        'name': str(data.get('name') or obj_id)[:42],
        'src': store_src,
        'w': max(8, int(float(data.get('w') or 128))),
        'h': max(8, int(float(data.get('h') or 128))),
        'lockRatio': data.get('lockRatio') is not False,
        'layer': layer,
        'collision': collision_of(data.get('collision'), layer)
    }
    write_json(os.path.join(folder, obj_id + '.oblab'), body)
    out_src = store_src if store_src.startswith('assets/') else ('assets/object/' + pack_id + '.labr/' + src_name)
    return {'ok': True, 'pack': pack_id, 'id': obj_id, 'src': out_src}
