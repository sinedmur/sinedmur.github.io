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

    // Глобальные переменные для Web Audio API
    let audioContext;
    let audioSource;
    let audioBuffer;
    let isPlaying = false;
    let currentTime = 0;

    // Инициализация AudioContext
    function initializeWebAudio() {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    // Загрузка аудиофайла
    function loadAudioFile(src) {
        return fetch(src)
            .then(response => response.arrayBuffer())
            .then(arrayBuffer => audioContext.decodeAudioData(arrayBuffer))
            .then(buffer => {
                audioBuffer = buffer;
            })
            .catch(error => console.error('Ошибка при загрузке аудио:', error));
    }

    // Воспроизведение аудио
    function playAudio() {
        if (!audioBuffer) return;

        if (!audioSource || audioSource.state === 'stopped') {
            audioSource = audioContext.createBufferSource();
            audioSource.buffer = audioBuffer;
            audioSource.connect(audioContext.destination);

            // Установка начального времени воспроизведения
            audioSource.start(0, currentTime);
            isPlaying = true;
        }
    }

    // Пауза аудио
    function pauseAudio() {
        if (audioSource) {
            currentTime = audioContext.currentTime - audioSource.context.currentTime + currentTime;
            audioSource.stop();
            isPlaying = false;
        }
    }

    // Обновление состояния кнопки
    function updatePlayPauseButton(button) {
        if (isPlaying) {
            button.innerHTML = '<img class="img__src" src="./img/Pausemini.svg" alt="btn" />'; // Иконка паузы
        } else {
            button.innerHTML = '<img class="img__src" src="./img/Playmini.svg" alt="btn" />'; // Иконка воспроизведения
        }
    }

    // Обработчик завершения воспроизведения
    function onAudioEnded() {
        isPlaying = false;
        currentTime = 0;

        const valueDisplay = document.querySelector('.value');
        if (valueDisplay) {
            let currentValue = parseInt(valueDisplay.textContent, 10) || 0;
            valueDisplay.textContent = currentValue + 10;
        }

        updatePlayPauseButton(document.querySelector('.btn_play'));
    }

    // Кэш для хранения загруженных страниц
    const pageCache = {};

    // Находим все кнопки с атрибутом data-page
    const buttons = document.querySelectorAll('[data-page]');

    // Добавляем обработчик событий для каждой кнопки
    buttons.forEach(button => {
        button.addEventListener('click', () => {
            const page = button.getAttribute('data-page'); // Получаем значение атрибута data-page
            loadPage(page); // Загружаем страницу
        });
    });

    // Функция для загрузки страницы
    function loadPage(page) {
        // Сохраняем состояние аудио перед загрузкой нового контента
        if (isPlaying) {
            pauseAudio(); // Приостанавливаем воспроизведение, но сохраняем состояние
        }

        // Проверяем, есть ли страница в кэше
        if (pageCache[page]) {
            updateContent(pageCache[page]);
            restoreAudioState(); // Восстанавливаем состояние аудио
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
        if (audioBuffer && !isPlaying) {
            playAudio();
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

        if (playButton) {
            const updateButtonIcon = () => {
                if (isPlaying) {
                    playButton.innerHTML = '<img class="img__src" src="./img/Pausemini.svg" alt="btn" />'; // Иконка паузы
                } else {
                    playButton.innerHTML = '<img class="img__src" src="./img/Playmini.svg" alt="btn" />'; // Иконка воспроизведения
                }
            };

            // Обновляем иконку при загрузке страницы
            updateButtonIcon();

            // Добавляем обработчик для кнопки воспроизведения/паузы
            playButton.addEventListener('click', () => {
                if (isPlaying) {
                    pauseAudio();
                } else {
                    playAudio();
                }
                updateButtonIcon(); // Обновляем иконку после изменения состояния
            });
        }
    }

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

    // Инициализация Web Audio API
    initializeWebAudio();
    loadAudioFile('./audio/chains.mp3').then(() => {
        console.log('Аудио загружено');
    });

    // Настраиваем кнопку воспроизведения/паузы при первой загрузке страницы
    setupPlayPauseButton();

    // Устанавливаем обработчик завершения воспроизведения
    if (audioSource) {
        audioSource.onended = onAudioEnded;
    }
});
