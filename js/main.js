document.addEventListener('DOMContentLoaded', () => {

    const activeBtn = document.querySelector('.active_btn');
    const completeBtn = document.querySelector('.complete_btn');
    const activeContainer = document.querySelector('.active__container');
    const completeContainer = document.querySelector('.complete__container');

    // Проверяем, что элементы существуют
    if (activeBtn && completeBtn && activeContainer && completeContainer) {

        // Обработчик для кнопки active_btn
        activeBtn.addEventListener('click', () => {
            activeContainer.classList.remove('hidden'); // Показываем active__container
            completeContainer.classList.add('hidden'); // Скрываем complete__container
        });

        // Обработчик для кнопки complete_btn
        completeBtn.addEventListener('click', () => {
            completeContainer.classList.remove('hidden'); // Показываем complete__container
            activeContainer.classList.add('hidden'); // Скрываем active__container
        });
    }

    if (window.Telegram && window.Telegram.WebApp && Telegram.WebApp.lockOrientation) {
        Telegram.WebApp.lockOrientation(); // Блокируем ориентацию
    } else {
        console.error("Метод lockOrientation недоступен.");
    }
    
    if (window.Telegram && window.Telegram.WebApp && Telegram.WebApp.disableVerticalSwipes) {
  Telegram.WebApp.disableVerticalSwipes(); // Блокируем вертикальные свайпы
} else {
  console.error("Метод disableVerticalSwipes недоступен.");
}
   // Проверяем, что Telegram WebApp API доступен
if (window.Telegram && window.Telegram.WebApp) {
    // Получаем информацию о платформе
    const platform = Telegram.WebApp.platform;
  
    // Если платформа мобильная (android, ios), включаем полноэкранный режим
    if (platform === 'android' || platform === 'ios') {
      if (Telegram.WebApp.requestFullscreen) {
        Telegram.WebApp.requestFullscreen();
      } else {
        console.error("Метод requestFullscreen() недоступен.");
      }
    } 
  } else {
    console.error("Telegram WebApp API недоступен.");
  }

  let audioContext;
  let audioBuffer;
  let sourceNode;
  let isPlaying = false;
  let startTime = 0;
  let pausedAt = 0;
  let gainNode;
  let valueNormal = 0;  // Переменная для отслеживания обычного value
  let valueSpecial = 0; // Переменная для отслеживания value при открытом контейнере
  let lastUpdateTime = 0;  // Время последнего обновления value
  let wasContainerOpen = false;  // Флаг для отслеживания состояния контейнера
  let valueUpdateInterval = null; // Глобальная переменная для хранения таймера
  const valueDisplay = document.querySelector('.balanc .value'); // Элемент для отображения значения value (с учетом вашего HTML)
  const valueDisplayMini = document.querySelector('.balances .value');
  const song = document.querySelector('.song');
  const audioContainer = document.querySelector('.audio__container');
  const playerContainer = document.querySelector('.player__container');
  const undermenuContainer = document.querySelector('.undermenu__container'); // Основной плеер
  let touchStartY = 0;
  let touchEndY = 0;
  let touchStartX = 0;
  let touchEndX = 0;

  function updateValue() {

    if (playerContainer.classList.contains('show')) {
        // Большой плеер открыт - начисляем в специальное значение
        valueSpecial += 3;  // Коэффициент начисления при открытом плеере
    } else {
        // Маленький плеер - обычное начисление
        valueNormal += 1;
    }

    updateValuesInDOM();
}

function startValueUpdate() {
    if (valueUpdateInterval) clearInterval(valueUpdateInterval); // Убираем старый интервал
    lastUpdateTime = audioContext.currentTime; // Фиксируем момент старта
    valueUpdateInterval = setInterval(updateValue, 1000); // Обновляем каждую секунду
}

function stopValueUpdate() {
    if (valueUpdateInterval) {
        clearInterval(valueUpdateInterval);
        valueUpdateInterval = null;
    }
}

  function updateValuesInDOM() {
    valueDisplay.textContent = valueNormal + valueSpecial;
    valueDisplayMini.textContent = valueNormal + valueSpecial;
}
  
function handleBackButtonPageNavigation() {
    if (audioContainer && playerContainer && undermenuContainer) {
        audioContainer.classList.remove('hidden');
        playerContainer.classList.remove('show');
        undermenuContainer.classList.remove('hidden');
    }
        Telegram.WebApp.BackButton.hide();
}

  if (audioContainer && playerContainer) {
      song.addEventListener('click', function () {
        expandPlayer();
      });
  }

  // Обработчик для начала свайпа в audio__container (если мы находимся в маленьком плеере)
  audioContainer.addEventListener('touchstart', (e) => {
      touchStartY = e.changedTouches[0].screenY;
      touchStartX = e.changedTouches[0].screenX;
  });

  // Обработчик для завершения свайпа в audio__container (если мы находимся в маленьком плеере)
  audioContainer.addEventListener('touchend', (e) => {
      touchEndY = e.changedTouches[0].screenY;
      touchEndX = e.changedTouches[0].screenX;
      handleSwipeFromAudioContainer();
      handleSwipeNextAudioContainer();
      handleSwipePrevAudioContainer();
  });

  // Обработчик для начала свайпа в player__container (если мы в большом плеере)
  playerContainer.addEventListener('touchstart', (e) => {
      touchStartY = e.changedTouches[0].screenY;
  });

  // Обработчик для завершения свайпа в player__container (если мы в большом плеере)
  playerContainer.addEventListener('touchend', (e) => {
      touchEndY = e.changedTouches[0].screenY;
      handleSwipeFromPlayerContainer();
  });

  // Функция для обработки свайпа из audio__container
  function handleSwipeFromAudioContainer() {
      if (touchStartY - touchEndY > 50) {  // Свайп вверх
          expandPlayer();  // Разворачиваем плеер
      }
  }

  function handleSwipeNextAudioContainer() {
    if (touchStartX - touchEndX > 50) {  // Свайп вверх
        if (isPlaying) pauseAudio();
        playNextTrack();
    }
}

function handleSwipePrevAudioContainer() {
    if (touchEndX - touchStartX > 50) {  // Свайп вверх
        if (isPlaying) pauseAudio();
        playPrevSwipeTrack();
    }
}

  // Функция для обработки свайпа из player__container
  function handleSwipeFromPlayerContainer() {
      if (touchEndY - touchStartY > 50) {  // Свайп вниз
          collapsePlayer();  // Сворачиваем плеер
      }
  }

  // Функция для открытия плеера
  function expandPlayer() {
      if (audioContainer && playerContainer && undermenuContainer) {
          audioContainer.classList.add('hidden');  // Скрываем маленькое окно
          playerContainer.classList.add('show');  // Показываем плеер
          undermenuContainer.classList.add('hidden');
          Telegram.WebApp.BackButton.show();
      }
  }

  // Функция для сворачивания плеера
  function collapsePlayer() {
      if (audioContainer && playerContainer && undermenuContainer) {
          audioContainer.classList.remove('hidden');  // Показываем маленькое окно
          playerContainer.classList.remove('show');  // Скрываем плеер
          undermenuContainer.classList.remove('hidden');
          Telegram.WebApp.BackButton.hide();
      }
  }
  
  const playButton = document.querySelector('.btn_play');
  const playButton2 = document.querySelector('.play_btn');
  const nextButton = document.querySelector('.btn_next');
  const progressBar = document.querySelector('.progress');
  const progressBarMini = document.querySelector('.progressmini');
  const timeDisplay = document.querySelector('.time'); // Для отображения текущего времени
  const endTimeDisplay = document.querySelector('.end__time'); // Для отображения полного времени
  let endTime = 0;
  let isManualStop = false;
  let reverseState = 0; // Состояние кнопки reverse_btn: 0 - исходное, 1 - один трек, 2 - плейлист
  let isRandom = false; // Флаг для random режима
  
  // Обновляем отображение сохраненных значений
  updateValuesInDOM();
  const reverseBtn = document.querySelector('.reverse_btn'); // Кнопка reverse
  const randomBtn = document.querySelector('.random_btn');   // Кнопка random
  const reverseSrc = document.querySelector('.reverse__src'); // Изображение внутри reverse_btn
  const randomSrc = document.querySelector('.random__src'); // Изображение внутри random_btn
  
  reverseBtn.addEventListener('click', () => {
    reverseState = (reverseState + 1) % 2; // Переключаем состояния: 0 -> 1 -> 2 -> 0

    switch (reverseState) {
        case 0:
            // В исходное состояние
            reverseSrc.src = './img/Reverse.svg'; // Исходное изображение
            break;
        case 1:
            // Воспроизводим один и тот же трек
            reverseSrc.src = './img/ReverseOne.svg'; // Изображение для одного трека
            break;
    }
});
  
  randomBtn.addEventListener('click', () => {
      isRandom = !isRandom; // Переключаем флаг random
  
      if (isRandom) {
          randomSrc.src = './img/RandomOn.svg'; // Активное изображение
          shufflePlaylist(); // Перемешиваем плейлист
      } else {
          randomSrc.src = './img/Random.svg'; // Неактивное изображение
          resetPlaylistOrder(); // Возвращаем порядок плейлиста в исходное состояние
          remainingTracks = []; // Очищаем список оставшихся треков
      }
      updatePlayPauseButtons(); // Обновляем кнопки в зависимости от состояния
  });

  let remainingTracks = [];

// Функция для перемешивания плейлиста
function shufflePlaylist() {
    // Инициализируем массив с индексами всех треков
    remainingTracks = currentPlaylist.map((_, index) => index);

    // Перемешиваем этот массив
    for (let i = remainingTracks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [remainingTracks[i], remainingTracks[j]] = [remainingTracks[j], remainingTracks[i]]; // Меняем местами
    }
}

function resetPlaylistOrder() {
    // Восстанавливаем порядок треков в плейлисте
    currentPlaylist.sort((a, b) => {
        return a.src.localeCompare(b.src); // Сортируем по пути к файлам, чтобы вернуть исходный порядок
    });
}

  const playlist = [
    {
        src: './audio/track1.mp3',
        cover: './img/cover1.jpeg',
        title: 'Нас не догонят',
        author: 'S1NTEZ',
        feat: '',
        songautors: ''
    },
    {
        src: './audio/track2.mp3',
        cover: './img/cover2.jpg',
        title: 'Вера в любовь',
        author: 'S1NTEZ',
        feat: '',
        songautors: ''
    },
    {
        src: './audio/track3.mp3',
        cover: './img/cover3.jpg',
        title: 'Услышь',
        author: 'S1NTEZ',
        feat: 'feat.',
        songautors: 'Asper'
    },
    {
        src: './audio/track4.mp3',
        cover: './img/cover4.jpg',
        title: 'Покурим на двоих',
        author: 'S1NTEZ',
        feat: 'feat.',
        songautors: 'Asper'
    }
];
let myMusicTracks = []; // Массив для хранения индексов добавленных треков
let prevButtonPressedOnce = false; // Флаг для отслеживания первого нажатия
let currentPlaylist = playlist; // По умолчанию используем основной плейлист
let currentTrackIndex = 0;
const coverElement = document.querySelector('.cover__src');   // Картинка обложки
const trackTitleElement = document.querySelector('.songname'); // Заголовок трека
const trackAuthorElement = document.querySelector('.songautor'); // Автор трека
const trackFeatElement = document.querySelector('.feat');
const trackAuthorsElement = document.querySelector('.songautors'); // Автор трека
const trackAuthorElement2 = document.querySelector('.songautor2'); // Автор трека
const trackFeatElement2 = document.querySelector('.feat2');
const trackAuthorsElement2 = document.querySelector('.songautors2'); // Автор трека
const trackTitleElement2 = document.querySelector('.songtitle'); // Заголовок трека 2
const nextBtn = document.querySelector('.next_btn');
const nextBtn2 = document.querySelector('.btn_next');
const prevBtn = document.querySelector('.prev_btn');

nextBtn.addEventListener('click', async () => {
    if (isPlaying) pauseAudio();
    await playNextTrack();
});
nextBtn2.addEventListener('click', async () => {
    if (isPlaying) pauseAudio();
    await playNextTrack();
});

prevBtn.addEventListener('click', async () => {
    if (isPlaying) pauseAudio();
    await playPrevTrack();
});

async function playNextTrack() {
    console.log("Current playlist:", currentPlaylist === playlist ? "Main playlist" : "MyMusicTracks");
    console.log("Current track index:", currentTrackIndex);
    console.log("Track to play:", currentPlaylist[currentTrackIndex].title);
    console.log("Playing next track from:", currentPlaylist === playlist ? "Main playlist" : "MyMusicTracks"); // Отладка
    if (isRandom) {
        if (remainingTracks.length === 0) {
            shufflePlaylist(); // Если все треки проиграны, перемешиваем снова
        }
        const randomIndex = remainingTracks.pop(); // Берем последний (случайный) трек из оставшихся
        currentTrackIndex = randomIndex;
    } else {
        // Переключаем на следующий трек в текущем плейлисте
        currentTrackIndex = (currentTrackIndex + 1) % currentPlaylist.length;
    }
    console.log("Next track index:", currentTrackIndex, "Track:", currentPlaylist[currentTrackIndex].title); // Отладка
    console.log("Playing next track from currentPlaylist. Index:", currentTrackIndex); // Отладка
    pausedAt = 0;
    await loadAudio(currentTrackIndex); // Загружаем выбранный трек
    playAudio(); // Воспроизводим его
    updatePlayPauseButtons();
}

async function playPrevTrack() {
    console.log("Current playlist:", currentPlaylist === playlist ? "Main playlist" : "MyMusicTracks");
    console.log("Current track index:", currentTrackIndex);
    console.log("Track to play:", currentPlaylist[currentTrackIndex].title);
    if (prevButtonPressedOnce) {
        // Второе нажатие — переключаем трек
        currentTrackIndex = (currentTrackIndex - 1 + currentPlaylist.length) % currentPlaylist.length;
        prevButtonPressedOnce = false; // Сбрасываем флаг
    } else {
        // Первое нажатие — просто начинаем текущий трек сначала
        prevButtonPressedOnce = true;

        // Ждем короткий промежуток времени для двойного нажатия (например, 1 сек)
        setTimeout(() => {
            prevButtonPressedOnce = false; // Если за 1 сек не нажали ещё раз, сбрасываем
        }, 2000);
    }

    console.log("Playing previous track from currentPlaylist. Index:", currentTrackIndex); // Отладка
    pausedAt = 0;
    await loadAudio(currentTrackIndex);
    playAudio();
    updatePlayPauseButtons();
}

async function playPrevSwipeTrack() {
    currentTrackIndex = (currentTrackIndex - 1 + currentPlaylist.length) % currentPlaylist.length;
    prevButtonPressedOnce = false; // Сбрасываем флаг
    pausedAt = 0;
    await loadAudio(currentTrackIndex);
    playAudio();
    updatePlayPauseButtons();
}

let audioBuffers = {}; // кэш всех загруженных буферов
const CACHE_LIMIT = 5;   // Сколько треков максимум держим в кэше

async function loadAudio(trackIndex = 0) {
    const track = currentPlaylist[trackIndex]; // Используем текущий плейлист

    if (!track) {
        console.error("Track not found in current playlist!"); // Проверка наличия трека
        return;
    }

    console.log("Loading track from currentPlaylist. Index:", trackIndex, "Track:", track.title); // Отладка
    console.log("Track source:", track.src); // Отладка: проверяем источник аудио

    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        gainNode = audioContext.createGain();
        gainNode.connect(audioContext.destination);
    }

    if (playButton && playButton2) {
        playButton.classList.add('loading');
        playButton2.classList.add('loading');
    }

    try {
        if (audioBuffers[trackIndex]) {
            // Берём из кэша
            console.log("Using cached audio buffer for track:", track.title); // Отладка
            audioBuffer = audioBuffers[trackIndex];
        } else {
            // Загружаем с нуля
            console.log("Fetching audio for track:", track.title); // Отладка
            const response = await fetch(track.src);
            const arrayBuffer = await response.arrayBuffer();
            audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            audioBuffers[trackIndex] = audioBuffer; // сохраняем в кэш
        }

        endTime = audioBuffer.duration;

        const totalMinutes = Math.floor(endTime / 60);
        const totalSeconds = Math.floor(endTime % 60);
        endTimeDisplay.textContent = `${totalMinutes}:${totalSeconds < 10 ? '0' + totalSeconds : totalSeconds}`;

        // Обновляем UI
        updateTrackInfo(track); // Обновляем интерфейс

        playButton.classList.remove('loading');
        playButton2.classList.remove('loading');

        // Предзагружаем соседние треки
        preloadTrack(trackIndex - 2);
        preloadTrack(trackIndex - 1);
        preloadTrack(trackIndex + 1);
        preloadTrack(trackIndex + 2);

        // Очищаем кэш, чтобы не разрастался
        cleanupCache(trackIndex);

    } catch (error) {
        console.error('Error loading audio:', error);
        playButton.classList.remove('loading');
        playButton2.classList.remove('loading');
    }
}

// Предзагрузка трека по индексу
async function preloadTrack(index) {
    if (index < 0 || index >= currentPlaylist.length) return;

    if (audioBuffers[index]) return; // Уже в кэше

    try {
        const track = currentPlaylist[index];
        const response = await fetch(track.src);
        const arrayBuffer = await response.arrayBuffer();
        const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);

        audioBuffers[index] = decodedBuffer;
        console.log(`Предзагружен трек #${index + 1}: ${track.title}`);
    } catch (error) {
        console.warn(`Не удалось предзагрузить трек #${index + 1}`, error);
    }
}

