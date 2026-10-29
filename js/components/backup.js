// Back up and move (#backup): everything the site remembers in this browser
// (medals, favourites, saved builds, Monkey Knowledge checklist, tool inputs)
// packed into one code, a link and a QR code. No accounts: the code itself is
// the data. Opening the link (#restore=…) on another device brings it back.

const PREFIX = 'btd6hub:';
const SKIP = new Set(['btd6hub:lastSeenPatch']);
const QR_LIMIT = 2300; // characters a QR code can comfortably hold as a link

function collect() {
  const data = {};
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key?.startsWith(PREFIX) && !SKIP.has(key)) data[key.slice(PREFIX.length)] = localStorage.getItem(key);
    }
  } catch {
    // storage blocked
  }
  return data;
}

const toBase64Url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromBase64Url = (text) => Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function pipe(bytes, stream) {
  const out = await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer();
  return new Uint8Array(out);
}

export async function encodeBackup(data) {
  const json = new TextEncoder().encode(JSON.stringify({ v: 1, data }));
  if (typeof CompressionStream === 'undefined') return 'j' + toBase64Url(json);
  return 'z' + toBase64Url(await pipe(json, new CompressionStream('deflate-raw')));
}

export async function decodeBackup(code) {
  const text = code.trim().replace(/^.*#restore=/, '');
  const kind = text[0];
  let bytes = fromBase64Url(text.slice(1));
  if (kind === 'z') bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
  else if (kind !== 'j') throw new Error('not a backup code');
  const parsed = JSON.parse(new TextDecoder().decode(bytes));
  if (parsed?.v !== 1 || typeof parsed.data !== 'object') throw new Error('not a backup code');
  return parsed.data;
}

export function backupTool() {
  return {
    code: '',
    link: '',
    qrSvg: '',
    tooBigForQr: false,
    summary: [],
    pasted: '',
    status: '',     // '' | 'restored' | 'error'
    copied: false,

    async init() {
      this.$watch('$store.hub.toolView', (view) => view === 'backup' && this.refresh());
      if (this.$store.hub.toolView === 'backup') await this.refresh();
      const fromLink = this.$store.hub.pendingRestore;
      if (fromLink) {
        this.pasted = fromLink;
        this.$store.hub.pendingRestore = null;
      }
    },

    async refresh() {
      const data = collect();
      const count = (key) => {
        try {
          const v = JSON.parse(data[key] ?? 'null');
          return Array.isArray(v) ? v.length : v && typeof v === 'object' ? Object.keys(v).length : 0;
        } catch {
          return 0;
        }
      };
      this.summary = [
        { label: 'Maps with medals', value: count('medals') },
        { label: 'Favourites', value: count('favourites') },
        { label: 'Saved builds', value: count('plannerSaved') },
        { label: 'Monkey Knowledge ticked', value: count('mkOwned') },
      ];
      this.code = await encodeBackup(data);
      this.link = `${location.origin}${location.pathname}#restore=${this.code}`;
      this.tooBigForQr = this.link.length > QR_LIMIT;
      this.qrSvg = '';
      if (!this.tooBigForQr && window.qrcode) {
        const qr = window.qrcode(0, 'L');
        qr.addData(this.link);
        qr.make();
        this.qrSvg = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
      }
    },

    async copy(text) {
      try {
        await navigator.clipboard.writeText(text);
        this.copied = true;
        setTimeout(() => { this.copied = false; }, 1800);
      } catch {
        this.copied = false;
      }
    },

    /** Replace this browser's data with the pasted backup, then reload so every tool picks it up. */
    async restore() {
      this.status = '';
      try {
        const data = await decodeBackup(this.pasted);
        for (const [key, value] of Object.entries(data)) {
          if (typeof value === 'string' && /^[\w-]+$/.test(key)) localStorage.setItem(PREFIX + key, value);
        }
        this.status = 'restored';
        history.replaceState(null, '', '#backup');
        setTimeout(() => location.reload(), 900);
      } catch {
        this.status = 'error';
      }
    },
  };
}
