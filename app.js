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
    currentSection: 'discover'
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

    // Обработчик для входящих платежей
    tg.onEvent('invoiceClosed', (eventData) => {
        if (eventData.status === 'paid') {
            const payload = JSON.parse(eventData.payload || '{}');
            if (payload.beatId) {
                state.purchases.push(payload.beatId);
                updateUI();
                tg.showAlert('Покупка подтверждена! Теперь вы можете слушать бит полностью.');
            } else if (payload.topUp) {
                state.balance += parseInt(payload.topUp);
                updateUI();
                tg.showAlert(`Баланс пополнен на ${payload.topUp} Stars!`);
            }
        }
    });
}

function createAdditionalSections() {
    const mainContent = document.querySelector('.main-content');
    
    // Секция избранного
    const favoritesSection = document.createElement('section');
    favoritesSection.className = 'favorites-section';
    favoritesSection.innerHTML = `
        <h2>Избранное</h2>
        <div class="favorites-grid" id="favoritesGrid"></div>
    `;
    mainContent.appendChild(favoritesSection);
    
    // Секция покупок
    const purchasesSection = document.createElement('section');
    purchasesSection.className = 'purchases-section';
    purchasesSection.innerHTML = `
        <h2>Мои покупки</h2>
        <div class="purchases-grid" id="purchasesGrid"></div>
    `;
    mainContent.appendChild(purchasesSection);
    
    // Секция профиля
    const profileSection = document.createElement('section');
    profileSection.className = 'profile-section';
    profileSection.innerHTML = `
        <h2>Мой профиль</h2>
        <div class="profile-info" id="profileInfo"></div>
        <button class="logout-btn" id="logoutBtn">Выйти</button>
    `;
    mainContent.appendChild(profileSection);
}

function loadMockData() {
    state.beats = [
        {
            id: '1',
            title: 'Dark Trap Beat',
            genre: 'trap',
            bpm: 140,
            price: 50,
            cover: 'https://cdn-images.dzcdn.net/images/cover/9b727c3451bd7ef32f18bff6711e4794/0x1900-000000-80-0-0.jpg',
            audio: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
            artist: 'prod.by.night',
            duration: 180,
            uploadDate: '2025-05-10'
        },
        {
            id: '2',
            title: 'Melodic Drill',
            genre: 'drill',
            bpm: 150,
            price: 75,
            cover: 'https://i1.sndcdn.com/artworks-RW1l8QJFfKfDCT6e-GRzRVg-t500x500.jpg',
            audio: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
            artist: 'icybeats',
            duration: 210,
            uploadDate: '2025-05-08'
        },
        {
            id: '3',
            title: 'R&B Vibes',
            genre: 'rnb',
            bpm: 90,
            price: 40,
            cover: 'https://i1.sndcdn.com/artworks-ajILrkHGlLnAOcCN-o3uaKg-t500x500.jpg',
            audio: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
            artist: 'soulfulprod',
            duration: 195,
            uploadDate: '2025-05-05'
        }
    ];
    
    state.myBeats = [
        {
            id: '5',
            title: 'My First Beat',
            genre: 'trap',
            bpm: 140,
            price: 40,
            cover: 'https://i1.sndcdn.com/artworks-000606959152-f623qa-t500x500.jpg',
            audio: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
            artist: tg.initDataUnsafe.user?.username || 'You',
            duration: 185,
            uploadDate: '2025-04-28',
            sales: 3,
            earned: 120
        }
    ];
    
    state.favorites = ['1', '3'];
    state.purchases = ['2'];
}

function loadUserData() {
    if (tg.initDataUnsafe?.user) {
        const user = tg.initDataUnsafe.user;
        updateProfileSection(user);
    }
}