// Очистка кэша — оставляем только 5 треков вокруг текущего
function cleanupCache(currentIndex) {
    const allowedIndexes = new Set([
        currentIndex - 2,
        currentIndex - 1,
        currentIndex,
        currentIndex + 1,
        currentIndex + 2
    ]);

    for (const index in audioBuffers) {
        if (!allowedIndexes.has(Number(index))) {
            delete audioBuffers[index];
        }
    }
}

function createSourceNode() {
    console.log("Creating source node for track:", currentPlaylist[currentTrackIndex].title); // Отладка
    console.log("Audio buffer source:", audioBuffer); // Отладка: проверяем буфер
    sourceNode = audioContext.createBufferSource();
    sourceNode.buffer = audioBuffer;
    sourceNode.connect(gainNode);
    
    // Обработчик окончания трека
    sourceNode.onended = async () => {
        if (isManualStop) {
            isManualStop = false;  // Сбрасываем флаг, чтобы следующий запуск работал корректно
            return;  // Просто выходим, не переключаем трек
        }
        
        if (reverseState === 1) {  // Если режим "Один трек"
            // Воспроизводим текущий трек заново
            isPlaying = false;
            updateProgress();
            await loadAudio(currentTrackIndex);  // Перезагружаем текущий трек
            playAudio();  // Воспроизводим заново
        } else {
            isPlaying = false;
            updateProgress();
            await playNextTrack();  // Переход к следующему треку, если не в режиме "Один трек"
        }
    };
}

