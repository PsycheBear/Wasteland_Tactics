import struct, os, sys

BA2_PATH = r'C:\Program Files (x86)\Steam\steamapps\common\Fallout 4\Data\Fallout4 - Sounds.ba2'

with open(BA2_PATH, 'rb') as f:
    magic = f.read(4)
    version = struct.unpack('<I', f.read(4))[0]
    archive_type = f.read(4)
    file_count = struct.unpack('<I', f.read(4))[0]
    name_table_offset = struct.unpack('<Q', f.read(8))[0]

    records = []
    for i in range(file_count):
        name_hash = struct.unpack('<I', f.read(4))[0]
        ext = f.read(4).decode('ascii', errors='ignore').rstrip('\x00')
        dir_hash = struct.unpack('<I', f.read(4))[0]
        unknown = struct.unpack('<I', f.read(4))[0]
        offset = struct.unpack('<Q', f.read(8))[0]
        packed_size = struct.unpack('<I', f.read(4))[0]
        unpacked_size = struct.unpack('<I', f.read(4))[0]
        unk2 = struct.unpack('<I', f.read(4))[0]
        records.append({'ext': ext, 'offset': offset, 'packed_size': packed_size, 'unpacked_size': unpacked_size})

    f.seek(name_table_offset)
    for i in range(file_count):
        name_len = struct.unpack('<H', f.read(2))[0]
        name = f.read(name_len).decode('utf-8', errors='ignore')
        records[i]['name'] = name

    keywords = ['pipboy', 'ui_', 'vats', 'laser', 'pistol', 'rifle', 'shotgun',
                'impact', 'explosion', 'hit_', 'melee', 'sledge', 'fatman', 'fat_man',
                'plasma', 'gauss', 'minigun', 'pip_boy', 'pip-boy', 'wpn_', 'geiger',
                'radiat', 'wind', 'quest_done', 'levelup', 'level_up',
                'ui_menu', 'ui_pip', 'ui_hud', 'ui_misc', 'casino', 'caps']

    matches = []
    for r in records:
        name_lower = r['name'].lower()
        for kw in keywords:
            if kw in name_lower:
                matches.append(r)
                break

    print(f'Total files: {file_count}, Matches: {len(matches)}')
    print()

    # Group by directory
    categories = {}
    for m in matches:
        name = m['name'].replace('\\', '/')
        parts = name.split('/')
        if len(parts) >= 3:
            cat = '/'.join(parts[:3])
        else:
            cat = parts[0]
        if cat not in categories:
            categories[cat] = []
        categories[cat].append(name)

    for cat in sorted(categories.keys()):
        print(f'=== {cat} ({len(categories[cat])} files) ===')
        for name in categories[cat][:8]:
            print(f'  {name}')
        if len(categories[cat]) > 8:
            print(f'  ... and {len(categories[cat]) - 8} more')
        print()