function updateProfileSection(user) {
    const profileInfo = document.getElementById('profileInfo');
    if (!profileInfo) return;
    
    profileInfo.innerHTML = `
        <div class="profile-card">
            <div class="profile-avatar">
                ${user.photo_url ? `<img src="${user.photo_url}" alt="${user.first_name}">` : '👤'}
            </div>
            <div class="profile-details">
                <h3>${user.first_name} ${user.last_name || ''}</h3>
                ${user.username ? `<p>@${user.username}</p>` : ''}
                <p>Баланс: ${state.balance} <span class="stars-icon">⭐</span></p>
                <button class="topup-btn" id="topupBtn">Пополнить баланс</button>
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

    // Добавляем обработчик для кнопки пополнения баланса
    document.getElementById('topupBtn')?.addEventListener('click', topUpBalance);
}

function topUpBalance() {
    tg.showPopup({
        title: 'Пополнение баланса',
        message: 'Выберите сумму для пополнения:',
        buttons: [
            { id: '100', type: 'default', text: '100 Stars' },
            { id: '500', type: 'default', text: '500 Stars' },
            { id: '1000', type: 'default', text: '1000 Stars' },
            { id: 'cancel', type: 'cancel', text: 'Отмена' }
        ]
    }, async (buttonId) => {
        if (buttonId !== 'cancel') {
            const amount = parseInt(buttonId);
            
            try {
                const result = await tg.openInvoice({
                    currency: 'XTR',
                    amount: amount * 100,
                    description: 'Пополнение баланса Stars',
                    payload: JSON.stringify({
                        topUp: amount,
                        userId: tg.initDataUnsafe.user?.id
                    })
                });
                
                if (result.status === 'paid') {
                    state.balance += amount;
                    updateUI();
                    tg.showAlert(`Баланс успешно пополнен на ${amount} Stars!`);
                }
            } catch (error) {
                console.error('Ошибка при пополнении баланса:', error);
                tg.showAlert('Произошла ошибка при пополнении баланса.');
            }
        }
    });
}

function setupEventListeners() {
    // Роли
    document.querySelectorAll('.role-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            state.role = btn.dataset.role;
            updateUI();
        });
    });
    
    // Навигация
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            state.currentSection = btn.dataset.section;
            updateUI();
        });
    });
    
    // Загрузка битов
    document.getElementById('uploadBeatBtn')?.addEventListener('click', () => {
        document.getElementById('uploadModal').classList.add('active');
    });
    
    document.getElementById('cancelUpload')?.addEventListener('click', () => {
        document.getElementById('uploadModal').classList.remove('active');
    });
    
    document.getElementById('uploadForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        uploadNewBeat();
    });
    
    // Аудио плеер
    const audioPlayer = document.getElementById('audioPlayer');
    const playPauseBtn = document.getElementById('playPauseBtn');
    
    playPauseBtn?.addEventListener('click', togglePlayPause);
    audioPlayer?.addEventListener('play', () => {
        state.isPlaying = true;
        updatePlayPauseButton();
    });
    audioPlayer?.addEventListener('pause', () => {
        state.isPlaying = false;
        updatePlayPauseButton();
    });
    audioPlayer?.addEventListener('timeupdate', updateProgressBar);
    document.getElementById('progressBar')?.addEventListener('input', seekAudio);
    
    // Избранное и покупки
    document.getElementById('favoriteBtn')?.addEventListener('click', toggleFavorite);
    document.getElementById('buyBtn')?.addEventListener('click', purchaseBeat);
    
    // Поиск и фильтры
    document.getElementById('searchInput')?.addEventListener('input', filterBeats);
    document.getElementById('genreFilter')?.addEventListener('change', filterBeats);
    document.getElementById('bpmFilter')?.addEventListener('change', filterBeats);
    
    // Выход
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        tg.close();
    });
    
    // Закрытие плеера
    document.getElementById('closePlayer')?.addEventListener('click', closePlayer);
}

function updateUI() {
    // Роли
    document.querySelector('.buyer-section').classList.toggle('active', state.role === 'buyer');
    document.querySelector('.seller-section').classList.toggle('active', state.role === 'seller');
    
    document.querySelectorAll('.role-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.role === state.role);
    });
    
    // Навигация
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.section === state.currentSection);
    });
    
    // Секции
    document.querySelector('.buyer-section').style.display = 
        state.currentSection === 'discover' && state.role === 'buyer' ? 'block' : 'none';
    document.querySelector('.favorites-section').style.display = 
        state.currentSection === 'favorites' && state.role === 'buyer' ? 'block' : 'none';
    document.querySelector('.purchases-section').style.display = 
        state.currentSection === 'purchases' && state.role === 'buyer' ? 'block' : 'none';
    document.querySelector('.profile-section').style.display = 
        state.currentSection === 'profile' && state.role === 'buyer' ? 'block' : 'none';
    document.querySelector('.seller-section').style.display = 
        state.role === 'seller' ? 'block' : 'none';
    
    // Контент
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
    
    // Баланс
    const userBalance = document.getElementById('userBalance');
    if (userBalance) {
        userBalance.textContent = `${state.balance} ⭐`;
    }
}

function renderBeatsGrid() {
    const beatsGrid = document.getElementById('beatsGrid');
    if (!beatsGrid) return;
    
    beatsGrid.innerHTML = '';
    
    state.beats.forEach(beat => {
        beatsGrid.appendChild(createBeatCard(beat));
    });
}

function renderFavorites() {
    const favoritesGrid = document.getElementById('favoritesGrid');
    if (!favoritesGrid) return;
    
    favoritesGrid.innerHTML = '';
    
    if (state.favorites.length === 0) {
        favoritesGrid.innerHTML = '<p class="empty-message">У вас пока нет избранных битов</p>';
        return;
    }
    
    state.favorites.forEach(beatId => {
        const beat = state.beats.find(b => b.id === beatId);
        if (beat) {
            favoritesGrid.appendChild(createBeatCard(beat));
        }
    });
}

function renderPurchases() {
    const purchasesGrid = document.getElementById('purchasesGrid');
    if (!purchasesGrid) return;
    
    purchasesGrid.innerHTML = '';
    
    if (state.purchases.length === 0) {
        purchasesGrid.innerHTML = '<p class="empty-message">У вас пока нет покупок</p>';
        return;
    }
    
    state.purchases.forEach(beatId => {
        const beat = state.beats.find(b => b.id === beatId);
        if (beat) {
            purchasesGrid.appendChild(createBeatCard(beat));
        }
    });
}

function renderMyBeats() {
    const myBeatsList = document.getElementById('myBeatsList');
    if (!myBeatsList) return;
    
    myBeatsList.innerHTML = '';
    
    if (state.myBeats.length === 0) {
        myBeatsList.innerHTML = `
            <div class="empty-state">
                <p>У вас пока нет загруженных битов</p>
            </div>
        `;
        return;
    }
    
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
                    <span>${beat.earned || 0} ⭐</span>
                </div>
            </div>
        `;
        myBeatsList.appendChild(beatItem);
    });
}

