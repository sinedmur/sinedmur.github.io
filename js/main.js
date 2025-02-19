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

    // TON Connect (с добавлением проверки на уже зарегистрированный элемент)
    function initializeTonConnect() {
        const tonConnectElement = document.getElementById('ton-connect');
        
        if (tonConnectElement) {
            // Проверяем, зарегистрирован ли уже кастомный элемент 'tc-root'
            if (!customElements.get('tc-root')) {
                // Если элемент не зарегистрирован, инициализируем TonConnect UI
                try {
                    window.tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
                        manifestUrl: 'https://sinedmur.github.io/tonconnect-manifest.json',
                        buttonRootId: 'ton-connect',
                        language: 'ru',
                        uiPreferences: {
                            borderRadius: 's',
                        }
                    });
                    console.log('TON Connect UI initialized successfully');
                } catch (error) {
                    console.error('Error initializing TON Connect UI:', error);
                }
            } else {
                console.log('TON Connect UI is already initialized');
            }
        } else {
            console.error('TON Connect element not found');
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
        'index.html',
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
});
