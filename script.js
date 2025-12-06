/**
 * TASNIM & SAID & AI - CORE ENGINE V128 (Fix: State Sanitization & Direct DOM Read)
 * Features: Mem Prompt, Knowledge Actions, Cloud Links, Robust Key Handling
 */

const CONFIG = {
    endpoints: {
        deepseek: 'https://api.deepseek.com',
        github: 'https://models.inference.ai.azure.com'
    },
    defaults: {
        system: "You are Tasnim & Said AI. Be professional, direct, and helpful. Always structure your answers clearly."
    },
    validProviders: ['deepseek', 'github'] // Whitelist
};

const STATE = {
    provider: localStorage.getItem('active_provider') || 'deepseek',
    model: localStorage.getItem('active_model') || 'deepseek-chat',

    keys: {
        deepseek: localStorage.getItem('key_deepseek') || '',
        github: localStorage.getItem('key_github') || ''
    },

    prompt: localStorage.getItem('sys_prompt') || CONFIG.defaults.system,
    prompt_mem: localStorage.getItem('sys_prompt_mem') || '',

    theme: localStorage.getItem('theme') || 'dark',

    history: [],
    knowledgeFiles: [], // { name, content }
    knowledgeLinks: [], // { url }
    knowledgeActions: [] // { name, schema }
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
    // 1. Sanitize Provider (CRITICAL FIX for Legacy State)
    if (!CONFIG.validProviders.includes(STATE.provider)) {
        console.warn(`Invalid provider '${STATE.provider}' detected. Resetting to 'deepseek'.`);
        STATE.provider = 'deepseek';
        STATE.model = 'deepseek-chat';
        localStorage.setItem('active_provider', 'deepseek');
        localStorage.setItem('active_model', 'deepseek-chat');
    }

    dom.keys.deepseek.value = STATE.keys.deepseek;
    dom.keys.github.value = STATE.keys.github;
    dom.promptInput.value = STATE.prompt;
    dom.promptMemInput.value = STATE.prompt_mem;

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

// --- KNOWLEDGE BASE LOGIC ---

// 1. Files
function handleFileUpload(files) {
    Array.from(files).forEach(file => {
        if (file.type.startsWith('text/') ||
            file.name.endsWith('.js') ||
            file.name.endsWith('.py') ||
            file.name.endsWith('.json') ||
            file.name.endsWith('.md')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                STATE.knowledgeFiles.push({ name: file.name, content: e.target.result });
                renderKnowledgeLists();
                notify(`Added: ${file.name}`, 'success');
            };
            reader.readAsText(file);
        } else {
            notify(`Skipped ${file.name} (Binary/Unsupported)`, 'error');
        }
    });
}

// 2. Links
function addLink() {
    const url = dom.knowledgeLinkInput.value.trim();
    if (!url) return;
    try {
        new URL(url);
    } catch (_) {
        notify('Invalid URL', 'error');
        return;
    }
    STATE.knowledgeLinks.push({ url: url });
    dom.knowledgeLinkInput.value = '';
    renderKnowledgeLists();
    notify('Link Added', 'success');
}

// 3. Actions
function addAction() {
    const name = dom.actionName.value.trim();
    const schema = dom.actionSchema.value.trim();

    if (!name || !schema) {
        notify('Action Name and Schema required', 'error');
        return;
    }

    STATE.knowledgeActions.push({ name, schema });
    dom.actionName.value = '';
    dom.actionSchema.value = '';
    renderKnowledgeLists();
    notify(`Action '${name}' Added`, 'success');
}

