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
    isSearchingProducers: false,
    lastSearchQuery: '',
    currentSection: 'discover',
    currentProducer: null,
    producers: [],
    gangs: [],
    currentGang: null
};

// Инициализация приложения
async function init() {
    await fetchUserBalance();
    setupNavigation();
    setupEventListeners();
    await loadBeatsFromServer();
    await loadProducers();
    await loadGangs();
    createAdditionalSections();
    updateUI();
    await loadUserData();
    setupSearch();

    tg.onEvent('invoiceClosed', async (eventData) => {
        if (eventData.status === 'paid') {
            await fetchUserBalance();
            const payload = JSON.parse(eventData.payload || '{}');
            if (payload.beatId) {
                state.purchases.push(payload.beatId);
                updateUI();
                tg.showAlert('Покупка подтверждена! Теперь вы можете слушать бит полностью.');
            }
        }
    });
}

// Новая функция для настройки навигации
function setupNavigation() {
    const navContainer = document.querySelector('.bottom-nav');
    const buyerNavTemplate = document.getElementById('buyerNav');
    const sellerNavTemplate = document.getElementById('sellerNav');
    
    // Проверяем, что шаблоны существуют
    if (!buyerNavTemplate || !sellerNavTemplate) {
        console.error('Navigation templates not found');
        return;
    }
    
    // Определяем текущую активную секцию
    const currentActiveBtn = navContainer.querySelector('.nav-btn.active');
    let currentSection = currentActiveBtn ? currentActiveBtn.dataset.section : 
                       (state.role === 'buyer' ? 'discover' : 'myBeats');
    
    // Очищаем навигацию
    navContainer.innerHTML = '';
    
    // Клонируем и добавляем соответствующий шаблон
    let newNav;
    if (state.role === 'buyer') {
        newNav = buyerNavTemplate.content.cloneNode(true);
    } else {
        newNav = sellerNavTemplate.content.cloneNode(true);
    }
    
    navContainer.appendChild(newNav);
    
    // Устанавливаем активную кнопку
    const newActiveBtn = navContainer.querySelector(`.nav-btn[data-section="${currentSection}"]`);
    if (newActiveBtn) {
        newActiveBtn.classList.add('active');
        state.currentSection = currentSection;
    } else {
        // Если не нашли кнопку для текущей секции, устанавливаем первую доступную
        const firstNavBtn = navContainer.querySelector('.nav-btn');
        if (firstNavBtn) {
            firstNavBtn.classList.add('active');
            state.currentSection = firstNavBtn.dataset.section;
        }
    }
    
    // Обновляем обработчики событий
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const section = btn.dataset.section;
            state.currentSection = section;
            
            if (section === 'upload') {
                document.getElementById('uploadModal').classList.add('active');
            } else {
                document.getElementById('uploadModal').classList.remove('active');
            }
            
            updateUI();
        });
    });
}

async function loadProducers() {
    try {
        const response = await fetch('https://beatmarketserver.onrender.com/producers');
        if (response.ok) {
            state.producers = await response.json();
        }
    } catch (error) {
        console.error('Ошибка загрузки продюсеров:', error);
    }
}

async function loadGangs() {
    try {
        const response = await fetch('https://beatmarketserver.onrender.com/gangs');
        if (response.ok) {
            state.gangs = await response.json();
        }
    } catch (error) {
        console.error('Ошибка загрузки гэнгов:', error);
    }
}

async function loadBeatsFromServer() {
    try {
        const response = await fetch('https://beatmarketserver.onrender.com/beats');
        if (response.ok) {
            const serverBeats = await response.json();
            state.beats = serverBeats.map(beat => ({
                ...beat,
                id: beat._id || beat.id
            }));
            updateMyBeats();
        }
    } catch (error) {
        console.error('Ошибка загрузки битов:', error);
    }
}

function updateMyBeats() {
    if (tg.initDataUnsafe?.user?.id) {
        const userId = tg.initDataUnsafe.user.id.toString();
        state.myBeats = state.beats.filter(
            beat => beat.ownerTelegramId && beat.ownerTelegramId.toString() === userId
        );
    } else {
        state.myBeats = [];
    }
}

async function fetchUserBalance() {
    try {
        if (tg?.initDataUnsafe?.user?.id) {
            const response = await fetch(`https://beatmarketserver.onrender.com/user/${tg.initDataUnsafe.user.id}`);
            if (response.ok) {
                const userData = await response.json();
                state.balance = userData.balance || 0;
            }
        }
    } catch (error) {
        console.error('Error fetching user balance:', error);
        state.balance = 0;
    }
}