function playAudio() {
    if (!audioBuffer || isPlaying) return;
    console.log("Playing track:", currentPlaylist[currentTrackIndex].title); // Отладка
    createSourceNode();
    sourceNode.start(0, pausedAt);
    startTime = audioContext.currentTime;
    isPlaying = true;
    updatePlayPauseButtons();
    requestAnimationFrame(updateProgress);
    startValueUpdate(); // Останавливаем начисление value при паузе
}

function pauseAudio() {
    if (sourceNode && isPlaying) {
        isManualStop = true;  // Помечаем, что это ручная остановка
        pausedAt += audioContext.currentTime - startTime;
        sourceNode.stop();
        sourceNode.disconnect();
        sourceNode = null;
        isPlaying = false;
        updatePlayPauseButtons();
        lastUpdateTime = 0;  // Сбрасываем метку времени последнего обновления
        updateValuesInDOM();
        stopValueUpdate(); // Останавливаем начисление value при паузе
    }
}

function updateProgress() {
    if (!isPlaying || !audioBuffer) return;

    const currentTime = (audioContext.currentTime - startTime) + pausedAt;
    const duration = audioBuffer.duration;
    const progress = (currentTime / duration) * 100;

    progressBar.style.width = `${progress}%`;
    progressBarMini.style.width = `${progress}%`;

    // Обновляем отображение времени
    const minutes = Math.floor(currentTime / 60);
    const seconds = Math.floor(currentTime % 60);
    timeDisplay.textContent = `${minutes}:${seconds < 10 ? '0' + seconds : seconds}`;

    // Проверяем, если прошло 1 секунда или больше с последнего обновления
    if (currentTime - lastUpdateTime >= 1) {
        lastUpdateTime = currentTime;  // Обновляем метку времени

        if (playerContainer.classList.contains('show')) {
            // Если контейнер открыт, начисляем 2 балла за секунду
            valueSpecial += 3;
        } else {
            // Если контейнер не открыт, начисляем 1 балл за секунду
            valueNormal += 1;
        }
        updateValuesInDOM();
    }

    if (isPlaying) {
        requestAnimationFrame(updateProgress);
    }
}

