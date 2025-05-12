// Инициализация Telegram WebApp
const tg = window.Telegram.WebApp;
tg.expand();

// Состояние приложения
const state = {
    role: 'buyer',
    beats: [],
    myBeats: [],
    favorites: [],
    purchases: [],
    balance: 100, // Стартовый баланс в Stars
    currentBeat: null,
    isPlaying: false,
    currentSection: 'discover' // Активная секция
};

// DOM элементы
const elements = {
    roleBtns: document.querySelectorAll('.role-btn'),
    buyerSection: document.querySelector('.buyer-section'),
    sellerSection: document.querySelector('.seller-section'),
    beatsGrid: document.getElementById('beatsGrid'),
    uploadModal: document.getElementById('uploadModal'),
    uploadForm: document.getElementById('uploadForm'),
    cancelUpload: document.getElementById('cancelUpload'),
    uploadBeatBtn: document.getElementById('uploadBeatBtn'),
    playerModal: document.getElementById('playerModal'),
    audioPlayer: document.getElementById('audioPlayer'),
    playPauseBtn: document.getElementById('playPauseBtn'),
    progressBar: document.getElementById('progressBar'),
    currentTime: document.getElementById('currentTime'),
    duration: document.getElementById('duration'),
    closePlayer: document.getElementById('closePlayer'),
    favoriteBtn: document.getElementById('favoriteBtn'),
    buyBtn: document.getElementById('buyBtn'),
    beatPriceDisplay: document.getElementById('beatPriceDisplay'),
    playerTitle: document.getElementById('playerTitle'),
    playerInfo: document.getElementById('playerInfo'),
    beatCover: document.getElementById('beatCover'),
    userBalance: document.getElementById('userBalance'),
    totalSales: document.getElementById('totalSales'),
    totalEarned: document.getElementById('totalEarned'),
    myBeatsList: document.getElementById('myBeatsList'),
    searchInput: document.getElementById('searchInput'),
    genreFilter: document.getElementById('genreFilter'),
    bpmFilter: document.getElementById('bpmFilter'),
    navBtns: document.querySelectorAll('.nav-btn'),
    discoverSection: document.querySelector('.buyer-section'),
    favoritesSection: document.createElement('div'),
    purchasesSection: document.createElement('div'),
    profileSection: document.createElement('div')
};

// Инициализация приложения
function init() {
    // Создаем дополнительные секции
    createAdditionalSections();
    
    // Загрузка тестовых данных
    loadMockData();
    
    // Установка обработчиков событий
    setupEventListeners();
    
    // Обновление интерфейса
    updateUI();
    
    // Загрузка данных пользователя из Telegram
    loadUserData();
}

// Создание дополнительных секций
function createAdditionalSections() {
    // Секция избранного
    elements.favoritesSection.className = 'favorites-section';
    elements.favoritesSection.innerHTML = `
        <h2>Избранное</h2>
        <div class="favorites-grid" id="favoritesGrid"></div>
    `;
    elements.buyerSection.parentNode.appendChild(elements.favoritesSection);
    
    // Секция покупок
    elements.purchasesSection.className = 'purchases-section';
    elements.purchasesSection.innerHTML = `
        <h2>Мои покупки</h2>
        <div class="purchases-grid" id="purchasesGrid"></div>
    `;
    elements.buyerSection.parentNode.appendChild(elements.purchasesSection);
    
    // Секция профиля
    elements.profileSection.className = 'profile-section';
    elements.profileSection.innerHTML = `
        <h2>Мой профиль</h2>
        <div class="profile-info" id="profileInfo"></div>
        <button class="logout-btn" id="logoutBtn">Выйти</button>
    `;
    elements.buyerSection.parentNode.appendChild(elements.profileSection);
}

