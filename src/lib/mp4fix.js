// Підготовка mp4 для відтворення на телефонах без перекодування:
//  1) «faststart»: службовий блок moov переноситься на початок файлу (інакше iPhone на кожному витку циклу
//     лізе в кінець файлу і підвисає);
//  2) звукові доріжки видаляються (відео в прев'ю німе; звук із Flow/Veo теж підвішує стик циклу);
//  3) службові блоки uuid/free перед mdat відкидаються.
// Повертає Uint8Array з новим файлом або null, якщо файл не потребує змін чи це не mp4.

const u32 = (d, o) => ((d[o] << 24) | (d[o + 1] << 16) | (d[o + 2] << 8) | d[o + 3]) >>> 0;
const type = (d, o) => String.fromCharCode(d[o], d[o + 1], d[o + 2], d[o + 3]);

function boxes(d, start, end) {
  const out = [];
  let p = start;
  while (p + 8 <= end) {
    let size = u32(d, p);
    let head = 8;
    if (size === 1) { size = u32(d, p + 8) * 4294967296 + u32(d, p + 12); head = 16; }
    else if (size === 0) size = end - p;
    if (size < head || p + size > end) break;
    out.push({ t: type(d, p + 4), s: p, e: p + size, h: head });
    p += size;
  }
  return out;
}

const CONTAINERS = new Set(['trak', 'mdia', 'minf', 'stbl']);

// Повертає копію box (moov/trak/…) зі зсунутими на delta зміщеннями в stco/co64.
function shiftOffsets(d, b, delta) {
  const body = d.slice(b.s + b.h, b.e);
  const rebuilt = [];
  for (const c of boxes(body, 0, body.length)) {
    if (CONTAINERS.has(c.t)) {
      rebuilt.push(shiftOffsets(body, { s: c.s, e: c.e, h: c.h, t: c.t }, delta));
    } else if (c.t === 'stco') {
      const x = body.slice(c.s, c.e);
      const n = u32(x, 12);
      for (let i = 0; i < n; i += 1) {
        const o = 16 + i * 4;
        const v = u32(x, o) + delta;
        x[o] = (v >>> 24) & 255; x[o + 1] = (v >>> 16) & 255; x[o + 2] = (v >>> 8) & 255; x[o + 3] = v & 255;
      }
      rebuilt.push(x);
    } else if (c.t === 'co64') {
      const x = body.slice(c.s, c.e);
      const n = u32(x, 12);
      for (let i = 0; i < n; i += 1) {
        const o = 16 + i * 8;
        let v = u32(x, o) * 4294967296 + u32(x, o + 4) + delta;
        const hi = Math.floor(v / 4294967296);
        v -= hi * 4294967296;
        x[o] = (hi >>> 24) & 255; x[o + 1] = (hi >>> 16) & 255; x[o + 2] = (hi >>> 8) & 255; x[o + 3] = hi & 255;
        x[o + 4] = (v >>> 24) & 255; x[o + 5] = (v >>> 16) & 255; x[o + 6] = (v >>> 8) & 255; x[o + 7] = v & 255;
      }
      rebuilt.push(x);
    } else {
      rebuilt.push(body.slice(c.s, c.e));
    }
  }
  const len = rebuilt.reduce((a, r) => a + r.length, 0);
  const out = new Uint8Array(8 + len);
  out[0] = (8 + len) >>> 24; out[1] = ((8 + len) >>> 16) & 255; out[2] = ((8 + len) >>> 8) & 255; out[3] = (8 + len) & 255;
  for (let i = 0; i < 4; i += 1) out[4 + i] = b.t.charCodeAt(i);
  let p = 8;
  for (const r of rebuilt) { out.set(r, p); p += r.length; }
  return out;
}

function handlerOf(d, trak) {
  const mdia = boxes(d, trak.s + trak.h, trak.e).find((b) => b.t === 'mdia');
  if (!mdia) return '';
  const hdlr = boxes(d, mdia.s + mdia.h, mdia.e).find((b) => b.t === 'hdlr');
  return hdlr ? type(d, hdlr.s + 16) : '';
}

export function fixMp4(d) {
  if (!(d instanceof Uint8Array)) d = new Uint8Array(d);
  const top = boxes(d, 0, d.length);
  const ftyp = top.find((b) => b.t === 'ftyp');
  const moov = top.find((b) => b.t === 'moov');
  const mdats = top.filter((b) => b.t === 'mdat');
  if (!ftyp || !moov || mdats.length !== 1) return null;
  const mdat = mdats[0];
  // Лише найпростіша розкладка: [ftyp, (службові), mdat, moov] або вже [ftyp, moov, mdat].
  const others = top.filter((b) => !['ftyp', 'moov', 'mdat', 'uuid', 'free', 'skip', 'wide'].includes(b.t));
  if (others.length) return null;
  const kids = boxes(d, moov.s + moov.h, moov.e);
  const traks = kids.filter((b) => b.t === 'trak');
  const hasAudio = traks.some((tr) => handlerOf(d, tr) === 'soun');
  const moovAtEnd = moov.s > mdat.s;
  if (!hasAudio && !moovAtEnd) return null;

  // moov без звукових доріжок
  const keep = kids.filter((b) => !(b.t === 'trak' && handlerOf(d, b) === 'soun'));
  const parts = keep.map((b) => d.slice(b.s, b.e));
  const bodyLen = parts.reduce((a, r) => a + r.length, 0);
  const moovLen = 8 + bodyLen;
  const raw = new Uint8Array(moovLen);
  raw[0] = moovLen >>> 24; raw[1] = (moovLen >>> 16) & 255; raw[2] = (moovLen >>> 8) & 255; raw[3] = moovLen & 255;
  raw[4] = 109; raw[5] = 111; raw[6] = 111; raw[7] = 118; // 'moov'
  let q = 8;
  for (const r of parts) { raw.set(r, q); q += r.length; }

  // Нова розкладка: ftyp, moov, mdat. Нове зміщення mdat = ftyp + moov; старе = mdat.s.
  const newMdatStart = (ftyp.e - ftyp.s) + moovLen;
  const delta = newMdatStart - mdat.s;
  const moovBox = { s: 0, e: raw.length, h: 8, t: 'moov' };
  const shifted = shiftOffsets(raw, moovBox, delta);
  const mdatBytes = d.slice(mdat.s, mdat.e);
  const ftypBytes = d.slice(ftyp.s, ftyp.e);
  const out = new Uint8Array(ftypBytes.length + shifted.length + mdatBytes.length);
  out.set(ftypBytes, 0);
  out.set(shifted, ftypBytes.length);
  out.set(mdatBytes, ftypBytes.length + shifted.length);
  return out;
}
