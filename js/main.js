document.addEventListener('DOMContentLoaded', () => {
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
        fetch(page)
            .then(response => response.text())
            .then(html => {
                // Заменяем содержимое wrapper на загруженный контент
                document.querySelector('.wrapper').innerHTML = html;

                // После загрузки страницы обновляем активную кнопку
                updateActiveButton(page);
            })
            .catch(error => {
                console.error('Error loading page:', error);
            });
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

    // Делегирование событий для кнопки воспроизведения аудио
    document.addEventListener('click', (event) => {
        if (event.target.closest('.btn_play')) {
            const audio = document.querySelector('.audio');
            if (audio) {
                if (audio.paused) {
                    audio.play();
                    event.target.innerHTML = '<img class="img__src" src="./img/Pausemini.svg" alt="btn" />'; // Меняем иконку на паузу
                } else {
                    audio.pause();
                    event.target.innerHTML = '<img class="img__src" src="./img/Playmini.svg" alt="btn" />'; // Меняем иконку на воспроизведение
                }
            }
        }
    });

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
});