// Render All Lists
function renderKnowledgeLists() {
    // Files
    dom.listFiles.innerHTML = '';
    STATE.knowledgeFiles.forEach((file, index) => {
        const div = document.createElement('div');
        div.className = 'file-item';
        div.innerHTML = `
            <span class="file-name"><i class="fa-solid fa-file-code"></i> ${file.name}</span>
            <button class="remove-file" onclick="removeItem('files', ${index})"><i class="fa-solid fa-trash"></i></button>
        `;
        dom.listFiles.appendChild(div);
    });

    // Links
    dom.listLinks.innerHTML = '';
    STATE.knowledgeLinks.forEach((link, index) => {
        const div = document.createElement('div');
        div.className = 'file-item';
        div.style.borderColor = '#4d6bfe';
        div.innerHTML = `
            <span class="file-name"><i class="fa-solid fa-link" style="color: #4d6bfe"></i> ${link.url}</span>
            <button class="remove-file" onclick="removeItem('links', ${index})"><i class="fa-solid fa-trash"></i></button>
        `;
        dom.listLinks.appendChild(div);
    });

    // Actions
    dom.listActions.innerHTML = '';
    STATE.knowledgeActions.forEach((act, index) => {
        const div = document.createElement('div');
        div.className = 'file-item';
        div.style.borderColor = '#ffd700';
        div.innerHTML = `
            <span class="file-name"><i class="fa-solid fa-bolt" style="color: #ffd700"></i> ${act.name}</span>
            <button class="remove-file" onclick="removeItem('actions', ${index})"><i class="fa-solid fa-trash"></i></button>
        `;
        dom.listActions.appendChild(div);
    });
}

window.removeItem = function (type, index) {
    if (type === 'files') STATE.knowledgeFiles.splice(index, 1);
    if (type === 'links') STATE.knowledgeLinks.splice(index, 1);
    if (type === 'actions') STATE.knowledgeActions.splice(index, 1);
    renderKnowledgeLists();
}

// --- TAB SWITCHING ---
document.querySelectorAll('.settings-tab').forEach(tab => {
    tab.addEventListener('click', function () {
        const parent = this.closest('.settings-container');
        if (!parent) return;
        parent.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
        parent.querySelectorAll('.settings-section').forEach(s => s.classList.remove('active'));
        this.classList.add('active');
        const targetId = 'sec-' + this.dataset.tab;
        const targetSec = document.getElementById(targetId);
        if (targetSec) targetSec.classList.add('active');
    });
});


