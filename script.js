/**
 * TASNIM & SAID AI - المحرك الأساسي V4.3
 * الإصدار النهائي مع جميع الإصلاحات
 * جميع الحقوق محفوظة © 2024 Focalta AI
 */

// ===== التكوين الأساسي =====
const CONFIG = {
    endpoints: {
        deepseek: 'https://api.deepseek.com/chat/completions',
        github: 'https://api.inference.ai.azure.com/v1/chat/completions'
    },
    
    defaults: {
        systemPrompt: `أنت مساعد ذكي اسمه "تسنيم وسعيد AI". أنت:
- محترف، دقيق، ومفيد
- تقدم إجابات منظمة مع أمثلة عملية
- تكتب الأكواد بوضوح مع شرح مفصل
- تستخدم اللغة العربية الفصحى مع المصطلحات التقنية`,
        
        memPrompt: `🔥 وضع MEM النشط - المستوى المتقدم
أنت الآن تعمل في وضع القدرات المتقدمة. كن:
- أكثر عمقاً في التحليل
- أكثر إبداعاً في الحلول
- أكثر تفصيلاً في الشرح
- أكثر مرونة في التعامل مع المهام المعقدة`,
        
        model: 'deepseek/deepseek-chat',
        provider: 'github'
    }
};

// ===== حالة التطبيق =====
let APP_STATE = {
    settings: {
        provider: localStorage.getItem('ai_provider') || CONFIG.defaults.provider,
        model: localStorage.getItem('ai_model') || CONFIG.defaults.model,
        apiKeys: {
            deepseek: localStorage.getItem('deepseek_key') || '',
            github: localStorage.getItem('github_key') || ''
        },
        proxy: {
            enabled: localStorage.getItem('proxy_enabled') !== 'false',
            mode: localStorage.getItem('proxy_mode') || 'auto'
        }
    },
    
    prompts: {
        system: localStorage.getItem('system_prompt') || CONFIG.defaults.systemPrompt,
        mem: localStorage.getItem('mem_prompt') || CONFIG.defaults.memPrompt
    },
    
    knowledge: {
        files: JSON.parse(localStorage.getItem('knowledge_files') || '[]'),
        links: JSON.parse(localStorage.getItem('knowledge_links') || '[]'),
        actions: JSON.parse(localStorage.getItem('knowledge_actions') || '[]')
    },
    
    conversation: {
        messages: [],
        sessionId: Date.now().toString()
    },
    
    system: {
        connection: {
            status: 'disconnected',
            lastTest: null
        },
        proxy: {
            activeServer: JSON.parse(localStorage.getItem('active_proxy') || 'null'),
            testResults: JSON.parse(localStorage.getItem('proxy_test_results') || '{}')
        }
    }
};

// ===== مدير البروكسي المتقدم =====
class ProxyManager {
    constructor() {
        this.activeProxy = APP_STATE.system.proxy.activeServer;
        this.testResults = new Map();
        this.proxies = [
            { id: 'corsproxy', name: 'CORS Proxy', url: 'https://corsproxy.io/?', priority: 1 },
            { id: 'allorigins', name: 'AllOrigins', url: 'https://api.allorigins.win/raw?url=', priority: 2 },
            { id: 'thingproxy', name: 'ThingProxy', url: 'https://thingproxy.freeboard.io/fetch/', priority: 3 },
            { id: 'corsanywhere', name: 'CORS Anywhere', url: 'https://cors-anywhere.herokuapp.com/', priority: 4 }
        ];
    }
    
