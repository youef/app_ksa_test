"""Build portable KayKit archives used internally by the game."""
from pathlib import Path
import json
import zipfile

root = Path(__file__).resolve().parents[1] / 'public' / 'kingdom' / 'kaykit'
manifest = json.loads((root / 'manifest.json').read_text())

for pack in manifest['packs']:
    archive = root / (pack['id'] + '.zip')
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as output:
        for item in pack['files']:
            output.write(root / item['path'], item['path'])

print('Built the internal KayKit asset archives.')