// Модифицируйте функцию createAdditionalSections
function createAdditionalSections() {
    const mainContent = document.querySelector('.main-content');
    if (!mainContent) return;

    // Общие секции для всех пользователей
    const favoritesSection = document.createElement('section');
    favoritesSection.className = 'favorites-section';
    favoritesSection.innerHTML = `
        <h2>Избранное</h2>
        <div class="favorites-grid" id="favoritesGrid"></div>
    `;
    mainContent.appendChild(favoritesSection);
    
    const purchasesSection = document.createElement('section');
    purchasesSection.className = 'purchases-section';
    purchasesSection.innerHTML = `
        <h2>Мои покупки</h2>
        <div class="purchases-grid" id="purchasesGrid"></div>
    `;
    mainContent.appendChild(purchasesSection);
    
    const profileSection = document.createElement('section');
    profileSection.className = 'profile-section';
    profileSection.innerHTML = `
        <h2>Мой профиль</h2>
        <div class="profile-info" id="profileInfo"></div>
        <div class="gang-info" id="gangInfo"></div>
        <button class="logout-btn" id="logoutBtn">Выйти</button>
    `;
    mainContent.appendChild(profileSection);

        const statsSection = document.createElement('section');
        statsSection.className = 'stats-section';
        statsSection.innerHTML = `
            <h2>Статистика</h2>
            <div class="stats">
                <div class="stat-card">
                    <h3>Всего продаж</h3>
                    <p id="totalSales">0</p>
                </div>
                <div class="stat-card">
                    <h3>Заработано</h3>
                    <p id="totalEarned">0 ⭐</p>
                </div>
                <div class="stat-card">
                    <h3>Битов</h3>
                    <p id="totalBeats">0</p>
                </div>
                <div class="stat-card">
                    <h3>Подписчиков</h3>
                    <p id="totalFollowers">0</p>
                </div>
            </div>
        `;
        mainContent.appendChild(statsSection);
        
        const uploadSection = document.createElement('section');
        uploadSection.className = 'upload-section';
        uploadSection.innerHTML = `
            <h2>Загрузить новый контент</h2>
            <div class="upload-options">
                <button class="upload-option-btn" data-type="beat">
                    <i class="icon-music"></i>
                    <span>Бит</span>
                </button>
                <button class="upload-option-btn" data-type="beatpack">
                    <i class="icon-folder"></i>
                    <span>Битпак</span>
                </button>
                <button class="upload-option-btn" data-type="kit">
                    <i class="icon-drum"></i>
                    <span>Кит</span>
                </button>
                <button class="upload-option-btn" data-type="service">
                    <i class="icon-service"></i>
                    <span>Услуга</span>
                </button>
            </div>
        `;
        mainContent.appendChild(uploadSection);
        
        const myBeatsSection = document.createElement('section');
        myBeatsSection.className = 'my-beats-section';
        myBeatsSection.innerHTML = `
            <h2>Мои биты</h2>
            <div class="my-beats-list" id="myBeatsList"></div>
        `;
        mainContent.appendChild(myBeatsSection);
    

    // Общие секции (если есть)
    const producerSection = document.createElement('section');
    producerSection.className = 'producer-section';
    producerSection.innerHTML = `
        <div class="producer-header" id="producerHeader">
            <button class="back-btn" id="backToBeats">← Назад</button>
            <h2 id="producerName"></h2>
        </div>
        <div class="producer-info" id="producerInfo"></div>
        <h3>Биты этого автора</h3>
        <div class="producer-beats-grid" id="producerBeatsGrid"></div>
    `;
    mainContent.appendChild(producerSection);
    
    // Добавляем превью обложки
    document.getElementById('beatCoverFile')?.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            if (!file.type.match('image.*')) {
                tg.showAlert('Пожалуйста, выберите файл изображения');
                e.target.value = '';
                return;
            }
            
            const reader = new FileReader();
            reader.onload = function(event) {
                const preview = document.getElementById('coverPreview');
                preview.innerHTML = `<img src="${event.target.result}" alt="Превью обложки" style="max-width: 100px; max-height: 100px;">`;
            };
            reader.readAsDataURL(file);
        }
    });
}

