// debug/debug.js - Interfaz ligera para diagnóstico
const apiKeyEl = document.getElementById('apiKey');
const enabledEl = document.getElementById('enabled');
const btnGet = document.getElementById('btn-get');
const btnStart = document.getElementById('btn-start');
const btnStop = document.getElementById('btn-stop');
const btnClear = document.getElementById('btn-clear');
const candidatesEl = document.getElementById('candidates');
const logEl = document.getElementById('log');

function log(...args) {
  const txt = args.map(a => (typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a))).join(' ');
  logEl.textContent = (logEl.textContent === '—' ? '' : logEl.textContent + '\n') + txt;
  logEl.scrollTop = logEl.scrollHeight;
}

function shortKey(k) {
  if (!k) return '—';
  return k.length > 10 ? k.slice(0,6) + '…' + k.slice(-4) : k;
}

function renderCandidates(list) {
  if (!list || list.length === 0) {
    candidatesEl.innerHTML = '<div class="small">No se encontraron candidatos.</div>';
    return;
  }
  const rows = list.map(item => {
    const can = item.canDraw ? '<span class="ok">draw OK</span>' : '<span class="bad">draw FAILED</span>';
    return `<tr>
      <td>${item.type}</td>
      <td style="word-break:break-all">${item.url || ''}</td>
      <td>${item.w||''}×${item.h||''}</td>
      <td>${can}</td>
    </tr>`;
  }).join('');
  candidatesEl.innerHTML = `<table><thead><tr><th>tipo</th><th>url</th><th>dim</th><th>draw</th></tr></thead><tbody>${rows}</tbody></table>`;
}

// cargar storage
function loadStorage() {
  chrome.storage.local.get(['apiKey','lang','enabled'], data => {
    apiKeyEl.textContent = shortKey(data.apiKey || '');
    enabledEl.textContent = data.enabled ? 'activo' : 'inactivo';
    log('Storage leido', data);
  });
}

async function sendToActiveTab(message, cb) {
  try {
    const [tab] = await chrome.tabs.query({active:true,currentWindow:true});
    if (!tab || !tab.id) {
      log('No se encontró pestaña activa');
      return;
    }
    chrome.tabs.sendMessage(tab.id, message, (resp) => {
      if (chrome.runtime.lastError) {
        log('sendMessage error:', chrome.runtime.lastError.message);
        if (cb) cb(null, chrome.runtime.lastError);
      } else {
        log('Respuesta de content script:', resp);
        if (cb) cb(resp);
      }
    });
  } catch (e) {
    log('Error sendToActiveTab', e);
    if (cb) cb(null, e);
  }
}

btnGet.addEventListener('click', async () => {
  loadStorage();
  log('Solicitando diagnostics al content script en la pestaña activa...');
  sendToActiveTab({ action: 'diagnostics' }, (resp, err) => {
    if (!resp) {
      log('No respuesta de diagnostics (revisa consola de la pestaña):', err);
      return;
    }
    if (resp.ok && resp.candidates) {
      renderCandidates(resp.candidates);
      log('Diagnostics recibidos: candidatos=', resp.candidates.length);
    } else {
      log('Diagnostics: respuesta inesperada', resp);
    }
  });
});

btnStart.addEventListener('click', async () => {
  chrome.storage.local.get(['apiKey','lang'], data => {
    const apiKey = data.apiKey || '';
    const lang = data.lang || 'Español';
    log('Enviando start a pestaña (apiKey presente?:', !!apiKey, ')');
    sendToActiveTab({ action: 'start', apiKey, lang }, resp => {
      log('Start: respuesta', resp);
    });
  });
});

btnStop.addEventListener('click', async () => {
  log('Enviando stop a pestaña');
  sendToActiveTab({ action: 'stop' }, resp => {
    log('Stop: respuesta', resp);
  });
});

btnClear.addEventListener('click', () => {
  logEl.textContent = '';
  candidatesEl.innerHTML = '';
});

loadStorage();
log('Debug UI cargado. Pulsa "Obtener diagnóstico" en la pestaña del manga.');