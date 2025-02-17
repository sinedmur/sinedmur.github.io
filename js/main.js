document.addEventListener('DOMContentLoaded', () => {
    // Аудио-логика (оставьте без изменений, если она работает)
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
        if (isPlaying) return;

        sourceNode = audioContext.createBufferSource();
        sourceNode.buffer = audioBuffer;
        sourceNode.connect(gainNode);
        startTime = audioContext.currentTime;
        sourceNode.start(0, pausedAt);
        isPlaying = true;

        sourceNode.onended = () => {
            isPlaying = false;
            pausedAt = 0;
        };
    }

    function pauseAudio() {
        if (sourceNode && isPlaying) {
            pausedAt = audioContext.currentTime - startTime;
            sourceNode.stop();
            sourceNode.disconnect();
            sourceNode = null;
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
    const buttons = document.querySelectorAll('[data-page]');

    // Обработчик для кнопок с data-page
    function handlePageButtonClick(event) {
        const page = event.currentTarget.getAttribute('data-page');
        loadPage(page);
    }

    // Инициализация кнопок
    function initializePageButtons() {
        buttons.forEach(button => {
            button.removeEventListener('click', handlePageButtonClick); // Удаляем старый обработчик
            button.addEventListener('click', handlePageButtonClick); // Добавляем новый
        });
    }

    // Загрузка страницы
    function loadPage(page) {
        if (pageCache[page]) {
            updateContent(pageCache[page]);
            updateActiveButton(page);
        } else {
            fetch(page)
                .then(response => response.text())
                .then(html => {
                    const parser = new DOMParser();
                    const newDocument = parser.parseFromString(html, 'text/html');
                    const newContent = newDocument.querySelector('.mainmenu');
                    if (newContent) {
                        pageCache[page] = newContent.innerHTML;
                        updateContent(newContent.innerHTML);
                        updateActiveButton(page);
                        initializePageButtons(); // Переинициализируем кнопки после загрузки новой страницы
                        setTimeout(() => {
                            initializeTonConnect();
                        }, 100);
                    } else {
                        console.error('Mainmenu content not found in the loaded page');
                    }
                })
                .catch(error => {
                    console.error('Error loading page:', error);
                });
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

    // Инициализация кнопок при загрузке страницы
    initializePageButtons();

    // Определение текущей страницы
    const currentPage = window.location.pathname.split('/').pop();
    updateActiveButton(currentPage);
});
