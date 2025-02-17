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

    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    let audioBuffer;
    let audioSource;
    let startTime = 0;
    let pausedTime = 0;
    let isPlaying = false;
    let gainNode = audioContext.createGain();

    async function loadAudio() {
        try {
            const response = await fetch('./audio/chains.mp3');
            const arrayBuffer = await response.arrayBuffer();
            audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        } catch (error) {
            console.error('Error loading audio:', error);
        }
    }

    function playAudio() {
        if (isPlaying || !audioBuffer) return;
        audioSource = audioContext.createBufferSource();
        audioSource.buffer = audioBuffer;
        audioSource.connect(gainNode);
        gainNode.connect(audioContext.destination);
        audioSource.start(0, pausedTime);
        startTime = audioContext.currentTime - pausedTime;
        isPlaying = true;
        updatePlayButton();
        
        audioSource.onended = () => {
            isPlaying = false;
            pausedTime = 0;
            updatePlayButton();
        };
    }

    function pauseAudio() {
        if (!isPlaying) return;
        pausedTime += audioContext.currentTime - startTime;
        audioSource.stop();
        isPlaying = false;
        updatePlayButton();
    }

    function updatePlayButton() {
        const playButton = document.querySelector('.btn_play');
        if (playButton) {
            playButton.innerHTML = isPlaying
                ? '<img class="img__src" src="./img/Pausemini.svg" alt="Pause" />'
                : '<img class="img__src" src="./img/Playmini.svg" alt="Play" />';
        }
    }

    const playButton = document.querySelector('.btn_play');
    if (playButton) {
        playButton.addEventListener('click', () => {
            if (isPlaying) {
                pauseAudio();
            } else {
                if (audioContext.state === 'suspended') {
                    audioContext.resume().then(playAudio);
                } else {
                    playAudio();
                }
            }
        });
    }

    loadAudio();

    const pageCache = {};
    const buttons = document.querySelectorAll('[data-page]');
    buttons.forEach(button => {
        button.addEventListener('click', () => {
            loadPage(button.getAttribute('data-page'));
        });
    });

    function loadPage(page) {
        if (pageCache[page]) {
            updateContent(pageCache[page]);
            updateActiveButton(page);
            setTimeout(() => initializeTonConnect(), 100);
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
            if (img) img.src = img.getAttribute('data-default');
        });
        const activeButton = document.querySelector(`[data-page="${page}"]`);
        if (activeButton) {
            const img = activeButton.querySelector('img');
            if (img) img.src = img.getAttribute('data-active');
        }
    }
});
