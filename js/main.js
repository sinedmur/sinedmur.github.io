document.addEventListener('DOMContentLoaded', () => {
    // Инициализация Telegram Web App
    function initializeTelegramAuth() {
        if (typeof Telegram !== 'undefined' && Telegram.WebApp) {
            const webApp = Telegram.WebApp;

            // Получаем данные пользователя
            const user = webApp.initDataUnsafe.user;

            if (user) {
                // Сохраняем данные пользователя в localStorage
                localStorage.setItem('userAvatar', user.photo_url);

                // Отображаем аватарку пользователя
                displayUserInfo();
            } else {
                console.error('User data is not available');
            }
        } else {
            console.error('Telegram Web App is not available');
        }
    }

    // Функция для отображения аватарки и имени пользователя
    function displayUserInfo() {
        const avatarElement = document.getElementById('avatar');
        const userInfoElement = document.getElementById('user-info');

        // Получаем данные из localStorage
        const userAvatar = localStorage.getItem('userAvatar');

        // Если аватарка есть, используем её, иначе — заглушку
        if (avatarElement) {
            if (userAvatar) {
                avatarElement.src = userAvatar;
            } else {
                // Устанавливаем заглушку для аватарки
                avatarElement.src = './img/token.svg'; // Путь к изображению-заглушке
            }
            avatarElement.style.display = 'block'; // Показываем элемент
        }
    }

    // Инициализация Telegram Auth при загрузке страницы
    initializeTelegramAuth();

    // Отображаем данные пользователя при каждой загрузке страницы
    displayUserInfo();

    // Инициализация TON Connect
    function initializeTonConnect() {
        const tonConnectElement = document.getElementById('ton-connect');
        if (tonConnectElement) {
            console.log('TON Connect element found:', tonConnectElement);

            // Создаем новый экземпляр TON Connect
            window.tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
                manifestUrl: 'https://sinedmur.github.io/tonconnect-manifest.json',
                buttonRootId: 'ton-connect'
            });

            console.log('TON Connect initialized');
        } else {
            console.error('TON Connect element not found');
        }
    }

    // Инициализация при первой загрузке страницы
    initializeTonConnect();

    // Глобальный аудиоэлемент
    const audio = document.querySelector('.audio');

    // Глобальная переменная для хранения состояния аудио
    let audioState = {
        playing: false,
        currentTime: 0,
        src: './audio/chains.mp3' // Путь к аудиофайлу
    };

    // Находим элемент для отображения значения value
    const valueDisplay = document.querySelector('.value');

    // Обработчик события завершения воспроизведения аудио
    if (audio) {
        audio.addEventListener('ended', () => {
            if (valueDisplay) {
                let currentValue = parseInt(valueDisplay.textContent, 10);
                currentValue += 10;
                valueDisplay.textContent = currentValue;
            }
        });
    }

    // Кэш для хранения загруженных страниц
    const pageCache = {};

    // Находим все кнопки с атрибутом data-page
    const buttons = document.querySelectorAll('[data-page]');

    // Добавляем обработчик событий для каждой кнопки
    buttons.forEach(button => {
        button.addEventListener('click', () => {
            const page = button.getAttribute('data-page');
            loadPage(page);
        });
    });

    // Функция для загрузки страницы
    function loadPage(page) {
        // Сохраняем состояние аудио перед загрузкой нового контента
        if (audio) {
            audioState.playing = !audio.paused;
            audioState.currentTime = audio.currentTime;
        }

        // Проверяем, есть ли страница в кэше
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

                    // Сохраняем загруженный контент в кэше
                    pageCache[page] = newContent.innerHTML;

                    // Обновляем содержимое страницы
                    updateContent(newContent.innerHTML);

                    // Восстанавливаем состояние аудио после загрузки нового контента
                    restoreAudioState();

                    // После загрузки страницы обновляем активную кнопку
                    updateActiveButton(page);

                    // Настраиваем кнопку воспроизведения/паузы
                    setupPlayPauseButton();

                    // Инициализация TON Connect с задержкой
                    setTimeout(() => {
                        initializeTonConnect();
                    }, 100); // Задержка 100 мс
                })
                .catch(error => {
                    console.error('Error loading page:', error);
                });
        }

        // Восстанавливаем данные пользователя после загрузки новой страницы
        displayUserInfo();
    }

    // Функция для обновления содержимого страницы
    function updateContent(content) {
        const mainmenu = document.querySelector('.mainmenu');
        if (mainmenu) {
            mainmenu.innerHTML = content;
        }
    }

    // Функция для восстановления состояния аудио
    function restoreAudioState() {
        if (audio) {
            audio.currentTime = audioState.currentTime; // Восстанавливаем текущее время
            if (audioState.playing) {
                audio.play().catch(() => {
                    console.warn('Failed to resume audio playback.');
                });
            }
        }
    }

    // Функция для обновления активной кнопки
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

    // Функция для настройки кнопки воспроизведения/паузы
    function setupPlayPauseButton() {
        const playButton = document.querySelector('.btn_play');

        if (playButton && audio) {
            const updateButtonIcon = () => {
                if (audio.paused) {
                    playButton.innerHTML = '▶️'; // Иконка воспроизведения
                } else {
                    playButton.innerHTML = '⏸️'; // Иконка паузы
                }
            };

            updateButtonIcon();

            playButton.addEventListener('click', () => {
                if (audio.paused) {
                    audio.play();
                } else {
                    audio.pause();
                }
                updateButtonIcon();
            });

            audio.addEventListener('play', updateButtonIcon);
            audio.addEventListener('pause', updateButtonIcon);
        }
    }

    // Делегирование событий для кнопки следующего трека
    document.addEventListener('click', (event) => {
        if (event.target.closest('.btn_next')) {
            console.log('Next track');
        }
    });

    // Делегирование событий для кнопок навигации в undermenu
    document.addEventListener('click', (event) => {
        if (event.target.closest('[data-page]')) {
            const button = event.target.closest('[data-page]');
            const page = button.getAttribute('data-page');
            loadPage(page);
        }
    });

    // При загрузке страницы обновляем активную кнопку
    const currentPage = window.location.pathname.split('/').pop();
    updateActiveButton(currentPage);

    // Восстанавливаем состояние аудио при первой загрузке страницы
    restoreAudioState();

    // Настраиваем кнопку воспроизведения/паузы при первой загрузке страницы
    setupPlayPauseButton();
});