    async testProxies() {
        showNotification('🔍 جاري اختبار البروكسيات...', 'info');
        
        const testUrl = 'https://api.deepseek.com';
        const results = [];
        
        for (const proxy of this.proxies) {
            try {
                const startTime = Date.now();
                const proxyUrl = `${proxy.url}${encodeURIComponent(testUrl)}`;
                
                const response = await fetch(proxyUrl, {
                    method: 'HEAD',
                    headers: {
                        'User-Agent': 'TasnimSaidAI/4.3',
                        'Accept': '*/*'
                    }
                });
                
                const latency = Date.now() - startTime;
                
                if (response.ok || response.status === 200 || response.status === 405) {
                    results.push({
                        ...proxy,
                        status: 'working',
                        latency,
                        testedAt: Date.now()
                    });
                    console.log(`✅ ${proxy.name} يعمل (${latency}ms)`);
                } else {
                    results.push({
                        ...proxy,
                        status: 'failed',
                        latency,
                        error: `HTTP ${response.status}`
                    });
                    console.log(`❌ ${proxy.name} فشل (HTTP ${response.status})`);
                }
            } catch (error) {
                results.push({
                    ...proxy,
                    status: 'failed',
                    latency: null,
                    error: error.message
                });
                console.log(`❌ ${proxy.name} فشل: ${error.message}`);
            }
            
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        results.sort((a, b) => {
            if (a.status === 'working' && b.status !== 'working') return -1;
            if (a.status !== 'working' && b.status === 'working') return 1;
            return (a.latency || 9999) - (b.latency || 9999);
        });
        
        this.testResults.set('latest', results);
        localStorage.setItem('proxy_test_results', JSON.stringify(results));
        
        const bestProxy = results.find(p => p.status === 'working');
        if (bestProxy) {
            this.activeProxy = bestProxy;
            localStorage.setItem('active_proxy', JSON.stringify(bestProxy));
            
            showNotification(`✅ أفضل بروكسي: ${bestProxy.name} (${bestProxy.latency}ms)`, 'success');
            
            const proxyInfo = document.getElementById('active-proxy-info');
            if (proxyInfo) {
                proxyInfo.innerHTML = `
                    <strong>${bestProxy.name}</strong> | 
                    السرعة: ${bestProxy.latency}ms | 
                    التحديث: ${new Date().toLocaleTimeString()}
                `;
            }
            
            return bestProxy;
        } else {
            showNotification('⚠️ لم يتم العثور على بروكسي يعمل', 'warning');
            return null;
        }
    }
    
    async fetchWithProxy(url, options = {}) {
        const proxyEnabled = APP_STATE.settings.proxy.enabled;
        
        if (!proxyEnabled) {
            return await this.directFetch(url, options);
        }
        
        let proxy = this.activeProxy;
        if (!proxy || Date.now() - proxy.testedAt > 3600000) {
            proxy = await this.testProxies();
        }
        
        if (!proxy) {
            console.warn('لا توجد بروكسيات تعمل، جرب الاتصال المباشر');
            return await this.directFetch(url, options);
        }
        
        try {
            const proxyUrl = `${proxy.url}${encodeURIComponent(url)}`;
            
            const proxyOptions = {
                ...options,
                headers: {
                    ...options.headers,
                    'X-Requested-With': 'XMLHttpRequest',
                    'Origin': window.location.origin,
                    'User-Agent': 'TasnimSaidAI/4.3'
                }
            };
            
            console.log(`🔗 استخدام البروكسي: ${proxy.name}`);
            const response = await fetch(proxyUrl, proxyOptions);
            
            if (!response.ok) {
                throw new Error(`Proxy HTTP ${response.status}`);
            }
            
            return response;
        } catch (proxyError) {
            console.error('خطأ في البروكسي:', proxyError);
            return await this.directFetch(url, options);
        }
    }
    
    async directFetch(url, options = {}) {
        try {
            const response = await fetch(url, options);
            return response;
        } catch (error) {
            console.error('خطأ في الاتصال المباشر:', error);
            throw error;
        }
    }
}

// ===== تهيئة marked.js =====
marked.setOptions({
    breaks: true,
    gfm: true,
    highlight: function(code, lang) {
        if (lang && hljs.getLanguage(lang)) {
            return hljs.highlight(code, { language: lang }).value;
        }
        return hljs.highlightAuto(code).value;
    }
});

// ===== تهيئة مدير البروكسي =====
const proxyManager = new ProxyManager();

// ===== وظائف المساعدة =====
function showNotification(message, type = 'info') {
    const notificationArea = document.getElementById('notification-area');
    if (!notificationArea) return;
    
    const toast = document.createElement('div');
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fa-solid ${icons[type] || 'fa-info-circle'}"></i>
        <span>${message}</span>
    `;
    
    notificationArea.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-100%)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function updateConnectionStatus(status, message = '') {
    const statusElement = document.getElementById('connection-status');
    const statusText = document.getElementById('status-text');
    const miniStatus = document.getElementById('connection-status-mini');
    
    if (!statusElement || !statusText) return;
    
    const statusConfig = {
        connected: { text: 'متصل', color: 'var(--success)', icon: '✓' },
        disconnected: { text: 'غير متصل', color: 'var(--error)', icon: '✗' },
        testing: { text: 'جاري الاختبار...', color: 'var(--warning)', icon: '🔄' },
        error: { text: 'خطأ اتصال', color: 'var(--error)', icon: '⚠️' }
    };
    
    const config = statusConfig[status] || statusConfig.disconnected;
    
    statusText.textContent = message || config.text;
    
    const dotElement = statusElement.querySelector('.status-dot');
    if (dotElement) {
        dotElement.className = `status-dot ${status}`;
        dotElement.style.background = config.color;
    }
    
    if (miniStatus) {
        const miniDot = miniStatus.querySelector('.status-dot');
        const miniText = miniStatus.querySelector('span');
        
        if (miniDot) {
            miniDot.className = `status-dot ${status}`;
            miniDot.style.background = config.color;
        }
        
        if (miniText) {
            miniText.textContent = config.text;
        }
    }
    
    APP_STATE.system.connection.status = status;
}

function scrollToBottom() {
    setTimeout(() => {
        const chatHistory = document.getElementById('chat-history');
        if (chatHistory) {
            chatHistory.scrollTop = chatHistory.scrollHeight;
        }
    }, 100);
}

// ===== إدارة النوافذ =====
class ModalManager {
    constructor() {
        this.currentModal = null;
        this.initModals();
    }
    
    initModals() {
        const allModals = document.querySelectorAll('.settings-modal');
        allModals.forEach(modal => {
            modal.classList.add('modal-hidden');
            modal.classList.remove('modal-show');
        });
        
        document.addEventListener('click', (e) => {
            if (this.currentModal && e.target === this.currentModal) {
                this.closeCurrentModal();
            }
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.currentModal) {
                this.closeCurrentModal();
            }
        });
    }
    
    openModal(modalId) {
        if (this.currentModal) {
            this.closeCurrentModal();
        }
        
        const modal = document.getElementById(modalId);
        if (!modal) {
            console.error(`Modal with ID ${modalId} not found`);
            return;
        }
        
        modal.classList.remove('modal-hidden');
        setTimeout(() => {
            modal.classList.add('modal-show');
        }, 10);
        
        this.currentModal = modal;
        document.body.style.overflow = 'hidden';
    }
    
    closeCurrentModal() {
        if (!this.currentModal) return;
        
        this.currentModal.classList.remove('modal-show');
        setTimeout(() => {
            this.currentModal.classList.add('modal-hidden');
            this.currentModal = null;
            document.body.style.overflow = '';
        }, 300);
    }
    
    closeModalById(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('modal-show');
            setTimeout(() => {
                modal.classList.add('modal-hidden');
                if (this.currentModal === modal) {
                    this.currentModal = null;
                    document.body.style.overflow = '';
                }
            }, 300);
        }
    }
    
    setupOpenButtons() {
        const openButtons = {
            'open-prompt': 'prompt-modal',
            'open-prompt-mem': 'prompt-mem-modal',
            'open-knowledge': 'knowledge-modal',
            'open-settings': 'settings-modal',
            'open-help': 'help-modal'
        };
        
        Object.entries(openButtons).forEach(([buttonId, modalId]) => {
            const button = document.getElementById(buttonId);
            if (button) {
                button.addEventListener('click', () => {
                    this.openModal(modalId);
                });
            }
        });
    }
    
    setupCloseButtons() {
        const closeButtons = {
            'close-prompt': 'prompt-modal',
            'close-prompt-mem': 'prompt-mem-modal',
            'close-knowledge': 'knowledge-modal',
            'close-settings': 'settings-modal',
            'close-help': 'help-modal'
        };
        
        Object.entries(closeButtons).forEach(([buttonId, modalId]) => {
            const button = document.getElementById(buttonId);
            if (button) {
                button.replaceWith(button.cloneNode(true));
                const newButton = document.getElementById(buttonId);
                
                newButton.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.closeModalById(modalId);
                });
            }
        });
    }
}

const modalManager = new ModalManager();

// ===== إدارة المحادثة =====
class ConversationManager {
    constructor() {
        this.isProcessing = false;
    }
    
    async sendUserMessage(content) {
        if (this.isProcessing) {
            showNotification('⏳ جاري معالجة الرسالة السابقة...', 'warning');
            return;
        }
        
        this.isProcessing = true;
        
        try {
            const provider = APP_STATE.settings.provider;
            let apiKey = APP_STATE.settings.apiKeys[provider];
            let endpoint = CONFIG.endpoints[provider];
            
            if (!apiKey) {
                showNotification('❌ يرجى إدخال مفتاح API في الإعدادات أولاً', 'error');
                modalManager.openModal('settings-modal');
                return;
            }
            
            this.addMessage('user', content);
            this.renderMessage('user', content);
            
            const input = document.getElementById('user-input');
            if (input) {
                input.value = '';
                input.style.height = 'auto';
            }
            
            const sendBtn = document.getElementById('send-btn');
            if (sendBtn) sendBtn.disabled = true;
            
            const typingIndicator = this.showTypingIndicator();
            
            const systemPrompt = this.buildSystemPrompt(content);
            
            const requestBody = {
                model: APP_STATE.settings.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...APP_STATE.conversation.messages.map(msg => ({
                        role: msg.role,
                        content: msg.content
                    }))
                ],
                stream: false,
                max_tokens: 4000,
                temperature: 0.7
            };
            
            updateConnectionStatus('testing', 'جاري الإرسال...');
            
            console.log('📤 إرسال طلب إلى:', endpoint);
            console.log('🔑 المزود:', provider);
            console.log('🤖 النموذج:', APP_STATE.settings.model);
            
            const response = await proxyManager.fetchWithProxy(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                    'Accept': 'application/json',
                    'User-Agent': 'TasnimSaidAI/4.3'
                },
                body: JSON.stringify(requestBody)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ خطأ في الاستجابة:', response.status, errorText);
                
                try {
                    const errorJson = JSON.parse(errorText);
                    throw new Error(errorJson.error?.message || `HTTP ${response.status}`);
                } catch {
                    throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 100)}`);
                }
            }
            
            const data = await response.json();
            
            if (!data.choices || !data.choices[0]) {
                throw new Error('رد غير متوقع من الخادم');
            }
            
            typingIndicator.remove();
            
            const assistantContent = data.choices[0].message.content;
            await this.streamResponse(assistantContent);
            
            updateConnectionStatus('connected', 'متصل');
            showNotification('✅ تم استلام الرد', 'success');
            
        } catch (error) {
            console.error('خطأ في الإرسال:', error);
            
            const typingIndicator = document.querySelector('.typing-indicator-container');
            if (typingIndicator) typingIndicator.remove();
            
            this.showErrorMessage(error);
            
        } finally {
            this.isProcessing = false;
            const sendBtn = document.getElementById('send-btn');
            if (sendBtn) sendBtn.disabled = false;
            
            const input = document.getElementById('user-input');
            if (input) input.focus();
        }
    }
    
    buildSystemPrompt(userMessage) {
        let prompt = APP_STATE.prompts.system;
        
        if (userMessage.startsWith('11') && APP_STATE.prompts.mem) {
            prompt += `\n\n=== 🔥 وضع MEM النشط ===\n${APP_STATE.prompts.mem}\n=== نهاية وضع MEM ===\n`;
            showNotification('⚡ وضع MEM مفعل', 'info');
        }
        
        if (APP_STATE.knowledge.files.length > 0) {
            prompt += '\n\n=== قاعدة المعرفة ===\n';
            APP_STATE.knowledge.files.forEach(file => {
                prompt += `\n📄 ${file.name}:\n${file.content.substring(0, 1000)}${file.content.length > 1000 ? '...' : ''}\n`;
            });
        }
        
        if (APP_STATE.knowledge.links.length > 0) {
            prompt += '\n\n=== الروابط المرجعية ===\n';
            APP_STATE.knowledge.links.forEach(link => {
                prompt += `\n🔗 ${link.url}\n`;
            });
        }
        
        return prompt;
    }
    
    async streamResponse(content) {
        const words = content.split(' ');
        let displayedText = '';
        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message bot-message';
        messageDiv.innerHTML = `
            <div class="avatar bot-avatar">ذ</div>
            <div class="msg-content" id="streaming-content"></div>
        `;
        
        document.getElementById('chat-history').appendChild(messageDiv);
        const contentDiv = messageDiv.querySelector('#streaming-content');
        
        for (let i = 0; i < words.length; i++) {
            displayedText += (i === 0 ? '' : ' ') + words[i];
            contentDiv.innerHTML = marked.parse(displayedText + (i < words.length - 1 ? '▌' : ''));
            
            scrollToBottom();
            await new Promise(resolve => setTimeout(resolve, 20));
        }
        
        hljs.highlightAll();
        
        this.addMessage('assistant', content);
        
        messageDiv.innerHTML = this.renderMessageHTML('assistant', content);
        hljs.highlightAll();
    }
    
    addMessage(role, content) {
        const message = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            role,
            content,
            timestamp: Date.now()
        };
        
        APP_STATE.conversation.messages.push(message);
        
        if (APP_STATE.conversation.messages.length > 100) {
            APP_STATE.conversation.messages = APP_STATE.conversation.messages.slice(-100);
        }
        
        return message;
    }
    
    renderMessage(role, content) {
        const chatHistory = document.getElementById('chat-history');
        if (!chatHistory) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}-message`;
        messageDiv.innerHTML = this.renderMessageHTML(role, content);
        
        chatHistory.appendChild(messageDiv);
        scrollToBottom();
        
        if (role === 'assistant') {
            hljs.highlightAll();
        }
    }
    
    renderMessageHTML(role, content) {
        const isUser = role === 'user';
        const avatar = isUser ? 
            '<div class="avatar user-avatar"><i class="fa-solid fa-user"></i></div>' :
            '<div class="avatar bot-avatar">ذ</div>';
        
        const parsedContent = isUser ? 
            content.replace(/\n/g, '<br>') :
            marked.parse(content);
        
        return `
            ${avatar}
            <div style="flex:1; min-width:0;">
                <div class="msg-content">${parsedContent}</div>
                <div class="message-actions-row">
                    <button type="button" class="mini-btn" onclick="copyMessageText('${Date.now()}')">
                        <i class="fa-regular fa-copy"></i> نسخ
                    </button>
                    ${isUser ? `
                    <button type="button" class="mini-btn" onclick="editMessage('${Date.now()}')">
                        <i class="fa-solid fa-edit"></i> تعديل
                    </button>
                    ` : ''}
                </div>
            </div>
        `;
    }
    
    showTypingIndicator() {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'typing-indicator-container';
        typingDiv.innerHTML = `
            <div class="message bot-message">
                <div class="avatar bot-avatar">ذ</div>
                <div class="msg-content">
                    <div class="typing-indicator">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('chat-history').appendChild(typingDiv);
        scrollToBottom();
        
        return typingDiv;
    }
    
    showErrorMessage(error) {
        let errorMessage = error.message || 'حدث خطأ غير معروف';
        let solution = '';
        
        if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
            solution = `
                <p><strong>الحلول المقترحة:</strong></p>
                <ol>
                    <li>تفعيل <strong>وضع البروكسي</strong> في الإعدادات</li>
                    <li>التحقق من اتصال الإنترنت</li>
                    <li>اختبار جميع البروكسيات</li>
                </ol>
            `;
        } else if (errorMessage.includes('401') || errorMessage.includes('403')) {
            solution = '<p>تحقق من صحة مفتاح API في الإعدادات</p>';
        } else if (errorMessage.includes('unknown_model')) {
            solution = '<p>غيّر النموذج من القائمة المنسدلة في أعلى الشاشة</p>';
        } else if (errorMessage.includes('429')) {
            solution = '<p>تم تجاوز الحد المسموح، انتظر قليلاً وحاول مرة أخرى</p>';
        }
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'message bot-message';
        
        errorDiv.innerHTML = `
            <div class="avatar bot-avatar" style="background: var(--error);">⚠️</div>
            <div class="msg-content">
                <div class="error-message">
                    <h4><i class="fa-solid fa-exclamation-triangle"></i> خطأ في الاتصال</h4>
                    <p><strong>الخطأ:</strong> ${errorMessage}</p>
                    ${solution}
                    <button type="button" onclick="retryLastMessage()" class="retry-btn">
                        <i class="fa-solid fa-redo"></i> إعادة المحاولة
                    </button>
                </div>
            </div>
        `;
        
        document.getElementById('chat-history').appendChild(errorDiv);
        updateConnectionStatus('error', 'خطأ في الاتصال');
    }
    
    clearConversation() {
        APP_STATE.conversation.messages = [];
        
        const chatHistory = document.getElementById('chat-history');
        if (chatHistory) {
            const welcomeMessage = chatHistory.querySelector('.welcome-message');
            chatHistory.innerHTML = '';
            if (welcomeMessage) {
                chatHistory.appendChild(welcomeMessage);
            }
        }
        
        showNotification('🗑️ تم مسح المحادثة', 'info');
    }
}

