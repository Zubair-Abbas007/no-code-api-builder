/**
 * ZIP Builder Service
 * Creates an in-memory ZIP buffer from a files map.
 * Uses the built-in zlib + manual ZIP construction (no extra deps).
 */

'use strict';

const zlib = require('zlib');

/**
 * Builds a ZIP archive from a { filename: content } map.
 * Returns a Buffer containing the ZIP file.
 *
 * @param {Object} files  - { 'path/to/file.js': 'code string', ... }
 * @param {string} folder - Root folder name inside the ZIP
 * @returns {Promise<Buffer>}
 */
async function buildZip(files, folder) {
  const safeName = (folder || 'my-api').replace(/[^a-zA-Z0-9-_]/g, '-');
  const entries  = [];
  const centralDir = [];
  let offset = 0;

  for (const [filename, content] of Object.entries(files)) {
    const fullPath    = `${safeName}/${filename}`;
    const fileData    = Buffer.from(content, 'utf8');
    const compressed  = zlib.deflateRawSync(fileData, { level: 6 });
    const crc         = crc32(fileData);
    const nameBuffer  = Buffer.from(fullPath, 'utf8');
    const now         = dosDateTime();

    // Local file header
    const localHeader = Buffer.alloc(30 + nameBuffer.length);
    localHeader.writeUInt32LE(0x04034b50, 0);  // signature
    localHeader.writeUInt16LE(20, 4);           // version needed
    localHeader.writeUInt16LE(0, 6);            // flags
    localHeader.writeUInt16LE(8, 8);            // compression (deflate)
    localHeader.writeUInt16LE(now.time, 10);    // mod time
    localHeader.writeUInt16LE(now.date, 12);    // mod date
    localHeader.writeUInt32LE(crc, 14);         // CRC-32
    localHeader.writeUInt32LE(compressed.length, 18); // compressed size
    localHeader.writeUInt32LE(fileData.length, 22);   // uncompressed size
    localHeader.writeUInt16LE(nameBuffer.length, 26); // filename length
    localHeader.writeUInt16LE(0, 28);           // extra field length
    nameBuffer.copy(localHeader, 30);

    entries.push(localHeader, compressed);

    // Central directory entry
    const cdEntry = Buffer.alloc(46 + nameBuffer.length);
    cdEntry.writeUInt32LE(0x02014b50, 0);  // signature
    cdEntry.writeUInt16LE(20, 4);          // version made by
    cdEntry.writeUInt16LE(20, 6);          // version needed
    cdEntry.writeUInt16LE(0, 8);           // flags
    cdEntry.writeUInt16LE(8, 10);          // compression
    cdEntry.writeUInt16LE(now.time, 12);
    cdEntry.writeUInt16LE(now.date, 14);
    cdEntry.writeUInt32LE(crc, 16);
    cdEntry.writeUInt32LE(compressed.length, 20);
    cdEntry.writeUInt32LE(fileData.length, 24);
    cdEntry.writeUInt16LE(nameBuffer.length, 28);
    cdEntry.writeUInt16LE(0, 30);          // extra
    cdEntry.writeUInt16LE(0, 32);          // comment
    cdEntry.writeUInt16LE(0, 34);          // disk start
    cdEntry.writeUInt16LE(0, 36);          // internal attr
    cdEntry.writeUInt32LE(0, 38);          // external attr
    cdEntry.writeUInt32LE(offset, 42);     // local header offset
    nameBuffer.copy(cdEntry, 46);

    centralDir.push(cdEntry);
    offset += localHeader.length + compressed.length;
  }

  const cdBuffer  = Buffer.concat(centralDir);
  const eocd      = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);           // signature
  eocd.writeUInt16LE(0, 4);                    // disk number
  eocd.writeUInt16LE(0, 6);                    // disk with CD
  eocd.writeUInt16LE(centralDir.length, 8);    // entries on disk
  eocd.writeUInt16LE(centralDir.length, 10);   // total entries
  eocd.writeUInt32LE(cdBuffer.length, 12);     // CD size
  eocd.writeUInt32LE(offset, 16);              // CD offset
  eocd.writeUInt16LE(0, 20);                   // comment length

  return Buffer.concat([...entries, cdBuffer, eocd]);
}

// ── CRC-32 ────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ── DOS date/time ─────────────────────────────────────────
function dosDateTime() {
  const d = new Date();
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
  };
}

module.exports = { buildZip };
