// content/content.js - soporte para <picture>/.webp + fallback via background fetch
console.log('Manga Translator content script cargado en', location.href);

let translating = false;
let observer = null;
let processedImages = new Set();

function ensureHUD() {
  if (document.getElementById('manga-translator-hud')) return;
  const hud = document.createElement('div');
  hud.id = 'manga-translator-hud';
  hud.style.position = 'fixed';
  hud.style.right = '12px';
  hud.style.bottom = '12px';
  hud.style.zIndex = 2147483647;
  hud.style.background = 'rgba(0,0,0,0.7)';
  hud.style.color = 'white';
  hud.style.padding = '6px 8px';
  hud.style.fontSize = '12px';
  hud.style.borderRadius = '6px';
  hud.style.maxWidth = '260px';
  hud.textContent = 'Manga Translator: inactivo';
  document.body.appendChild(hud);
}
function setHUD(text) {
  ensureHUD();
  const hud = document.getElementById('manga-translator-hud');
  hud.textContent = 'Manga Translator: ' + text;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log('Content: mensaje recibido', msg);
  if (msg.action === 'start') {
    startTranslation(msg.apiKey, msg.lang);
    sendResponse && sendResponse({ status: 'start-received' });
  } else if (msg.action === 'stop') {
    stopTranslation();
    sendResponse && sendResponse({ status: 'stop-received' });
  } else if (msg.action === 'diagnostics') {
    // Ejecutar diagnóstico rápido y responder con resultados
    (async () => {
      try {
        const items = findCandidateImages();
        const results = [];
        for (const it of items.slice(0, 80)) {
          if (it.type === 'img') {
            const img = it.el;
            const url = it.url || '';
            const w = img.naturalWidth || img.width || 0;
            const h = img.naturalHeight || img.height || 0;
            let canDraw = false;
            try {
              const canvas = document.createElement('canvas');
              canvas.width = Math.max(1, w);
              canvas.height = Math.max(1, h);
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0);
              // intentar toDataURL para confirmar si está tainted
              canvas.toDataURL('image/jpeg');
              canDraw = true;
            } catch (e) {
              canDraw = false;
            }
            results.push({ type: 'img', url, w, h, canDraw });
          } else {
            // bg/url: no podemos dibujar directo sin descargar. marcamos canDraw=false
            results.push({ type: it.type, url: it.url || '', w: 0, h:0, canDraw: false });
          }
        }
        sendResponse({ ok: true, candidates: results, translating });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true; // responderemos async
  }
});

// === resto del content script (start/stop/translateImage...) ===
// Mantén aquí el resto de tus funciones (startTranslation, translateVisibleImages, translateImage, addOverlays, etc.)
// ... si ya tienes esas funciones, no las sobreescribas; asegúrate sólo de mantener la función findCandidateImages() que el diagnostics usa.

function findCandidateImages() {
  const results = [];

  const imgs = Array.from(document.querySelectorAll('img'));
  imgs.forEach(img => {
    const effective = img.currentSrc || img.src || '';
    results.push({ type: 'img', el: img, url: effective });
  });

  const pictures = Array.from(document.querySelectorAll('picture'));
  pictures.forEach(pic => {
    const img = pic.querySelector('img');
    if (img) return;
    const source = pic.querySelector('source');
    if (source) {
      const srcset = source.getAttribute('srcset') || source.getAttribute('src') || '';
      const firstUrl = (srcset.split(',')[0] || '').trim().split(' ')[0] || '';
      if (firstUrl) results.push({ type: 'url', el: pic, url: firstUrl });
    }
  });

  const all = Array.from(document.querySelectorAll('*'));
  all.forEach(el => {
    const bg = getComputedStyle(el).backgroundImage || '';
    if (bg && bg !== 'none' && bg.startsWith('url(')) {
      const m = bg.match(/url\(["']?(.*?)["']?\)/);
      if (m && m[1]) {
        results.push({ type: 'bg', el: el, url: m[1] });
      }
    }
  });

  return results;
}