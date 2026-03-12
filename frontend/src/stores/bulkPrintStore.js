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
    if (state.items.length >= 8) { alert('Bulk print limit is 8 items.'); return state; }
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
        <img src="${item.imgSrc}" alt="${item.barcode}" style="width:58mm;height:auto;display:block;" />
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
    body { font-family: Arial, sans-serif; background: #f5f5f5; padding: 24px; display: flex; flex-direction: column; align-items: center; }
    h2 { font-size: 18px; color: #111; margin-bottom: 20px; align-self: flex-start; max-width: 520px; width: 100%; }
    .card { background: white; border-radius: 8px; padding: 16px; box-shadow: 0 1px 6px rgba(0,0,0,0.1); margin-bottom: 16px; width: 100%; max-width: 520px; }
    .grid { display: flex; flex-wrap: wrap; gap: 8px; }
    .label { padding: 4px; text-align: left; }
    .barcode-num { font-weight: bold; font-size: 12px; letter-spacing: 1px; margin-top: 3px; }
    .item-name { font-size: 10px; color: #555; margin-top: 1px; max-width: 58mm; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .print-btn { width: 100%; max-width: 520px; padding: 13px; background: #111; color: white; border: none; border-radius: 6px; font-size: 15px; font-weight: 700; cursor: pointer; }
    @media print {
      @page { margin: 0; }
      body { background: white; padding: 2mm; -webkit-print-color-adjust: exact; print-color-adjust: exact; align-items: flex-start; }
      h2, .print-btn { display: none; }
      .card { box-shadow: none; padding: 0; border-radius: 0; }
    }
  </style>
</head>
<body>
  <h2>Bulk Print — ${count} Barcode${count > 1 ? 's' : ''}</h2>
  <div class="card"><div class="grid">${labelsHtml}</div></div>
  <button class="print-btn" onclick="window.print()">Print ${count} Barcode${count > 1 ? 's' : ''}</button>
</body>
</html>`;

    win.document.open();
    win.document.write(html);
    win.document.close();
  }
}));

export default useBulkPrintStore;