const conversationManager = new ConversationManager();

// ===== اختبار الاتصال =====
async function testConnection() {
    const provider = APP_STATE.settings.provider;
    let apiKey = APP_STATE.settings.apiKeys[provider];
    let endpoint = CONFIG.endpoints[provider];
    
    if (!apiKey) {
        showNotification('❌ أدخل مفتاح API أولاً', 'error');
        return false;
    }
    
    updateConnectionStatus('testing', 'جاري اختبار الاتصال...');
    
    try {
        console.log('🔍 اختبار اتصال مع:', provider);
        console.log('🔑 المفتاح:', apiKey.substring(0, 10) + '...');
        
        const response = await proxyManager.fetchWithProxy(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                model: APP_STATE.settings.model,
                messages: [{ role: 'user', content: 'test' }],
                max_tokens: 5
            })
        });
        
        if (response.ok) {
            updateConnectionStatus('connected', 'متصل وجاهز');
            showNotification('✅ الاتصال ناجح!', 'success');
            return true;
        } else {
            const errorText = await response.text();
            console.error('خطأ في الاستجابة:', response.status, errorText);
            
            try {
                const errorJson = JSON.parse(errorText);
                throw new Error(errorJson.error?.message || `HTTP ${response.status}`);
            } catch {
                throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 100)}`);
            }
        }
        
    } catch (error) {
        console.error('اختبار الاتصال فشل:', error);
        
        let errorMsg = 'فشل اختبار الاتصال';
        let solution = '';
        
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            errorMsg = 'مشكلة في الشبكة أو CORS';
            solution = 'جرب تفعيل البروكسي في الإعدادات';
        } else if (error.message.includes('401') || error.message.includes('403')) {
            errorMsg = 'مفتاح API غير صالح أو منتهي';
            solution = 'تحقق من المفتاح في الإعدادات';
        } else if (error.message.includes('unknown_model')) {
            errorMsg = 'النموذج غير معروف';
            solution = 'غيّر النموذج في القائمة المنسدلة';
        } else if (error.message.includes('429')) {
            errorMsg = 'تم تجاوز الحد المسموح';
            solution = 'انتظر قليلاً ثم حاول مرة أخرى';
        }
        
        updateConnectionStatus('error', errorMsg);
        showNotification(`❌ ${errorMsg}${solution ? ` - ${solution}` : ''}`, 'error');
        return false;
    }
}

// ===== إدارة قاعدة المعرفة =====
function setupKnowledgeBase() {
    const addLinkBtn = document.getElementById('add-link-btn');
    const linkInput = document.getElementById('knowledge-link-input');
    
    if (addLinkBtn && linkInput) {
        addLinkBtn.addEventListener('click', () => {
            const url = linkInput.value.trim();
            if (!url) {
                showNotification('❌ أدخل رابطاً صالحاً', 'error');
                return;
            }
            
            try {
                new URL(url);
                APP_STATE.knowledge.links.push({ url, added: Date.now() });
                localStorage.setItem('knowledge_links', JSON.stringify(APP_STATE.knowledge.links));
                renderKnowledgeLists();
                linkInput.value = '';
                showNotification('✅ تمت إضافة الرابط', 'success');
            } catch {
                showNotification('❌ الرابط غير صالح', 'error');
            }
        });
    }
    
    const addActionBtn = document.getElementById('add-action-btn');
    const actionName = document.getElementById('action-name');
    const actionSchema = document.getElementById('action-schema');
    
    if (addActionBtn && actionName && actionSchema) {
        addActionBtn.addEventListener('click', () => {
            const name = actionName.value.trim();
            const schema = actionSchema.value.trim();
            
            if (!name || !schema) {
                showNotification('❌ الاسم والمخطط مطلوبان', 'error');
                return;
            }
            
            APP_STATE.knowledge.actions.push({ name, schema, added: Date.now() });
            localStorage.setItem('knowledge_actions', JSON.stringify(APP_STATE.knowledge.actions));
            renderKnowledgeLists();
            
            actionName.value = '';
            actionSchema.value = '';
            
            showNotification(`✅ تمت إضافة الإجراء: ${name}`, 'success');
        });
    }
    
    const dropZone = document.getElementById('knowledge-drop-zone');
    const fileInput = document.getElementById('knowledge-upload');
    
    if (dropZone && fileInput) {
        dropZone.addEventListener('click', () => fileInput.click());
        
        fileInput.addEventListener('change', (e) => {
            const files = e.target.files;
            Array.from(files).forEach(file => {
                if (file.size > 5 * 1024 * 1024) {
                    showNotification(`❌ الملف ${file.name} كبير جداً (الحد: 5MB)`, 'error');
                    return;
                }
                
                const reader = new FileReader();
                reader.onload = (e) => {
                    APP_STATE.knowledge.files.push({
                        name: file.name,
                        content: e.target.result,
                        size: file.size,
                        type: file.type,
                        added: Date.now()
                    });
                    
                    localStorage.setItem('knowledge_files', JSON.stringify(APP_STATE.knowledge.files));
                    renderKnowledgeLists();
                    showNotification(`✅ تمت إضافة: ${file.name}`, 'success');
                };
                
                reader.readAsText(file);
            });
            
            e.target.value = '';
        });
    }
    
    renderKnowledgeLists();
}

function renderKnowledgeLists() {
    const renderList = (elementId, items, type) => {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        element.innerHTML = '';
        
        items.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'file-item';
            
            let icon = 'fa-file';
            let color = 'var(--text-muted)';
            
            if (type === 'files') {
                icon = getFileIcon(item.name);
                color = getFileColor(item.name);
            } else if (type === 'links') {
                icon = 'fa-link';
                color = 'var(--primary)';
            } else if (type === 'actions') {
                icon = 'fa-bolt';
                color = 'var(--warning)';
            }
            
            div.innerHTML = `
                <span class="file-name">
                    <i class="fa-solid ${icon}" style="color: ${color};"></i>
                    <span>${type === 'files' ? item.name : (type === 'links' ? item.url : item.name)}</span>
                </span>
                <button type="button" class="remove-file" onclick="removeKnowledgeItem('${type}', ${index})">
                    <i class="fa-solid fa-trash"></i>
                </button>
            `;
            
            element.appendChild(div);
        });
        
        if (items.length === 0) {
            element.innerHTML = `
                <div style="text-align: center; padding: 20px; color: var(--text-muted);">
                    <i class="fa-solid fa-inbox"></i>
                    <p>لا توجد عناصر</p>
                </div>
            `;
        }
    };
    
    renderList('knowledge-list-files', APP_STATE.knowledge.files, 'files');
    renderList('knowledge-list-links', APP_STATE.knowledge.links, 'links');
    renderList('knowledge-list-actions', APP_STATE.knowledge.actions, 'actions');
}

window.removeKnowledgeItem = function(type, index) {
    if (type === 'files') {
        APP_STATE.knowledge.files.splice(index, 1);
        localStorage.setItem('knowledge_files', JSON.stringify(APP_STATE.knowledge.files));
    } else if (type === 'links') {
        APP_STATE.knowledge.links.splice(index, 1);
        localStorage.setItem('knowledge_links', JSON.stringify(APP_STATE.knowledge.links));
    } else if (type === 'actions') {
        APP_STATE.knowledge.actions.splice(index, 1);
        localStorage.setItem('knowledge_actions', JSON.stringify(APP_STATE.knowledge.actions));
    }
    
    renderKnowledgeLists();
    showNotification('🗑️ تم الحذف', 'info');
};

function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const icons = {
        txt: 'fa-file-alt',
        md: 'fa-file-alt',
        js: 'fa-file-code',
        json: 'fa-file-code',
        py: 'fa-file-code',
        html: 'fa-file-code',
        css: 'fa-file-code',
        pdf: 'fa-file-pdf',
        doc: 'fa-file-word',
        docx: 'fa-file-word'
    };
    
    return icons[ext] || 'fa-file';
}

function getFileColor(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const colors = {
        js: '#f7df1e',
        json: '#f0db4f',
        py: '#3776ab',
        html: '#e34c26',
        css: '#264de4',
        pdf: '#ff0000',
        doc: '#2b579a',
        docx: '#2b579a'
    };
    
    return colors[ext] || 'var(--text-muted)';
}

// ===== حفظ الإعدادات =====
function saveSettings() {
    const deepseekKey = document.getElementById('deepseek-key');
    const githubKey = document.getElementById('github-key');
    
    if (deepseekKey) {
        APP_STATE.settings.apiKeys.deepseek = deepseekKey.value.trim();
        localStorage.setItem('deepseek_key', APP_STATE.settings.apiKeys.deepseek);
    }
    
    if (githubKey) {
        APP_STATE.settings.apiKeys.github = githubKey.value.trim();
        localStorage.setItem('github_key', APP_STATE.settings.apiKeys.github);
    }
    
    const proxyToggle = document.getElementById('proxy-mode-toggle');
    const proxyType = document.getElementById('proxy-type-select');
    
    if (proxyToggle) {
        APP_STATE.settings.proxy.enabled = proxyToggle.checked;
        localStorage.setItem('proxy_enabled', APP_STATE.settings.proxy.enabled);
    }
    
    if (proxyType) {
        APP_STATE.settings.proxy.mode = proxyType.value;
        localStorage.setItem('proxy_mode', APP_STATE.settings.proxy.mode);
    }
    
    modalManager.closeCurrentModal();
    
    showNotification('✅ تم حفظ الإعدادات', 'success');
    
    setTimeout(async () => {
        if (APP_STATE.settings.proxy.enabled) {
            showNotification('🔄 جاري تحديث البروكسي...', 'info');
            await proxyManager.testProxies();
        }
        
        const apiKey = APP_STATE.settings.apiKeys[APP_STATE.settings.provider];
        if (apiKey) {
            setTimeout(() => testConnection(), 1000);
        }
    }, 500);
}

// ===== وظائف التعليمات =====
function setupPromptEvents() {
    const savePromptBtn = document.getElementById('save-prompt');
    if (savePromptBtn) {
        savePromptBtn.addEventListener('click', () => {
            const input = document.getElementById('system-prompt-input');
            if (input) {
                APP_STATE.prompts.system = input.value.trim();
                localStorage.setItem('system_prompt', APP_STATE.prompts.system);
                modalManager.closeCurrentModal();
                showNotification('✅ تم حفظ التعليمات الأساسية', 'success');
            }
        });
    }
    
    const clearPromptBtn = document.getElementById('clear-prompt');
    if (clearPromptBtn) {
        clearPromptBtn.addEventListener('click', () => {
            const input = document.getElementById('system-prompt-input');
            if (input) {
                input.value = CONFIG.defaults.systemPrompt;
            }
        });
    }
    
    const saveMemPromptBtn = document.getElementById('save-prompt-mem');
    if (saveMemPromptBtn) {
        saveMemPromptBtn.addEventListener('click', () => {
            const input = document.getElementById('system-prompt-mem-input');
            if (input) {
                APP_STATE.prompts.mem = input.value.trim();
                localStorage.setItem('mem_prompt', APP_STATE.prompts.mem);
                modalManager.closeCurrentModal();
                showNotification('✅ تم حفظ تعليمات MEM', 'success');
            }
        });
    }
    
    const clearMemPromptBtn = document.getElementById('clear-prompt-mem');
    if (clearMemPromptBtn) {
        clearMemPromptBtn.addEventListener('click', () => {
            const input = document.getElementById('system-prompt-mem-input');
            if (input) {
                input.value = CONFIG.defaults.memPrompt;
            }
        });
    }
}

// ===== وظائف الواجهة العامة =====
window.copyMessageText = function(messageId) {
    const message = APP_STATE.conversation.messages.find(m => m.id.includes(messageId));
    if (message) {
        navigator.clipboard.writeText(message.content)
            .then(() => showNotification('✅ تم نسخ الرسالة', 'success'))
            .catch(() => showNotification('❌ فشل النسخ', 'error'));
    }
};

window.editMessage = function(messageId) {
    const message = APP_STATE.conversation.messages.find(m => m.id.includes(messageId));
    if (message && message.role === 'user') {
        const input = document.getElementById('user-input');
        input.value = message.content;
        input.focus();
        showNotification('📝 يمكنك تعديل الرسالة الآن', 'info');
    }
};

window.retryLastMessage = function() {
    const lastUserMessage = APP_STATE.conversation.messages
        .filter(msg => msg.role === 'user')
        .pop();
    
    if (lastUserMessage) {
        conversationManager.sendUserMessage(lastUserMessage.content);
    }
};

window.openHelp = function(type) {
    modalManager.openModal('help-modal');
};

window.openSettingsTab = function(tabName) {
    modalManager.openModal('settings-modal');
    
    setTimeout(() => {
        const tab = document.querySelector(`.settings-tab[data-tab="${tabName}"]`);
        if (tab) {
            tab.click();
        }
    }, 50);
};

// ===== تهيئة النظام =====
function initializeSystem() {
    const deepseekKey = document.getElementById('deepseek-key');
    const githubKey = document.getElementById('github-key');
    const systemPrompt = document.getElementById('system-prompt-input');
    const memPrompt = document.getElementById('system-prompt-mem-input');
    const proxyToggle = document.getElementById('proxy-mode-toggle');
    const proxyType = document.getElementById('proxy-type-select');
    
    if (deepseekKey) deepseekKey.value = APP_STATE.settings.apiKeys.deepseek;
    if (githubKey) githubKey.value = APP_STATE.settings.apiKeys.github;
    if (systemPrompt) systemPrompt.value = APP_STATE.prompts.system;
    if (memPrompt) memPrompt.value = APP_STATE.prompts.mem;
    if (proxyToggle) proxyToggle.checked = APP_STATE.settings.proxy.enabled;
    if (proxyType) proxyType.value = APP_STATE.settings.proxy.mode;
    
    updateModelsUI();
    
    const input = document.getElementById('user-input');
    if (input) {
        input.focus();
        
        input.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 200) + 'px';
            
            const sendBtn = document.getElementById('send-btn');
            if (sendBtn) {
                sendBtn.disabled = !this.value.trim();
            }
        });
        
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }
    
    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
        const themeIcon = document.querySelector('#theme-toggle i');
        if (themeIcon) {
            themeIcon.className = 'fa-solid fa-sun';
        }
    }
    
    updateConnectionStatus('disconnected', 'جاهز للاتصال');
    
    if (APP_STATE.settings.proxy.enabled) {
        setTimeout(async () => {
            showNotification('⚡ جاري تهيئة البروكسي...', 'info');
            await proxyManager.testProxies();
        }, 2000);
    }
}

function updateModelsUI() {
    const modelLabel = document.getElementById('current-model-name');
    if (modelLabel) {
        modelLabel.textContent = APP_STATE.settings.model;
    }
}

// ===== الأحداث الرئيسية =====
function setupEventListeners() {
    const sendBtn = document.getElementById('send-btn');
    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }
    
    const newChat = document.getElementById('new-chat-action');
    if (newChat) {
        newChat.addEventListener('click', () => {
            if (confirm('هل تريد بدء محادثة جديدة؟')) {
                conversationManager.clearConversation();
            }
        });
    }
    
    const clearChat = document.getElementById('clear-chat');
    if (clearChat) {
        clearChat.addEventListener('click', () => {
            if (confirm('هل تريد مسح المحادثة الحالية؟')) {
                conversationManager.clearConversation();
            }
        });
    }
    
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const isDark = !document.body.classList.contains('light-mode');
            const newTheme = isDark ? 'light' : 'dark';
            document.body.classList.toggle('light-mode');
            localStorage.setItem('theme', newTheme);
            
            const icon = themeToggle.querySelector('i');
            if (icon) {
                icon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
            }
            
            showNotification(`✅ تم التبديل إلى الوضع ${newTheme === 'dark' ? 'المظلم' : 'الفاتح'}`, 'success');
        });
    }
    
    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            const element = document.getElementById('chat-history');
            if (!element) return;
            
            showNotification('📄 جاري تحضير ملف PDF...', 'info');
            
            const opt = {
                margin: 0.5,
                filename: `محادثة-${new Date().toISOString().slice(0,10)}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2 },
                jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
            };
            
            html2pdf().set(opt).from(element).save().then(() => {
                showNotification('✅ تم تصدير المحادثة', 'success');
            }).catch((error) => {
                console.error('خطأ في التصدير:', error);
                showNotification('❌ فشل تصدير المحادثة', 'error');
            });
        });
    }
    
    const modelSelector = document.getElementById('model-selector-btn');
    const modelDropdown = document.getElementById('model-dropdown');
    
    if (modelSelector && modelDropdown) {
        modelSelector.addEventListener('click', (e) => {
            e.stopPropagation();
            modelDropdown.classList.toggle('hidden');
        });
        
        document.addEventListener('click', () => {
            modelDropdown.classList.add('hidden');
        });
        
        document.querySelectorAll('.dropdown-item').forEach(item => {
            item.addEventListener('click', () => {
                const provider = item.dataset.provider;
                const model = item.dataset.model;
                
                APP_STATE.settings.provider = provider;
                APP_STATE.settings.model = model;
                
                localStorage.setItem('ai_provider', provider);
                localStorage.setItem('ai_model', model);
                
                modelDropdown.classList.add('hidden');
                updateModelsUI();
                
                showNotification(`🔄 تم التبديل إلى ${model}`, 'info');
            });
        });
    }
    
    document.querySelectorAll('.settings-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            const container = this.closest('.settings-container');
            if (!container) return;
            
            container.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
            container.querySelectorAll('.settings-section').forEach(s => s.classList.remove('active'));
            
            this.classList.add('active');
            const sectionId = 'sec-' + this.dataset.tab;
            const section = document.getElementById(sectionId);
            if (section) section.classList.add('active');
        });
    });
    
    const testConnectionBtn = document.getElementById('test-config');
    if (testConnectionBtn) {
        testConnectionBtn.addEventListener('click', () => {
            testConnection();
        });
    }
    
    const saveSettingsBtn = document.getElementById('save-config');
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', saveSettings);
    }
    
    const testProxiesBtn = document.getElementById('test-all-proxies');
    if (testProxiesBtn) {
        testProxiesBtn.addEventListener('click', async () => {
            await proxyManager.testProxies();
        });
    }
    
    const themeDark = document.getElementById('theme-dark');
    const themeLight = document.getElementById('theme-light');
    
    if (themeDark && themeLight) {
        themeDark.addEventListener('click', () => {
            themeDark.classList.add('active');
            themeLight.classList.remove('active');
            document.body.classList.remove('light-mode');
            localStorage.setItem('theme', 'dark');
            showNotification('✅ تم التبديل إلى الوضع المظلم', 'success');
        });
        
        themeLight.addEventListener('click', () => {
            themeLight.classList.add('active');
            themeDark.classList.remove('active');
            document.body.classList.add('light-mode');
            localStorage.setItem('theme', 'light');
            showNotification('✅ تم التبديل إلى الوضع الفاتح', 'success');
        });
    }
    
    document.querySelectorAll('.size-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            const size = this.dataset.size;
            document.body.style.fontSize = size === 'small' ? '14px' : size === 'large' ? '18px' : '16px';
            showNotification(`✅ حجم الخط: ${this.textContent}`, 'success');
        });
    });
    
    document.querySelectorAll('.density-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.density-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            showNotification(`✅ كثافة الرسائل: ${this.textContent}`, 'success');
        });
    });
    
    const resetAppearance = document.getElementById('reset-appearance');
    if (resetAppearance) {
        resetAppearance.addEventListener('click', () => {
            document.body.classList.remove('light-mode');
            localStorage.setItem('theme', 'dark');
            
            document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
            document.querySelector('[data-size="medium"]').classList.add('active');
            document.body.style.fontSize = '16px';
            
            document.querySelectorAll('.density-btn').forEach(b => b.classList.remove('active'));
            document.querySelector('[data-density="normal"]').classList.add('active');
            
            themeDark.classList.add('active');
            themeLight.classList.remove('active');
            
            showNotification('✅ تم إعادة تعيين المظهر', 'success');
        });
    }
}

function sendMessage() {
    const input = document.getElementById('user-input');
    if (!input) return;
    
    const message = input.value.trim();
    if (!message) return;
    
    conversationManager.sendUserMessage(message);
}

// ===== بدء التشغيل =====
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 بدء تحميل نظام تسنيم & سعيد AI - الإصدار 4.3');
    console.log('© 2024 Focalta AI - جميع الحقوق محفوظة');
    
    initializeSystem();
    
    modalManager.setupOpenButtons();
    modalManager.setupCloseButtons();
    
    setupPromptEvents();
    setupKnowledgeBase();
    setupEventListeners();
    
    setTimeout(() => {
        showNotification('🚀 نظام تسنيم & سعيد AI جاهز للعمل!', 'success');
        console.log('✅ النظام محمل وجاهز للعمل');
        
        const apiKey = APP_STATE.settings.apiKeys[APP_STATE.settings.provider];
        if (apiKey) {
            setTimeout(() => testConnection(), 1500);
        }
    }, 1000);
    
    console.log('✅ الواجهة الرئيسية تظهر أولاً');
});