// Загрузка тестовых данных
function loadMockData() {
    state.beats = [
        {
            id: '1',
            title: 'Dark Trap Beat',
            genre: 'trap',
            bpm: 140,
            price: 50, // Цена в Stars
            cover: 'https://example.com/cover1.jpg',
            audio: 'https://example.com/beat1.mp3',
            artist: 'prod.by.night',
            duration: 180,
            uploadDate: '2025-05-10'
        },
        {
            id: '2',
            title: 'Melodic Drill',
            genre: 'drill',
            bpm: 150,
            price: 75, // Цена в Stars
            cover: 'https://example.com/cover2.jpg',
            audio: 'https://example.com/beat2.mp3',
            artist: 'icybeats',
            duration: 210,
            uploadDate: '2025-05-08'
        }
    ];
    
    state.myBeats = [
        {
            id: '5',
            title: 'My First Beat',
            genre: 'trap',
            bpm: 140,
            price: 40,
            cover: 'https://example.com/mycover1.jpg',
            audio: 'https://example.com/mybeat1.mp3',
            artist: tg.initDataUnsafe.user?.username || 'You',
            duration: 185,
            uploadDate: '2025-04-28',
            sales: 3,
            earned: 120 // Заработано Stars
        }
    ];
    
    state.favorites = ['1', '3'];
    state.purchases = ['2'];
}

// Загрузка данных пользователя из Telegram
function loadUserData() {
    if (tg.initDataUnsafe?.user) {
        const user = tg.initDataUnsafe.user;
        console.log('User data:', user);
        
        // Обновляем профиль
        updateProfileSection(user);
    }
}

// Обновление секции профиля
function updateProfileSection(user) {
    const profileInfo = `
        <div class="profile-card">
            <div class="profile-avatar">
                ${user.photo_url ? `<img src="${user.photo_url}" alt="${user.first_name}">` : '👤'}
            </div>
            <div class="profile-details">
                <h3>${user.first_name} ${user.last_name || ''}</h3>
                ${user.username ? `<p>@${user.username}</p>` : ''}
                <p>Баланс: ${state.balance} Stars</p>
            </div>
        </div>
        <div class="profile-stats">
            <div class="stat-item">
                <span>${state.favorites.length}</span>
                <span>В избранном</span>
            </div>
            <div class="stat-item">
                <span>${state.purchases.length}</span>
                <span>Покупок</span>
            </div>
        </div>
    `;
    
    document.getElementById('profileInfo').innerHTML = profileInfo;
}

// Установка обработчиков событий
function setupEventListeners() {
    // Переключение между режимами покупателя/продавца
    elements.roleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            state.role = btn.dataset.role;
            updateUI();
        });
    });
    
    // Открытие модального окна загрузки бита
    elements.uploadBeatBtn.addEventListener('click', () => {
        elements.uploadModal.classList.add('active');
    });
    
    // Закрытие модального окна загрузки бита
    elements.cancelUpload.addEventListener('click', () => {
        elements.uploadModal.classList.remove('active');
    });
    
    // Отправка формы загрузки бита
    elements.uploadForm.addEventListener('submit', (e) => {
        e.preventDefault();
        uploadNewBeat();
    });
    
    // Закрытие плеера
    elements.closePlayer.addEventListener('click', closePlayer);
    
    // Управление воспроизведением
    elements.playPauseBtn.addEventListener('click', togglePlayPause);
    elements.audioPlayer.addEventListener('play', () => {
        state.isPlaying = true;
        updatePlayPauseButton();
    });
    elements.audioPlayer.addEventListener('pause', () => {
        state.isPlaying = false;
        updatePlayPauseButton();
    });
    elements.audioPlayer.addEventListener('timeupdate', updateProgressBar);
    elements.progressBar.addEventListener('input', seekAudio);
    
    // Добавление в избранное
    elements.favoriteBtn.addEventListener('click', toggleFavorite);
    
    // Покупка бита
    elements.buyBtn.addEventListener('click', purchaseBeat);
    
    // Поиск и фильтрация
    elements.searchInput.addEventListener('input', filterBeats);
    elements.genreFilter.addEventListener('change', filterBeats);
    elements.bpmFilter.addEventListener('change', filterBeats);

    // Навигация по секциям
    elements.navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            state.currentSection = btn.dataset.section;
            updateUI();
        });
    });
    
    // Кнопка выхода
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        tg.close();
    });
}

