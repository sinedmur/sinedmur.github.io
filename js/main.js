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
                updateWalletUI(savedAddress); // Обновляем UI с сохраненным адресом
            } else {
                // Если адреса нет, инициируем подключение
                window.tonConnectUI.onStatusChange((wallet) => {
                    if (wallet) {
                        console.log('Received wallet address:', wallet.account.address);
                        localStorage.setItem('tonWalletAddress', wallet.account.address);
                        updateWalletUI(wallet.account.address);
                    } else {
                        resetWalletUI();
                        localStorage.removeItem('tonWalletAddress');
                    }
                });
            }
        }

        connectButton.addEventListener('click', async () => {
            try {
                const wallet = await window.tonConnectUI.connectWallet();
                if (wallet) {
                    console.log('Received wallet address:', wallet.account.address);
                    localStorage.setItem('tonWalletAddress', wallet.account.address);
                    updateWalletUI(wallet.account.address);
                }
            } catch (error) {
                console.error('Ошибка при подключении кошелька:', error);
            }
        });
    }

    // Функция для получения non-bounceable адреса
async function getNonBounceableAddress(address) {
    try {
        const response = await fetch(`https://dton.io/api/address/${address}`);
        const data = await response.json();

        if (data && data.success && data.mainnet && data.mainnet.base64urlsafe && data.mainnet.base64urlsafe.non_bounceable) {
            return data.mainnet.base64urlsafe.non_bounceable;
        } else {
            console.error('Non-bounceable address not found in response:', data);
            return address; // Возвращаем исходный адрес, если non-bounceable адрес не найден
        }
    } catch (error) {
        console.error('Error fetching non-bounceable address:', error);
        return address; // Возвращаем исходный адрес в случае ошибки
    }
}

// Функция для сокращения адреса
function shortenAddress(address) {
    const start = address.slice(0, 6); // Первые 6 символов
    const end = address.slice(-4); // Последние 4 символа
    return `${start}...${end}`;
}

// Функция для копирования текста в буфер обмена
function copyToClipboard(text) {
    navigator.clipboard.writeText(text)
        .then(() => {
            console.log('Адрес скопирован:', text);
            showCopyFeedback(); // Показываем обратную связь
        })
        .catch((error) => {
            console.error('Ошибка при копировании:', error);
        });
}

// Функция для отображения обратной связи
function showCopyFeedback() {
    const copyButton = document.querySelector('.copymini');
    if (copyButton) {
        // Меняем иконку на "галочку"
        copyButton.innerHTML = '<img src="./img/Checkmark.svg" alt="Copied" />';

        // Возвращаем исходную иконку через 2 секунды
        setTimeout(() => {
            copyButton.innerHTML = '<img src="./img/copymini.svg" alt="Copy" />';
        }, 2000);
    }
}

// Функция для обновления UI с адресом кошелька
async function updateWalletUI(address) {
    const connectContainer = document.querySelector('.connect__container');
    const addressContainer = document.querySelector('.address__container');

    if (connectContainer) connectContainer.style.display = 'none'; // Скрываем кнопку подключения
    if (addressContainer) {
        addressContainer.style.display = 'flex'; // Показываем контейнер с адресом
        const nonBounceableAddress = await getNonBounceableAddress(address); // Получаем non-bounceable адрес
        const shortAddress = shortenAddress(nonBounceableAddress); // Сокращаем адрес
        addressContainer.querySelector('.address').textContent = shortAddress; // Выводим сокращенный адрес
        addressContainer.querySelector('.address').title = nonBounceableAddress; // Добавляем полный адрес в подсказку
    }
}

// Обработчик события для кнопки copymini
document.addEventListener('click', (event) => {
    const copyButton = event.target.closest('.copymini');
    if (copyButton) {
        const addressContainer = document.querySelector('.address__container');
        if (addressContainer) {
            const fullAddress = addressContainer.querySelector('.address').title; // Получаем полный адрес из атрибута title
            if (fullAddress) {
                copyToClipboard(fullAddress); // Копируем адрес
            } else {
                console.error('Полный адрес не найден');
            }
        }
    }
});
    // Функция для сброса UI кошелька
    function resetWalletUI() {
        const connectContainer = document.querySelector('.connect__container');
        const addressContainer = document.querySelector('.address__container');

        if (connectContainer) connectContainer.style.display = 'flex'; // Показываем кнопку подключения
        if (addressContainer) addressContainer.style.display = 'none'; // Скрываем контейнер с адресом
    }

    // Функция для отключения кошелька
    function disconnectWallet() {
        if (window.tonConnectUI) {
            window.tonConnectUI.disconnect();
            localStorage.removeItem('tonWalletAddress');
            resetWalletUI();
            console.log('Кошелек отключен');
        } else {
            console.error('TON Connect UI не инициализирован');
        }
    }

    // Делегирование события для кнопки с классом trash__container
    document.addEventListener('click', (event) => {
        const trashButton = event.target.closest('.trash__container');
        if (trashButton) {
            disconnectWallet();
        }
    });


    // Инициализация TonConnect и обновление UI при каждом переходе
    function updateUI() {
        const savedAddress = localStorage.getItem('tonWalletAddress');
        if (savedAddress) {
            updateWalletUI(savedAddress);
        } else {
            resetWalletUI();
        }
    
        if (window.tonConnectUI) {
            window.tonConnectUI.getWallet().then((wallet) => {
                if (wallet) {
                    localStorage.setItem('tonWalletAddress', wallet.account.address);
                    updateWalletUI(wallet.account.address);
                } else {
                    resetWalletUI();
                    localStorage.removeItem('tonWalletAddress');
                }
            }).catch((error) => {
                console.error("Ошибка при проверке состояния кошелька:", error);
            });
        }
    }

    // Обновляем UI при каждом переходе на страницу
    updateUI();

    // Инициализация TonConnect
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
            updateUI(); // Проверяем подключение кошелька после загрузки страницы
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
