/**
 * TASNIM & SAID & AI - CORE ENGINE V129 (Clean Reset)
 * Features: Proxy Mode, Mem Prompt, Knowledge Actions, Robust Key Handling
 */

const CONFIG = {
    endpoints: {
        deepseek: 'https://api.deepseek.com',
        github: 'https://models.inference.ai.azure.com'
    },
    defaults: {
        system: "You are Tasnim & Said AI. Be professional, direct, and helpful. Always structure your answers clearly."
    },
    validProviders: ['deepseek', 'github']
};

const STATE = {
    provider: localStorage.getItem('active_provider') || 'deepseek',
    model: localStorage.getItem('active_model') || 'deepseek-chat',

    keys: {
        deepseek: localStorage.getItem('key_deepseek') || '',
        github: localStorage.getItem('key_github') || ''
    },
    use_proxy: localStorage.getItem('use_proxy') === 'true',

    prompt: localStorage.getItem('sys_prompt') || CONFIG.defaults.system,
    prompt_mem: localStorage.getItem('sys_prompt_mem') || '',

    theme: localStorage.getItem('theme') || 'dark',

    history: [],
    knowledgeFiles: [],
    knowledgeLinks: [],
    knowledgeActions: []
};

// --- MARKDOWN SETUP ---
const renderer = new marked.Renderer();
renderer.code = function (code, language) {
    const validLang = (language || 'text').toLowerCase();
    const id = 'code-' + Math.random().toString(36).substr(2, 9);
    return `
    <div class="code-block-wrapper">
        <div class="code-header">
            <span class="code-lang">${validLang}</span>
            <button class="copy-btn" onclick="copyText('${id}')">
                <i class="fa-regular fa-clone"></i> Copy Code
            </button>
        </div>
        <pre><code id="${id}" class="language-${validLang}">${String(code)}</code></pre>
    </div>`;
};
marked.setOptions({ renderer: renderer });

// --- DOM ELEMENTS ---
const dom = {
    input: document.getElementById('user-input'),
    sendBtn: document.getElementById('send-btn'),
    historyContainer: document.getElementById('chat-history'),

    // Modals
    modalSettings: document.getElementById('settings-modal'),
    modalKnowledge: document.getElementById('knowledge-modal'),
    modalPrompt: document.getElementById('prompt-modal'),
    modalPromptMem: document.getElementById('prompt-mem-modal'),

    // Config Inputs
    keys: {
        deepseek: document.getElementById('deepseek-key'),
        github: document.getElementById('github-key')
    },
    promptInput: document.getElementById('system-prompt-input'),
    promptMemInput: document.getElementById('system-prompt-mem-input'),
    proxyToggle: document.getElementById('proxy-mode-toggle'),

    // Knowledge
    knowledgeDrop: document.getElementById('knowledge-drop-zone'),
    knowledgeInput: document.getElementById('knowledge-upload'),
    knowledgeLinkInput: document.getElementById('knowledge-link-input'),

    actionName: document.getElementById('action-name'),
    actionSchema: document.getElementById('action-schema'),

    // Lists
    listFiles: document.getElementById('knowledge-list-files'),
    listLinks: document.getElementById('knowledge-list-links'),
    listActions: document.getElementById('knowledge-list-actions'),

    // Add Buittons
    addLinkBtn: document.getElementById('add-link-btn'),
    addActionBtn: document.getElementById('add-action-btn'),

    // Header/Theme
    themeBtn: document.getElementById('theme-toggle'),
    modelLabel: document.getElementById('current-model-name'),
    dropdown: document.getElementById('model-dropdown')
};

// --- INITIALIZATION ---
function init() {
    if (!CONFIG.validProviders.includes(STATE.provider)) {
        STATE.provider = 'deepseek';
        STATE.model = 'deepseek-chat';
        localStorage.setItem('active_provider', 'deepseek');
        localStorage.setItem('active_model', 'deepseek-chat');
    }

    dom.keys.deepseek.value = STATE.keys.deepseek;
    dom.keys.github.value = STATE.keys.github;
    dom.promptInput.value = STATE.prompt;
    dom.promptMemInput.value = STATE.prompt_mem;
    if (dom.proxyToggle) dom.proxyToggle.checked = STATE.use_proxy;

    applyTheme(STATE.theme);
    updateHeaderUI();
    dom.input.focus();
}

function updateHeaderUI() {
    dom.modelLabel.textContent = STATE.model;
}

// --- THEME ---
function toggleTheme() {
    STATE.theme = STATE.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', STATE.theme);
    applyTheme(STATE.theme);
}

function applyTheme(theme) {
    if (theme === 'light') {
        document.body.classList.add('light-mode');
        dom.themeBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
    } else {
        document.body.classList.remove('light-mode');
        dom.themeBtn.innerHTML = '<i class="fa-solid fa-moon"></i>';
    }
}

