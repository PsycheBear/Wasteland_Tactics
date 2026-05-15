"""
Extract specific sound files from Fallout 4 BA2 archive to local cache.
Nothing goes into the repo — files stay at ~/.wasteland-tactics-audio/
"""
import struct, os, subprocess, shutil

BA2_PATH = r'C:\Program Files (x86)\Steam\steamapps\common\Fallout 4\Data\Fallout4 - Sounds.ba2'
LOOSE_PATH = r'C:\Program Files (x86)\Steam\steamapps\common\Fallout 4\Data'
CACHE_DIR = os.path.join(os.path.expanduser('~'), '.wasteland-tactics-audio')
os.makedirs(CACHE_DIR, exist_ok=True)

# BA2 path → cache output name
WANTED_FILES = {
    # UI — Pip-Boy
    'Sound/FX/UI/PipBoy/UI_PipBoy_LightOn.xwm': 'ui/pipboy-click.wav',
    'Sound/FX/UI/PipBoy/UI_PipBoy_LightOff.xwm': 'ui/pipboy-off.wav',
    'Sound/FX/UI/PipBoy/RotaryVertical/UI_PipBoy_RotaryVertical_01.xwm': 'ui/pipboy-dial.wav',
    'Sound/FX/UI/PipBoy/RotaryHorizontal/UI_PipBoy_RotaryHorizontal_01.xwm': 'ui/pipboy-tab.wav',
    'Sound/FX/UI/PipBoy/UI_PipBoy_Favorite_Menu_Up_01.xwm': 'ui/pipboy-select.wav',
    'Sound/FX/UI/PipBoy/UI_PipBoy_Favorite_Menu_Down_01.xwm': 'ui/pipboy-deselect.wav',
    'Sound/FX/UI/UI_Experience_Up.xwm': 'ui/experience-up.wav',
    'Sound/FX/UI/UI_Discover_Location_01.xwm': 'ui/discover-location.wav',

    # VATS
    'Sound/FX/UI/VATS/UI_VATS_Enter.xwm': 'ui/vats-enter.wav',
    'Sound/FX/UI/VATS/UI_VATS_Exit.xwm': 'ui/vats-exit.wav',
    'Sound/FX/UI/VATS/UI_VATS_TargetLock_01.xwm': 'ui/vats-target.wav',
    'Sound/FX/UI/VATS/UI_VATS_CriticalExecuted.xwm': 'ui/vats-critical.wav',
    'Sound/FX/UI/VATS/UI_VATS_CriticalAvailable.xwm': 'ui/vats-crit-ready.wav',

    # Bottle caps
    'Sound/FX/ITM/ITM_Bottlecaps_Up_01.xwm': 'ui/caps-earn.wav',
    'Sound/FX/ITM/ITM_Bottlecaps_Up_02.xwm': 'ui/caps-earn2.wav',
    'Sound/FX/ITM/ITM_Bottlecaps_Down_01.xwm': 'ui/caps-spend.wav',
    'Sound/FX/ITM/ITM_Bottlecaps_Down_02.xwm': 'ui/caps-spend2.wav',

    # Weapons — Laser/Energy
    'Sound/FX/FX/Laser/Beam/FX_Laser_Beam_Pistol_A_01.xwm': 'combat/laser-pistol.wav',
    'Sound/FX/FX/Laser/FX_Projectile_Laser_A_01.xwm': 'combat/laser-projectile.wav',
    'Sound/FX/FX/Laser/Impact/FX_Laser_Impact_01.xwm': 'combat/laser-impact.wav',
    'Sound/FX/FX/Laser/Impact/FX_Laser_Impact_02.xwm': 'combat/laser-impact2.wav',

    # Weapons — Ballistic
    'Sound/FX/WPN/Pistol10mm/WPN_Pistol10mm_Fire_2D.wav': 'combat/pistol-10mm.wav',
    'Sound/FX/WPN/Pistol10mm/WPN_Pistol10mm_Fire_Sup_2D.wav': 'combat/pistol-suppressed.wav',
    'Sound/FX/WPN/RifleHuntingA/WPN_RifleHuntingA_Fire_2D_A_01.wav': 'combat/hunting-rifle.wav',

    # Weapons — Pipe gun
    'Sound/FX/WPN/Handmade/PistolPipeA/WPN_Handmade_PipeA_Fire_2D_01.wav': 'combat/pipe-pistol.wav',

    # Impacts — Bullet
    'Sound/FX/FX/Bullet/Impact/FX_Bullet_Impact_Flesh_01.xwm': 'combat/bullet-impact.wav',
    'Sound/FX/FX/Bullet/Impact/FX_Bullet_Impact_Flesh_02.xwm': 'combat/bullet-impact2.wav',
    'Sound/FX/FX/Bullet/Impact/FX_Bullet_Explosive_Impact_Flesh_01.xwm': 'combat/explosive-impact.wav',

    # Weapons — Melee
    'Sound/FX/WPN/Impact/Sledgehammer/WPN_Impact_Sledgehammer_Flesh_01.wav': 'combat/sledgehammer.wav',
    'Sound/FX/WPN/Impact/Sledgehammer/WPN_Impact_Sledgehammer_Flesh_02.wav': 'combat/sledgehammer2.wav',

    # Weapons — Fat Man / Explosive
    'Sound/FX/WPN/FatMan/WPN_FatMan_Fire_2D.wav': 'combat/fat-man-fire.wav',
    'Sound/FX/FX/Explosion/FX_Explosion_NukeChargen_A_01.xwm': 'combat/nuke-explosion.wav',
    'Sound/FX/FX/Explosion/CarNuke/FX_Explosion_CarNuke_2D_01.xwm': 'combat/car-nuke.wav',

    # Weapons — Minigun
    'Sound/FX/WPN/Minigun/WPN_Minigun_Fire_2D_01.wav': 'combat/minigun.wav',

    # Weapons — Gauss
    'Sound/FX/FX/GaussSlug/FX_GaussSlug_Impact_Flesh_01.xwm': 'combat/gauss-impact.wav',

    # Weapons — Plasma
    'Sound/FX/FX/Explosion/GrenadePlasma/FX_Explosion_GrenadePlasma_LayerA_01.xwm': 'combat/plasma-explosion.wav',

    # NPC — Deathclaw
    'Sound/FX/NPC/Deathclaw/FX/Melee/FX_Deathclaw_Melee_01.xwm': 'combat/deathclaw-melee.wav',
    'Sound/FX/NPC/Deathclaw/FX/Melee/FX_Deathclaw_Melee_02.xwm': 'combat/deathclaw-melee2.wav',

    # Ambient
    'Sound/FX/AMB/Exteriors/AMB_Ext_Wind_Bed_Clear_A_01_LP.wav': 'ambient/wind-clear.wav',
    'Sound/FX/AMB/Exteriors/AMB_Ext_Wind_Bed_Dusty_A_01_LP.wav': 'ambient/wind-dusty.wav',
    'Sound/FX/AMB/Exteriors/AMB_Ext_Wind_Bed_Urban_A_01_LP.wav': 'ambient/wind-urban.wav',

    # Radiation / Geiger
    'Sound/FX/OBJ/ScannerRadiationVault/OBJ_ScannerRadiationVault_01.xwm': 'fx/geiger-counter.wav',
    'Sound/FX/TRP/TRP_Radiation_Emitter_Fire_01.xwm': 'fx/radiation-emitter.wav',

    # Level Up
    'Music/Special/MUS_Special_LevelUp_01.xwm': 'music/level-up.wav',
    'Music/Special/MUS_Special_LevelUp_02.xwm': 'music/level-up2.wav',

    # Door / Vault
    'Sound/FX/DRS/DRS_MetalCapsuleSmallExt01_Open_01.xwm': 'fx/vault-door-open.wav',
    'Sound/FX/DRS/DRS_MetalCapsuleSmallExt01_Close_01.xwm': 'fx/vault-door-close.wav',
}