// Функция для открытия карточки битмейкера
async function openProducer(producerId) {
    try {
        state.currentSectionBeforeProducer = state.currentSection;
        
        const response = await fetch(`https://beatmarketserver.onrender.com/producer/${producerId}`);
        if (!response.ok) throw new Error('Producer not found');
        
        const producer = await response.json();
        state.currentProducer = producer;
        state.currentSection = 'producer';
        
        document.getElementById('producerName').textContent = producer.name;
        
        const producerInfo = document.getElementById('producerInfo');
        producerInfo.innerHTML = `
            <div class="producer-card">
                <img src="${producer.avatar || 'https://via.placeholder.com/150'}" 
                     alt="${producer.name}" class="producer-avatar">
                <div class="producer-stats">
                    <div class="stat-item">
                        <span>${producer.beats?.length || 0}</span>
                        <span>Битов</span>
                    </div>
                    <div class="stat-item">
                        <span>${producer.followers || 0}</span>
                        <span>Подписчиков</span>
                    </div>
                </div>
                ${producer.id !== tg.initDataUnsafe.user?.id ? 
                `<button class="follow-btn" id="followBtn">
                    ${producer.followersList?.includes(tg.initDataUnsafe.user?.id.toString()) ? 'Отписаться' : 'Подписаться'}
                </button>` : ''}
            </div>
            ${producer.gang ? `
            <div class="producer-gang">
                <h4>Гэнг: ${producer.gang.name}</h4>
                <div class="gang-members">
                    ${producer.gang.members.map(member => `
                        <div class="gang-member">
                            <img src="${member.avatar || 'https://via.placeholder.com/50'}" alt="${member.name}">
                            <span>${member.name}</span>
                        </div>
                    `).join('')}
                </div>
            </div>` : ''}
        `;
        
        const beatsResponse = await fetch(`https://beatmarketserver.onrender.com/beats?producer=${producerId}`);
        const producerBeats = beatsResponse.ok ? await beatsResponse.json() : [];
        
        const grid = document.getElementById('producerBeatsGrid');
        grid.innerHTML = '';
        producerBeats.forEach(beat => {
            grid.appendChild(createBeatCard(beat));
        });
        
        updateUI();
        
        document.getElementById('backToBeats').addEventListener('click', backToBeats);
        document.getElementById('followBtn')?.addEventListener('click', toggleFollow);
    } catch (error) {
        console.error('Error opening producer:', error);
        tg.showAlert('Не удалось загрузить информацию о битмейкере');
        backToBeats();
    }
}

function backToBeats() {
    if (state.isSearchingProducers) {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.value = state.lastSearchQuery;
        }
    }
    
    state.currentSection = state.currentSectionBeforeProducer || 'discover';
    state.currentProducer = null;
    
    updateUI();
    
    if (state.isSearchingProducers && state.lastSearchQuery) {
        const producerName = state.lastSearchQuery.substring(1);
        const foundProducers = state.producers.filter(p => 
            p.name.toLowerCase().includes(producerName)
        );
        showProducerSearchResults(foundProducers);
    }
}

async function loadUserData() {
    if (tg.initDataUnsafe?.user) {
        const userId = tg.initDataUnsafe.user.id;
        try {
            const res = await fetch(`https://beatmarketserver.onrender.com/user/${userId}`);
            const userData = await res.json();

            if (tg?.CloudStorage?.setItem) {
                await tg.CloudStorage.setItem('favorites', JSON.stringify(userData.favorites || []));
                await tg.CloudStorage.setItem('purchases', JSON.stringify(userData.purchases || []));
            }

            state.favorites = userData.favorites?.map(b => b._id?.toString() || b.toString()) || [];
            state.purchases = userData.purchases?.map(b => b._id?.toString() || b.toString()) || [];
            
            updateProfileSection(userData);
        } catch (error) {
            console.error('Error loading user data:', error);
            if (tg?.CloudStorage?.getItem) {
                const favs = await tg.CloudStorage.getItem('favorites');
                const purchases = await tg.CloudStorage.getItem('purchases');
                state.favorites = favs ? JSON.parse(favs) : [];
                state.purchases = purchases ? JSON.parse(purchases) : [];
            } else {
                state.favorites = [];
                state.purchases = [];
            }
        }
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
            <div class="stat-item">
                <span>${state.myBeats.length}</span>
                <span>Битов</span>
            </div>
        </div>
    `;

    // Обновляем информацию о гэнге
    const gangInfo = document.getElementById('gangInfo');
    if (gangInfo) {
        const userGang = state.gangs.find(g => 
            g.members.some(m => m.id === tg.initDataUnsafe.user?.id)
        );
        
        if (userGang) {
            gangInfo.innerHTML = `
                <div class="gang-card">
                    <h3>Гэнг: ${userGang.name}</h3>
                    <div class="gang-members">
                        ${userGang.members.map(member => `
                            <div class="gang-member">
                                <img src="${member.avatar || 'https://via.placeholder.com/50'}" alt="${member.name}">
                                <span>${member.name}</span>
                            </div>
                        `).join('')}
                    </div>
                    <button class="leave-gang-btn" id="leaveGangBtn">Покинуть гэнг</button>
                </div>
            `;
            
            document.getElementById('leaveGangBtn')?.addEventListener('click', leaveGang);
        } else {
            gangInfo.innerHTML = `
                <button class="create-gang-btn" id="createGangBtn">Создать гэнг</button>
                <button class="join-gang-btn" id="joinGangBtn">Присоединиться к гэнгу</button>
            `;
            
            document.getElementById('createGangBtn')?.addEventListener('click', showCreateGangModal);
            document.getElementById('joinGangBtn')?.addEventListener('click', showJoinGangModal);
        }
    }

    document.getElementById('topupBtn')?.addEventListener('click', topUpBalance);
}

function showCreateGangModal() {
    tg.showPopup({
        title: 'Создать гэнг',
        message: 'Введите название вашего гэнга:',
        buttons: [
            { id: 'create', type: 'default', text: 'Создать' },
            { id: 'cancel', type: 'cancel', text: 'Отмена' }
        ]
    }, async (buttonId) => {
        if (buttonId === 'create') {
            const gangName = prompt('Введите название гэнга:');
            if (gangName && gangName.trim()) {
                try {
                    const response = await fetch('https://beatmarketserver.onrender.com/gangs', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            name: gangName.trim(),
                            creatorId: tg.initDataUnsafe.user?.id,
                            members: [{
                                id: tg.initDataUnsafe.user?.id,
                                name: tg.initDataUnsafe.user?.first_name || 'User',
                                avatar: tg.initDataUnsafe.user?.photo_url
                            }]
                        })
                    });
                    
                    if (response.ok) {
                        const newGang = await response.json();
                        state.gangs.push(newGang);
                        updateUI();
                        tg.showAlert(`Гэнг "${newGang.name}" успешно создан!`);
                    } else {
                        const error = await response.json();
                        tg.showAlert(error.message || 'Ошибка создания гэнга');
                    }
                } catch (error) {
                    console.error('Error creating gang:', error);
                    tg.showAlert('Ошибка соединения');
                }
            }
        }
    });
}

function showJoinGangModal() {
    const availableGangs = state.gangs.filter(gang => 
        !gang.members.some(m => m.id === tg.initDataUnsafe.user?.id)
    );
    
    if (availableGangs.length === 0) {
        tg.showAlert('Нет доступных гэнгов для присоединения');
        return;
    }
    
    const buttons = availableGangs.map(gang => ({
        id: gang.id,
        type: 'default',
        text: gang.name
    }));
    
    buttons.push({ id: 'cancel', type: 'cancel', text: 'Отмена' });
    
    tg.showPopup({
        title: 'Выберите гэнг',
        message: 'К какому гэнгу вы хотите присоединиться?',
        buttons: buttons
    }, async (buttonId) => {
        if (buttonId !== 'cancel') {
            try {
                const response = await fetch(`https://beatmarketserver.onrender.com/gangs/${buttonId}/join`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: tg.initDataUnsafe.user?.id,
                        userName: tg.initDataUnsafe.user?.first_name || 'User',
                        userAvatar: tg.initDataUnsafe.user?.photo_url
                    })
                });
                
                if (response.ok) {
                    const updatedGang = await response.json();
                    const index = state.gangs.findIndex(g => g.id === updatedGang.id);
                    if (index !== -1) {
                        state.gangs[index] = updatedGang;
                    }
                    updateUI();
                    tg.showAlert(`Вы присоединились к гэнгу "${updatedGang.name}"!`);
                } else {
                    const error = await response.json();
                    tg.showAlert(error.message || 'Ошибка присоединения к гэнгу');
                }
            } catch (error) {
                console.error('Error joining gang:', error);
                tg.showAlert('Ошибка соединения');
            }
        }
    });
}

