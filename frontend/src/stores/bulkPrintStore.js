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

  executePrint: async () => {
    const win = window.open('', '_blank');
    if (!win) { alert('Please allow popups for this site to print.'); return; }

    const resolved = await Promise.all(get().items.map(toBase64));

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
  <title>Bulk Print Barcodes</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; }
    .grid { display: flex; flex-wrap: wrap; }
    .label { padding: 2mm; }
    .barcode-num { font-weight: bold; font-size: 13px; letter-spacing: 2px; margin-top: 4px; }
    .item-name { font-size: 11px; color: #444; margin-top: 2px; }
    @media print {
      @page { margin: 0; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body><div class="grid">${labelsHtml}</div></body>
</html>`;

    win.document.open();
    win.document.write(html);
    win.document.close();
    win.onload = () => win.print();
  }
}));

export default useBulkPrintStore;
