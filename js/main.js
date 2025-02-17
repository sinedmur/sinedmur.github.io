document.addEventListener('DOMContentLoaded', () => {
    // Инициализация Telegram Web App
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

    // Используем Web Audio API для непрерывного воспроизведения
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    let audioBuffer;
    let sourceNode;
    let startTime = 0;
    let pausedAt = 0;
    let isPlaying = false;

    async function loadAudio() {
        if (!audioBuffer) {
            const response = await fetch('./audio/chains.mp3');
            const arrayBuffer = await response.arrayBuffer();
            audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        }
    }

    async function playAudio() {
        if (!audioBuffer) {
            await loadAudio();
        }
        if (sourceNode) {
            sourceNode.stop();
        }
        sourceNode = audioContext.createBufferSource();
        sourceNode.buffer = audioBuffer;
        sourceNode.connect(audioContext.destination);
        startTime = audioContext.currentTime - pausedAt;
        sourceNode.start(0, pausedAt);
        isPlaying = true;

        sourceNode.onended = () => {
            isPlaying = false;
            pausedAt = 0;
        };
    }

    function pauseAudio() {
        if (sourceNode) {
            sourceNode.stop();
            pausedAt += audioContext.currentTime - startTime;
            isPlaying = false;
        }
    }

    document.querySelector('.btn_play')?.addEventListener('click', () => {
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
        isPlaying ? pauseAudio() : playAudio();
    });

    const pageCache = {};
    const buttons = document.querySelectorAll('[data-page]');
    
    buttons.forEach(button => {
        button.addEventListener('click', () => {
            const page = button.getAttribute('data-page');
            loadPage(page);
        });
    });

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
                    pageCache[page] = newContent.innerHTML;
                    updateContent(newContent.innerHTML);
                    updateActiveButton(page);
                    setTimeout(() => {
                        initializeTonConnect();
                    }, 100);
                })
                .catch(error => {
                    console.error('Error loading page:', error);
                });
        }
        displayUserInfo();
    }

    function updateContent(content) {
        const mainmenu = document.querySelector('.mainmenu');
        if (mainmenu) {
            mainmenu.innerHTML = content;
        }
    }

    function updateActiveButton(page) {
        buttons.forEach(button => {
            const img = button.querySelector('img');
            if (img) {
                const defaultSrc = img.getAttribute('data-default');
                img.src = defaultSrc;
            }
        });

        const activeButton = document.querySelector(`[data-page="${page}"]`);
        if (activeButton) {
            const img = activeButton.querySelector('img');
            if (img) {
                const activeSrc = img.getAttribute('data-active');
                img.src = activeSrc;
            }
        }
    }

    document.addEventListener('click', (event) => {
        if (event.target.closest('.btn_next')) {
            console.log('Next track');
        }
    });

    document.addEventListener('click', (event) => {
        if (event.target.closest('[data-page]')) {
            const button = event.target.closest('[data-page]');
            const page = button.getAttribute('data-page');
            loadPage(page);
        }
    });

    const currentPage = window.location.pathname.split('/').pop();
    updateActiveButton(currentPage);
    loadAudio();
});