async function leaveGang() {
    tg.showPopup({
        title: 'Покинуть гэнг',
        message: 'Вы уверены, что хотите покинуть гэнг?',
        buttons: [
            { id: 'leave', type: 'destructive', text: 'Покинуть' },
            { id: 'cancel', type: 'cancel', text: 'Отмена' }
        ]
    }, async (buttonId) => {
        if (buttonId === 'leave') {
            try {
                const userId = tg.initDataUnsafe.user?.id;
                const gang = state.gangs.find(g => 
                    g.members.some(m => m.id === userId)
                );
                
                if (!gang) {
                    tg.showAlert('Ошибка: гэнг не найден');
                    return;
                }
                
                const response = await fetch(`https://beatmarketserver.onrender.com/gangs/${gang.id}/leave`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId })
                });
                
                if (response.ok) {
                    const updatedGang = await response.json();
                    const index = state.gangs.findIndex(g => g.id === updatedGang.id);
                    if (index !== -1) {
                        if (updatedGang.members.length === 0) {
                            state.gangs.splice(index, 1);
                        } else {
                            state.gangs[index] = updatedGang;
                        }
                    }
                    updateUI();
                    tg.showAlert('Вы покинули гэнг');
                } else {
                    const error = await response.json();
                    tg.showAlert(error.message || 'Ошибка выхода из гэнга');
                }
            } catch (error) {
                console.error('Error leaving gang:', error);
                tg.showAlert('Ошибка соединения');
            }
        }
    });
}

