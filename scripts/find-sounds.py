import struct

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
        records[i]['name'] = name.replace('\\', '/')

# Search for weapon fire sounds, UI sounds, VATS, explosions
searches = [
    'wpn', 'laser', 'fire', 'pistol', 'rifle', 'shotgun', 'sledge', 'fatman',
    'fat_man', 'plasma', 'minigun', 'gauss', 'pipe',
    'ui_pipboy', 'ui_pip', 'pipboy_tab', 'pipboy_select', 'pipboy_mode',
    'pipboy_highlight', 'pipboy_rotary', 'pipboy_dial',
    'vats_start', 'vats_enter', 'vats_target', 'vats_critical', 'vats_crit',
    'explosion', 'nuke', 'quest_done', 'level_up',
    'laser_impact', 'plasma_impact',
]

for search in searches:
    matches = [r for r in records if search.lower() in r['name'].lower()]
    if matches:
        print(f'\n=== "{search}" ({len(matches)} matches) ===')
        for m in matches[:6]:
            print(f'  {m["name"]}')
        if len(matches) > 6:
            print(f'  ... +{len(matches)-6} more')
