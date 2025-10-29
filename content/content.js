let translating = false;
let observer = null;
let processedImages = new Set();

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'start') {
    startTranslation(msg.apiKey, msg.lang);
  } else if (msg.action === 'stop') {
    stopTranslation();
  }
});

function startTranslation(apiKey, lang) {
  if (translating || !apiKey) return;
  translating = true;

  injectStyles();
  observePage(apiKey, lang);
  translateVisibleImages(apiKey, lang);
}

function stopTranslation() {
  translating = false;
  if (observer) observer.disconnect();
  document.querySelectorAll('.manga-translator-overlay').forEach(el => el.remove());
  document.querySelectorAll('.manga-translator-container').forEach(el => {
    const img = el.querySelector('img');
    if (img && el.parentNode) {
      el.parentNode.insertBefore(img, el);
      el.remove();
    }
  });
  processedImages.clear();
}

function injectStyles() {
  if (document.getElementById('manga-translator-styles')) return;
  const style = document.createElement('style');
  style.id = 'manga-translator-styles';
  style.textContent = `
    .manga-translator-container { position: relative; display: inline-block; }
    .manga-translator-overlay {
      position: absolute; background: rgba(255,255,255,0.95); color: #000;
      border-radius: 6px; padding: 4px 6px; font-weight: 600; font-size: 12px;
      pointer-events: auto; cursor: move; min-width: 20px; min-height: 20px;
      word-wrap: break-word; box-shadow: 0 1px 3px rgba(0,0,0,0.2);
      transition: all 0.15s; line-height: 1.2; user-select: none;
    }
    .manga-translator-overlay:hover { background: white; box-shadow: 0 2px 8px rgba(79,70,229,0.25); }
    .manga-translator-overlay.selected { outline: 2px solid #4f46e5; }
    .manga-translator-overlay .text { outline: none; width: 100%; height: 100%; display: flex;
      align-items: center; justify-content: center; text-align: center; }
    .manga-translator-overlay .resize { position: absolute; width: 8px; height: 8px;
      background: #4f46e5; border: 1.5px solid white; border-radius: 50%;
      bottom: -4px; right: -4px; cursor: se-resize; opacity: 0; }
    .manga-translator-overlay:hover .resize,
    .manga-translator-overlay.selected .resize { opacity: 1; }
  `;
  document.head.appendChild(style);
}

function observePage(apiKey, lang) {
  observer = new MutationObserver(() => translateVisibleImages(apiKey, lang));
  observer.observe(document.body, { childList: true, subtree: true });

  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setTimeout(() => translateVisibleImages(apiKey, lang), 800);
    }
  }).observe(document, { subtree: true, childList: true });
}

async function translateVisibleImages(apiKey, lang) {
  const images = Array.from(document.querySelectorAll('img'))
    .filter(img => {
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      const src = img.src.toLowerCase();
      return w > 400 && h > 600 && (
        src.includes('manga') || src.includes('chapter') || 
        src.includes('page') || src.includes('img')
      );
    });

  for (const img of images) {
    if (processedImages.has(img)) continue;
    if (!img.complete || img.naturalWidth === 0) continue;

    processedImages.add(img);
    await translateImage(img, apiKey, lang);
  }
}

async function translateImage(img, apiKey, lang) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  ctx.drawImage(img, 0, 0);
  const base64 = canvas.toDataURL('image/jpeg').split(',')[1];

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [
          { text: `Detecta y traduce TODO el texto de este manga al ${lang}. Responde SOLO con JSON válido:\n[{ "translated_text": "...", "coordinates": { "top": 10, "left": 20, "width": 15, "height": 5 } }]` },
          { inline_data: { mime_type: "image/jpeg", data: base64 } }
        ]}],
        generationConfig: { response_mime_type: "application/json", temperature: 0.2 }
      })
    });

    if (!res.ok) return;
    const data = await res.json();
    const text = data.candidates[0]?.content?.parts[0]?.text || '[]';
    const translations = JSON.parse(text);
    addOverlays(img, translations);
  } catch (e) {
    console.warn("Error traduciendo:", e);
  }
}

function addOverlays(img, translations) {
  let container = img.closest('.manga-translator-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'manga-translator-container';
    img.parentNode.insertBefore(container, img);
    container.appendChild(img);
  }

  translations.forEach(t => {
    const bubble = document.createElement('div');
    bubble.className = 'manga-translator-overlay';
    bubble.style.top = `${t.coordinates.top}%`;
    bubble.style.left = `${t.coordinates.left}%`;
    bubble.style.width = `${t.coordinates.width}%`;
    bubble.style.minHeight = `${t.coordinates.height}%`;

    const span = document.createElement('span');
    span.className = 'text';
    span.textContent = t.translated_text;
    bubble.appendChild(span);

    const resize = document.createElement('div');
    resize.className = 'resize';
    bubble.appendChild(resize);

    makeDraggable(bubble, container);
    makeResizable(bubble, container);
    bubble.addEventListener('dblclick', () => editText(span));

    container.appendChild(bubble);
  });
}

function makeDraggable(el, container) {
  el.onmousedown = e => {
    if (e.target !== el && !e.target.classList.contains('text')) return;
    e.preventDefault();
    const start = { x: e.clientX, y: e.clientY };
    const init = { left: parseFloat(el.style.left), top: parseFloat(el.style.top) };
    el.classList.add('selected');

    const move = ev => {
      const dx = ((ev.clientX - start.x) / container.offsetWidth) * 100;
      const dy = ((ev.clientY - start.y) / container.offsetHeight) * 100;
      el.style.left = `${Math.max(0, Math.min(100 - parseFloat(el.style.width), init.left + dx))}%`;
      el.style.top = `${Math.max(0, Math.min(100 - parseFloat(el.style.minHeight), init.top + dy))}%`;
    };

    document.onmousemove = move;
    document.onmouseup = () => {
      document.onmousemove = document.onmouseup = null;
      el.classList.remove('selected');
    };
  };
}

function makeResizable(el, container) {
  const handle = el.querySelector('.resize');
  handle.onmousedown = e => {
    e.stopPropagation();
    const start = { x: e.clientX, y: e.clientY };
    const init = { w: parseFloat(el.style.width), h: parseFloat(el.style.minHeight) };

    const move = ev => {
      const dw = ((ev.clientX - start.x) / container.offsetWidth) * 100;
      const dh = ((ev.clientY - start.y) / container.offsetHeight) * 100;
      el.style.width = `${Math.max(3, Math.min(100 - parseFloat(el.style.left), init.w + dw))}%`;
      el.style.minHeight = `${Math.max(3, Math.min(100 - parseFloat(el.style.top), init.h + dh))}%`;
    };

    document.onmousemove = move;
    document.onmouseup = () => {
      document.onmousemove = document.onmouseup = null;
    };
  };
}

function editText(span) {
  span.contentEditable = true;
  span.focus();
  span.addEventListener('blur', () => span.contentEditable = false, { once: true });
}