function setupEventListeners() {
    // Роли
    document.querySelectorAll('.role-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            state.role = btn.dataset.role;
            setupNavigation();
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
    
    // Опции загрузки
    document.querySelectorAll('.upload-option-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.type;
            showUploadModalForType(type);
        });
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

function showUploadModalForType(type) {
    const modalTitle = {
        beat: 'Загрузить бит',
        beatpack: 'Загрузить битпак',
        kit: 'Загрузить кит',
        service: 'Добавить услугу'
    }[type];
    
    document.getElementById('uploadModal').classList.add('active');
    document.getElementById('uploadModal').querySelector('h2').textContent = modalTitle;
    document.getElementById('uploadForm').dataset.type = type;
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
    
    // Скрываем все секции сначала
    document.querySelectorAll('section').forEach(section => {
        section.style.display = 'none';
    });
    
    if (state.role === 'buyer') {
        // Показываем соответствующие секции для покупателя
        switch(state.currentSection) {
            case 'discover':
                document.querySelector('.buyer-section').style.display = 'block';
                renderBeatsGrid();
                break;
            case 'favorites':
                document.querySelector('.favorites-section').style.display = 'block';
                renderFavorites();
                break;
            case 'purchases':
                document.querySelector('.purchases-section').style.display = 'block';
                renderPurchases();
                break;
            case 'profile':
                document.querySelector('.profile-section').style.display = 'block';
                if (tg.initDataUnsafe?.user) updateProfileSection(tg.initDataUnsafe.user);
                break;
        }
    } 
    if (state.role === 'seller') {
        // Показываем соответствующие секции для битмейкера
        // document.querySelector('.seller-section').style.display = 'block';
        
        switch(state.currentSection) {
            case 'myBeats':
                document.querySelector('.my-beats-section').style.display = 'block';
                renderMyBeats();
                break;
            case 'upload':
                document.querySelector('.upload-section').style.display = 'block';
                break;
            case 'stats':
                document.querySelector('.stats-section').style.display = 'block';
                updateSellerStats();
                break;
            case 'profile':
                document.querySelector('.profile-section').style.display = 'block';
                if (tg.initDataUnsafe?.user) updateProfileSection(tg.initDataUnsafe.user);
                break;
        }
    }
    
    // Баланс
    const userBalance = document.getElementById('userBalance');
    if (userBalance) {
        userBalance.textContent = `${state.balance} ⭐`;
    }

    if (state.currentSection === 'producer') {
        document.querySelector('.producer-section').style.display = 'block';
    }
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

function renderBeatsGrid() {
    const beatsGrid = document.getElementById('beatsGrid');
    if (!beatsGrid) return;
    
    beatsGrid.innerHTML = '';
    
    state.beats.forEach(beat => {
        beatsGrid.appendChild(createBeatCard(beat));
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
                <button class="delete-beat-btn" data-beatid="${beat._id || beat.id}">×</button>
            </div>
            <div class="beat-info">
                <div class="beat-title">${beat.title}</div>
                <div class="beat-meta">
                    <span>${beat.sales || 0} продаж</span>
                    <span>${beat.earned || 0} ⭐</span>
                </div>
            </div>
        `;
        
        beatItem.querySelector('.delete-beat-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteBeat(beat._id || beat.id);
        });
        
        myBeatsList.appendChild(beatItem);
    });
}

function updateSellerStats() {
    const totalSales = state.myBeats.reduce((sum, beat) => sum + (beat.sales || 0), 0);
    const totalEarned = state.myBeats.reduce((sum, beat) => sum + (beat.earned || 0), 0);
    const totalBeats = state.myBeats.length;
    
    // Находим текущего пользователя среди продюсеров
    const currentProducer = state.producers.find(p => p.id === tg.initDataUnsafe.user?.id?.toString());
    const totalFollowers = currentProducer?.followers || 0;
    
    document.getElementById('totalSales').textContent = totalSales;
    document.getElementById('totalEarned').textContent = `${totalEarned} ⭐`;
    document.getElementById('totalBeats').textContent = totalBeats;
    document.getElementById('totalFollowers').textContent = totalFollowers;
}

function createBeatCard(beat) {
    const isFavorite = state.favorites.includes(beat._id || beat.id);
    const isPurchased = state.purchases.includes(beat._id || beat.id);
    const isOwner = beat.ownerTelegramId === tg.initDataUnsafe.user?.id;
    
    // Находим продюсера для этого бита
    const producer = state.producers.find(p => p.id === beat.ownerTelegramId) || 
                    state.producers.find(p => p.beats.includes(beat._id || beat.id));
    
    const beatCard = document.createElement('div');
    beatCard.className = 'beat-card';
    beatCard.innerHTML = `
        <div class="beat-cover">
            ${beat.cover ? `<img src="${beat.cover}" alt="${beat.title}">` : ''}
            ${isOwner ? `<button class="delete-beat-btn" data-beatid="${beat._id || beat.id}">×</button>` : ''}
        </div>
        <div class="beat-info">
            <div class="beat-title">${beat.title}</div>
            <div class="beat-meta">
                <span class="producer-link" data-producer="${beat.ownerTelegramId || getProducerIdByBeat(beat._id || beat.id)}">
                    ${producer?.name || beat.artist}
                </span>
                <span>${beat.price} ⭐</span>
            </div>
        </div>
    `;
  
  beatCard.querySelector('.beat-cover').addEventListener('click', () => openPlayer(beat));
  
  // Обновленный обработчик для клика по имени продюсера
  beatCard.querySelector('.producer-link').addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const producerId = e.target.getAttribute('data-producer');
    if (producerId) {
      openProducer(producerId);
    }
  });
  
 if (isOwner) {
    beatCard.querySelector('.delete-beat-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteBeat(beat._id || beat.id);
    });
  }
  return beatCard;
}

async function deleteBeat(beatId) {
    if (!beatId) {
        tg.showAlert('Не указан ID бита для удаления');
        return;
    }

    tg.showPopup({
        title: 'Подтвердите удаление',
        message: 'Вы действительно хотите удалить этот бит?',
        buttons: [
            { id: 'confirm', type: 'destructive', text: 'Да, удалить' },
            { id: 'cancel', type: 'cancel', text: 'Отмена' }
        ]
    }, async (buttonId) => {
        if (buttonId === 'confirm') {
            try {
                const userId = tg.initDataUnsafe.user?.id;
                if (!userId) {
                    tg.showAlert('Ошибка: пользователь не идентифицирован');
                    return;
                }

                console.log('Deleting beat:', { beatId, userId }); // Логирование для отладки

                const response = await fetch(`https://beatmarketserver.onrender.com/beat/${beatId}`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        userId: userId.toString() // Явное преобразование в строку
                    })
                });

                const result = await response.json();
                console.log('Delete response:', result); // Логирование ответа

                if (response.ok) {
                    // Обновляем состояние
                    state.beats = state.beats.filter(b => (b._id || b.id) !== beatId);
                    state.myBeats = state.myBeats.filter(b => (b._id || b.id) !== beatId);
                    
                    updateUI();
                    tg.showAlert('Бит успешно удален');
                } else {
                    const error = result.message || 'Не удалось удалить бит';
                    console.error('Delete error:', error);
                    tg.showAlert(`Ошибка: ${error}`);
                }
            } catch (error) {
                console.error('Ошибка при удалении бита:', error);
                tg.showAlert('Произошла ошибка при удалении бита. Проверьте соединение.');
            }
        }
    });
}