// --- KNOWLEDGE BASE ---
function handleFileUpload(files) {
    Array.from(files).forEach(file => {
        if (file.type.startsWith('text/') || file.name.endsWith('.js') || file.name.endsWith('.py') || file.name.endsWith('.json') || file.name.endsWith('.md')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                STATE.knowledgeFiles.push({ name: file.name, content: e.target.result });
                renderKnowledgeLists();
                notify(`Added: ${file.name}`, 'success');
            };
            reader.readAsText(file);
        } else {
            notify(`Skipped ${file.name} (Unsupported)`, 'error');
        }
    });
}

function addLink() {
    const url = dom.knowledgeLinkInput.value.trim();
    if (!url) return;
    STATE.knowledgeLinks.push({ url: url });
    dom.knowledgeLinkInput.value = '';
    renderKnowledgeLists();
    notify('Link Added', 'success');
}

function addAction() {
    const name = dom.actionName.value.trim();
    const schema = dom.actionSchema.value.trim();
    if (!name || !schema) { notify('Name & Schema required', 'error'); return; }
    STATE.knowledgeActions.push({ name, schema });
    dom.actionName.value = '';
    dom.actionSchema.value = '';
    renderKnowledgeLists();
    notify(`Action '${name}' Added`, 'success');
}

function renderKnowledgeLists() {
    dom.listFiles.innerHTML = '';
    STATE.knowledgeFiles.forEach((file, index) => {
        const div = document.createElement('div');
        div.className = 'file-item';
        div.innerHTML = `<span class="file-name"><i class="fa-solid fa-file-code"></i> ${file.name}</span><button class="remove-file" onclick="removeItem('files', ${index})"><i class="fa-solid fa-trash"></i></button>`;
        dom.listFiles.appendChild(div);
    });
    dom.listLinks.innerHTML = '';
    STATE.knowledgeLinks.forEach((link, index) => {
        const div = document.createElement('div');
        div.className = 'file-item';
        div.style.borderColor = '#4d6bfe';
        div.innerHTML = `<span class="file-name"><i class="fa-solid fa-link" style="color: #4d6bfe"></i> ${link.url}</span><button class="remove-file" onclick="removeItem('links', ${index})"><i class="fa-solid fa-trash"></i></button>`;
        dom.listLinks.appendChild(div);
    });
    dom.listActions.innerHTML = '';
    STATE.knowledgeActions.forEach((act, index) => {
        const div = document.createElement('div');
        div.className = 'file-item';
        div.style.borderColor = '#ffd700';
        div.innerHTML = `<span class="file-name"><i class="fa-solid fa-bolt" style="color: #ffd700"></i> ${act.name}</span><button class="remove-file" onclick="removeItem('actions', ${index})"><i class="fa-solid fa-trash"></i></button>`;
        dom.listActions.appendChild(div);
    });
}
window.removeItem = function (type, index) {
    if (type === 'files') STATE.knowledgeFiles.splice(index, 1);
    if (type === 'links') STATE.knowledgeLinks.splice(index, 1);
    if (type === 'actions') STATE.knowledgeActions.splice(index, 1);
    renderKnowledgeLists();
}

