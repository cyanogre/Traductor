const toggleBtn = document.getElementById('toggle-btn');
const status = document.getElementById('status');
const apiKeyInput = document.getElementById('api-key');
const langSelect = document.getElementById('lang');

let isActive = false;

chrome.storage.sync.get(['apiKey', 'lang', 'enabled'], (data) => {
  apiKeyInput.value = data.apiKey || '';
  langSelect.value = data.lang || 'Español';
  isActive = data.enabled || false;
  updateButton();
});

apiKeyInput.addEventListener('input', () => {
  chrome.storage.sync.set({ apiKey: apiKeyInput.value.trim() });
});

langSelect.addEventListener('change', () => {
  chrome.storage.sync.set({ lang: langSelect.value });
});

toggleBtn.addEventListener('click', async () => {
  isActive = !isActive;
  chrome.storage.sync.set({ enabled: isActive });

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.tabs.sendMessage(tab.id, {
    action: isActive ? 'start' : 'stop',
    apiKey: apiKeyInput.value.trim(),
    lang: langSelect.value
  });

  updateButton();
});

function updateButton() {
  toggleBtn.textContent = isActive ? 'Detener' : 'Iniciar Traducción';
  toggleBtn.className = isActive 
    ? 'w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded transition text-sm'
    : 'w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded transition text-sm';
  status.textContent = isActive ? 'Traducción activa' : '';
}