if (playButton && playButton2 && nextButton) {
    playButton.addEventListener('click', async () => {
        if (!audioBuffer) await loadAudio();
        if (isPlaying) {
            pauseAudio();
        } else {
            playAudio();
        }
        updatePlayPauseButtons();  // <-- вызываем тут
    });

    playButton2.addEventListener('click', async () => {
        if (!audioBuffer) await loadAudio();
        if (isPlaying) {
            pauseAudio();
        } else {
            playAudio();
        }
        updatePlayPauseButtons();  // <-- и тут тоже
    });
}

function updatePlayPauseButtons() {
    if (isPlaying) {
        playButton.innerHTML = '<img class="img__src" src="./img/Pausemini.svg" alt="btn" />';
        playButton2.innerHTML = '<img class="play__src" src="./img/Pause.svg" alt="btn" />';
        nextButton.innerHTML = '<img class="img__close" src="./img/Nextmini.svg" alt="btn" />';
    } else {
        playButton.innerHTML = '<img class="img__src" src="./img/Playmini.svg" alt="btn" />';
        playButton2.innerHTML = '<img class="play__src" src="./img/Play.svg" alt="btn" />';
        nextButton.innerHTML = '<img class="img__close" src="./img/Like.svg" alt="btn" />';
    }

    // Обновляем изображения для reverse_btn и random_btn
    if (reverseState === 1) {
        reverseSrc.src = './img/ReverseOne.svg'; // Изображение для одного трека
    } else {
        reverseSrc.src = './img/Reverse.svg'; // Исходное изображение
    }

    if (isRandom) {
        randomSrc.src = './img/RandomOn.svg'; // Активное изображение для random
    } else {
        randomSrc.src = './img/Random.svg'; // Неактивное изображение для random
    }
}

