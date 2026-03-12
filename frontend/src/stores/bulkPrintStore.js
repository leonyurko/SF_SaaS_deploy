import { create } from 'zustand';

const toBase64 = async (item) => {
  const url = item.barcode_image_url
    ? (item.barcode_image_url.startsWith('http')
        ? item.barcode_image_url
        : window.location.origin + item.barcode_image_url)
    : '';
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve({ ...item, imgSrc: reader.result });
      reader.readAsDataURL(blob);
    });
  } catch {
    return { ...item, imgSrc: url };
  }
};

const useBulkPrintStore = create((set, get) => ({
  items: [],

  addItem: (item) => set((state) => {
    if (state.items.length >= 16) { alert('Bulk print limit is 16 items.'); return state; }
    if (state.items.find(i => i.id === item.id)) return state;
    return { items: [...state.items, item] };
  }),

  removeItem: (itemId) => set((state) => ({
    items: state.items.filter(i => i.id !== itemId)
  })),

  clearItems: () => set({ items: [] }),

  // win must be opened synchronously by the caller before any state changes (Safari requirement)
  executePrint: async (win) => {
    if (!win) { win = window.open('', '_blank'); }
    if (!win) { alert('Please allow popups for this site to print.'); return; }

    const resolved = await Promise.all(get().items.map(toBase64));
    const count = resolved.length;

    const labelsHtml = resolved.map(item => `
      <div class="label">
        <img class="bc-img" src="${item.imgSrc}" alt="${item.barcode}" style="width:58mm;height:auto;display:block;" />
        <div class="barcode-num">${item.barcode}</div>
        <div class="item-name">${item.name}</div>
      </div>`).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Bulk Print ${count} Barcodes</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; background: #f5f5f5; padding: 24px; display: flex; justify-content: center; }
    .wrap { width: 100%; max-width: 480px; }
    h2 { font-size: 18px; color: #111; margin-bottom: 20px; }
    .card { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 1px 6px rgba(0,0,0,0.1); margin-bottom: 16px; }
    .row { display: flex; gap: 12px; align-items: flex-end; }
    .grp { flex: 1; }
    .grp label { display: block; font-size: 12px; font-weight: 700; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
    .grp input { width: 100%; padding: 9px 10px; border: 1px solid #ddd; border-radius: 5px; font-size: 15px; }
    .grp input:focus { outline: none; border-color: #000; }
    .toggle { display: flex; border: 1px solid #ddd; border-radius: 5px; overflow: hidden; }
    .toggle button { flex: 1; padding: 9px 0; border: none; cursor: pointer; font-size: 14px; font-weight: 700; }
    .labels-card { background: white; border-radius: 8px; padding: 16px; box-shadow: 0 1px 6px rgba(0,0,0,0.1); margin-bottom: 16px; }
    .label { padding: 4px 0; border-bottom: 1px solid #f0f0f0; }
    .label:last-child { border-bottom: none; }
    .barcode-num { font-weight: bold; font-size: 13px; letter-spacing: 2px; margin-top: 3px; color: #222; }
    .item-name { font-size: 11px; color: #555; margin-top: 1px; }
    .print-btn { width: 100%; padding: 13px; border: none; border-radius: 6px; font-size: 15px; font-weight: 700; cursor: pointer; background: #111; color: white; }
    @media print {
      @page { margin: 0; }
      body { background: white; padding: 2mm; -webkit-print-color-adjust: exact; print-color-adjust: exact; display: block; }
      .wrap { max-width: none; }
      h2, .card, .print-btn { display: none; }
      .labels-card { box-shadow: none; padding: 0; border-radius: 0; }
      .label { border-bottom: none; padding: 2mm 0; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <h2>Bulk Print — ${count} Barcode${count > 1 ? 's' : ''}</h2>
    <div class="card">
      <div class="row">
        <div class="grp">
          <label>Width</label>
          <input type="number" id="bw" value="58" min="1" max="200" step="0.5" oninput="upd()" />
        </div>
        <div class="grp">
          <label>Height</label>
          <input type="number" id="bh" min="1" max="200" step="0.5" placeholder="Auto" oninput="upd()" />
        </div>
        <div class="grp">
          <label>Unit</label>
          <div class="toggle">
            <button id="bcm" onclick="su('cm')" style="background:white;color:#888;">cm</button>
            <button id="bmm" onclick="su('mm')" style="background:#111;color:white;">mm</button>
          </div>
        </div>
      </div>
    </div>
    <div class="labels-card">${labelsHtml}</div>
    <button class="print-btn" onclick="window.print()">Print ${count} Barcode${count > 1 ? 's' : ''}</button>
  </div>
  <script>
    var u = 'mm';
    function su(v) {
      u = v;
      document.getElementById('bcm').style.background = v==='cm'?'#111':'white';
      document.getElementById('bcm').style.color = v==='cm'?'white':'#888';
      document.getElementById('bmm').style.background = v==='mm'?'#111':'white';
      document.getElementById('bmm').style.color = v==='mm'?'white':'#888';
      upd();
    }
    function upd() {
      var w = parseFloat(document.getElementById('bw').value);
      var hv = document.getElementById('bh').value;
      var h = parseFloat(hv);
      document.querySelectorAll('.bc-img').forEach(function(el) {
        if (!isNaN(w) && w > 0) el.style.width = w + u;
        el.style.height = (!isNaN(h) && h > 0) ? h + u : 'auto';
      });
    }
  </script>
</body>
</html>`;

    win.document.open();
    win.document.write(html);
    win.document.close();
  }
}));

export default useBulkPrintStore;