// Обновление интерфейса
function updateUI() {
    // Переключение секций
    elements.buyerSection.classList.toggle('active', state.role === 'buyer');
    elements.sellerSection.classList.toggle('active', state.role === 'seller');
    
    // Обновление кнопок ролей
    elements.roleBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.role === state.role);
    });
    
    // Обновление навигации
    elements.navBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.section === state.currentSection);
    });
    
    // Показываем активную секцию
    elements.discoverSection.style.display = state.currentSection === 'discover' ? 'block' : 'none';
    elements.favoritesSection.style.display = state.currentSection === 'favorites' ? 'block' : 'none';
    elements.purchasesSection.style.display = state.currentSection === 'purchases' ? 'block' : 'none';
    elements.profileSection.style.display = state.currentSection === 'profile' ? 'block' : 'none';
    
    // Обновление контента
    if (state.role === 'buyer') {
        switch(state.currentSection) {
            case 'discover':
                renderBeatsGrid();
                break;
            case 'favorites':
                renderFavorites();
                break;
            case 'purchases':
                renderPurchases();
                break;
            case 'profile':
                if (tg.initDataUnsafe?.user) {
                    updateProfileSection(tg.initDataUnsafe.user);
                }
                break;
        }
    } else {
        renderMyBeats();
        updateSellerStats();
    }
    
    // Обновление баланса
    elements.userBalance.textContent = `${state.balance} Stars`;
}

// Рендеринг избранного
function renderFavorites() {
    const favoritesGrid = document.getElementById('favoritesGrid');
    favoritesGrid.innerHTML = '';
    
    if (state.favorites.length === 0) {
        favoritesGrid.innerHTML = '<p class="empty-message">У вас пока нет избранных битов</p>';
        return;
    }
    
    state.favorites.forEach(beatId => {
        const beat = state.beats.find(b => b.id === beatId);
        if (beat) {
            const beatCard = createBeatCard(beat);
            favoritesGrid.appendChild(beatCard);
        }
    });
}

// Рендеринг покупок
function renderPurchases() {
    const purchasesGrid = document.getElementById('purchasesGrid');
    purchasesGrid.innerHTML = '';
    
    if (state.purchases.length === 0) {
        purchasesGrid.innerHTML = '<p class="empty-message">У вас пока нет покупок</p>';
        return;
    }
    
    state.purchases.forEach(beatId => {
        const beat = state.beats.find(b => b.id === beatId);
        if (beat) {
            const beatCard = createBeatCard(beat);
            purchasesGrid.appendChild(beatCard);
        }
    });
}

// Создание карточки бита
function createBeatCard(beat) {
    const isFavorite = state.favorites.includes(beat.id);
    const isPurchased = state.purchases.includes(beat.id);
    
    const beatCard = document.createElement('div');
    beatCard.className = 'beat-card';
    beatCard.dataset.id = beat.id;
    beatCard.innerHTML = `
        <div class="beat-cover">
            ${beat.cover ? `<img src="${beat.cover}" alt="${beat.title}">` : ''}
            <div class="play-icon">▶️</div>
        </div>
        <div class="beat-info">
            <div class="beat-title">${beat.title}</div>
            <div class="beat-meta">
                <span>${beat.artist}</span>
                <span>${beat.price} Stars</span>
            </div>
        </div>
    `;
    
    beatCard.addEventListener('click', () => openPlayer(beat));
    return beatCard;
}

