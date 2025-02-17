document.addEventListener('DOMContentLoaded', () => {
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

    const audio = document.querySelector('.audio');
    
    function saveAudioState() {
        if (audio) {
            sessionStorage.setItem('audioTime', audio.currentTime);
            sessionStorage.setItem('audioPlaying', !audio.paused);
        }
    }

    function restoreAudioState() {
        if (!audio) return;

        const savedTime = sessionStorage.getItem('audioTime');
        const wasPlaying = sessionStorage.getItem('audioPlaying') === 'true';

        if (savedTime) {
            audio.currentTime = parseFloat(savedTime);
        }
        
        if (wasPlaying) {
            audio.play().catch(err => console.warn('Playback error:', err));
        }
    }

    if (audio) {
        restoreAudioState();
        audio.addEventListener('timeupdate', saveAudioState);
    }

    const pageCache = {};
    const buttons = document.querySelectorAll('[data-page]');

    buttons.forEach(button => {
        button.addEventListener('click', () => {
            const page = button.getAttribute('data-page');
            saveAudioState();
            loadPage(page);
        });
    });

    function loadPage(page) {
        if (pageCache[page]) {
            updateContent(pageCache[page]);
            restoreAudioState();
            updateActiveButton(page);
            setupPlayPauseButton();
        } else {
            fetch(page)
                .then(response => response.text())
                .then(html => {
                    const parser = new DOMParser();
                    const newDocument = parser.parseFromString(html, 'text/html');
                    const newContent = newDocument.querySelector('.mainmenu');
                    pageCache[page] = newContent.innerHTML;
                    updateContent(newContent.innerHTML);
                    restoreAudioState();
                    updateActiveButton(page);
                    setupPlayPauseButton();
                    setTimeout(() => initializeTonConnect(), 100);
                })
                .catch(error => console.error('Error loading page:', error));
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

    function setupPlayPauseButton() {
        const playButton = document.querySelector('.btn_play');
        if (playButton && audio) {
            const updateButtonIcon = () => {
                playButton.innerHTML = audio.paused ?
                    '<img class="img__src" src="./img/Playmini.svg" alt="btn" />' :
                    '<img class="img__src" src="./img/Pausemini.svg" alt="btn" />';
            };

            updateButtonIcon();
            playButton.addEventListener('click', () => {
                audio.paused ? audio.play() : audio.pause();
                updateButtonIcon();
            });

            audio.addEventListener('play', updateButtonIcon);
            audio.addEventListener('pause', updateButtonIcon);
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
            saveAudioState();
            loadPage(page);
        }
    });

    const currentPage = window.location.pathname.split('/').pop();
    updateActiveButton(currentPage);
    restoreAudioState();
    setupPlayPauseButton();
});