// Вспомогательная функция для поиска битмейкера по ID бита
function getProducerIdByBeat(beatId) {
  const beat = state.beats.find(b => (b._id || b.id) === beatId);
  if (!beat) return '';
  
  // Для битов с указанным владельцем
  if (beat.ownerTelegramId) {
    return beat.ownerTelegramId;
  }
  
  // Для старых битов (если нет ownerTelegramId)
  const producer = state.producers.find(p => p.beats.includes(beatId));
  return producer ? producer._id : '';
}

async function followProducer(producerId) {
    try {
        const response = await fetch('https://beatmarketserver.onrender.com/follow', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: tg.initDataUnsafe.user?.id,
                producerId
            })
        });
        
        if (response.ok) {
            tg.showAlert('Вы успешно подписались на битмейкера');
            const producerResponse = await fetch(`https://beatmarketserver.onrender.com/producer/${producerId}`);
            if (producerResponse.ok) {
                state.currentProducer = await producerResponse.json();
                updateUI();
            }
        } else {
            const error = await response.json();
            tg.showAlert(error.message || 'Ошибка подписки');
        }
    } catch (error) {
        console.error('Follow error:', error);
        tg.showAlert('Ошибка соединения');
    }
}

function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', async (e) => {
        const query = e.target.value.trim().toLowerCase();
        state.lastSearchQuery = query;
        
        if (query.startsWith('@')) {
            state.isSearchingProducers = true;
            const producerName = query.substring(1);
            
            // Загружаем всех продюсеров с сервера
            try {
                const response = await fetch('https://beatmarketserver.onrender.com/producers');
                if (response.ok) {
                    const producers = await response.json();
                    const foundProducers = producers.filter(p => 
                        p.name.toLowerCase().includes(producerName)
                    );
                    showProducerSearchResults(foundProducers);
                }
            } catch (error) {
                console.error('Ошибка поиска продюсеров:', error);
                showProducerSearchResults([]);
            }
        } else {
            state.isSearchingProducers = false;
            filterBeats();
        }
    });
}

// Показываем результаты поиска по битмейкерам
function showProducerSearchResults(producers) {
    const beatsGrid = document.getElementById('beatsGrid');
    beatsGrid.innerHTML = '';
    document.body.classList.add('searching'); // Добавляем класс searching

    if (producers.length === 0) {
        beatsGrid.innerHTML = '<p class="empty-message">Битмейкеры не найдены</p>';
        return;
    }
    
    producers.forEach(producer => {
        const card = document.createElement('div');
        card.className = 'producer-search-card';
        card.innerHTML = `
            <img src="${producer.avatar}" alt="${producer.name}" class="producer-search-avatar">
            <div class="producer-search-info">
                <h3>${producer.name}</h3>
                <p>${producer.beats.length} битов • ${producer.followers} подписчиков</p>
            </div>
        `;
        card.addEventListener('click', () => {
            openProducer(producer._id);
            // Сохраняем состояние поиска
            state.currentSectionBeforeProducer = 'discover';
        });
        beatsGrid.appendChild(card);
    });
}