// Покупка бита через Telegram Stars
function purchaseBeat() {
    if (!state.currentBeat) return;
    
    if (state.purchases.includes(state.currentBeat.id)) {
        tg.showAlert('Вы уже купили этот бит');
        return;
    }
    
    // Проверка баланса
    if (state.balance < state.currentBeat.price) {
        tg.showPopup({
            title: 'Недостаточно Stars',
            message: `На вашем балансе недостаточно Stars. Требуется: ${state.currentBeat.price}`,
            buttons: [{
                id: 'topup',
                type: 'default',
                text: 'Пополнить'
            }, {
                id: 'cancel',
                type: 'cancel',
                text: 'Отмена'
            }]
        }, (buttonId) => {
            if (buttonId === 'topup') {
                tg.openInvoice({
                    currency: 'STARS',
                    amount: state.currentBeat.price * 2, // Предлагаем пополнить в 2 раза больше
                    description: 'Пополнение баланса Stars'
                }, (status) => {
                    if (status === 'paid') {
                        state.balance += state.currentBeat.price * 2;
                        updateUI();
                        tg.showAlert('Баланс успешно пополнен!');
                    }
                });
            }
        });
        return;
    }
    
    // Подтверждение покупки
    tg.showPopup({
        title: 'Подтверждение покупки',
        message: `Купить "${state.currentBeat.title}" за ${state.currentBeat.price} Stars?`,
        buttons: [{
            id: 'confirm',
            type: 'destructive',
            text: 'Купить'
        }, {
            id: 'cancel',
            type: 'cancel',
            text: 'Отмена'
        }]
    }, (buttonId) => {
        if (buttonId === 'confirm') {
            // Имитация платежа через Stars
            tg.openInvoice({
                currency: 'STARS',
                amount: state.currentBeat.price,
                description: `Покупка бита "${state.currentBeat.title}"`
            }, (status) => {
                if (status === 'paid') {
                    // Обновление состояния
                    state.purchases.push(state.currentBeat.id);
                    state.balance -= state.currentBeat.price;
                    
                    // Обновление UI
                    updateUI();
                    updatePurchaseButton();
                    
                    tg.showAlert('Покупка успешно завершена! Теперь вы можете слушать этот бит без ограничений.');
                } else {
                    tg.showAlert('Платеж не был завершен');
                }
            });
        }
    });
}

// Рендеринг сетки битов
function renderBeatsGrid() {
    elements.beatsGrid.innerHTML = '';
    
    state.beats.forEach(beat => {
        const isFavorite = state.favorites.includes(beat.id);
        const isPurchased = state.purchases.includes(beat.id);
        
        const beatCard = document.createElement('div');
        beatCard.className = 'beat-card';
        beatCard.dataset.id = beat.id;
        beatCard.innerHTML = `
            <div class="beat-cover">
                ${beat.cover ? `<img src="${beat.cover}" alt="${beat.title}">` : ''}
                <div class="play-icon">▶️</div>
            </div>
            <div class="beat-info">
                <div class="beat-title">${beat.title}</div>
                <div class="beat-meta">
                    <span>${beat.artist}</span>
                    <span>${beat.price} TON</span>
                </div>
            </div>
        `;
        
        beatCard.addEventListener('click', () => openPlayer(beat));
        elements.beatsGrid.appendChild(beatCard);
    });
}

// Рендеринг списка битов продавца
function renderMyBeats() {
    if (state.myBeats.length === 0) {
        elements.myBeatsList.innerHTML = `
            <div class="empty-state">
                <p>У вас пока нет загруженных битов</p>
            </div>
        `;
        return;
    }
    
    elements.myBeatsList.innerHTML = '';
    
    state.myBeats.forEach(beat => {
        const beatItem = document.createElement('div');
        beatItem.className = 'beat-card';
        beatItem.innerHTML = `
            <div class="beat-cover">
                ${beat.cover ? `<img src="${beat.cover}" alt="${beat.title}">` : ''}
            </div>
            <div class="beat-info">
                <div class="beat-title">${beat.title}</div>
                <div class="beat-meta">
                    <span>${beat.sales || 0} продаж</span>
                    <span>${beat.earned || 0} TON</span>
                </div>
            </div>
        `;
        
        elements.myBeatsList.appendChild(beatItem);
    });
}

// Обновление статистики продавца
function updateSellerStats() {
    const totalSales = state.myBeats.reduce((sum, beat) => sum + (beat.sales || 0), 0);
    const totalEarned = state.myBeats.reduce((sum, beat) => sum + (beat.earned || 0), 0);
    
    elements.totalSales.textContent = totalSales;
    elements.totalEarned.textContent = totalEarned.toFixed(2);
}

// Фильтрация битов
function filterBeats() {
    const searchTerm = elements.searchInput.value.toLowerCase();
    const genreFilter = elements.genreFilter.value;
    const bpmFilter = elements.bpmFilter.value;
    
    const filteredBeats = state.beats.filter(beat => {
        // Поиск по названию и исполнителю
        const matchesSearch = beat.title.toLowerCase().includes(searchTerm) || 
                            beat.artist.toLowerCase().includes(searchTerm);
        
        // Фильтр по жанру
        const matchesGenre = !genreFilter || beat.genre === genreFilter;
        
        // Фильтр по BPM
        let matchesBpm = true;
        if (bpmFilter) {
            const [min, max] = bpmFilter.split('-').map(Number);
            if (max) {
                matchesBpm = beat.bpm >= min && beat.bpm <= max;
            } else {
                matchesBpm = beat.bpm >= min;
            }
        }
        
        return matchesSearch && matchesGenre && matchesBpm;
    });
    
    // Временное обновление состояния для демонстрации
    const originalBeats = [...state.beats];
    state.beats = filteredBeats;
    renderBeatsGrid();
    state.beats = originalBeats;
}