loadAudio();

function switchToMainPlaylist() {
    currentPlaylist = playlist;
    currentTrackIndex = 0; // Сбрасываем индекс трека
}


const addBtn = document.querySelector('.add_btn');

addBtn.addEventListener('click', () => {
    addTrackToMusicPage(currentTrackIndex);
});

function addTrackToMusicPage(trackIndex) {
    const track = currentPlaylist[trackIndex]; // Получаем трек из основного плейлиста

    if (!track) {
        console.error("Track not found in playlist!"); // Проверка наличия трека
        return;
    }

    // Создаем глубокую копию объекта трека
    const trackCopy = JSON.parse(JSON.stringify(track)); // Глубокая копия

    // Добавляем копию трека в myMusicTracks
    myMusicTracks.push(trackCopy); // Добавляем объект трека в массив

    console.log("Added track to myMusicTracks:", trackCopy); // Отладка
    console.log("myMusicTracks:", myMusicTracks); // Отладка

    // Обновляем интерфейс
    const newTrack = document.createElement('div');
    newTrack.classList.add('track1');

    newTrack.innerHTML = 
        `<div class="cover1"><img src="${trackCopy.cover}" alt="cover"></div>
         <div class="song2">
             <div class="songtitle">${trackCopy.title}</div>
             <div class="authors">
                 <div class="songautor">${trackCopy.author}</div>
                 <div class="feat">${trackCopy.feat}</div>
                 <div class="songautors">${trackCopy.songautors}</div>
             </div>
         </div>
         <div class="duration">${formatTime(audioBuffer.duration)}</div>
         <div class="info"><img src="./img/info.svg" alt="info"></div>`;

    // Добавляем обработчик события на клик по треку
    newTrack.addEventListener('click', () => {
        console.log("Clicked track:", trackCopy); // Отладка
        playTrackFromMusicPage(trackCopy); // Передаем копию трека
    });

    const myMusicContainer = document.querySelector('.mymusic__container');
    myMusicContainer.appendChild(newTrack);
}