// --- CORE MESSAGE LOGIC ---
async function sendMessage() {
    const text = dom.input.value.trim();
    if (!text) return;

    // DEBUG: Ensure State is in sync with DOM (Crucial Fix)
    // Sometimes user types key but forgets to save. We read directly.
    if (dom.keys.deepseek.value && !STATE.keys.deepseek) {
        STATE.keys.deepseek = dom.keys.deepseek.value.trim();
        localStorage.setItem('key_deepseek', STATE.keys.deepseek);
    }
    if (dom.keys.github.value && !STATE.keys.github) {
        STATE.keys.github = dom.keys.github.value.trim();
        localStorage.setItem('key_github', STATE.keys.github);
    }

    const activeKey = STATE.keys[STATE.provider];

    if (!activeKey) {
        // Detailed Error Message
        const label = STATE.provider === 'deepseek' ? 'DeepSeek Official' : 'GitHub/Azure';
        notify(`Missing API Key for: ${label}. Please Check Settings.`, 'error');
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

    // *** PROMPT CONSTRUCTION ***
    let finalSystemPrompt = STATE.prompt;

    // TRIGGER LOGIC: MEM (11)
    if (text.startsWith('11')) {
        if (STATE.prompt_mem) {
            finalSystemPrompt += "\n\n--- SECONDARY INSTRUCTION LAYER (MEM TRIGGERED) ---\n";
            finalSystemPrompt += STATE.prompt_mem;
            finalSystemPrompt += "\n--- END MEM LAYER ---\n";
            notify('Mem Layer Activated ⚡', 'info');
        }
    }

    // Inject Files
    if (STATE.knowledgeFiles.length > 0) {
        let block = "\n\n--- KNOWLEDGE BASE (FILES) ---\n";
        STATE.knowledgeFiles.forEach(f => {
            block += `FILE: ${f.name}\n${f.content}\n---\n`;
        });
        finalSystemPrompt += block;
    }

    // Inject Links
    if (STATE.knowledgeLinks.length > 0) {
        let block = "\n\n--- KNOWLEDGE BASE (LINKS) ---\n";
        block += "Using provided reference links:\n";
        STATE.knowledgeLinks.forEach(l => {
            block += `LINK: ${l.url}\n`;
        });
        block += "---\n";
        finalSystemPrompt += block;
    }

    // Inject Actions
    if (STATE.knowledgeActions.length > 0) {
        let block = "\n\n--- AVAILABLE ACTIONS (TOOLS) ---\n";
        block += "You have the ability to simulate or request the following actions:\n";
        STATE.knowledgeActions.forEach(a => {
            block += `ACTION: ${a.name}\nSCHEMA/DESC:\n${a.schema}\n---\n`;
        });
        finalSystemPrompt += block;
    }

    try {
        const endpoint = CONFIG.endpoints[STATE.provider];

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
            if (response.status === 429) throw new Error('Rate Limit Exceeded (429).');
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
        botContent.innerHTML = `<div style="color:#ff4444"><strong>Error:</strong> ${err.message}</div>`;
        notify('Message failed: ' + err.message, 'error');
    }
}

// --- RENDERING & UTIL ---
function addMessageToState(role, content) {
    STATE.history.push({ role, content });
}

function renderMessage(role, content, index) {
    const div = document.createElement('div');
    div.className = `message ${role}-message`;
    div.innerHTML = renderMessageHTML(role, content, index);
    dom.historyContainer.appendChild(div);
}

function renderBotPlaceholder() {
    const div = document.createElement('div');
    div.className = `message bot-message`;
    div.innerHTML = `
        <div class="avatar bot-avatar">AI</div>
        <div class="msg-content"></div>
    `;
    dom.historyContainer.appendChild(div);
    return { wrapperDiv: div, contentDiv: div.querySelector('.msg-content') };
}

function renderMessageHTML(role, content, index) {
    const isUser = role === 'user';
    const parsedContent = isUser ? content.replace(/\n/g, '<br>') : marked.parse(content);
    return `
        <div class="avatar ${isUser ? 'user-avatar' : 'bot-avatar'}">
            ${isUser ? '<i class="fa-solid fa-user"></i>' : 'AI'}
        </div>
        <div style="flex:1; min-width:0;">
            <div class="msg-content">${parsedContent}</div>
            <div class="message-actions-row">
                <button class="mini-btn" onclick="copyMessage(${index})"><i class="fa-regular fa-copy"></i> Copy</button>
                ${isUser ? `<button class="mini-btn" onclick="editMessage(${index})"><i class="fa-solid fa-pen"></i> Edit</button>` : ''}
            </div>
        </div>
    `;
}

window.copyText = function (id) {
    const el = document.getElementById(id);
    if (el) navigator.clipboard.writeText(el.innerText).then(() => notify('Code copied', 'info'));
}
window.copyMessage = function (index) {
    const msg = STATE.history[index];
    if (msg) navigator.clipboard.writeText(msg.content).then(() => notify('Message copied', 'info'));
}
window.editMessage = function (index) {
    const msg = STATE.history[index];
    if (msg) {
        dom.input.value = msg.content;
        STATE.history = STATE.history.slice(0, index);
        dom.historyContainer.innerHTML = '';
        STATE.history.forEach((m, i) => renderMessage(m.role, m.content, i));
        dom.input.focus();
    }
}
window.exportChat = function () {
    const element = document.getElementById('chat-history');
    const opt = {
        margin: 0.5,
        filename: `TASNIM_SAID_AI_Chat.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
}

function notify(msg, type) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerText = msg;
    t.style.borderLeftColor = type === 'error' ? '#ff4444' : '#4d6bfe';
    document.getElementById('notification-area').appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

// --- EVENT LISTENERS ---
dom.themeBtn.addEventListener('click', toggleTheme);
document.getElementById('open-settings').addEventListener('click', () => dom.modalSettings.classList.remove('hidden'));
document.getElementById('close-settings').addEventListener('click', () => dom.modalSettings.classList.add('hidden'));

// Knowledge Interactions
document.getElementById('open-knowledge').addEventListener('click', () => dom.modalKnowledge.classList.remove('hidden'));
document.getElementById('close-knowledge').addEventListener('click', () => dom.modalKnowledge.classList.add('hidden'));
dom.knowledgeDrop.addEventListener('click', () => dom.knowledgeInput.click());
dom.knowledgeInput.addEventListener('change', (e) => handleFileUpload(e.target.files));
dom.addLinkBtn.addEventListener('click', addLink);
dom.addActionBtn.addEventListener('click', addAction);

// Main Prompt
document.getElementById('open-prompt').addEventListener('click', () => dom.modalPrompt.classList.remove('hidden'));
document.getElementById('close-prompt').addEventListener('click', () => dom.modalPrompt.classList.add('hidden'));
document.getElementById('save-prompt').addEventListener('click', () => {
    STATE.prompt = dom.promptInput.value.trim();
    localStorage.setItem('sys_prompt', STATE.prompt);
    dom.modalPrompt.classList.add('hidden');
    notify('Main Instructions Updated', 'success');
});
document.getElementById('clear-prompt').addEventListener('click', () => {
    dom.promptInput.value = CONFIG.defaults.system;
});

// MEM Prompt
document.getElementById('open-prompt-mem').addEventListener('click', () => dom.modalPromptMem.classList.remove('hidden'));
document.getElementById('close-prompt-mem').addEventListener('click', () => dom.modalPromptMem.classList.add('hidden'));
document.getElementById('save-prompt-mem').addEventListener('click', () => {
    STATE.prompt_mem = dom.promptMemInput.value.trim();
    localStorage.setItem('sys_prompt_mem', STATE.prompt_mem);
    dom.modalPromptMem.classList.add('hidden');
    notify('Mem Layer Updated', 'success');
});
document.getElementById('clear-prompt-mem').addEventListener('click', () => {
    dom.promptMemInput.value = '';
});

// Keys Save
document.getElementById('save-config').addEventListener('click', () => {
    STATE.keys.deepseek = dom.keys.deepseek.value.trim();
    STATE.keys.github = dom.keys.github.value.trim();
    localStorage.setItem('key_deepseek', STATE.keys.deepseek);
    localStorage.setItem('key_github', STATE.keys.github);
    dom.modalSettings.classList.add('hidden');
    notify('Keys Saved', 'success');
});

// Test Connection
document.getElementById('test-config').addEventListener('click', async () => {
    const provider = STATE.provider;
    const key = dom.keys[provider].value.trim();
    if (!key) {
        notify('Please enter a key to test.', 'error');
        return;
    }

    notify(`Testing ${provider}...`, 'info');
    try {
        const endpoint = CONFIG.endpoints[provider];
        // Simple 1-token request to validate key
        const response = await fetch(`${endpoint}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`
            },
            body: JSON.stringify({
                model: STATE.model,
                messages: [{ role: 'user', content: 'Hi' }],
                max_tokens: 1
            })
        });

        if (response.ok) {
            notify('Connection Successful! ✅', 'success');
        } else {
            const err = await response.text();
            throw new Error(`API returned ${response.status}`);
        }
    } catch (e) {
        console.error(e);
        if (e.message.includes('Failed to fetch')) {
            alert("CONNECTION ERROR (CORS)\n\nPossible causes:\n1. Invalid API Key (Most likely!)\n2. Opening file directly (file://) - Try 'start_server.bat'\n3. No Internet");
        } else {
            alert(`TEST FAILED: ${e.message}`);
        }
    }
});

// Dropdown
document.getElementById('model-selector-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    dom.dropdown.classList.toggle('hidden');
});
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

dom.input.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = this.scrollHeight + 'px';
    dom.sendBtn.disabled = !this.value.trim();
});
dom.input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});
dom.sendBtn.addEventListener('click', sendMessage);
document.getElementById('export-btn').addEventListener('click', window.exportChat);
document.getElementById('new-chat-action').addEventListener('click', () => location.reload());

init();