function updateSellerStats() {
    const totalSales = state.myBeats.reduce((sum, beat) => sum + (beat.sales || 0), 0);
    const totalEarned = state.myBeats.reduce((sum, beat) => sum + (beat.earned || 0), 0);
    
    const totalSalesEl = document.getElementById('totalSales');
    const totalEarnedEl = document.getElementById('totalEarned');
    
    if (totalSalesEl) totalSalesEl.textContent = totalSales;
    if (totalEarnedEl) totalEarnedEl.textContent = `${totalEarned} ⭐`;
}

function createBeatCard(beat) {
    const isFavorite = state.favorites.includes(beat.id);
    const isPurchased = state.purchases.includes(beat.id);
    
    const beatCard = document.createElement('div');
    beatCard.className = 'beat-card';
    beatCard.dataset.id = beat.id;
    beatCard.innerHTML = `
        <div class="beat-cover">
            ${beat.cover ? `<img src="${beat.cover}" alt="${beat.title}">` : ''}
            
        </div>
        <div class="beat-info">
            <div class="beat-title">${beat.title}</div>
            <div class="beat-meta">
                <span>${beat.artist}</span>
                <span>${beat.price} ⭐</span>
            </div>
        </div>
    `;
    
    beatCard.addEventListener('click', () => openPlayer(beat));
    return beatCard;
}

