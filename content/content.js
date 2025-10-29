// content/content.js - Versión standalone con debugging visual
console.log('[MT] Content script INICIANDO en', location.href);

// Variables globales (expuestas para debugging)
window.MT_translating = false;
window.MT_processedImages = new Set();
window.MT_currentApiKey = '';
window.MT_currentLang = 'Español';
window.MT_controlPanel = null;

// Crear panel de control en la página
function createControlPanel() {
  if (window.MT_controlPanel) return;
  
  window.MT_controlPanel = document.createElement('div');
  window.MT_controlPanel.id = 'manga-translator-panel';
  window.MT_controlPanel.innerHTML = `
    <div style="background: rgba(0,0,0,0.95); color: white; padding: 12px; border-radius: 8px; font-family: system-ui; font-size: 13px;">
      <div style="margin-bottom: 8px; font-weight: bold;">🎌 Manga Translator</div>
      <input type="text" id="mt-api-key" placeholder="API Key de Gemini" 
        style="width: 100%; padding: 6px; margin-bottom: 6px; border-radius: 4px; border: 1px solid #555; background: #222; color: white; font-size: 12px;">
      <select id="mt-lang" style="width: 100%; padding: 6px; margin-bottom: 6px; border-radius: 4px; border: 1px solid #555; background: #222; color: white; font-size: 12px;">
        <option>Español</option>
        <option>English</option>
        <option>Français</option>
        <option>Deutsch</option>
        <option>Português</option>
      </select>
      <button id="mt-toggle" style="width: 100%; padding: 8px; border: none; border-radius: 4px; background: #4f46e5; color: white; font-weight: bold; cursor: pointer; font-size: 13px; margin-bottom: 6px;">
        ▶️ Iniciar
      </button>
      <div id="mt-status" style="margin-top: 6px; font-size: 11px; color: #aaa; text-align: center; min-height: 20px;">Listo</div>
      <div id="mt-debug" style="margin-top: 6px; font-size: 10px; color: #666; border-top: 1px solid #333; padding-top: 6px; max-height: 100px; overflow-y: auto;"></div>
    </div>
  `;
  
  window.MT_controlPanel.style.cssText = `
    position: fixed;
    top: 60px;
    right: 12px;
    z-index: 2147483647;
    width: 280px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
  `;
  
  document.body.appendChild(window.MT_controlPanel);
  console.log('[MT] Panel creado');
  addDebugLog('Panel creado');
  
  // Cargar datos guardados
  try {
    chrome.storage.local.get(['apiKey', 'lang'], (data) => {
      if (data.apiKey) {
        document.getElementById('mt-api-key').value = data.apiKey;
        console.log('[MT] API key cargada desde storage');
      }
      if (data.lang) {
        document.getElementById('mt-lang').value = data.lang;
      }
    });
  } catch (e) {
    console.warn('[MT] No se pudo cargar desde storage:', e);
  }
  
  // Event listeners
  document.getElementById('mt-api-key').addEventListener('input', (e) => {
    try {
      chrome.storage.local.set({ apiKey: e.target.value });
    } catch (err) {
      console.warn('[MT] No se pudo guardar API key');
    }
  });
  
  document.getElementById('mt-lang').addEventListener('change', (e) => {
    try {
      chrome.storage.local.set({ lang: e.target.value });
    } catch (err) {
      console.warn('[MT] No se pudo guardar idioma');
    }
  });
  
  document.getElementById('mt-toggle').addEventListener('click', () => {
    console.log('[MT] Boton toggle clickeado');
    addDebugLog('Boton clickeado');
    
    const apiKey = document.getElementById('mt-api-key').value.trim();
    const lang = document.getElementById('mt-lang').value;
    
    console.log('[MT] API key length:', apiKey.length);
    console.log('[MT] Lang:', lang);
    console.log('[MT] Translating actual:', window.MT_translating);
    
    if (!window.MT_translating) {
      if (!apiKey) {
        setStatus('⚠️ Introduce tu API key');
        addDebugLog('ERROR: API key vacia');
        console.warn('[MT] API key vacia');
        return;
      }
      addDebugLog('Iniciando traduccion...');
      startTranslation(apiKey, lang);
    } else {
      addDebugLog('Deteniendo...');
      stopTranslation();
    }
  });
  
  console.log('[MT] Event listeners configurados');
}

