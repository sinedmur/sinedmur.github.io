document.addEventListener('DOMContentLoaded', () => {
    let audioContext;
    let audioBuffer;
    let sourceNode;
    let isPlaying = false;
    let startTime = 0;
    let pausedAt = 0;
    let gainNode;

    const playButton = document.querySelector('.btn_play');

    async function loadAudio() {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            gainNode = audioContext.createGain();
            gainNode.connect(audioContext.destination);
        }

        if (playButton) {
            playButton.classList.add('loading');
        }

        try {
            const response = await fetch('./audio/chains.mp3');
            const arrayBuffer = await response.arrayBuffer();
            audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            if (playButton) {
                playButton.classList.remove('loading');
            }
        } catch (error) {
            console.error('Error loading audio:', error);
            if (playButton) {
                playButton.classList.remove('loading');
            }
        }
    }

    function createSourceNode() {
        sourceNode = audioContext.createBufferSource();
        sourceNode.buffer = audioBuffer;
        sourceNode.connect(gainNode);
        sourceNode.onended = () => {
            isPlaying = false;
        };
    }

    function playAudio() {
        if (!audioBuffer || isPlaying) return;

        createSourceNode();
        sourceNode.start(0, pausedAt);
        startTime = audioContext.currentTime;
        isPlaying = true;
    }

    function pauseAudio() {
        if (sourceNode && isPlaying) {
            pausedAt += audioContext.currentTime - startTime;
            sourceNode.stop();
            sourceNode.disconnect();
            sourceNode = null;
            isPlaying = false;
        }
    }

    if (playButton) {
        playButton.addEventListener('click', async () => {
            if (!audioBuffer) await loadAudio();
            if (isPlaying) {
                pauseAudio();
                playButton.innerHTML = '<img class="img__src" src="./img/Playmini.svg" alt="btn" />';
            } else {
                playAudio();
                playButton.innerHTML = '<img class="img__src" src="./img/Pausemini.svg" alt="btn" />';
            }
        });
    }
    loadAudio();

    // Telegram Auth
    function initializeTelegramAuth() {
        if (typeof Telegram !== 'undefined' && Telegram.WebApp) {
            const webApp = Telegram.WebApp;
            const user = webApp.initDataUnsafe.user;
            if (user) {
                localStorage.setItem('userAvatar', user.photo_url);
                displayUserInfo();
            } else {
                console.error('User data is not available');
            }
        } else {
            console.error('Telegram Web App is not available');
        }
    }

    function displayUserInfo() {
        const avatarElement = document.getElementById('avatar');
        const userAvatar = localStorage.getItem('userAvatar');
        if (avatarElement) {
            avatarElement.src = userAvatar || './img/token.svg';
            avatarElement.style.display = 'block';
        }
    }

    initializeTelegramAuth();
    displayUserInfo();

    // TON Connect
    function initializeTonConnect() {
        const connectButton = document.querySelector('.connect__container');

        if (!connectButton) {
            console.error('TON Connect button not found');
            return;
        }

        if (!window.tonConnectUI) {
            window.tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
                manifestUrl: 'https://sinedmur.github.io/tonconnect-manifest.json',
                language: 'ru',
                uiPreferences: {
                    borderRadius: 's',
                }
            });

            // Проверка наличия сохраненного адреса в localStorage
            const savedAddress = localStorage.getItem('tonWalletAddress');
            if (savedAddress) {
                // Адрес кошелька уже сохранён, обновляем UI
                updateWalletUI(savedAddress);
            } else {
                // Если адреса нет, инициируем подключение
                window.tonConnectUI.onStatusChange((wallet) => {
                    if (wallet) {
                        // Сохраняем адрес кошелька в localStorage
                        localStorage.setItem('tonWalletAddress', wallet.account.address);
                        updateWalletUI(wallet.account.address);
                    } else {
                        resetWalletUI();
                    }
                });
            }
        }

        connectButton.addEventListener('click', async () => {
            try {
                // Проверка, если кошелек уже подключен
                const wallet = await window.tonConnectUI.connectWallet();
                if (wallet) {
                    // Сохраняем адрес кошелька в localStorage
                    localStorage.setItem('tonWalletAddress', wallet.account.address);
                    updateWalletUI(wallet.account.address);
                }
            } catch (error) {
                console.error('Ошибка при подключении кошелька:', error);
            }
        });
    }

    function updateWalletUI(address) {
        const connectContainer = document.querySelector('.connect__container');
        const addressContainer = document.querySelector('.address__container');

        if (connectContainer) connectContainer.style.display = 'none';
        if (addressContainer) {
            addressContainer.style.display = 'flex';
            // Применяем функцию для преобразования TON-адреса
            addressContainer.querySelector('.address').textContent = formatTonAddress(address);
        }
    }

    function resetWalletUI() {
        const connectContainer = document.querySelector('.connect__container');
        const addressContainer = document.querySelector('.address__container');

        if (connectContainer) connectContainer.style.display = 'flex';
        if (addressContainer) addressContainer.style.display = 'none';
    }

    // Функция для преобразования HEX в Base64
    function hexToBase64(hex) {
        const bytes = Uint8Array.from(Buffer.from(hex, 'hex'));
        return base64url(bytes);
    }

    // Функция для кодирования в Base64 URL-safe формат
    function base64url(bytes) {
        const base64 = btoa(String.fromCharCode.apply(null, bytes));
        return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    // Функция для преобразования HEX адреса в читаемый TON-адрес
    function formatTonAddress(address) {
        try {
            // Если адрес уже в нужном формате, возвращаем его как есть
            if (address.startsWith('UQC')) {
                return address;
            }

            // Убираем префикс "0:", если он есть
            if (address.startsWith('0:')) {
                address = address.slice(2);
            }

            // Проверяем, если адрес в HEX формате
            if (address.length === 64) {
                // Преобразуем HEX в Base64
                const base64Address = hexToBase64(address);
                return base64Address;
            }

            // Если это не HEX адрес, возвращаем его как есть
            return address;
        } catch (error) {
            console.error('Ошибка форматирования TON-адреса:', error);
            return address; // Возвращаем исходный адрес в случае ошибки
        }
    }

    // Подключаем TonConnect после загрузки каждой страницы
    function loadPage(page) {
        if (pageCache[page]) {
            updateContent(pageCache[page]);
            updateActiveButton(page);
            if (page === 'wallet.html') {
                initializeTonConnect(); // Инициализация TonConnect для страницы wallet.html
            }
        } else {
            console.error(`Page ${page} not found in cache`);
        }
        displayUserInfo();
        // Обновление состояния кошелька на каждой странице
        const savedAddress = localStorage.getItem('tonWalletAddress');
        if (savedAddress) {
            updateWalletUI(savedAddress);
        } else {
            resetWalletUI();
        }
    }

    initializeTonConnect();

    // Загрузка страниц
    const pageCache = {};

    // Список всех страниц для предварительной загрузки
    const pagesToPreload = [
        'missions.html',
        'buy.html',
        'settings.html',
        'home.html',
        'music.html',
        'airdrop.html',
        'friends.html',
        'wallet.html'
    ];

    // Функция для предварительной загрузки всех страниц
    async function preloadPages() {
        try {
            const fetchPromises = pagesToPreload.map(async (page) => {
                const response = await fetch(page);
                const html = await response.text();
                const parser = new DOMParser();
                const newDocument = parser.parseFromString(html, 'text/html');
                const newContent = newDocument.querySelector('.mainmenu');
                if (newContent) {
                    pageCache[page] = newContent.innerHTML;
                } else {
                    console.error(`Mainmenu content not found in ${page}`);
                }
            });

            await Promise.all(fetchPromises);
            console.log('All pages preloaded successfully!');
        } catch (error) {
            console.error('Error preloading pages:', error);
        }
    }

    // Делегирование событий для кнопок с data-page
    document.addEventListener('click', (event) => {
        const button = event.target.closest('[data-page]');
        if (button) {
            const page = button.getAttribute('data-page');
            loadPage(page);
        }
    });

    // Загрузка страницы
    function loadPage(page) {
        if (pageCache[page]) {
            updateContent(pageCache[page]);
            updateActiveButton(page);
            if (page === 'wallet.html') {
                initializeTonConnect(); // Инициализация TonConnect для страницы wallet.html
            }
        } else {
            console.error(`Page ${page} not found in cache`);
        }
        displayUserInfo();
    }

    // Обновление контента
    function updateContent(content) {
        const mainmenu = document.querySelector('.mainmenu');
        if (mainmenu) {
            mainmenu.innerHTML = content;
        }
    }

    // Обновление активной кнопки
    function updateActiveButton(page) {
        const buttons = document.querySelectorAll('[data-page]');
        buttons.forEach(button => {
            const img = button.querySelector('img');
            if (img) {
                img.src = img.getAttribute('data-default');
            }
        });

        const activeButton = document.querySelector(`[data-page="${page}"]`);
        if (activeButton) {
            const img = activeButton.querySelector('img');
            if (img) {
                img.src = img.getAttribute('data-active');
            }
        }
    }

    // Предварительная загрузка всех страниц при загрузке сайта
    preloadPages().then(() => {
        // Определение текущей страницы
        const currentPage = window.location.pathname.split('/').pop();
        updateActiveButton(currentPage);
    });

    // Использование MutationObserver для отслеживания появления элемента с классом .refresh
    const observer = new MutationObserver(() => {
        const refreshButton = document.querySelector('.refresh');

        if (refreshButton) {
            refreshButton.addEventListener('click', function () {
                // Добавляем класс для вращения картинки внутри кнопки
                this.classList.add('rotate');
    
                // Убираем класс через время, чтобы анимация могла повториться
                setTimeout(() => {
                    this.classList.remove('rotate');
                }, 500);  // Это время должно совпадать с длительностью анимации
            });
        }
    });

    // Начинаем наблюдение за изменениями в DOM
    observer.observe(document.body, { childList: true, subtree: true });
});