function filterBeats() {
    document.body.classList.remove('searching'); // Убираем класс searching
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
    // Сбрасываем текущее состояние плеера
    const audioPlayer = document.getElementById('audioPlayer');
    if (audioPlayer) {
        audioPlayer.pause();
        audioPlayer.currentTime = 0;
    }
    
    state.currentBeat = beat;
    state.isPlaying = false;
    
    document.getElementById('playerTitle').textContent = beat.title;
    document.getElementById('playerInfo').textContent = `Жанр: ${getGenreName(beat.genre)} • BPM: ${beat.bpm}`;
    
    const beatCover = document.getElementById('beatCover');
    beatCover.innerHTML = beat.cover ? 
        `<img src="${beat.cover}" alt="${beat.title}">` : 
        '<div class="default-cover">🎵</div>';
    
    // Обновляем источник аудио
    if (audioPlayer) {
        audioPlayer.src = beat.audio;
        audioPlayer.load(); // Важно: перезагружаем аудио элемент
    }
    
    updateFavoriteButton();
    updatePurchaseButton();
    
    // Сбрасываем прогресс-бар
    const progressBar = document.getElementById('progressBar');
    if (progressBar) {
        progressBar.value = 0;
    }
    document.getElementById('currentTime').textContent = '0:00';
    document.getElementById('duration').textContent = formatTime(beat.duration || 0);
    
    // Показываем модальное окно
    document.getElementById('playerModal').classList.add('active');
    
    // Обновляем состояние кнопки play/pause
    updatePlayPauseButton();
    
    // Если бит куплен, начинаем воспроизведение
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

async function toggleFavorite() {
  const beatId = state.currentBeat?.id;
  const userId = tg.initDataUnsafe.user?.id;

  if (!beatId || !userId) return;

  const isFav = state.favorites.includes(beatId);
  const action = isFav ? 'remove' : 'add';

  try {
    const res = await fetch('https://beatmarketserver.onrender.com/favorite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, beatId, action })
    });

    if (!res.ok) throw new Error('Server error');

    const result = await res.json();
    if (result.success) {
      if (action === 'add') {
        state.favorites.push(beatId);
      } else {
        state.favorites = state.favorites.filter(id => id !== beatId);
      }
      
      // Сохраняем в локальное хранилище
      if (tg?.CloudStorage?.setItem) {
        await tg.CloudStorage.setItem('favorites', JSON.stringify(state.favorites));
      }
      
      updateUI();
      updateFavoriteButton();
    } else {
      tg.showAlert('Ошибка при обновлении избранного');
    }
  } catch (err) {
    console.error('Ошибка toggleFavorite:', err);
    tg.showAlert('Сервер недоступен');
  }
}

async function toggleFollow() {
    try {
        if (!state.currentProducer) return;
        
        const producerId = state.currentProducer.id;
        const userId = tg.initDataUnsafe.user?.id?.toString();
        
        if (!producerId || !userId) {
            tg.showAlert('Ошибка: пользователь не идентифицирован');
            return;
        }

        // Проверяем, не пытается ли пользователь подписаться сам на себя
        if (producerId === userId) {
            tg.showAlert('Вы не можете подписаться на самого себя');
            return;
        }

        // Проверяем текущее состояние подписки
        const isFollowing = state.currentProducer.followersList?.includes(userId);
        const endpoint = isFollowing ? 'unfollow' : 'follow';

        // Показываем loader
        const followBtn = document.getElementById('followBtn');
        if (followBtn) {
            followBtn.disabled = true;
            followBtn.textContent = 'Загрузка...';
        }

        const response = await fetch(`https://beatmarketserver.onrender.com/${endpoint}`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                userId: userId,
                producerId: producerId
            })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Неизвестная ошибка сервера' }));
            throw new Error(error.message || `Ошибка HTTP: ${response.status}`);
        }

        // Обновляем данные продюсера
        const producerResponse = await fetch(`https://beatmarketserver.onrender.com/producer/${producerId}`);
        if (producerResponse.ok) {
            state.currentProducer = await producerResponse.json();
            updateUI();
            tg.showAlert(isFollowing ? 'Вы отписались от битмейкера' : 'Вы подписались на битмейкера');
        } else {
            throw new Error('Не удалось обновить данные продюсера');
        }
    } catch (error) {
        console.error('Follow error:', error);
        tg.showAlert(error.message || 'Произошла ошибка при подписке');
    } finally {
        const followBtn = document.getElementById('followBtn');
        if (followBtn) {
            followBtn.disabled = false;
            followBtn.textContent = state.currentProducer?.followersList?.includes(tg.initDataUnsafe.user?.id?.toString()) 
                ? 'Отписаться' 
                : 'Подписаться';
        }
    }
}