function addDebugLog(text) {
  const debugEl = document.getElementById('mt-debug');
  if (debugEl) {
    const time = new Date().toLocaleTimeString();
    debugEl.innerHTML = `<div>${time}: ${text}</div>` + debugEl.innerHTML;
  }
}

function setStatus(text) {
  const statusEl = document.getElementById('mt-status');
  if (statusEl) {
    statusEl.textContent = text;
  }
  console.log('[MT] Status:', text);
}

function updateToggleButton() {
  const btn = document.getElementById('mt-toggle');
  if (btn) {
    btn.textContent = window.MT_translating ? '⏹️ Detener' : '▶️ Iniciar';
    btn.style.background = window.MT_translating ? '#dc2626' : '#4f46e5';
  }
}

function startTranslation(apiKey, lang) {
  console.log('[MT] === startTranslation LLAMADO ===');
  console.log('[MT] API Key:', apiKey.substring(0, 10) + '...');
  console.log('[MT] Lang:', lang);
  
  addDebugLog('startTranslation ejecutandose');
  
  try {
    if (window.MT_translating) {
      console.log('[MT] Ya esta traduciendo');
      addDebugLog('Ya esta activo');
      return;
    }
    
    if (!apiKey || !apiKey.trim()) {
      console.error('[MT] API key vacia');
      setStatus('ERROR: API key vacia');
      addDebugLog('ERROR: API key vacia');
      return;
    }

    window.MT_translating = true;
    window.MT_currentApiKey = apiKey.trim();
    window.MT_currentLang = lang || 'Español';
    window.MT_processedImages.clear();
    
    console.log('[MT] Estado activado');
    console.log('[MT] Variables configuradas:', {
      translating: window.MT_translating,
      apiKeyLength: window.MT_currentApiKey.length,
      lang: window.MT_currentLang
    });
    
    setStatus('🔍 Buscando imágenes...');
    addDebugLog('Estado: ACTIVADO');
    updateToggleButton();

    // Primera búsqueda
    setTimeout(() => {
      console.log('[MT] Ejecutando primera busqueda...');
      addDebugLog('Primera busqueda...');
      translateVisibleImages();
    }, 500);

    // Observador de mutaciones
    if (document.body) {
      const observer = new MutationObserver(() => {
        if (window.MT_translating) {
          console.log('[MT] Mutation detectada');
          translateVisibleImages();
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      
      window.MT_observer = observer;
      console.log('[MT] Observer activado');
    }

    // Escaneo periódico
    let scanCount = 0;
    window.MT_interval = setInterval(() => {
      if (!window.MT_translating) {
        clearInterval(window.MT_interval);
        console.log('[MT] Interval detenido');
        return;
      }
      scanCount++;
      console.log('[MT] Escaneo periodico', scanCount);
      addDebugLog('Escaneo #' + scanCount);
      translateVisibleImages();
    }, 5000);
    
    console.log('[MT] Interval configurado');
    
  } catch (e) {
    console.error('[MT] ERROR en startTranslation:', e);
    console.error('[MT] Stack:', e.stack);
    setStatus('ERROR: ' + e.message);
    addDebugLog('ERROR: ' + e.message);
  }
}

function stopTranslation() {
  console.log('[MT] Deteniendo...');
  window.MT_translating = false;
  
  if (window.MT_observer) {
    window.MT_observer.disconnect();
    window.MT_observer = null;
  }
  
  if (window.MT_interval) {
    clearInterval(window.MT_interval);
    window.MT_interval = null;
  }
  
  setStatus('⏹️ Detenido');
  addDebugLog('Estado: DETENIDO');
  updateToggleButton();
}

function findCandidateImages() {
  const results = [];

  try {
    const imgs = document.querySelectorAll('img');
    console.log('[MT] Encontradas', imgs.length, 'imagenes <img>');
    
    imgs.forEach((img) => {
      try {
        const effective = img.currentSrc || img.src || '';
        if (effective) {
          results.push({ type: 'img', el: img, url: effective });
        }
      } catch (e) {
        console.warn('[MT] Error procesando img:', e);
      }
    });
  } catch (e) {
    console.error('[MT] Error buscando imagenes:', e);
  }
  
  console.log('[MT] Total candidatos:', results.length);
  return results;
}

function isImageVisible(el) {
  try {
    if (!el || !el.getBoundingClientRect) return false;
    const rect = el.getBoundingClientRect();
    const windowHeight = window.innerHeight || document.documentElement.clientHeight;
    const windowWidth = window.innerWidth || document.documentElement.clientWidth;
    
    return (
      rect.top < windowHeight &&
      rect.bottom > 0 &&
      rect.left < windowWidth &&
      rect.right > 0 &&
      rect.width > 50 &&
      rect.height > 50
    );
  } catch (e) {
    return false;
  }
}

function translateVisibleImages() {
  if (!window.MT_translating) {
    console.log('[MT] translateVisibleImages: translating=false, retornando');
    return;
  }

  console.log('[MT] === translateVisibleImages EJECUTANDO ===');
  addDebugLog('Escaneando imagenes...');
  
  try {
    const candidates = findCandidateImages();
    
    if (!candidates || !Array.isArray(candidates)) {
      console.error('[MT] Candidatos invalidos');
      addDebugLog('ERROR: candidatos invalidos');
      return;
    }
    
    let toTranslate = 0;
    let visible = 0;
    let skipped = 0;

    for (const item of candidates) {
      try {
        if (!item || !item.el) {
          skipped++;
          continue;
        }
        
        if (!isImageVisible(item.el)) {
          skipped++;
          continue;
        }
        
        visible++;
        
        const key = item.url || item.el.outerHTML.substring(0, 100);
        if (window.MT_processedImages.has(key)) {
          continue;
        }
        
        console.log('[MT] Nueva imagen para procesar');
        window.MT_processedImages.add(key);
        
        if (item.type === 'img') {
          const img = item.el;
          const w = img.naturalWidth || img.width || 0;
          const h = img.naturalHeight || img.height || 0;
          
          console.log('[MT] Dimensiones:', w, 'x', h);
          
          if (w < 100 || h < 100) {
            console.log('[MT] Imagen muy pequeña, omitiendo');
            continue;
          }
          
          console.log('[MT] Procesando imagen', w, 'x', h);
          addDebugLog('Procesando ' + w + 'x' + h);
          translateImage(img, key);
          toTranslate++;
        }
      } catch (e) {
        console.error('[MT] Error procesando candidato:', e);
      }
    }

    console.log('[MT] Resumen:', {
      total: candidates.length,
      visible: visible,
      toTranslate: toTranslate,
      skipped: skipped,
      processed: window.MT_processedImages.size
    });
    
    addDebugLog('Visible: ' + visible + ', Traducir: ' + toTranslate + ', Ya procesadas: ' + window.MT_processedImages.size);

    if (toTranslate > 0) {
      setStatus('⏳ Procesando ' + toTranslate + ' imagen(es)...');
    } else {
      setStatus('👀 Esperando... (' + window.MT_processedImages.size + ' procesadas)');
    }
  } catch (e) {
    console.error('[MT] ERROR en translateVisibleImages:', e);
    console.error('[MT] Stack:', e.stack);
    setStatus('ERROR: ' + e.message);
    addDebugLog('ERROR: ' + e.message);
  }
}

async function translateImage(imgElement, imageKey) {
  console.log('[MT] === translateImage INICIO ===');
  addDebugLog('Convirtiendo imagen...');
  
  try {
    const canvas = document.createElement('canvas');
    const w = imgElement.naturalWidth || imgElement.width;
    const h = imgElement.naturalHeight || imgElement.height;
    
    canvas.width = w;
    canvas.height = h;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imgElement, 0, 0);
    
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    const base64 = dataUrl.split(',')[1];
    
    console.log('[MT] Base64 generado:', base64.length, 'chars');
    setStatus('🌐 Llamando a Gemini...');
    addDebugLog('Llamando a Gemini API...');

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${window.MT_currentApiKey}`;

    const prompt = `Eres un experto en traducción de manga. Analiza esta imagen y detecta TODOS los textos (bocadillos, onomatopeyas, títulos). Tradúcelos del japonés al ${window.MT_currentLang}. Proporciona coordenadas precisas en porcentaje. Responde SOLO con JSON válido.`;

    const schema = {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          "original_text": { type: "STRING" },
          "translated_text": { type: "STRING" },
          "coordinates": {
            type: "OBJECT",
            properties: {
              "top": { type: "NUMBER" },
              "left": { type: "NUMBER" },
              "width": { type: "NUMBER" },
              "height": { type: "NUMBER" }
            },
            required: ["top", "left", "width", "height"]
          }
        },
        required: ["translated_text", "coordinates"]
      }
    };

    const payload = {
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: "image/jpeg", data: base64 } }
        ]
      }],
      generationConfig: {
        response_mime_type: "application/json",
        response_schema: schema,
        temperature: 0.2
      }
    };

    console.log('[MT] Enviando request...');
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    console.log('[MT] Response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[MT] Error API:', errorData);
      throw new Error(errorData.error?.message || 'Error en la API');
    }

    const result = await response.json();
    const text = result.candidates[0].content.parts[0].text;
    const bubbles = JSON.parse(text);

    console.log('[MT] Recibidos', bubbles.length, 'textos');
    addDebugLog('Recibidos ' + bubbles.length + ' textos');

    if (bubbles.length === 0) {
      setStatus('⚠️ No se encontró texto');
      addDebugLog('Sin texto detectado');
      return;
    }

    addOverlays(imgElement, bubbles);
    setStatus('✅ ' + bubbles.length + ' textos traducidos');
    addDebugLog('✅ ' + bubbles.length + ' traducidos');

  } catch (error) {
    console.error('[MT] ERROR:', error);
    console.error('[MT] Stack:', error.stack);
    setStatus('ERROR: ' + error.message);
    addDebugLog('ERROR: ' + error.message);
  }
}

function addOverlays(imgElement, bubbles) {
  console.log('[MT] Creando', bubbles.length, 'burbujas');
  
  try {
    let container = imgElement.parentElement.querySelector('.manga-overlay-container');
    
    if (!container) {
      container = document.createElement('div');
      container.className = 'manga-overlay-container';
      container.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 10000;
      `;
      
      const parent = imgElement.parentElement;
      if (getComputedStyle(parent).position === 'static') {
        parent.style.position = 'relative';
      }
      
      parent.appendChild(container);
    }

    bubbles.forEach((bubble, idx) => {
      try {
        const div = document.createElement('div');
        div.className = 'manga-translation-bubble';
        div.textContent = bubble.translated_text;
        
        div.style.cssText = `
          position: absolute;
          top: ${bubble.coordinates.top}%;
          left: ${bubble.coordinates.left}%;
          width: ${bubble.coordinates.width}%;
          min-height: ${bubble.coordinates.height}%;
          background: rgba(255, 255, 255, 0.95);
          color: black;
          font-weight: 600;
          font-size: 12px;
          padding: 4px 6px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
          pointer-events: auto;
          cursor: pointer;
          line-height: 1.2;
          word-wrap: break-word;
          font-family: system-ui;
          transition: all 0.2s;
          z-index: 10001;
        `;

        div.addEventListener('mouseenter', () => {
          div.style.background = 'rgba(255, 255, 255, 1)';
          div.style.transform = 'scale(1.05)';
        });

        div.addEventListener('mouseleave', () => {
          div.style.background = 'rgba(255, 255, 255, 0.95)';
          div.style.transform = 'scale(1)';
        });

        div.addEventListener('click', (e) => {
          e.stopPropagation();
          div.remove();
        });

        container.appendChild(div);
      } catch (e) {
        console.error('[MT] Error creando burbuja:', e);
      }
    });
    
    console.log('[MT]', bubbles.length, 'burbujas anadidas');
  } catch (e) {
    console.error('[MT] Error en addOverlays:', e);
  }
}

// Mensajes desde popup (mantener compatibilidad)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log('[MT] Mensaje recibido:', msg);
  
  try {
    if (msg.action === 'start') {
      startTranslation(msg.apiKey, msg.lang);
      sendResponse({ status: 'start-received', ok: true });
    } else if (msg.action === 'stop') {
      stopTranslation();
      sendResponse({ status: 'stop-received', ok: true });
    }
  } catch (e) {
    console.error('[MT] Error:', e);
    sendResponse({ status: 'error', message: e.message });
  }
  
  return true;
});

// Crear panel cuando cargue la página
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', createControlPanel);
} else {
  setTimeout(createControlPanel, 100);
}

console.log('[MT] Content script cargado');