function filterBeats() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const genreFilter = document.getElementById('genreFilter').value;
    const bpmFilter = document.getElementById('bpmFilter').value;
    
    const beatsGrid = document.getElementById('beatsGrid');
    if (!beatsGrid) return;
    
    beatsGrid.innerHTML = '';
    
    const filteredBeats = state.beats.filter(beat => {
        const matchesSearch = beat.title.toLowerCase().includes(searchTerm) || 
                            beat.artist.toLowerCase().includes(searchTerm);
        
        const matchesGenre = !genreFilter || beat.genre === genreFilter;
        
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
    
    filteredBeats.forEach(beat => {
        beatsGrid.appendChild(createBeatCard(beat));
    });
}

function openPlayer(beat) {
    state.currentBeat = beat;
    
    document.getElementById('playerTitle').textContent = beat.title;
    document.getElementById('playerInfo').textContent = `Жанр: ${getGenreName(beat.genre)} • BPM: ${beat.bpm}`;
    document.getElementById('beatPriceDisplay').textContent = `${beat.price} ⭐`;
    
    const beatCover = document.getElementById('beatCover');
    beatCover.innerHTML = beat.cover ? 
        `<img src="${beat.cover}" alt="${beat.title}">` : 
        '<div class="default-cover">🎵</div>';
    
    const audioPlayer = document.getElementById('audioPlayer');
    audioPlayer.src = beat.audio;
    
    updateFavoriteButton();
    updatePurchaseButton();
    
    document.getElementById('playerModal').classList.add('active');
    
    if (state.purchases.includes(beat.id)) {
        audioPlayer.play().catch(e => console.log('Autoplay prevented:', e));
    }
}

function closePlayer() {
    const audioPlayer = document.getElementById('audioPlayer');
    if (audioPlayer) {
        audioPlayer.pause();
    }
    document.getElementById('playerModal').classList.remove('active');
    state.currentBeat = null;
}

function togglePlayPause() {
    const audioPlayer = document.getElementById('audioPlayer');
    if (!audioPlayer) return;
    
    if (state.isPlaying) {
        audioPlayer.pause();
    } else {
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
        
        audioPlayer.play().catch(e => console.log('Play error:', e));
    }
}

function updatePlayPauseButton() {
    const playPauseBtn = document.getElementById('playPauseBtn');
    if (playPauseBtn) {
        playPauseBtn.innerHTML = state.isPlaying ? '⏸️' : '▶️';
    }
}

function updateProgressBar() {
    const audioPlayer = document.getElementById('audioPlayer');
    const progressBar = document.getElementById('progressBar');
    const currentTime = document.getElementById('currentTime');
    const duration = document.getElementById('duration');
    
    if (!audioPlayer || !progressBar || !currentTime || !duration) return;
    
    const current = audioPlayer.currentTime;
    const dur = audioPlayer.duration || state.currentBeat?.duration || 0;
    
    progressBar.max = dur;
    progressBar.value = current;
    
    currentTime.textContent = formatTime(current);
    duration.textContent = formatTime(dur);
}

function seekAudio() {
    const audioPlayer = document.getElementById('audioPlayer');
    const progressBar = document.getElementById('progressBar');
    
    if (audioPlayer && progressBar) {
        audioPlayer.currentTime = progressBar.value;
    }
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function updateFavoriteButton() {
    if (!state.currentBeat) return;
    
    const favoriteBtn = document.getElementById('favoriteBtn');
    if (!favoriteBtn) return;
    
    const isFavorite = state.favorites.includes(state.currentBeat.id);
    favoriteBtn.innerHTML = isFavorite ? 
        '<i class="icon-heart"></i> В избранном' : 
        '<i class="icon-heart"></i> В избранное';
    favoriteBtn.classList.toggle('active', isFavorite);
}

function toggleFavorite() {
    if (!state.currentBeat) return;
    
    const index = state.favorites.indexOf(state.currentBeat.id);
    if (index === -1) {
        state.favorites.push(state.currentBeat.id);
    } else {
        state.favorites.splice(index, 1);
    }
    
    updateFavoriteButton();
}

function updatePurchaseButton() {
    if (!state.currentBeat) return;
    
    const buyBtn = document.getElementById('buyBtn');
    if (!buyBtn) return;
    
    const isPurchased = state.purchases.includes(state.currentBeat.id);
    buyBtn.style.display = isPurchased ? 'none' : 'flex';
    buyBtn.innerHTML = `Купить за ${state.currentBeat.price} ⭐`;
}

function purchaseBeat() {
    if (!state.currentBeat) return;
    
    if (state.purchases.includes(state.currentBeat.id)) {
        tg.showAlert('Вы уже купили этот бит');
        return;
    }
    
    if (state.balance < state.currentBeat.price) {
        tg.showPopup({
            title: 'Недостаточно Stars',
            message: `На вашем балансе ${state.balance} Stars, а требуется ${state.currentBeat.price}. Хотите пополнить баланс?`,
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
                topUpBalance();
            }
        });
        return;
    }
    
    tg.showPopup({
        title: 'Подтверждение покупки',
        message: `Вы хотите купить бит "${state.currentBeat.title}" за ${state.currentBeat.price} Telegram Stars?`,
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
            try {
                // Открываем платежную форму Telegram Stars
                const result = await tg.openInvoice({
                    currency: 'XTR', // Код валюты для Telegram Stars
                    amount: state.currentBeat.price * 100, // Сумма в центах (1 Star = 100 центов)
                    description: `Покупка бита: ${state.currentBeat.title}`,
                    payload: JSON.stringify({
                        beatId: state.currentBeat.id,
                        userId: tg.initDataUnsafe.user?.id
                    })
                });
                
                if (result.status === 'paid') {
                    // Успешная оплата
                    state.purchases.push(state.currentBeat.id);
                    state.balance -= state.currentBeat.price;
                    updateUI();
                    updatePurchaseButton();
                    
                    tg.showAlert('Покупка успешно завершена! Теперь вы можете слушать бит полностью.');
                    
                    // Автоматически начинаем воспроизведение после покупки
                    const audioPlayer = document.getElementById('audioPlayer');
                    if (audioPlayer) {
                        audioPlayer.play().catch(e => console.log('Play error:', e));
                    }
                } else {
                    tg.showAlert('Покупка не была завершена.');
                }
            } catch (error) {
                console.error('Ошибка при обработке платежа:', error);
                tg.showAlert('Произошла ошибка при обработке платежа.');
            }
        }
    });
}