// Открытие плеера
function openPlayer(beat) {
    state.currentBeat = beat;
    
    elements.playerTitle.textContent = beat.title;
    elements.playerInfo.textContent = `Жанр: ${getGenreName(beat.genre)} • BPM: ${beat.bpm}`;
    elements.beatPriceDisplay.textContent = beat.price.toFixed(2);
    
    // Установка обложки
    elements.beatCover.innerHTML = beat.cover ? 
        `<img src="${beat.cover}" alt="${beat.title}">` : 
        '<div class="default-cover">🎵</div>';
    
    // Установка аудио
    elements.audioPlayer.src = beat.audio;
    
    // Обновление кнопки избранного
    updateFavoriteButton();
    
    // Обновление кнопки покупки
    updatePurchaseButton();
    
    // Открытие модального окна
    elements.playerModal.classList.add('active');
    
    // Автовоспроизведение (если бит куплен)
    if (state.purchases.includes(beat.id)) {
        elements.audioPlayer.play().catch(e => console.log('Autoplay prevented:', e));
    }
}

// Закрытие плеера
function closePlayer() {
    elements.audioPlayer.pause();
    elements.playerModal.classList.remove('active');
    state.currentBeat = null;
}

// Переключение воспроизведения
function togglePlayPause() {
    if (state.isPlaying) {
        elements.audioPlayer.pause();
    } else {
        // Проверка, куплен ли бит
        if (state.currentBeat && !state.purchases.includes(state.currentBeat.id)) {
            tg.showPopup({
                title: 'Бит не куплен',
                message: 'Чтобы слушать этот бит полностью, необходимо его приобрести.',
                buttons: [{
                    id: 'buy',
                    type: 'default',
                    text: 'Купить'
                }, {
                    id: 'cancel',
                    type: 'cancel',
                    text: 'Отмена'
                }]
            }, (buttonId) => {
                if (buttonId === 'buy') {
                    purchaseBeat();
                }
            });
            return;
        }
        
        elements.audioPlayer.play().catch(e => console.log('Play error:', e));
    }
}

// Обновление кнопки воспроизведения
function updatePlayPauseButton() {
    elements.playPauseBtn.innerHTML = state.isPlaying ? '⏸️' : '▶️';
}

// Обновление прогресс-бара
function updateProgressBar() {
    const currentTime = elements.audioPlayer.currentTime;
    const duration = elements.audioPlayer.duration || state.currentBeat?.duration || 0;
    
    elements.progressBar.max = duration;
    elements.progressBar.value = currentTime;
    
    elements.currentTime.textContent = formatTime(currentTime);
    elements.duration.textContent = formatTime(duration);
}

// Перемотка аудио
function seekAudio() {
    elements.audioPlayer.currentTime = elements.progressBar.value;
}

// Форматирование времени
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

// Обновление кнопки избранного
function updateFavoriteButton() {
    if (!state.currentBeat) return;
    
    const isFavorite = state.favorites.includes(state.currentBeat.id);
    elements.favoriteBtn.innerHTML = isFavorite ? 
        '<i class="icon-heart"></i> В избранном' : 
        '<i class="icon-heart"></i> В избранное';
    elements.favoriteBtn.classList.toggle('active', isFavorite);
}

// Переключение избранного
function toggleFavorite() {
    if (!state.currentBeat) return;
    
    const index = state.favorites.indexOf(state.currentBeat.id);
    if (index === -1) {
        state.favorites.push(state.currentBeat.id);
    } else {
        state.favorites.splice(index, 1);
    }
    
    updateFavoriteButton();
    
    // В реальном приложении здесь бы сохраняли изменения на сервере
}

