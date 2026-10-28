/* Minimal offline DOCX -> plain text extractor.
   Implements just enough ZIP (local file header, stored + deflate) and a
   compact DEFLATE inflater to read word/document.xml out of a .docx file,
   then strips XML down to readable text. No network, no dependencies. */

(function (global) {
  // ---------- Tiny DEFLATE (RFC1951) inflater ----------
  function inflateRaw(data) {
    let pos = 0;
    let bitBuf = 0;
    let bitCnt = 0;

    function readBit() {
      if (bitCnt === 0) {
        bitBuf = data[pos++];
        bitCnt = 8;
      }
      const bit = bitBuf & 1;
      bitBuf >>= 1;
      bitCnt--;
      return bit;
    }
    function readBits(n) {
      let v = 0;
      for (let i = 0; i < n; i++) v |= readBit() << i;
      return v;
    }

    function buildTree(lengths) {
      const maxBits = Math.max(0, ...lengths);
      const blCount = new Array(maxBits + 1).fill(0);
      lengths.forEach((l) => { if (l > 0) blCount[l]++; });
      const nextCode = new Array(maxBits + 1).fill(0);
      let code = 0;
      for (let bits = 1; bits <= maxBits; bits++) {
        code = (code + blCount[bits - 1]) << 1;
        nextCode[bits] = code;
      }
      const codes = new Array(lengths.length).fill(0);
      for (let n = 0; n < lengths.length; n++) {
        const len = lengths[n];
        if (len > 0) {
          codes[n] = nextCode[len];
          nextCode[len]++;
        }
      }
      // map: bits-string -> symbol, organized by length for decode speed
      const table = {};
      for (let n = 0; n < lengths.length; n++) {
        const len = lengths[n];
        if (len > 0) {
          table[len + ":" + codes[n]] = n;
        }
      }
      return { table, maxBits };
    }

    function decodeSymbol(tree) {
      let code = 0;
      for (let len = 1; len <= tree.maxBits; len++) {
        code = (code << 1) | readBit();
        const key = len + ":" + code;
        if (key in tree.table) return tree.table[key];
      }
      throw new Error("inflate: bad code");
    }

    const lengthBase = [3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258];
    const lengthExtra = [0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];
    const distBase = [1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577];
    const distExtra = [0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];

    function fixedLitTree() {
      const lens = new Array(288);
      for (let i = 0; i <= 143; i++) lens[i] = 8;
      for (let i = 144; i <= 255; i++) lens[i] = 9;
      for (let i = 256; i <= 279; i++) lens[i] = 7;
      for (let i = 280; i <= 287; i++) lens[i] = 8;
      return buildTree(lens);
    }
    function fixedDistTree() {
      const lens = new Array(30).fill(5);
      return buildTree(lens);
    }

    const out = [];

    let finalBlock = false;
    while (!finalBlock) {
      finalBlock = readBit() === 1;
      const type = readBits(2);

      if (type === 0) {
        // stored
        bitCnt = 0; // align to byte
        const len = data[pos] | (data[pos + 1] << 8);
        pos += 4; // len + nlen
        for (let i = 0; i < len; i++) out.push(data[pos++]);
        continue;
      }

      let litTree, distTree;
      if (type === 1) {
        litTree = fixedLitTree();
        distTree = fixedDistTree();
      } else if (type === 2) {
        const hlit = readBits(5) + 257;
        const hdist = readBits(5) + 1;
        const hclen = readBits(4) + 4;
        const order = [16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];
        const clLens = new Array(19).fill(0);
        for (let i = 0; i < hclen; i++) clLens[order[i]] = readBits(3);
        const clTree = buildTree(clLens);

        const allLens = [];
        while (allLens.length < hlit + hdist) {
          const sym = decodeSymbol(clTree);
          if (sym <= 15) {
            allLens.push(sym);
          } else if (sym === 16) {
            const rep = readBits(2) + 3;
            const prev = allLens[allLens.length - 1];
            for (let i = 0; i < rep; i++) allLens.push(prev);
          } else if (sym === 17) {
            const rep = readBits(3) + 3;
            for (let i = 0; i < rep; i++) allLens.push(0);
          } else {
            const rep = readBits(7) + 11;
            for (let i = 0; i < rep; i++) allLens.push(0);
          }
        }
        litTree = buildTree(allLens.slice(0, hlit));
        distTree = buildTree(allLens.slice(hlit, hlit + hdist));
      } else {
        throw new Error("inflate: unsupported block type");
      }

      while (true) {
        const sym = decodeSymbol(litTree);
        if (sym < 256) {
          out.push(sym);
        } else if (sym === 256) {
          break;
        } else {
          const idx = sym - 257;
          const length = lengthBase[idx] + readBits(lengthExtra[idx]);
          const dsym = decodeSymbol(distTree);
          const dist = distBase[dsym] + readBits(distExtra[dsym]);
          const start = out.length - dist;
          for (let i = 0; i < length; i++) out.push(out[start + i]);
        }
      }
    }

    return new Uint8Array(out);
  }

  // ---------- Minimal ZIP reader (local file headers, no central-dir dependency) ----------
  function readUint16(buf, off) { return buf[off] | (buf[off + 1] << 8); }
  function readUint32(buf, off) {
    return (buf[off] | (buf[off + 1] << 8) | (buf[off + 2] << 16) | (buf[off + 3] << 24)) >>> 0;
  }

  function extractFileFromZip(buf, targetName) {
    let off = 0;
    while (off < buf.length - 4) {
      const sig = readUint32(buf, off);
      if (sig !== 0x04034b50) break; // not a local file header, stop scanning
      const compMethod = readUint16(buf, off + 8);
      const compSize = readUint32(buf, off + 18);
      const nameLen = readUint16(buf, off + 26);
      const nameStart = off + 30;
      const name = new TextDecoder("utf-8").decode(buf.slice(nameStart, nameStart + nameLen));
      const extraFieldLen = readUint16(buf, off + 28);
      const dataStart = nameStart + nameLen + extraFieldLen;
      const dataEnd = dataStart + compSize;

      if (name === targetName) {
        const raw = buf.slice(dataStart, dataEnd);
        if (compMethod === 0) return raw; // stored
        if (compMethod === 8) return inflateRaw(raw); // deflate
        throw new Error("Unsupported compression method " + compMethod);
      }
      off = dataEnd;
    }
    return null;
  }

  function xmlToText(xml) {
    // Insert paragraph breaks, then strip all tags.
    let s = xml
      .replace(/<\/w:p>/g, "\n")
      .replace(/<w:tab\/>/g, "\t")
      .replace(/<w:br\/>/g, "\n");
    s = s.replace(/<[^>]+>/g, "");
    s = s
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
    s = s.replace(/\n{3,}/g, "\n\n").trim();
    return s;
  }

  async function extractDocxText(arrayBuffer) {
    const buf = new Uint8Array(arrayBuffer);
    const docXmlBytes = extractFileFromZip(buf, "word/document.xml");
    if (!docXmlBytes) throw new Error("Could not find document.xml inside the .docx file");
    const xml = new TextDecoder("utf-8").decode(docXmlBytes);
    return xmlToText(xml);
  }

  global.miniDocx = { extractDocxText };
})(typeof window !== "undefined" ? window : globalThis);
