


document.addEventListener('DOMContentLoaded', () => {
    // Глобальный аудиоэлемент
    const audio = document.querySelector('.audio');

    // Глобальная переменная для хранения состояния аудио
    let audioState = {
        playing: false,
        currentTime: 0,
        src: './audio/chains.mp3' // Путь к аудиофайлу
    };

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
                })
                .catch(error => {
                    console.error('Error loading page:', error);
                });
        }
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