async function playTrackFromMusicPage(track) {
    console.log("Current playlist:", currentPlaylist === playlist ? "Main playlist" : "MyMusicTracks");
    console.log("Current track index:", currentTrackIndex);
    console.log("Track to play:", currentPlaylist[currentTrackIndex].title);
    console.log("Playing track from myMusicTracks:", track); // Отладка

    if (!track) {
        console.error("Track is undefined!"); // Проверка объекта трека
        return;
    }
    audioBuffers = {}; // Очищаем кэш
    // Находим индекс трека в myMusicTracks
    const trackIndex = myMusicTracks.indexOf(track);

    if (trackIndex === -1) {
        console.error("Track not found in myMusicTracks!"); // Проверка наличия трека
        return;
    }

    if (currentTrackIndex === trackIndex && currentPlaylist === myMusicTracks) {
        // Если нажали на тот же трек в пользовательском плейлисте
        if (isPlaying) {
            pauseAudio();
        } else {
            playAudio();
        }
    } else {
        // Если нажали на другой трек
        if (isPlaying) {
            pauseAudio();
        }
        pausedAt = 0; // Сбрасываем позицию воспроизведения
        currentPlaylist = myMusicTracks; // Переключаемся на пользовательский плейлист
        currentTrackIndex = trackIndex; // Обновляем текущий индекс трека

        console.log("Switched to myMusicTracks. Current index:", currentTrackIndex); // Отладка

        // Обновляем интерфейс перед загрузкой аудио
        updateTrackInfo(track);

        // Загружаем выбранный трек
        await loadAudio(currentTrackIndex);

        // Воспроизводим трек
        playAudio();
    }
    updatePlayPauseButtons();
}

function updateTrackInfo(track) {

    if (!track) {
        console.error("Track is undefined!");
        return;
    }

    if (!coverElement || !trackTitleElement || !trackAuthorElement) {
        console.error("DOM elements are missing!");
        return;
    }

    coverElement.src = track.cover;
    trackTitleElement.textContent = track.title;
    trackTitleElement2.textContent = track.title;
    trackAuthorElement.textContent = track.author;
    trackAuthorElement2.textContent = track.author;
    trackFeatElement.textContent = track.feat;
    trackAuthorsElement.textContent = track.songautors;
    trackFeatElement2.textContent = track.feat;
    trackAuthorsElement2.textContent = track.songautors;

    coverElement.onload = applyColor;
}

