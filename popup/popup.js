const toggleBtn = document.getElementById('toggle-btn');
const status = document.getElementById('status');
const apiKeyInput = document.getElementById('api-key');
const langSelect = document.getElementById('lang');
const openDebugBtn = document.getElementById('open-debug');

let isActive = false;

// Usar storage.local para evitar dependencia de Firefox Sync
chrome.storage.local.get(['apiKey', 'lang', 'enabled'], (data) => {
  console.log('Popup: datos desde storage', data);
  apiKeyInput.value = data.apiKey || '';
  langSelect.value = data.lang || 'Español';
  isActive = data.enabled || false;
  updateButton();
});

apiKeyInput.addEventListener('input', () => {
  chrome.storage.local.set({ apiKey: apiKeyInput.value.trim() });
  console.log('Popup: apiKey updated (local)');
});

langSelect.addEventListener('change', () => {
  chrome.storage.local.set({ lang: langSelect.value });
  console.log('Popup: lang updated', langSelect.value);
});

toggleBtn.addEventListener('click', async () => {
  isActive = !isActive;
  chrome.storage.local.set({ enabled: isActive });

  status.textContent = isActive ? 'Enviando orden de inicio...' : 'Deteniendo traducción...';
  console.log('Popup: toggle clicked, enabled=', isActive);

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      console.error('Popup: no se encontró pestaña activa', tab);
      status.textContent = 'No se encontró pestaña activa. Abre una pestaña con el manga.';
      return;
    }

    console.log('Popup: enviando mensaje a tab.id=', tab.id, 'url=', tab.url);

    chrome.tabs.sendMessage(tab.id, {
      action: isActive ? 'start' : 'stop',
      apiKey: apiKeyInput.value.trim(),
      lang: langSelect.value
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('Popup: error al enviar mensaje:', chrome.runtime.lastError.message);
        status.textContent = 'No hay content script en esta pestaña (mirar consola de la página).';
      } else {
        console.log('Popup: respuesta del content script', response);
        status.textContent = isActive ? 'Traducción activada en la pestaña' : 'Traducción detenida';
      }
    });
  } catch (e) {
    console.error('Popup: excepción al enviar mensaje', e);
    status.textContent = 'Error al enviar mensaje (ver consola).';
  }

  updateButton();
});

openDebugBtn.addEventListener('click', () => {
  // Abrir la página de debug en una nueva pestaña
  const url = chrome.runtime.getURL('debug/debug.html');
  window.open(url, '_blank', 'noopener');
});

function updateButton() {
  toggleBtn.textContent = isActive ? 'Detener' : 'Iniciar Traducción';
  toggleBtn.className = isActive 
    ? 'w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded transition text-sm'
    : 'w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded transition text-sm';
  status.textContent = isActive ? 'Traducción activa' : '';
}