// --- CORE LOGIC ---
async function sendMessage() {
    const text = dom.input.value.trim();
    if (!text) return;

    // Sync Keys directly
    if (dom.keys.deepseek.value) STATE.keys.deepseek = dom.keys.deepseek.value.trim();
    if (dom.keys.github.value) STATE.keys.github = dom.keys.github.value.trim();

    const activeKey = STATE.keys[STATE.provider];
    if (!activeKey) {
        notify('Missing API Key. Check Settings.', 'error');
        dom.modalSettings.classList.remove('hidden');
        return;
    }

    addMessageToState('user', text);
    renderMessage('user', text, STATE.history.length - 1);
    dom.input.value = '';
    dom.input.style.height = 'auto';
    dom.sendBtn.disabled = true;

    const botContentInfo = renderBotPlaceholder();
    const botContent = botContentInfo.contentDiv;
    botContent.innerHTML = '<span class="cursor">|</span>';

    // Prompt Construction
    let finalSystemPrompt = STATE.prompt;
    if (text.startsWith('11') && STATE.prompt_mem) {
        finalSystemPrompt += "\n\n--- SECONDARY MEM LAYER ---\n" + STATE.prompt_mem + "\n--- END MEM ---\n";
        notify('Mem Layer Active ⚡', 'info');
    }

    if (STATE.knowledgeFiles.length > 0) {
        finalSystemPrompt += "\n\n--- KNOWLEDGE FILES ---\n" + STATE.knowledgeFiles.map(f => `FILE: ${f.name}\n${f.content}\n`).join('---\n');
    }
    if (STATE.knowledgeLinks.length > 0) {
        finalSystemPrompt += "\n\n--- KNOWLEDGE LINKS ---\n" + STATE.knowledgeLinks.map(l => `LINK: ${l.url}`).join('\n');
    }
    if (STATE.knowledgeActions.length > 0) {
        finalSystemPrompt += "\n\n--- ACTIONS ---\n" + STATE.knowledgeActions.map(a => `ACTION: ${a.name}\n${a.schema}\n`).join('---\n');
    }

    try {
        let endpoint = CONFIG.endpoints[STATE.provider];
        if (STATE.use_proxy) {
            endpoint = 'https://corsproxy.io/?' + encodeURIComponent(endpoint);
        }

        const response = await fetch(`${endpoint}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${activeKey}`
            },
            body: JSON.stringify({
                model: STATE.model,
                messages: [
                    { role: 'system', content: finalSystemPrompt },
                    ...STATE.history.map(m => ({ role: m.role, content: m.content }))
                ],
                stream: true
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`API Error ${response.status}: ${errText}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            for (const line of lines) {
                if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                    try {
                        const json = JSON.parse(line.replace('data: ', ''));
                        const delta = json.choices[0]?.delta?.content || '';
                        fullText += delta;
                        botContent.innerHTML = marked.parse(fullText);
                        window.scrollTo(0, document.body.scrollHeight);
                    } catch (e) { }
                }
            }
        }
        hljs.highlightAll();
        addMessageToState('assistant', fullText);
        botContentInfo.wrapperDiv.innerHTML = renderMessageHTML('assistant', fullText, STATE.history.length - 1);
        hljs.highlightAll();

    } catch (err) {
        console.error(err);
        let msg = err.message;
        if (msg.includes('Failed to fetch')) {
            msg = "Connection Failed. Try enabling 'CORS Proxy Mode' in Settings.";
        }
        botContent.innerHTML = `<div style="color:#ff4444; border:1px solid red; padding:10px; border-radius:5px;"><strong>Error:</strong> ${msg}</div>`;
        notify('Message failed', 'error');
    }
}

// --- UTILS ---
function addMessageToState(role, content) { STATE.history.push({ role, content }); }
function renderMessage(role, content, index) {
    const div = document.createElement('div');
    div.className = `message ${role}-message`;
    div.innerHTML = renderMessageHTML(role, content, index);
    dom.historyContainer.appendChild(div);
}
function renderBotPlaceholder() {
    const div = document.createElement('div');
    div.className = `message bot-message`;
    div.innerHTML = `<div class="avatar bot-avatar">AI</div><div class="msg-content"></div>`;
    dom.historyContainer.appendChild(div);
    return { wrapperDiv: div, contentDiv: div.querySelector('.msg-content') };
}
function renderMessageHTML(role, content, index) {
    const isUser = role === 'user';
    const parsedContent = isUser ? content.replace(/\n/g, '<br>') : marked.parse(content);
    return `<div class="avatar ${isUser ? 'user-avatar' : 'bot-avatar'}">${isUser ? '<i class="fa-solid fa-user"></i>' : 'AI'}</div><div style="flex:1; min-width:0;"><div class="msg-content">${parsedContent}</div><div class="message-actions-row"><button class="mini-btn" onclick="copyMessage(${index})">Copy</button>${isUser ? `<button class="mini-btn" onclick="editMessage(${index})">Edit</button>` : ''}</div></div>`;
}
window.copyText = function (id) { navigator.clipboard.writeText(document.getElementById(id).innerText).then(() => notify('Code copied', 'info')); }
window.copyMessage = function (index) { navigator.clipboard.writeText(STATE.history[index].content).then(() => notify('Copied', 'info')); }
window.editMessage = function (index) {
    dom.input.value = STATE.history[index].content;
    STATE.history = STATE.history.slice(0, index);
    dom.historyContainer.innerHTML = '';
    STATE.history.forEach((m, i) => renderMessage(m.role, m.content, i));
    dom.input.focus();
}
window.exportChat = function () {
    html2pdf().set({ margin: 0.5, filename: 'Chat.pdf', image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' } }).from(document.getElementById('chat-history')).save();
}
function notify(msg, type) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerText = msg;
    t.style.borderLeftColor = type === 'error' ? '#ff4444' : '#4d6bfe';
    document.getElementById('notification-area').appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

// --- EVENTS ---
dom.themeBtn.addEventListener('click', toggleTheme);
document.getElementById('open-settings').addEventListener('click', () => dom.modalSettings.classList.remove('hidden'));
document.getElementById('close-settings').addEventListener('click', () => dom.modalSettings.classList.add('hidden'));

document.getElementById('open-knowledge').addEventListener('click', () => dom.modalKnowledge.classList.remove('hidden'));
document.getElementById('close-knowledge').addEventListener('click', () => dom.modalKnowledge.classList.add('hidden'));
dom.knowledgeDrop.addEventListener('click', () => dom.knowledgeInput.click());
dom.knowledgeInput.addEventListener('change', (e) => handleFileUpload(e.target.files));
dom.addLinkBtn.addEventListener('click', addLink);
dom.addActionBtn.addEventListener('click', addAction);

document.getElementById('open-prompt').addEventListener('click', () => dom.modalPrompt.classList.remove('hidden'));
document.getElementById('close-prompt').addEventListener('click', () => dom.modalPrompt.classList.add('hidden'));
document.getElementById('save-prompt').addEventListener('click', () => { STATE.prompt = dom.promptInput.value.trim(); localStorage.setItem('sys_prompt', STATE.prompt); dom.modalPrompt.classList.add('hidden'); notify('Instructions Saved', 'success'); });
document.getElementById('clear-prompt').addEventListener('click', () => { dom.promptInput.value = CONFIG.defaults.system; });

document.getElementById('open-prompt-mem').addEventListener('click', () => dom.modalPromptMem.classList.remove('hidden'));
document.getElementById('close-prompt-mem').addEventListener('click', () => dom.modalPromptMem.classList.add('hidden'));
document.getElementById('save-prompt-mem').addEventListener('click', () => { STATE.prompt_mem = dom.promptMemInput.value.trim(); localStorage.setItem('sys_prompt_mem', STATE.prompt_mem); dom.modalPromptMem.classList.add('hidden'); notify('Mem Layer Saved', 'success'); });
document.getElementById('clear-prompt-mem').addEventListener('click', () => { dom.promptMemInput.value = ''; });

document.getElementById('save-config').addEventListener('click', () => {
    STATE.keys.deepseek = dom.keys.deepseek.value.trim();
    STATE.keys.github = dom.keys.github.value.trim();
    localStorage.setItem('key_deepseek', STATE.keys.deepseek);
    localStorage.setItem('key_github', STATE.keys.github);
    dom.modalSettings.classList.add('hidden');
    notify('Keys Saved', 'success');
});

// PROXY TOGGLE
if (dom.proxyToggle) {
    dom.proxyToggle.addEventListener('change', (e) => {
        STATE.use_proxy = e.target.checked;
        localStorage.setItem('use_proxy', STATE.use_proxy);
        notify(`Proxy Mode: ${STATE.use_proxy ? 'ON 🚀' : 'OFF'}`, 'info');
    });
}

// TEST CONNECTION
document.getElementById('test-config').addEventListener('click', async () => {
    const provider = STATE.provider;
    const key = dom.keys[provider].value.trim();
    if (!key) { notify('Enter a key first', 'error'); return; }

    notify('Testing...', 'info');
    try {
        let endpoint = CONFIG.endpoints[provider];
        if (STATE.use_proxy) endpoint = 'https://corsproxy.io/?' + encodeURIComponent(endpoint);

        const res = await fetch(`${endpoint}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
            body: JSON.stringify({ model: STATE.model, messages: [{ role: 'user', content: 'Hi' }], max_tokens: 1 })
        });
        if (res.ok) notify('Connection OK! ✅', 'success');
        else throw new Error(res.status);
    } catch (e) {
        alert(e.message.includes('Failed to fetch') ? "Network/CORS Error. Try enabling Proxy Mode." : "Error: " + e.message);
    }
});