def read_ba2():
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
    return records

def extract_file(record, out_path):
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(BA2_PATH, 'rb') as f:
        f.seek(record['offset'])
        size = record['packed_size'] if record['packed_size'] != 0 else record['unpacked_size']
        data = f.read(size)
        if record['packed_size'] != 0 and record['packed_size'] != record['unpacked_size']:
            import zlib
            try: data = zlib.decompress(data)
            except: pass

    if record['name'].lower().endswith('.xwm'):
        raw_path = out_path + '.xwm'
        with open(raw_path, 'wb') as out: out.write(data)
        try:
            r = subprocess.run(['ffmpeg', '-y', '-i', raw_path, '-acodec', 'pcm_s16le', '-ar', '44100', out_path],
                              capture_output=True, timeout=15)
            if os.path.exists(out_path) and os.path.getsize(out_path) > 100:
                os.remove(raw_path)
                return True
        except Exception as e:
            print(f'    ffmpeg error: {e}')
        if os.path.exists(raw_path): os.remove(raw_path)
        return False
    else:
        with open(out_path, 'wb') as out: out.write(data)
        return os.path.getsize(out_path) > 100

def main():
    print(f'Reading BA2: {BA2_PATH}')
    records = read_ba2()
    lookup = {r['name'].lower(): r for r in records}
    print(f'Archive: {len(records)} files')

    extracted = failed = skipped = 0
    for ba2_name, out_name in WANTED_FILES.items():
        out_path = os.path.join(CACHE_DIR, out_name)
        if os.path.exists(out_path) and os.path.getsize(out_path) > 100:
            print(f'  [CACHED] {out_name}')
            skipped += 1
            continue

        # Check loose files
        loose_path = os.path.join(LOOSE_PATH, ba2_name.replace('/', os.sep))
        if os.path.exists(loose_path):
            os.makedirs(os.path.dirname(out_path), exist_ok=True)
            shutil.copy2(loose_path, out_path)
            print(f'  [LOOSE] {out_name}')
            extracted += 1
            continue

        key = ba2_name.lower()
        if key in lookup:
            print(f'  [BA2] {out_name}', end='')
            if extract_file(lookup[key], out_path):
                print(f' OK ({os.path.getsize(out_path):,} bytes)')
                extracted += 1
            else:
                print(' FAIL')
                failed += 1
        else:
            print(f'  [MISS] {ba2_name}')
            failed += 1

    print(f'\nResults: {extracted} extracted, {skipped} cached, {failed} failed')
    print(f'Cache: {CACHE_DIR}')
    total_size = sum(os.path.getsize(os.path.join(r, f)) for r, _, files in os.walk(CACHE_DIR) for f in files)
    print(f'Total cache size: {total_size / 1024 / 1024:.1f} MB')

if __name__ == '__main__':
    main()
