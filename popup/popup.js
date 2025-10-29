const toggleBtn = document.getElementById('toggle-btn');
const status = document.getElementById('status');
const apiKeyInput = document.getElementById('api-key');
const langSelect = document.getElementById('lang');
const openDebugBtn = document.getElementById('open-debug');

let isActive = false;

console.log('🎨 [Popup] Popup cargado');

// Cargar datos guardados
chrome.storage.local.get(['apiKey', 'lang', 'enabled'], (data) => {
  console.log('🎨 [Popup] Datos cargados:', {
    hasApiKey: !!data.apiKey,
    lang: data.lang,
    enabled: data.enabled
  });
  
  apiKeyInput.value = data.apiKey || '';
  langSelect.value = data.lang || 'Español';
  isActive = data.enabled || false;
  updateButton();
});

// Guardar API key
apiKeyInput.addEventListener('input', () => {
  const key = apiKeyInput.value.trim();
  chrome.storage.local.set({ apiKey: key });
  console.log('🎨 [Popup] API key guardada:', key ? `${key.substring(0, 10)}...` : 'vacía');
});

// Guardar idioma
langSelect.addEventListener('change', () => {
  chrome.storage.local.set({ lang: langSelect.value });
  console.log('🎨 [Popup] Idioma guardado:', langSelect.value);
});

// Toggle traducción
toggleBtn.addEventListener('click', async () => {
  console.log('🎨 [Popup] Toggle clicked, isActive:', isActive);
  
  try {
    // Validar API key
    const apiKey = apiKeyInput.value.trim();
    if (!isActive && !apiKey) {
      status.textContent = '⚠️ Introduce tu API key primero';
      status.className = 'error';
      apiKeyInput.focus();
      console.warn('🎨 [Popup] API key vacía');
      return;
    }

    isActive = !isActive;
    chrome.storage.local.set({ enabled: isActive });

    status.textContent = isActive ? '🔄 Activando traducción...' : '⏹️ Deteniendo...';
    status.className = '';
    console.log('🎨 [Popup] Nuevo estado:', isActive ? 'ACTIVANDO' : 'DETENIENDO');

    // Obtener pestaña activa con manejo de errores
    let tabs;
    try {
      tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      console.log('🎨 [Popup] Tabs query resultado:', tabs);
    } catch (e) {
      console.error('🎨 [Popup] Error en tabs.query:', e);
      throw new Error('No se pudo obtener la pestaña activa: ' + e.message);
    }
    
    if (!tabs || !Array.isArray(tabs) || tabs.length === 0) {
      console.error('🎨 [Popup] No hay pestañas en el resultado:', tabs);
      throw new Error('No se encontró pestaña activa');
    }

    const tab = tabs[0];
    
    if (!tab || !tab.id) {
      console.error('🎨 [Popup] Tab inválido:', tab);
      throw new Error('La pestaña activa no tiene ID válido');
    }

    console.log('🎨 [Popup] Enviando mensaje a tab:', {
      id: tab.id,
      url: tab.url,
      title: tab.title
    });

    // Enviar mensaje al content script
    chrome.tabs.sendMessage(tab.id, {
      action: isActive ? 'start' : 'stop',
      apiKey: apiKey,
      lang: langSelect.value
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('🎨 [Popup] Error en sendMessage:', chrome.runtime.lastError.message);
        status.textContent = '❌ Error: El content script no responde. Recarga la página del manga (F5).';
        status.className = 'error';
        isActive = false;
        chrome.storage.local.set({ enabled: false });
        updateButton();
      } else {
        console.log('🎨 [Popup] Respuesta recibida:', response);
        status.textContent = isActive 
          ? '✅ Traducción activada - Mira la consola de la página (F12)' 
          : '⏹️ Traducción detenida';
        status.className = isActive ? 'active' : '';
        updateButton();
      }
    });

  } catch (e) {
    console.error('🎨 [Popup] Excepción capturada:', e);
    console.error('🎨 [Popup] Stack trace:', e.stack);
    status.textContent = '❌ Error: ' + e.message;
    status.className = 'error';
    isActive = false;
    chrome.storage.local.set({ enabled: false });
    updateButton();
  }
});

// Abrir debug
openDebugBtn.addEventListener('click', () => {
  console.log('🎨 [Popup] Abriendo debug...');
  try {
    const url = chrome.runtime.getURL('debug/debug.html');
    chrome.tabs.create({ url });
  } catch (e) {
    console.error('🎨 [Popup] Error abriendo debug:', e);
  }
});

function updateButton() {
  if (isActive) {
    toggleBtn.textContent = '⏹️ Detener';
    toggleBtn.className = 'active';
    status.textContent = '✅ Traducción activa';
    status.className = 'active';
  } else {
    toggleBtn.textContent = '▶️ Iniciar Traducción';
    toggleBtn.className = '';
    if (status.textContent.includes('activa')) {
      status.textContent = '';
      status.className = '';
    }
  }
}

console.log('🎨 [Popup] Popup completamente inicializado');