function formatTime(duration) {
    const minutes = Math.floor(duration / 60);
    const seconds = Math.floor(duration % 60);
    return `${minutes}:${seconds < 10 ? '0' + seconds : seconds}`;
}
  

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
              console.error('Non-bounceable address not found or not processed yet:', data);
              return null; // Возвращаем null, если адрес не был обработан
          }
      } catch (error) {
          console.error('Error fetching non-bounceable address:', error);
          return null; // Возвращаем null в случае ошибки
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
      const nonBounceableAddress = await getNonBounceableAddress(address); // Получаем non-bounceable адрес

      if (nonBounceableAddress) {
          const shortAddress = shortenAddress(nonBounceableAddress); // Сокращаем адрес
          addressContainer.style.display = 'flex'; // Показываем контейнер с адресом
          addressContainer.querySelector('.address').textContent = shortAddress; // Выводим сокращенный адрес
          addressContainer.querySelector('.address').title = nonBounceableAddress; // Добавляем полный адрес в подсказку
      } else {
          addressContainer.style.display = 'none'; // Если адрес не обработан, скрываем его
      }
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
          updateActiveButton(page); // Убираем кнопку с активной страницей
            if (page === 'home.html') {
                Telegram.WebApp.BackButton.hide();
                displayUserInfo();
            }
            if (page === 'airdrop.html') {
                Telegram.WebApp.BackButton.hide();
            }
            if (page === 'friends.html') {
                Telegram.WebApp.BackButton.hide();
            }
            if (page === 'music.html') {
                Telegram.WebApp.BackButton.hide();
            }
          if (page === 'wallet.html') {
              initializeTonConnect();
              Telegram.WebApp.BackButton.hide(); // Инициализация TonConnect для страницы wallet.html
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
          
          // Убираем или добавляем класс disabled
          if (button.getAttribute('data-page') === page) {
              button.classList.add('disabled'); // Делаем кнопку неактивной
          } else {
              button.classList.remove('disabled'); // Включаем кнопку, если это не текущая страница
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

  function collapsePlaylist1() {
    const playlistOpen1 = document.querySelector('.playlist1_open');
    if (playlistOpen1) {
        playlistOpen1.classList.remove('show'); // Скрываем плейлист
    }
    Telegram.WebApp.BackButton.hide();
}

function collapsePlaylist2() {
    const playlistOpen2 = document.querySelector('.playlist2_open');
    if (playlistOpen2) {
        playlistOpen2.classList.remove('show'); // Скрываем плейлист
    }
    Telegram.WebApp.BackButton.hide();
}

function collapsePlaylist3() {
    const playlistOpen3 = document.querySelector('.playlist3_open');
    if (playlistOpen3) {
        playlistOpen3.classList.remove('show'); // Скрываем плейлист
    }
    Telegram.WebApp.BackButton.hide();
}

function collapsePlaylist4() {
    const playlistOpen4 = document.querySelector('.playlist4_open');
    if (playlistOpen4) {
        playlistOpen4.classList.remove('show'); // Скрываем плейлист
    }
    Telegram.WebApp.BackButton.hide();
}

// Функция для открытия плейлиста
function expandPlaylist1() {
    const playlistOpen1 = document.querySelector('.playlist1_open');
    if (playlistOpen1) {
        playlistOpen1.classList.add('show'); // Показываем плейлист
        Telegram.WebApp.BackButton.show();
    }
}

function expandPlaylist2() {
    const playlistOpen2 = document.querySelector('.playlist2_open');
    if (playlistOpen2) {
        playlistOpen2.classList.add('show');  // Показываем плеер
        Telegram.WebApp.BackButton.show();
    }
}

function expandPlaylist3() {
    const playlistOpen3 = document.querySelector('.playlist3_open');
    if (playlistOpen3) {
        playlistOpen3.classList.add('show');  // Показываем плеер
        Telegram.WebApp.BackButton.show();
    }
}

function expandPlaylist4() {
    const playlistOpen4 = document.querySelector('.playlist4_open');
    if (playlistOpen4) {
        playlistOpen4.classList.add('show');  // Показываем плеер
        Telegram.WebApp.BackButton.show();
    }
}

  // Использование MutationObserver для отслеживания появления элемента с классом .refresh
  const observer = new MutationObserver(() => {

    const playlistOpen1 = document.querySelector('.playlist1_open');
    const playlistOpen2 = document.querySelector('.playlist2_open');
    const playlistOpen3 = document.querySelector('.playlist3_open');
    const playlistOpen4 = document.querySelector('.playlist4_open');
    const playlistOne = document.querySelector('.playlist1'); // Основной плейлист
    const playlistTwo = document.querySelector('.playlist2'); // Основной плейлист
    const playlistThree = document.querySelector('.playlist3'); // Основной плейлист
    const playlistFour = document.querySelector('.playlist4'); // Основной плейлист

 // Обработчик для кнопки "Назад"
 if (!window.isBackButtonHandlerAdded) { // Проверяем, чтобы обработчик не добавлялся повторно
    Telegram.WebApp.BackButton.onClick(function () {
        // Если открыт плейлист, сворачиваем его первым
        if (playlistOpen1 && playlistOpen1.classList.contains('show')) {
            collapsePlaylist1();
            return;
        }
    
        if (playlistOpen2 && playlistOpen2.classList.contains('show')) {
            collapsePlaylist2();
            return;
        }
    
        if (playlistOpen3 && playlistOpen3.classList.contains('show')) {
            collapsePlaylist3();
            return;
        }
    
        if (playlistOpen4 && playlistOpen4.classList.contains('show')) {
            collapsePlaylist4();
            return;
        }
    
        // Если плеер открыт, скрываем его
        if (playerContainer && playerContainer.classList.contains('show')) {
            handleBackButtonPageNavigation();
            return;
        }
    });

    window.isBackButtonHandlerAdded = true; // Помечаем, что обработчик добавлен
}

    // Обработчик для открытия плейлиста
    if (playlistOpen1 && playlistOne) {
        playlistOne.addEventListener('click', function () {
            expandPlaylist1();
        });
    }
    
    if (playlistOpen2 && playlistTwo) {
        playlistTwo.addEventListener('click', function () {
            expandPlaylist2();
        });
    }

    if (playlistOpen3 && playlistThree) {
        playlistThree.addEventListener('click', function () {
            expandPlaylist3();
        });
    }

    if (playlistOpen4 && playlistFour) {
        playlistFour.addEventListener('click', function () {
            expandPlaylist4();
        });
    }

    // Обработчик для кнопки refresh
    const refreshButton = document.querySelector('.refresh');
    if (refreshButton) {
        refreshButton.addEventListener('click', function () {
            this.classList.add('rotate');
            setTimeout(() => {
                this.classList.remove('rotate');
            }, 500);
        });
    }

    // Обработчики для кнопок active_btn и complete_btn
    const activeBtn = document.querySelector('.active_btn');
    const completeBtn = document.querySelector('.complete_btn');
    const activeContainer = document.querySelector('.active__container');
    const completeContainer = document.querySelector('.complete__container');

    if (activeBtn && completeBtn && activeContainer && completeContainer) {
        console.log('Элементы найдены:', { activeBtn, completeBtn, activeContainer, completeContainer });

        activeBtn.addEventListener('click', () => {
            console.log('Нажата кнопка active_btn');
            activeContainer.classList.remove('hidden');
            completeContainer.classList.add('hidden');
        });

        completeBtn.addEventListener('click', () => {
            console.log('Нажата кнопка complete_btn');
            completeContainer.classList.remove('hidden');
            activeContainer.classList.add('hidden');
        });
    } 

    // Обновление значений valueNormal и valueSpecial
    const valueDisplay = document.querySelector('.balanc .value');
    const valueDisplayMini = document.querySelector('.balances .value');

    if (valueDisplay && valueDisplayMini) {
        valueDisplay.textContent = valueNormal + valueSpecial;
        valueDisplayMini.textContent = valueNormal + valueSpecial;
    }
});

// Начинаем наблюдение за изменениями в DOM
observer.observe(document.body, { childList: true, subtree: true });
updateValuesInDOM();


  const coverImage = document.querySelector(".cover__src"); // Картинка обложки
  const colorThief = new ColorThief(); // Объект ColorThief

  function applyColor() {
    try {
        if (coverElement.naturalWidth > 0) {  // Проверяем, что картинка уже загрузилась
            const color = colorThief.getColor(coverElement);
            console.log("Средний цвет обложки:", color);
            playerContainer.style.backgroundColor = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
            audioContainer.style.backgroundColor = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
        }
    } catch (error) {
        console.error("Ошибка получения цвета обложки:", error);
    }
}

  if (coverImage.complete) {
      applyColor();
  } else {
      coverImage.addEventListener("load", applyColor);
  }
});
