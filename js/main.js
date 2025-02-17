document.addEventListener('DOMContentLoaded', () => {
    let audioContext;
    let audioBuffer;
    let sourceNode;
    let isPlaying = false;
    let startTime = 0;
    let pausedAt = 0;
    let gainNode;

    async function loadAudio() {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            gainNode = audioContext.createGain();
            gainNode.connect(audioContext.destination);
        }
        const response = await fetch('./audio/chains.mp3');
        const arrayBuffer = await response.arrayBuffer();
        audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    }

    function playAudio() {
        if (!audioBuffer) return;

        // Если аудио уже воспроизводится, ничего не делаем
        if (isPlaying) return;

        // Создаем новый источник
        sourceNode = audioContext.createBufferSource();
        sourceNode.buffer = audioBuffer;
        sourceNode.connect(gainNode);

        // Начинаем воспроизведение с сохраненной позиции
        startTime = audioContext.currentTime - pausedAt; // Исправлено: учитываем pausedAt
        sourceNode.start(0, pausedAt); // Начинаем с сохраненной позиции
        isPlaying = true;

        // Обработка завершения воспроизведения
        sourceNode.onended = () => {
            isPlaying = false;
            pausedAt = 0; // Сбрасываем позицию воспроизведения
        };
    }

    function pauseAudio() {
        if (sourceNode && isPlaying) {
            // Сохраняем текущую позицию воспроизведения
            pausedAt = audioContext.currentTime - startTime; // Исправлено: сохраняем корректное значение
            sourceNode.stop();
            sourceNode.disconnect();
            sourceNode = null; // Удаляем ссылку на источник
            isPlaying = false;
        }
    }

    const playButton = document.querySelector('.btn_play');
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

    // Telegram Auth (оставьте без изменений, если это не связано с проблемой)
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

    // TON Connect (оставьте без изменений, если это не связано с проблемой)
    function initializeTonConnect() {
        const tonConnectElement = document.getElementById('ton-connect');
        if (tonConnectElement) {
            if (window.tonConnectUI) {
                window.tonConnectUI = null;
            }
            window.tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
                manifestUrl: 'https://sinedmur.github.io/tonconnect-manifest.json',
                buttonRootId: 'ton-connect'
            });
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