function uploadNewBeat() {
    const title = document.getElementById('beatTitle').value.trim();
    const genre = document.getElementById('beatGenre').value;
    const bpm = parseInt(document.getElementById('beatBpm').value);
    const price = parseFloat(document.getElementById('beatPrice').value);
    const audioFile = document.getElementById('beatFile').files[0];
    const coverFile = document.getElementById('beatCoverFile').files[0];
    
    if (!title || !genre || isNaN(bpm) || isNaN(price) || !audioFile) {
        tg.showAlert('Пожалуйста, заполните все обязательные поля корректно');
        return;
    }

    // Показываем индикатор загрузки
    const uploadBtn = document.getElementById('uploadBtn');
    const originalText = uploadBtn.textContent;
    uploadBtn.textContent = 'Загрузка...';
    uploadBtn.disabled = true;

    // Создаем объект для нового бита
    const newBeat = {
        id: Date.now().toString(),
        title,
        genre,
        bpm,
        price,
        cover: null,
        audio: null,
        artist: tg.initDataUnsafe.user?.username || 'You',
        duration: 180,
        uploadDate: new Date().toISOString().split('T')[0],
        sales: 0,
        earned: 0
    };

    // Функция для обработки загрузки файлов
    const processFiles = () => {
        return new Promise((resolve) => {
            // Обработка аудио
            const audioReader = new FileReader();
            audioReader.onload = (e) => {
                newBeat.audio = e.target.result;

                // Если есть обложка, обрабатываем ее
                if (coverFile) {
                    const coverReader = new FileReader();
                    coverReader.onload = (e) => {
                        newBeat.cover = e.target.result;
                        resolve(newBeat);
                    };
                    coverReader.readAsDataURL(coverFile);
                } else {
                    // Используем стандартную обложку, если не загружена
                    newBeat.cover = 'https://via.placeholder.com/300';
                    resolve(newBeat);
                }
            };
            audioReader.readAsDataURL(audioFile);
        });
    };

    // Обрабатываем файлы и добавляем бит
    processFiles().then((beatWithFiles) => {
        state.myBeats.unshift(beatWithFiles);
        document.getElementById('uploadModal').classList.remove('active');
        document.getElementById('uploadForm').reset();
        updateUI();
        
        tg.showAlert('Бит успешно загружен!');
    }).catch((error) => {
        console.error('Ошибка при загрузке файлов:', error);
        tg.showAlert('Произошла ошибка при загрузке файлов');
    }).finally(() => {
        uploadBtn.textContent = originalText;
        uploadBtn.disabled = false;
    });
}

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

// Запуск приложения
document.addEventListener('DOMContentLoaded', init);
