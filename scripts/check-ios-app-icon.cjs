'use strict';
const fs = require('node:fs');
const path = require('node:path');

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

function pngInfo(file) {
  const bytes = fs.readFileSync(file);
  if (bytes.toString('ascii', 1, 4) !== 'PNG') return null;
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    bitDepth: bytes[24],
    colorType: bytes[25],
  };
}

const appIconFiles = walk('ios').filter(file =>
  file.toLowerCase().includes('appicon.appiconset') && file.toLowerCase().endsWith('.png')
);
if (!appIconFiles.length) {
  throw new Error('Expo prebuild did not generate an AppIcon.appiconset PNG.');
}

const storeIcons = appIconFiles
  .map(file => ({ file, info: pngInfo(file) }))
  .filter(item => item.info && item.info.width === 1024 && item.info.height === 1024);

if (!storeIcons.length) {
  throw new Error('No generated 1024×1024 App Store icon was found in AppIcon.appiconset.');
}

const withAlpha = storeIcons.filter(item => item.info.colorType === 4 || item.info.colorType === 6);
if (withAlpha.length) {
  throw new Error('Generated App Store icon still has an alpha channel: ' + withAlpha.map(item => item.file).join(', '));
}

for (const item of storeIcons) {
  process.stdout.write('App Store icon OK: ' + item.file + ' (1024×1024, no alpha)\n');
}
