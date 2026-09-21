const fs = require('node:fs');
const path = require('node:path');
let count = 0;
function verify(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) { verify(file); continue; }
    const ext = path.extname(file).toLowerCase();
    if (!['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) continue;
    const bytes = fs.readFileSync(file);
    const actual = bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) ? '.png'
      : bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff ? '.jpg'
      : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' ? '.webp' : 'unknown';
    if (actual !== (ext === '.jpeg' ? '.jpg' : ext)) throw new Error(`${file}: extension ${ext} does not match ${actual} data`);
    count++;
  }
}
verify(path.join(__dirname, '../apps/mobile/assets'));
console.log(`Verified file formats for ${count} bundled images.`);