// Обновление кнопки покупки
function updatePurchaseButton() {
    if (!state.currentBeat) return;
    
    const isPurchased = state.purchases.includes(state.currentBeat.id);
    elements.buyBtn.style.display = isPurchased ? 'none' : 'flex';
}

// Покупка бита
function purchaseBeat() {
    if (!state.currentBeat) return;
    
    // Проверка баланса
    if (state.balance < state.currentBeat.price) {
        tg.showPopup({
            title: 'Недостаточно средств',
            message: `На вашем балансе недостаточно TON для покупки этого бита. Требуется: ${state.currentBeat.price.toFixed(2)} TON`,
            buttons: [{
                id: 'topup',
                type: 'default',
                text: 'Пополнить баланс'
            }, {
                id: 'cancel',
                type: 'cancel',
                text: 'Отмена'
            }]
        }, (buttonId) => {
            if (buttonId === 'topup') {
                // В реальном приложении здесь бы открывался интерфейс пополнения баланса
                tg.showAlert('Функция пополнения баланса будет реализована в будущем');
            }
        });
        return;
    }
    
    // Подтверждение покупки
    tg.showPopup({
        title: 'Подтверждение покупки',
        message: `Вы уверены, что хотите купить бит "${state.currentBeat.title}" за ${state.currentBeat.price.toFixed(2)} TON?`,
        buttons: [{
            id: 'confirm',
            type: 'destructive',
            text: 'Купить'
        }, {
            id: 'cancel',
            type: 'cancel',
            text: 'Отмена'
        }]
    }, async (buttonId) => {
        if (buttonId === 'confirm') {
            // В реальном приложении здесь бы выполнялась транзакция через TON
            try {
                // Имитация платежа
                await simulatePayment(state.currentBeat.price);
                
                // Обновление состояния
                state.purchases.push(state.currentBeat.id);
                state.balance -= state.currentBeat.price;
                
                // Обновление UI
                updateUI();
                updatePurchaseButton();
                
                tg.showAlert('Покупка успешно завершена! Теперь вы можете слушать этот бит без ограничений.');
            } catch (error) {
                tg.showAlert(`Ошибка при выполнении платежа: ${error.message}`);
            }
        }
    });
}

// Имитация платежа (в реальном приложении использовать TON Payments)
function simulatePayment(amount) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            // 10% chance of failure for demo purposes
            if (Math.random() < 0.1) {
                reject(new Error('Ошибка сети. Пожалуйста, попробуйте позже.'));
            } else {
                resolve();
            }
        }, 1000);
    });
}

// Загрузка нового бита
function uploadNewBeat() {
    const title = elements.beatTitle.value.trim();
    const genre = elements.beatGenre.value;
    const bpm = parseInt(elements.beatBpm.value);
    const price = parseFloat(elements.beatPrice.value);
    const file = elements.beatFile.files[0];
    
    if (!title || !genre || isNaN(bpm) || isNaN(price) || !file) {
        tg.showAlert('Пожалуйста, заполните все поля корректно');
        return;
    }
    
    // В реальном приложении здесь бы файл загружался на сервер/IPFS
    // Для демо просто создаем новый бит
    
    const newBeat = {
        id: Date.now().toString(),
        title,
        genre,
        bpm,
        price,
        cover: null, // В реальном приложении можно загружать обложку
        audio: URL.createObjectURL(file),
        artist: tg.initDataUnsafe.user?.username || 'You',
        duration: 180, // В реальном приложении определять длительность
        uploadDate: new Date().toISOString().split('T')[0],
        sales: 0,
        earned: 0
    };
    
    state.myBeats.unshift(newBeat);
    elements.uploadModal.classList.remove('active');
    elements.uploadForm.reset();
    updateUI();
    
    tg.showAlert('Бит успешно загружен! Теперь он доступен для покупки другими пользователями.');
}

// Получение читаемого названия жанра
function getGenreName(genreKey) {
    const genres = {
        'trap': 'Trap',
        'drill': 'Drill',
        'rnb': 'R&B',
        'hiphop': 'Hip-Hop',
        'other': 'Другое'
    };
    return genres[genreKey] || genreKey;
}

// Инициализация приложения после загрузки DOM
document.addEventListener('DOMContentLoaded', init);