function updatePurchaseButton() {
    if (!state.currentBeat) return;
    
    const buyBtn = document.getElementById('buyBtn');
    if (!buyBtn) return;
    
    const isPurchased = state.purchases.includes(state.currentBeat.id);
    buyBtn.style.display = isPurchased ? 'none' : 'flex';
    buyBtn.innerHTML = `Купить за ${state.currentBeat.price} ⭐`;
}

// Обновленная функция purchaseBeat с реальным балансом
async function purchaseBeat() {
    if (!state.currentBeat) return;
    
    if (state.purchases.includes(state.currentBeat.id)) {
        tg.showAlert('Вы уже купили этот бит');
        return;
    }
    
    // Получаем актуальный баланс перед покупкой
    await fetchUserBalance();
    
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
                    currency: 'XTR',
                    amount: state.currentBeat.price * 100,
                    description: `Покупка бита: ${state.currentBeat.title}`,
                    payload: JSON.stringify({
                        beatId: state.currentBeat.id,
                        userId: tg.initDataUnsafe.user?.id
                    })
                });
                
                if (result.status === 'paid') {
                    // Успешная оплата
                    state.purchases.push(state.currentBeat.id);
                    
                    // Обновляем баланс после покупки
                    state.balance -= state.currentBeat.price;
                    await updateTelegramBalance(state.balance);
                    
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

async function uploadNewBeat() {
    const title = document.getElementById('beatTitle').value.trim();
    const genre = document.getElementById('beatGenre').value;
    const bpm = parseInt(document.getElementById('beatBpm').value);
    const price = parseFloat(document.getElementById('beatPrice').value);
    const audioFile = document.getElementById('beatFile').files[0];
    const coverFile = document.getElementById('beatCoverFile').files[0];

    if (!title || !genre || isNaN(bpm) || isNaN(price) || !audioFile || !coverFile) {
        tg.showAlert('Пожалуйста, заполните все обязательные поля и загрузите обложку');
        return;
    }

    const uploadBtn = document.getElementById('uploadBtn');
    const originalText = uploadBtn.textContent;
    uploadBtn.textContent = 'Загрузка...';
    uploadBtn.disabled = true;

    const formData = new FormData();
    formData.append('title', title);
    formData.append('genre', genre);
    formData.append('bpm', bpm);
    formData.append('price', price);
    formData.append('artist', tg.initDataUnsafe.user?.username || 'Unknown');
    formData.append('audio', audioFile);
    formData.append('cover', coverFile);
    formData.append('ownerTelegramId', tg.initDataUnsafe.user?.id.toString());
    formData.append('photo_url', tg.initDataUnsafe.user?.photo_url || '');
try {
    const response = await fetch('https://beatmarketserver.onrender.com/upload', {
        method: 'POST',
        body: formData
    });

    const result = await response.json();
    if (result.success && result.beat) {
        // Добавляем новый бит с правильным ID
        const newBeat = {
            ...result.beat,
            id: result.beat._id || result.beat.id,
            ownerTelegramId: tg.initDataUnsafe.user?.id.toString()
        };
        
        state.beats.unshift(newBeat);
        updateMyBeats(); // Явно обновляем myBeats
        
        document.getElementById('uploadModal').classList.remove('active');
        document.getElementById('uploadForm').reset();
        document.getElementById('coverPreview').innerHTML = '';
        updateUI();
        tg.showAlert('Бит успешно загружен!');
    } else {
        tg.showAlert('Ошибка загрузки: ' + (result.error || 'неизвестная ошибка'));
    }
} catch (error) {
    console.error('Ошибка загрузки:', error);
    tg.showAlert('Ошибка при отправке данных на сервер');
} finally {
        uploadBtn.textContent = originalText;
        uploadBtn.disabled = false;
    }
}

// 5. Новая функция для обновления связей продюсеров
function updateProducersBeats() {
  const currentUserId = tg.initDataUnsafe.user?.id?.toString();
  if (!currentUserId) return;

  // Находим все биты текущего пользователя
  const userBeats = state.beats.filter(beat => 
    beat.ownerTelegramId?.toString() === currentUserId
  );
  
  // Находим или создаем продюсера
  let producer = state.producers.find(p => p.id === currentUserId);
  const username = tg.initDataUnsafe.user?.username || 'Unknown';
  
  if (!producer) {
    producer = {
      id: currentUserId,
      name: username,
      avatar: tg.initDataUnsafe.user?.photo_url || 'https://via.placeholder.com/150',
      beats: userBeats.map(beat => beat._id || beat.id),
      followers: 0,
      followersList: []
    };
    state.producers.push(producer);
  } else {
    // Обновляем существующего продюсера
    producer.avatar = tg.initDataUnsafe.user?.photo_url || producer.avatar;
    producer.name = username;
    producer.beats = userBeats.map(beat => beat._id || beat.id);
  }
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
