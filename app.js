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
            balance: 0,
            currentBeat: null,
            isPlaying: false,
            currentSection: 'discover'
        };

        // Инициализация приложения
        async function init() {
            // Загрузка тестовых данных
            loadMockData();
            
            // Получаем данные пользователя
            await loadUserData();
            
            // Установка обработчиков событий
            setupEventListeners();
            
            // Обновление интерфейса
            updateUI();
        }

        // Загрузка данных пользователя из CloudStorage
        async function loadUserData() {
            try {
                // Загружаем баланс
                const balance = await tg.CloudStorage.getItem('user_balance');
                state.balance = balance ? parseInt(balance) : 0;
                
                // Загружаем избранное
                const favorites = await tg.CloudStorage.getItem('user_favorites');
                state.favorites = favorites ? JSON.parse(favorites) : [];
                
                // Загружаем покупки
                const purchases = await tg.CloudStorage.getItem('user_purchases');
                state.purchases = purchases ? JSON.parse(purchases) : [];
                
                console.log('User data loaded from CloudStorage');
            } catch (error) {
                console.error('Error loading user data:', error);
                tg.showAlert('Ошибка загрузки данных');
            }
        }

        // Сохранение данных пользователя в CloudStorage
        async function saveUserData() {
            try {
                // Сохраняем баланс
                await tg.CloudStorage.setItem('user_balance', state.balance.toString());
                
                // Сохраняем избранное
                await tg.CloudStorage.setItem('user_favorites', JSON.stringify(state.favorites));
                
                // Сохраняем покупки
                await tg.CloudStorage.setItem('user_purchases', JSON.stringify(state.purchases));
                
                console.log('User data saved to CloudStorage');
            } catch (error) {
                console.error('Error saving user data:', error);
                tg.showAlert('Ошибка сохранения данных');
            }
        }

        // Загрузка тестовых данных
        function loadMockData() {
            state.beats = [
                {
                    id: '1',
                    title: 'Dark Trap Beat',
                    genre: 'trap',
                    bpm: 140,
                    price: 50,
                    cover: 'https://via.placeholder.com/300',
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
                    cover: 'https://via.placeholder.com/300',
                    audio: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
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
                    cover: 'https://via.placeholder.com/300',
                    audio: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
                    artist: tg.initDataUnsafe.user?.username || 'You',
                    duration: 185,
                    uploadDate: '2025-04-28',
                    sales: 3,
                    earned: 120
                }
            ];
        }

        // Установка обработчиков событий
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
            document.getElementById('uploadBeatBtn').addEventListener('click', () => {
                document.getElementById('uploadModal').classList.add('active');
            });
            
            document.getElementById('cancelUpload').addEventListener('click', () => {
                document.getElementById('uploadModal').classList.remove('active');
            });
            
            document.getElementById('uploadForm').addEventListener('submit', (e) => {
                e.preventDefault();
                uploadNewBeat();
            });
            
            // Аудио плеер
            const audioPlayer = document.getElementById('audioPlayer');
            const playPauseBtn = document.getElementById('playPauseBtn');
            
            playPauseBtn.addEventListener('click', togglePlayPause);
            audioPlayer.addEventListener('play', () => {
                state.isPlaying = true;
                updatePlayPauseButton();
            });
            audioPlayer.addEventListener('pause', () => {
                state.isPlaying = false;
                updatePlayPauseButton();
            });
            audioPlayer.addEventListener('timeupdate', updateProgressBar);
            document.getElementById('progressBar').addEventListener('input', seekAudio);
            
            // Избранное и покупки
            document.getElementById('favoriteBtn').addEventListener('click', toggleFavorite);
            document.getElementById('buyBtn').addEventListener('click', purchaseBeat);
            
            // Поиск и фильтры
            document.getElementById('searchInput').addEventListener('input', filterBeats);
            document.getElementById('genreFilter').addEventListener('change', filterBeats);
            document.getElementById('bpmFilter').addEventListener('change', filterBeats);
            
            // Выход
            document.getElementById('logoutBtn').addEventListener('click', () => {
                tg.close();
            });
            
            // Закрытие плеера
            document.getElementById('closePlayer').addEventListener('click', closePlayer);
        }

        // Обновление интерфейса
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
                        renderProfile();
                        break;
                }
            } else {
                renderMyBeats();
                updateSellerStats();
            }
            
            // Баланс
            document.getElementById('userBalance').textContent = `${state.balance} Stars`;
        }

        // Рендеринг сетки битов
        function renderBeatsGrid() {
            const beatsGrid = document.getElementById('beatsGrid');
            beatsGrid.innerHTML = '';
            
            state.beats.forEach(beat => {
                beatsGrid.appendChild(createBeatCard(beat));
            });
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
                    favoritesGrid.appendChild(createBeatCard(beat));
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
                    purchasesGrid.appendChild(createBeatCard(beat));
                }
            });
        }

        // Рендеринг профиля
        function renderProfile() {
            const profileInfo = document.getElementById('profileInfo');
            const user = tg.initDataUnsafe.user || {};
            
            profileInfo.innerHTML = `
                <div class="profile-card">
                    <div class="profile-avatar">
                        ${user.photo_url ? `<img src="${user.photo_url}" alt="${user.first_name}">` : '👤'}
                    </div>
                    <div class="profile-details">
                        <h3>${user.first_name || ''} ${user.last_name || ''}</h3>
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
        }

        // Рендеринг битов продавца
        function renderMyBeats() {
            const myBeatsList = document.getElementById('myBeatsList');
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
                            <span>${beat.earned || 0} Stars</span>
                        </div>
                    </div>
                `;
                myBeatsList.appendChild(beatItem);
            });
        }

        // Обновление статистики продавца
        function updateSellerStats() {
            const totalSales = state.myBeats.reduce((sum, beat) => sum + (beat.sales || 0), 0);
            const totalEarned = state.myBeats.reduce((sum, beat) => sum + (beat.earned || 0), 0);
            
            document.getElementById('totalSales').textContent = totalSales;
            document.getElementById('totalEarned').textContent = totalEarned;
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

        // Фильтрация битов
        function filterBeats() {
            const searchTerm = document.getElementById('searchInput').value.toLowerCase();
            const genreFilter = document.getElementById('genreFilter').value;
            const bpmFilter = document.getElementById('bpmFilter').value;
            
            const beatsGrid = document.getElementById('beatsGrid');
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

        // Открытие плеера
        function openPlayer(beat) {
            state.currentBeat = beat;
            
            document.getElementById('playerTitle').textContent = beat.title;
            document.getElementById('playerInfo').textContent = `Жанр: ${getGenreName(beat.genre)} • BPM: ${beat.bpm}`;
            document.getElementById('beatPriceDisplay').textContent = beat.price;
            
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

        // Закрытие плеера
        function closePlayer() {
            const audioPlayer = document.getElementById('audioPlayer');
            audioPlayer.pause();
            document.getElementById('playerModal').classList.remove('active');
            state.currentBeat = null;
        }

        // Переключение воспроизведения
        function togglePlayPause() {
            const audioPlayer = document.getElementById('audioPlayer');
            
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

        // Обновление кнопки воспроизведения
        function updatePlayPauseButton() {
            document.getElementById('playPauseBtn').innerHTML = state.isPlaying ? '⏸️' : '▶️';
        }

        // Обновление прогресс-бара
        function updateProgressBar() {
            const audioPlayer = document.getElementById('audioPlayer');
            const progressBar = document.getElementById('progressBar');
            const currentTime = document.getElementById('currentTime');
            const duration = document.getElementById('duration');
            
            const current = audioPlayer.currentTime;
            const dur = audioPlayer.duration || state.currentBeat?.duration || 0;
            
            progressBar.max = dur;
            progressBar.value = current;
            
            currentTime.textContent = formatTime(current);
            duration.textContent = formatTime(dur);
        }

        // Перемотка аудио
        function seekAudio() {
            const audioPlayer = document.getElementById('audioPlayer');
            const progressBar = document.getElementById('progressBar');
            audioPlayer.currentTime = progressBar.value;
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
            
            const favoriteBtn = document.getElementById('favoriteBtn');
            const isFavorite = state.favorites.includes(state.currentBeat.id);
            
            favoriteBtn.innerHTML = isFavorite ? 'В избранном' : 'В избранное';
            favoriteBtn.classList.toggle('active', isFavorite);
        }

        // Переключение избранного
        async function toggleFavorite() {
            if (!state.currentBeat) return;
            
            const index = state.favorites.indexOf(state.currentBeat.id);
            if (index === -1) {
                state.favorites.push(state.currentBeat.id);
            } else {
                state.favorites.splice(index, 1);
            }
            
            await saveUserData();
            updateFavoriteButton();
        }

        // Обновление кнопки покупки
        function updatePurchaseButton() {
            if (!state.currentBeat) return;
            
            const buyBtn = document.getElementById('buyBtn');
            const isPurchased = state.purchases.includes(state.currentBeat.id);
            buyBtn.style.display = isPurchased ? 'none' : 'flex';
        }

        // Покупка бита
        async function purchaseBeat() {
            if (!state.currentBeat) return;
            
            if (state.purchases.includes(state.currentBeat.id)) {
                tg.showAlert('Вы уже купили этот бит');
                return;
            }
            
            if (state.balance < state.currentBeat.price) {
                tg.showPopup({
                    title: 'Недостаточно Stars',
                    message: `У вас ${state.balance} Stars, требуется ${state.currentBeat.price} Stars`,
                    buttons: [{
                        id: 'topup',
                        type: 'default',
                        text: 'Пополнить'
                    }, {
                        id: 'cancel',
                        type: 'cancel',
                        text: 'Отмена'
                    }]
                }, async (buttonId) => {
                    if (buttonId === 'topup') {
                        const amount = Math.max(state.currentBeat.price * 2, 100);
                        tg.openInvoice({
                            currency: 'STARS',
                            amount: amount,
                            description: 'Пополнение баланса Stars'
                        }, async (status) => {
                            if (status === 'paid') {
                                state.balance += amount;
                                await saveUserData();
                                updateUI();
                                tg.showAlert(`Баланс пополнен на ${amount} Stars!`);
                            }
                        });
                    }
                });
                return;
            }
            
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
            }, async (buttonId) => {
                if (buttonId === 'confirm') {
                    tg.openInvoice({
                        currency: 'STARS',
                        amount: state.currentBeat.price,
                        description: `Покупка бита "${state.currentBeat.title}"`
                    }, async (status) => {
                        if (status === 'paid') {
                            state.purchases.push(state.currentBeat.id);
                            state.balance -= state.currentBeat.price;
                            
                            await saveUserData();
                            updateUI();
                            updatePurchaseButton();
                            
                            tg.showAlert(`Покупка успешна! Остаток: ${state.balance} Stars`);
                        }
                    });
                }
            });
        }

        // Загрузка нового бита
        async function uploadNewBeat() {
            const title = document.getElementById('beatTitle').value.trim();
            const genre = document.getElementById('beatGenre').value;
            const bpm = parseInt(document.getElementById('beatBpm').value);
            const price = parseInt(document.getElementById('beatPrice').value);
            const file = document.getElementById('beatFile').files[0];
            
            if (!title || !genre || isNaN(bpm) || isNaN(price) || !file) {
                tg.showAlert('Пожалуйста, заполните все поля корректно');
                return;
            }
            
            const newBeat = {
                id: Date.now().toString(),
                title,
                genre,
                bpm,
                price,
                cover: null,
                audio: URL.createObjectURL(file),
                artist: tg.initDataUnsafe.user?.username || 'You',
                duration: 180,
                uploadDate: new Date().toISOString().split('T')[0],
                sales: 0,
                earned: 0
            };
            
            state.myBeats.unshift(newBeat);
            document.getElementById('uploadModal').classList.remove('active');
            document.getElementById('uploadForm').reset();
            
            updateUI();
            tg.showAlert('Бит успешно загружен!');
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

        // Запуск приложения
        document.addEventListener('DOMContentLoaded', init);