// DROPDOWN & TAB SWITCHING
document.getElementById('model-selector-btn').addEventListener('click', (e) => { e.stopPropagation(); dom.dropdown.classList.toggle('hidden'); });
document.addEventListener('click', () => dom.dropdown.classList.add('hidden'));
document.querySelectorAll('.dropdown-item').forEach(item => {
    item.addEventListener('click', () => {
        STATE.provider = item.dataset.provider;
        STATE.model = item.dataset.model;
        localStorage.setItem('active_provider', STATE.provider);
        localStorage.setItem('active_model', STATE.model);
        updateHeaderUI();
        notify(`Switched to ${STATE.model}`, 'info');
    });
});
document.querySelectorAll('.settings-tab').forEach(tab => {
    tab.addEventListener('click', function () {
        const p = this.closest('.settings-container');
        if (!p) return;
        p.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
        p.querySelectorAll('.settings-section').forEach(s => s.classList.remove('active'));
        this.classList.add('active');
        const s = document.getElementById('sec-' + this.dataset.tab);
        if (s) s.classList.add('active');
    });
});

dom.input.addEventListener('input', function () { this.style.height = 'auto'; this.style.height = this.scrollHeight + 'px'; dom.sendBtn.disabled = !this.value.trim(); });
dom.input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
dom.sendBtn.addEventListener('click', sendMessage);
document.getElementById('export-btn').addEventListener('click', window.exportChat);
document.getElementById('new-chat-action').addEventListener('click', () => location.reload());

init();
