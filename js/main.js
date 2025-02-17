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
                // localStorage.setItem('userName', user.first_name);

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
        // const userName = localStorage.getItem('userName');
    
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
    
        // Отображаем имя пользователя только один раз
        if (userName && userInfoElement) {
            // Проверяем, есть ли уже элемент с именем пользователя
            if (!userInfoElement.querySelector('p')) {
                const userNameElement = document.createElement('p'); // Создаем элемент для имени пользователя
                userNameElement.textContent = userName;
                userInfoElement.appendChild(userNameElement); // Добавляем имя пользователя
            }
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

            // Убедитесь, что старый экземпляр уничтожен (если это возможно)
            if (window.tonConnectUI) {
                window.tonConnectUI = null;
            }

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
                // Получаем текущее значение value
                let currentValue = parseInt(valueDisplay.textContent, 10);
                // Увеличиваем значение на 10
                currentValue += 10;
                // Обновляем отображаемое значение
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
            const page = button.getAttribute('data-page'); // Получаем значение атрибута data-page
            loadPage(page); // Загружаем страницу
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
            // Используем закэшированный контент
            updateContent(pageCache[page]);
            restoreAudioState();
            updateActiveButton(page);
            setupPlayPauseButton();
        } else {
            // Загружаем контент страницы, если его нет в кэше
            fetch(page)
                .then(response => response.text())
                .then(html => {
                    // Парсим загруженный HTML
                    const parser = new DOMParser();
                    const newDocument = parser.parseFromString(html, 'text/html');
                    const newContent = newDocument.querySelector('.mainmenu'); // Извлекаем только нужный контент

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

    // Остальные функции (updateContent, restoreAudioState, updateActiveButton, setupPlayPauseButton) остаются без изменений

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
                audio.play(); // Воспроизводим аудио, если оно было запущено
            }
        }
    }

    // Функция для обновления активной кнопки
    function updateActiveButton(page) {
        // Убираем активное состояние у всех кнопок
        buttons.forEach(button => {
            const img = button.querySelector('img');
            if (img) {
                // Возвращаем исходное изображение для неактивных кнопок
                const defaultSrc = img.getAttribute('data-default');
                img.src = defaultSrc;
            }
        });

        // Находим кнопку, соответствующую текущей странице, и меняем её изображение
        const activeButton = document.querySelector(`[data-page="${page}"]`);
        if (activeButton) {
            const img = activeButton.querySelector('img');
            if (img) {
                // Устанавливаем активное изображение
                const activeSrc = img.getAttribute('data-active');
                img.src = activeSrc;
            }
        }
    }
    // Функция для настройки кнопки воспроизведения/паузы
    function setupPlayPauseButton() {
        const playButton = document.querySelector('.btn_play');

        if (playButton && audio) {
            // Обновляем иконку кнопки в зависимости от состояния аудио
            const updateButtonIcon = () => {
                if (audio.paused) {
                    playButton.innerHTML = '<img class="img__src" src="./img/Playmini.svg" alt="btn" />'; // Иконка воспроизведения
                } else {
                    playButton.innerHTML = '<img class="img__src" src="./img/Pausemini.svg" alt="btn" />'; // Иконка паузы
                }
            };

            // Обновляем иконку при загрузке страницы
            updateButtonIcon();

            // Добавляем обработчик для кнопки воспроизведения/паузы
            playButton.addEventListener('click', () => {
                if (audio.paused) {
                    audio.play();
                } else {
                    audio.pause();
                }
                updateButtonIcon(); // Обновляем иконку после изменения состояния
            });

            // Обновляем иконку при изменении состояния аудио
            audio.addEventListener('play', updateButtonIcon);
            audio.addEventListener('pause', updateButtonIcon);
        }
    }

    // Делегирование событий для кнопки следующего трека
    document.addEventListener('click', (event) => {
        if (event.target.closest('.btn_next')) {
            // Здесь можно добавить логику для переключения на следующий трек
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
