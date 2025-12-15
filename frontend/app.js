// app.js - полная версия с интеграцией бэкенда

// Инициализация Telegram Web App
const tg = window.Telegram.WebApp;
tg.expand();
tg.enableClosingConfirmation();

// Конфигурация API
const API_BASE_URL = 'https://telegram-job-backend-lnkb.onrender.com/api';
const SOCKET_URL = 'https://telegram-job-backend-lnkb.onrender.com';

// Глобальные переменные
let currentUser = null;
let currentChat = null;
let socket = null;
let userCache = {};
let ads = [];
let notifications = [];
let chats = [];

// Инициализация приложения
document.addEventListener('DOMContentLoaded', async function() {
    // Добавляем класс loaded после загрузки
    setTimeout(() => {
        document.body.classList.add('loaded');
    }, 500);

    // Предотвращаем зум на iOS при фокусе
    document.addEventListener('touchstart', function(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
            e.target.style.fontSize = '16px';
        }
    });
    
    // Исправляем отступы для iOS
    if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
        document.documentElement.style.setProperty('--safe-area-inset-top', 'env(safe-area-inset-top)');
        document.documentElement.style.setProperty('--safe-area-inset-bottom', 'env(safe-area-inset-bottom)');
    }
    
    // Делаем прокрутку более плавной
    document.querySelectorAll('.chat-container, .modal-content').forEach(el => {
        el.style.webkitOverflowScrolling = 'touch';
    });

    // Инициализация пользователя
    await initUserFromTelegram();
    
    // Настройка обработчиков событий
    setupEventListeners();
    
    // Загрузка данных
    if (currentUser) {
        if (currentUser.role) {
            if (currentUser.role === 'employer') {
                showScreen('employerScreen');
                await loadEmployerAds();
                updateEmployerStats();
            } else {
                showScreen('workerScreen');
                await loadWorkerAds();
                updateWorkerStats();
            }
        } else {
            showScreen('roleScreen');
        }
        
        updateHeaderInfo();
        await loadNotifications();
    }
});

// ============ ФУНКЦИИ АУТЕНТИФИКАЦИИ ============

async function initUserFromTelegram() {
    try {
        const telegramId = tg.initDataUnsafe.user?.id;
        if (!telegramId) {
            console.error('Telegram user ID not found');
            // Создаем тестового пользователя для разработки
            currentUser = {
                id: 1,
                telegram_id: 123456789,
                username: 'testuser',
                first_name: 'Тестовый',
                last_name: 'Пользователь',
                balance: 1000,
                role: null,
                subscription_until: null
            };
            return;
        }

        // Загружаем пользователя
        const response = await fetch(`${API_BASE_URL}/user`, {
            headers: {
                'Authorization': telegramId.toString()
            }
        });

        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
        } else {
            // Создаем нового пользователя
            await createNewUser(telegramId);
        }

        if (currentUser) {
            // Инициализируем WebSocket
            initWebSocket();
        }
    } catch (error) {
        console.error('Error initializing user:', error);
        // Резервный пользователь для разработки
        currentUser = {
            id: 1,
            telegram_id: tg.initDataUnsafe.user?.id || 123456789,
            username: tg.initDataUnsafe.user?.username || 'testuser',
            first_name: tg.initDataUnsafe.user?.first_name || 'Тестовый',
            last_name: tg.initDataUnsafe.user?.last_name || 'Пользователь',
            balance: 1000,
            role: null,
            subscription_until: null
        };
    }
}

async function createNewUser(telegramId) {
    try {
        const userData = {
            username: tg.initDataUnsafe.user?.username,
            first_name: tg.initDataUnsafe.user?.first_name || 'Пользователь',
            last_name: tg.initDataUnsafe.user?.last_name || `#${telegramId}`
        };

        const response = await fetch(`${API_BASE_URL}/user/init`, {
            method: 'POST',
            headers: {
                'Authorization': telegramId.toString(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        });

        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
        }
    } catch (error) {
        console.error('Error creating user:', error);
    }
}

// ============ WEBSOCKET ============

function initWebSocket() {
    if (!currentUser) return;
    
    socket = io(SOCKET_URL, {
        query: {
            userId: currentUser.id
        }
    });
    
    socket.on('connect', () => {
        console.log('WebSocket connected');
    });
    
    socket.on('new-message', (data) => {
        if (currentChat && currentChat.adId === data.adId) {
            addMessageToChat(data.message);
        }
        addNotification({
            type: 'message',
            title: 'Новое сообщение',
            message: `${data.userName}: ${data.message.text.substring(0, 50)}...`
        });
    });
    
    socket.on('new-bid', (data) => {
        if (currentUser.role === 'employer') {
            showNotification(`Новая ставка на ваше объявление: ${data.bid.amount} ₽`);
            addNotification({
                type: 'system',
                title: 'Новая ставка',
                message: `Пользователь ${data.userName} сделал ставку ${data.bid.amount} ₽`
            });
        }
    });
    
    socket.on('disconnect', () => {
        console.log('WebSocket disconnected');
    });
}

// ============ ОСНОВНЫЕ ФУНКЦИИ ============

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    const screen = document.getElementById(screenId);
    if (screen) {
        screen.classList.add('active');
    }
    
    if (screenId === 'employerScreen' || screenId === 'workerScreen') {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.getAttribute('data-screen') === screenId) {
                btn.classList.add('active');
            }
        });
    }
    
    const bottomNav = document.getElementById('bottomNav');
    if (screenId === 'roleScreen' || screenId === 'createAdScreen' || 
        screenId === 'adDetailScreen' || screenId === 'profileScreen' || 
        screenId === 'paymentScreen' || screenId === 'chatScreen' ||
        screenId === 'ratingScreen' || screenId === 'notificationsScreen' ||
        screenId === 'moderationScreen') {
        bottomNav.style.display = 'none';
    } else {
        bottomNav.style.display = 'flex';
    }
}

function showNotification(message, duration = 3000) {
    const notification = document.getElementById('notification');
    const notificationText = document.getElementById('notificationText');
    
    notificationText.textContent = message;
    notification.classList.add('show');
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, duration);
}

function updateHeaderInfo() {
    if (currentUser) {
        document.getElementById('userBalance').textContent = `${currentUser.balance || 0} ₽`;
    }
}

// ============ РАБОТА С ОБЪЯВЛЕНИЯМИ ============

async function loadEmployerAds() {
    try {
        const response = await fetch(`${API_BASE_URL}/ads?type=employer&user_id=${currentUser.id}`, {
            headers: {
                'Authorization': currentUser.telegram_id.toString()
            }
        });
        
        if (!response.ok) throw new Error('Failed to load ads');
        
        const data = await response.json();
        ads = data.ads || [];
        displayEmployerAds();
    } catch (error) {
        console.error('Error loading employer ads:', error);
        showNotification('Ошибка при загрузке объявлений');
    }
}

function displayEmployerAds() {
    const adsList = document.getElementById('employerAdsList');
    const activeTab = document.querySelector('.tab-btn.active')?.getAttribute('data-tab') || 'myAds';
    
    let filteredAds = ads.filter(ad => ad.employer_id === currentUser.id);
    
    if (activeTab === 'activeAds') {
        filteredAds = filteredAds.filter(ad => ad.status === 'active');
    } else if (activeTab === 'completedAds') {
        filteredAds = filteredAds.filter(ad => ad.status === 'completed');
    }
    
    if (filteredAds.length === 0) {
        adsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-clipboard-list"></i>
                <h3>${activeTab === 'myAds' ? 'У вас пока нет объявлений' : 
                     activeTab === 'activeAds' ? 'Нет активных объявлений' : 
                     'Нет завершенных объявлений'}</h3>
                <p>${activeTab === 'myAds' ? 'Создайте первое объявление, чтобы найти исполнителей' : 
                     activeTab === 'activeAds' ? 'Все ваши объявления находятся в работе или завершены' : 
                     'У вас нет завершенных объявлений'}</p>
                ${activeTab === 'myAds' ? '<button id="createFirstAdBtn" class="btn-primary">Создать объявление</button>' : ''}
            </div>
        `;
        
        if (activeTab === 'myAds') {
            document.getElementById('createFirstAdBtn').addEventListener('click', function() {
                showScreen('createAdScreen');
            });
        }
        return;
    }
    
    adsList.innerHTML = '';
    filteredAds.forEach(ad => {
        const adElement = createAdElement(ad, true);
        adsList.appendChild(adElement);
    });
}

async function loadWorkerAds() {
    try {
        const categoryFilter = document.getElementById('categoryFilter').value;
        const priceFilter = document.getElementById('priceFilter').value;
        
        const params = new URLSearchParams({
            type: 'worker',
            user_id: currentUser.id
        });
        
        if (categoryFilter !== 'all') {
            params.append('category', categoryFilter);
        }
        
        const response = await fetch(`${API_BASE_URL}/ads?${params}`, {
            headers: {
                'Authorization': currentUser.telegram_id.toString()
            }
        });
        
        if (!response.ok) throw new Error('Failed to load ads');
        
        const data = await response.json();
        displayWorkerAds(data.ads || [], priceFilter);
    } catch (error) {
        console.error('Error loading worker ads:', error);
        showNotification('Ошибка при загрузке объявлений');
    }
}

function displayWorkerAds(adsList, priceFilter) {
    const container = document.getElementById('workerAdsList');
    let filteredAds = adsList;
    
    if (priceFilter !== 'all') {
        if (priceFilter === 'low') {
            filteredAds = filteredAds.filter(ad => ad.price <= 1000);
        } else if (priceFilter === 'medium') {
            filteredAds = filteredAds.filter(ad => ad.price > 1000 && ad.price <= 5000);
        } else if (priceFilter === 'high') {
            filteredAds = filteredAds.filter(ad => ad.price > 5000);
        }
    }
    
    if (filteredAds.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search"></i>
                <h3>Нет доступных заданий</h3>
                <p>Попробуйте обновить список или изменить фильтры</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = '';
    filteredAds.forEach(ad => {
        const adElement = createAdElement(ad, false);
        container.appendChild(adElement);
    });
}

function createAdElement(ad, isEmployerView) {
    const adElement = document.createElement('div');
    adElement.className = `ad-card ${ad.auction ? 'ad-card-auction' : ''}`;
    
    const categoryColors = {
        delivery: '#28a745',
        cleaning: '#17a2b8',
        repair: '#ffc107',
        computer: '#6610f2',
        other: '#6c757d'
    };
    
    const categoryNames = {
        delivery: 'Доставка',
        cleaning: 'Уборка',
        repair: 'Ремонт',
        computer: 'Компьютерная помощь',
        other: 'Другое'
    };
    
    const currentBid = ad.min_bid || ad.price;
    const auctionEnded = ad.auction && new Date(ad.auction_ends_at) < new Date();
    
    let statusBadge = '';
    if (ad.status === 'taken') {
        statusBadge = '<span class="ad-card-status" style="color: #ffc107; font-weight: 600;">В работе</span>';
    } else if (ad.status === 'completed') {
        statusBadge = '<span class="ad-card-status" style="color: #28a745; font-weight: 600;">Завершено</span>';
    } else if (ad.auction && !auctionEnded) {
        statusBadge = '<span class="ad-card-status" style="color: #6610f2; font-weight: 600;">Аукцион</span>';
    }
    
    let auctionInfo = '';
    if (ad.auction && !isEmployerView) {
        const timeLeft = getTimeLeft(ad.auction_ends_at);
        auctionInfo = `
            <div class="auction-info">
                <h4>${auctionEnded ? 'Аукцион завершен' : 'Идет аукцион'}</h4>
                <div class="auction-stats">
                    <span class="auction-current-bid">Текущая ставка: ${currentBid ? currentBid + ' ₽' : 'Нет ставок'}</span>
                    <span class="auction-time-left">${auctionEnded ? 'Завершен' : 'Осталось: ' + timeLeft}</span>
                </div>
                ${!auctionEnded ? `
                    <div class="auction-bid-form">
                        <input type="number" id="bidInput_${ad.id}" placeholder="Ваша ставка" min="1" max="${ad.price}">
                        <button class="btn-secondary btn-small" onclick="placeBid(${ad.id})">Предложить</button>
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    adElement.innerHTML = `
        <div class="ad-card-header">
            <div class="ad-card-title">${ad.title}</div>
            <div class="ad-card-price">${ad.price} ₽</div>
        </div>
        <div class="ad-card-category" style="background-color: ${categoryColors[ad.category] + '20'}; color: ${categoryColors[ad.category]}">
            ${categoryNames[ad.category]}
            ${ad.auction ? '<span class="auction-badge"><i class="fas fa-gavel"></i> Торги</span>' : ''}
        </div>
        <div class="ad-card-description">${ad.description?.substring(0, 100) || ''}${ad.description?.length > 100 ? '...' : ''}</div>
        ${auctionInfo}
        <div class="ad-card-footer">
            <div class="ad-card-location">
                <i class="fas fa-map-marker-alt"></i>
                <span>${ad.location}</span>
            </div>
            ${statusBadge}
        </div>
        <div class="ad-card-actions">
            ${isEmployerView ? 
                `<button class="ad-card-action-btn details" data-ad-id="${ad.id}">Детали</button>
                 ${ad.status === 'active' ? `<button class="ad-card-action-btn edit" data-ad-id="${ad.id}">Изменить</button>` : ''}` : 
                `<button class="ad-card-action-btn details" data-ad-id="${ad.id}">Подробнее</button>
                 ${ad.auction && !auctionEnded ? 
                    `<button class="ad-card-action-btn accept" onclick="showAuctionScreen(${ad.id})">Участвовать</button>` : 
                    `<button class="ad-card-action-btn accept" data-ad-id="${ad.id}">Принять</button>`
                 }`
            }
        </div>
    `;
    
    const detailsBtn = adElement.querySelector('.ad-card-action-btn.details');
    detailsBtn.addEventListener('click', function() {
        const adId = parseInt(this.getAttribute('data-ad-id'));
        showAdDetail(adId);
    });
    
    if (!isEmployerView && !ad.auction) {
        const acceptBtn = adElement.querySelector('.ad-card-action-btn.accept');
        acceptBtn.addEventListener('click', function() {
            const adId = parseInt(this.getAttribute('data-ad-id'));
            acceptAd(adId);
        });
    }
    
    return adElement;
}

async function showAdDetail(adId) {
    try {
        const response = await fetch(`${API_BASE_URL}/ads?type=detail&ad_id=${adId}`, {
            headers: {
                'Authorization': currentUser.telegram_id.toString()
            }
        });
        
        if (!response.ok) throw new Error('Failed to load ad details');
        
        const data = await response.json();
        const ad = data.ads[0];
        
        if (!ad) {
            showNotification('Объявление не найдено');
            return;
        }
        
        displayAdDetail(ad);
    } catch (error) {
        console.error('Error loading ad details:', error);
        showNotification('Ошибка при загрузке объявления');
    }
}

function displayAdDetail(ad) {
    const container = document.getElementById('adDetailContainer');
    
    const categoryNames = {
        delivery: 'Доставка',
        cleaning: 'Уборка',
        repair: 'Ремонт',
        computer: 'Компьютерная помощь',
        other: 'Другое'
    };
    
    const isEmployer = currentUser.role === 'employer';
    const employerName = ad.employer ? `${ad.employer.first_name} ${ad.employer.last_name}` : 'Работодатель';
    
    container.innerHTML = `
        <div class="ad-detail-header">
            <div class="ad-detail-title">${ad.title}</div>
            <div class="ad-detail-price">${ad.price} ₽</div>
        </div>
        
        <div class="ad-detail-category">${categoryNames[ad.category]}</div>
        ${ad.auction ? '<div class="ad-detail-auction"><i class="fas fa-gavel"></i> Аукцион</div>' : ''}
        
        <div class="ad-detail-description">
            <h4>Описание:</h4>
            <p>${ad.description}</p>
        </div>
        
        <div class="ad-detail-meta">
            <div class="meta-item">
                <i class="fas fa-map-marker-alt"></i>
                <span><strong>Местоположение:</strong> ${ad.location}</span>
            </div>
            <div class="meta-item">
                <i class="fas fa-user"></i>
                <span><strong>Работодатель:</strong> ${employerName}</span>
            </div>
            <div class="meta-item">
                <i class="fas fa-calendar-alt"></i>
                <span><strong>Дата публикации:</strong> ${new Date(ad.created_at).toLocaleDateString('ru-RU')}</span>
            </div>
            ${ad.auction_ends_at ? `
                <div class="meta-item">
                    <i class="fas fa-clock"></i>
                    <span><strong>Аукцион до:</strong> ${new Date(ad.auction_ends_at).toLocaleString('ru-RU')}</span>
                </div>
            ` : ''}
            <div class="meta-item">
                <i class="fas fa-info-circle"></i>
                <span><strong>Статус:</strong> ${getStatusText(ad.status)}</span>
            </div>
        </div>
        
        ${ad.auction ? `
            <div class="ad-detail-bids">
                <h4>Ставки:</h4>
                <div id="adDetailBids">
                    Загрузка ставок...
                </div>
            </div>
        ` : ''}
        
        <div class="ad-detail-actions">
            <button id="backToListBtn" class="btn-secondary">
                <i class="fas fa-arrow-left"></i> Назад к списку
            </button>
            
            ${!isEmployer && ad.status === 'active' && !ad.auction ? `
                <button id="acceptAdDetailBtn" class="btn-primary" data-ad-id="${ad.id}">
                    <i class="fas fa-check"></i> Принять задание
                </button>
                <button id="openChatBtn" class="btn-secondary" data-ad-id="${ad.id}" data-user-id="${ad.employer_id}">
                    <i class="fas fa-comment"></i> Написать
                </button>
            ` : ''}
            
            ${isEmployer && ad.status === 'active' ? `
                <button id="editAdBtn" class="btn-secondary" data-ad-id="${ad.id}">
                    <i class="fas fa-edit"></i> Редактировать
                </button>
            ` : ''}
        </div>
    `;
    
    // Загружаем ставки для аукциона
    if (ad.auction) {
        loadBidsForAd(ad.id);
    }
    
    // Настройка обработчиков
    document.getElementById('backToListBtn').addEventListener('click', function() {
        if (currentUser.role === 'employer') {
            showScreen('employerScreen');
        } else {
            showScreen('workerScreen');
        }
    });
    
    if (!isEmployer && ad.status === 'active' && !ad.auction) {
        document.getElementById('acceptAdDetailBtn').addEventListener('click', function() {
            const adId = parseInt(this.getAttribute('data-ad-id'));
            acceptAd(adId);
        });
        
        document.getElementById('openChatBtn').addEventListener('click', function() {
            const adId = parseInt(this.getAttribute('data-ad-id'));
            const userId = parseInt(this.getAttribute('data-user-id'));
            openChat(adId, userId);
        });
    }
    
    showScreen('adDetailScreen');
}

async function acceptAd(adId) {
    try {
        showModal(
            'Принятие задания',
            'Вы уверены, что хотите принять это задание? После принятия вы сможете обсудить детали с работодателем.',
            async () => {
                // Здесь должен быть API для принятия задания
                // Пока используем заглушку
                showNotification('Задание принято! Теперь вы можете связаться с работодателем в чате.');
                
                if (currentUser.role === 'worker') {
                    showScreen('workerScreen');
                    await loadWorkerAds();
                }
            }
        );
    } catch (error) {
        console.error('Error accepting ad:', error);
        showNotification('Ошибка при принятии задания');
    }
}

async function publishAd() {
    try {
        const title = document.getElementById('adTitle').value.trim();
        const category = document.getElementById('adCategory').value;
        const description = document.getElementById('adDescription').value.trim();
        const price = parseInt(document.getElementById('adPrice').value);
        const location = document.getElementById('adLocation').value.trim();
        const auctionEnabled = document.getElementById('auctionToggle').checked;
        
        if (!title || !description || !location || price < 100) {
            showNotification('Заполните все поля корректно. Минимальная цена - 100 ₽');
            return;
        }
        
        if (auctionEnabled) {
            const auctionHours = parseInt(document.getElementById('auctionHours').value) || 0;
            const auctionMinutes = parseInt(document.getElementById('auctionMinutes').value) || 0;
            
            if (auctionHours === 0 && auctionMinutes === 0) {
                showNotification('Укажите время проведения аукциона');
                return;
            }
        }
        
        const adData = {
            title,
            description,
            category,
            price,
            location,
            auction: auctionEnabled
        };
        
        const response = await fetch(`${API_BASE_URL}/ads`, {
            method: 'POST',
            headers: {
                'Authorization': currentUser.telegram_id.toString(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(adData)
        });
        
        if (!response.ok) throw new Error('Failed to create ad');
        
        const data = await response.json();
        
        // Очистка формы
        document.getElementById('adTitle').value = '';
        document.getElementById('adDescription').value = '';
        document.getElementById('adPrice').value = '1000';
        document.getElementById('adLocation').value = '';
        document.getElementById('auctionToggle').checked = false;
        
        showNotification(`Объявление "${title}" успешно опубликовано!`);
        showScreen('employerScreen');
        await loadEmployerAds();
        updateHeaderInfo();
        
    } catch (error) {
        console.error('Error publishing ad:', error);
        showNotification('Ошибка при создании объявления');
    }
}

// ============ АУКЦИОНЫ ============

async function showAuctionScreen(adId) {
    try {
        const response = await fetch(`${API_BASE_URL}/ads?type=detail&ad_id=${adId}`, {
            headers: {
                'Authorization': currentUser.telegram_id.toString()
            }
        });
        
        if (!response.ok) throw new Error('Failed to load ad');
        
        const data = await response.json();
        const ad = data.ads[0];
        
        if (!ad || !ad.auction) {
            showNotification('Аукцион не найден');
            return;
        }
        
        displayAuctionScreen(ad);
    } catch (error) {
        console.error('Error loading auction:', error);
        showNotification('Ошибка при загрузке аукциона');
    }
}

function displayAuctionScreen(ad) {
    const container = document.getElementById('adDetailContainer');
    const currentBid = ad.min_bid || ad.price;
    const auctionEnded = new Date(ad.auction_ends_at) < new Date();
    
    container.innerHTML = `
        <div class="auction-screen">
            <div class="auction-header">
                <h2>${ad.title}</h2>
                <p>Аукцион за задание</p>
            </div>
            
            <div class="auction-timer-large" id="auctionTimer">
                ${getTimeLeft(ad.auction_ends_at)}
            </div>
            
            <div class="auction-price">
                <div class="price-item">
                    <div class="price-label">Начальная цена</div>
                    <div class="price-value initial-price">${ad.price} ₽</div>
                </div>
                <div class="price-item">
                    <div class="price-label">Текущая ставка</div>
                    <div class="price-value current-price" id="currentBidValue">${currentBid} ₽</div>
                </div>
            </div>
            
            ${!auctionEnded ? `
                <div class="auction-bid-container">
                    <h4>Ваше предложение</h4>
                    <p>Предложите цену ниже текущей ставки</p>
                    
                    <div class="bid-input-group">
                        <input type="number" id="auctionBidInput" 
                               value="${currentBid - 10}" 
                               min="1" max="${currentBid}">
                        <span style="font-size: 1.2rem; font-weight: 600;">₽</span>
                    </div>
                    
                    <div class="bid-step-buttons">
                        <button class="bid-step-btn" onclick="updateBid(-10)">-10 ₽</button>
                        <button class="bid-step-btn" onclick="updateBid(-50)">-50 ₽</button>
                        <button class="bid-step-btn" onclick="updateBid(-100)">-100 ₽</button>
                        <button class="bid-step-btn" onclick="updateBid(-200)">-200 ₽</button>
                    </div>
                    
                    <div class="bid-hint" id="bidHint">
                        Текущая ставка: ${currentBid} ₽
                    </div>
                    
                    <button id="submitBidBtn" class="btn-primary btn-large" data-ad-id="${ad.id}">
                        <i class="fas fa-gavel"></i> Сделать ставку
                    </button>
                </div>
            ` : `
                <div class="auction-ended">
                    <h4><i class="fas fa-flag-checkered"></i> Аукцион завершен</h4>
                    <p>Победитель будет определен автоматически</p>
                </div>
            `}
            
            <div class="bids-history">
                <h5>История ставок</h5>
                <div id="bidsHistoryList">
                    Загрузка...
                </div>
            </div>
        </div>
    `;
    
    // Загружаем историю ставок
    loadBidsForAd(ad.id);
    
    // Настройка обработчиков
    if (!auctionEnded) {
        const bidInput = document.getElementById('auctionBidInput');
        bidInput.addEventListener('input', updateBidHint);
        
        document.getElementById('submitBidBtn').addEventListener('click', function() {
            const amount = parseInt(bidInput.value);
            const adId = parseInt(this.getAttribute('data-ad-id'));
            placeBid(adId, amount);
        });
    }
    
    // Обновляем таймер
    updateAuctionTimer(ad.auction_ends_at);
    
    showScreen('adDetailScreen');
}

function getTimeLeft(endDate) {
    if (!endDate) return 'Завершен';
    
    const end = new Date(endDate);
    const now = new Date();
    const diff = end - now;
    
    if (diff <= 0) return 'Завершен';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}ч ${minutes}м`;
}

function updateAuctionTimer(endDate) {
    const timerElement = document.getElementById('auctionTimer');
    if (!timerElement) return;
    
    const update = () => {
        const timeLeft = getTimeLeft(endDate);
        timerElement.textContent = timeLeft;
        
        if (timeLeft === 'Завершен') {
            clearInterval(timerInterval);
        }
    };
    
    update();
    const timerInterval = setInterval(update, 60000);
}

function updateBid(change) {
    const input = document.getElementById('auctionBidInput');
    const currentValue = parseInt(input.value) || 0;
    const newValue = currentValue + change;
    
    if (newValue > 0) {
        input.value = newValue;
        updateBidHint();
    }
}

function updateBidHint() {
    const input = document.getElementById('auctionBidInput');
    const hint = document.getElementById('bidHint');
    if (!input || !hint) return;
    
    const amount = parseInt(input.value) || 0;
    hint.textContent = `Вы предлагаете: ${amount} ₽`;
}

async function placeBid(adId, amount) {
    try {
        if (!amount || amount <= 0) {
            showNotification('Введите корректную сумму');
            return;
        }
        
        const response = await fetch(`${API_BASE_URL}/ads/${adId}/bids`, {
            method: 'POST',
            headers: {
                'Authorization': currentUser.telegram_id.toString(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ amount })
        });
        
        if (!response.ok) {
            const error = await response.json();
            showNotification(error.error || 'Ошибка при размещении ставки');
            return;
        }
        
        const data = await response.json();
        showNotification(data.message || 'Ставка успешно размещена');
        
        // Обновляем отображение
        loadBidsForAd(adId);
        
    } catch (error) {
        console.error('Error placing bid:', error);
        showNotification('Ошибка при размещении ставки');
    }
}

async function loadBidsForAd(adId) {
    try {
        const response = await fetch(`${API_BASE_URL}/ads/${adId}/bids`);
        
        if (!response.ok) throw new Error('Failed to load bids');
        
        const data = await response.json();
        displayBidsHistory(data.bids || []);
    } catch (error) {
        console.error('Error loading bids:', error);
    }
}

function displayBidsHistory(bids) {
    const container = document.getElementById('bidsHistoryList') || document.getElementById('adDetailBids');
    if (!container) return;
    
    if (!bids || bids.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #6c757d;">Ставок еще нет</p>';
        return;
    }
    
    container.innerHTML = bids.map(bid => `
        <div class="bid-item">
            <div class="bid-user">
                <div class="bid-avatar">
                    <i class="fas fa-user"></i>
                </div>
                <span>${bid.user?.first_name || 'Пользователь'} ${bid.user?.last_name || ''}</span>
            </div>
            <div class="bid-amount">${bid.amount} ₽</div>
            <div class="bid-time">${new Date(bid.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
    `).join('');
}

// ============ ЧАТ ============

async function openChat(adId, otherUserId) {
    const ad = ads.find(a => a.id === adId);
    if (!ad) {
        showNotification('Объявление не найдено');
        return;
    }
    
    // Получаем информацию о другом пользователе
    const otherUser = await getUserById(otherUserId);
    if (!otherUser) {
        showNotification('Пользователь не найден');
        return;
    }
    
    currentChat = {
        adId,
        otherUserId,
        ad,
        otherUser
    };
    
    // Обновляем UI чата
    document.getElementById('chatUserName').textContent = `${otherUser.first_name} ${otherUser.last_name}`;
    
    // Показываем информацию об объявлении
    const adInfo = document.getElementById('chatAdInfo');
    adInfo.innerHTML = `
        <div class="ad-info-header">
            <div class="ad-info-title">${ad.title}</div>
            <div class="ad-info-price">${ad.price} ₽</div>
        </div>
        <div>
            <span class="ad-info-status status-${ad.status}">${getStatusText(ad.status)}</span>
            <span style="margin-left: 10px; font-size: 0.9rem;">ID: ${ad.id}</span>
        </div>
    `;
    
    // Загружаем сообщения
    await loadChatMessages(adId, otherUserId);
    
    // Подключаемся к комнате WebSocket
    if (socket) {
        socket.emit('join-ad', adId);
    }
    
    showScreen('chatScreen');
}

async function getUserById(userId) {
    if (userCache[userId]) {
        return userCache[userId];
    }
    
    try {
        // В реальном приложении здесь был бы запрос к API
        // Пока используем заглушку
        const user = {
            id: userId,
            first_name: userId === 2 ? 'Иван' : 'Мария',
            last_name: userId === 2 ? 'Петров' : 'Сидорова',
            role: userId === 2 ? 'employer' : 'worker'
        };
        
        userCache[userId] = user;
        return user;
    } catch (error) {
        console.error('Error getting user:', error);
        return null;
    }
}

async function loadChatMessages(adId, otherUserId) {
    try {
        const response = await fetch(`${API_BASE_URL}/messages?ad_id=${adId}&other_user_id=${otherUserId}`, {
            headers: {
                'Authorization': currentUser.telegram_id.toString()
            }
        });
        
        if (!response.ok) throw new Error('Failed to load messages');
        
        const data = await response.json();
        displayChatMessages(data.messages || []);
    } catch (error) {
        console.error('Error loading messages:', error);
    }
}

function displayChatMessages(messages) {
    const container = document.getElementById('chatMessages');
    container.innerHTML = '';
    
    if (!messages || messages.length === 0) {
        const welcomeMessage = document.createElement('div');
        welcomeMessage.className = 'message message-incoming';
        welcomeMessage.innerHTML = `
            <p>Здравствуйте! Это начало вашего чата по объявлению.</p>
            <div class="message-time">${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</div>
        `;
        container.appendChild(welcomeMessage);
        return;
    }
    
    messages.forEach(message => {
        const messageElement = createMessageElement(message);
        container.appendChild(messageElement);
    });
    
    setTimeout(() => {
        container.scrollTop = container.scrollHeight;
    }, 100);
}

function createMessageElement(message) {
    const messageElement = document.createElement('div');
    const isOutgoing = message.sender_id === currentUser.id;
    
    messageElement.className = `message ${isOutgoing ? 'message-outgoing' : 'message-incoming'}`;
    messageElement.innerHTML = `
        <p>${message.text}</p>
        <div class="message-time">
            ${new Date(message.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
            ${isOutgoing ? `<span class="message-status ${message.read ? 'status-read' : 'status-unread'}">
                ${message.read ? '✓✓' : '✓'}
            </span>` : ''}
        </div>
    `;
    
    return messageElement;
}

async function sendMessage() {
    if (!currentChat) return;
    
    try {
        const input = document.getElementById('chatInput');
        const text = input.value.trim();
        
        if (!text) return;
        
        const response = await fetch(`${API_BASE_URL}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': currentUser.telegram_id.toString(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ad_id: currentChat.adId,
                receiver_id: currentChat.otherUserId,
                text
            })
        });
        
        if (!response.ok) throw new Error('Failed to send message');
        
        const data = await response.json();
        
        // Добавляем сообщение в UI
        addMessageToChat(data.message);
        
        // Очищаем поле ввода
        input.value = '';
        
    } catch (error) {
        console.error('Error sending message:', error);
        showNotification('Ошибка при отправке сообщения');
    }
}

function addMessageToChat(message) {
    const container = document.getElementById('chatMessages');
    const messageElement = createMessageElement(message);
    container.appendChild(messageElement);
    
    setTimeout(() => {
        container.scrollTop = container.scrollHeight;
    }, 100);
}

// ============ ПРОФИЛЬ И НАСТРОЙКИ ============

async function loadProfileScreen() {
    if (!currentUser) return;
    
    document.getElementById('profileUserName').textContent = `${currentUser.first_name} ${currentUser.last_name}`;
    document.getElementById('profileUserRole').textContent = currentUser.role === 'employer' ? 'Работодатель' : 'Работник';
    document.getElementById('profileBalance').textContent = `${currentUser.balance || 0} ₽`;
    
    // Загружаем количество объявлений
    try {
        const response = await fetch(`${API_BASE_URL}/ads?type=employer&user_id=${currentUser.id}`, {
            headers: {
                'Authorization': currentUser.telegram_id.toString()
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            document.getElementById('profileAdsCount').textContent = data.ads?.length || 0;
        }
    } catch (error) {
        console.error('Error loading ads count:', error);
    }
    
    const subscriptionStatus = currentUser.subscription_until && new Date(currentUser.subscription_until) > new Date() ? 
        `Активна до ${new Date(currentUser.subscription_until).toLocaleDateString('ru-RU')}` : 
        'Не активна';
    document.getElementById('profileSubscriptionStatus').textContent = subscriptionStatus;
    
    // Добавляем кнопку модерации для админов
    if (currentUser.role === 'admin') {
        document.querySelector('.profile-actions').innerHTML += `
            <button class="profile-action-btn" id="moderationBtn">
                <i class="fas fa-shield-alt"></i>
                <span>Модерация</span>
                <i class="fas fa-chevron-right"></i>
            </button>
        `;
        
        document.getElementById('moderationBtn')?.addEventListener('click', showModerationScreen);
    }
}

async function updateUserRole(role) {
    try {
        const response = await fetch(`${API_BASE_URL}/user/role`, {
            method: 'POST',
            headers: {
                'Authorization': currentUser.telegram_id.toString(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ role })
        });
        
        if (!response.ok) throw new Error('Failed to update role');
        
        const data = await response.json();
        currentUser = data.user;
        
        showNotification(`Роль изменена на: ${role === 'employer' ? 'работодатель' : 'работник'}`);
        
        if (role === 'employer') {
            showScreen('employerScreen');
            await loadEmployerAds();
            updateEmployerStats();
        } else {
            showScreen('workerScreen');
            await loadWorkerAds();
            updateWorkerStats();
        }
        
        updateHeaderInfo();
        
    } catch (error) {
        console.error('Error updating role:', error);
        showNotification('Ошибка при изменении роли');
    }
}

// ============ УВЕДОМЛЕНИЯ ============

async function loadNotifications() {
    // В реальном приложении здесь был бы запрос к API
    // Пока используем тестовые уведомления
    notifications = [
        {
            id: 1,
            type: 'system',
            title: 'Добро пожаловать!',
            message: 'Спасибо за регистрацию в Шабашка. Начните использовать все возможности приложения.',
            read: true,
            created_at: new Date(Date.now() - 86400000).toISOString()
        },
        {
            id: 2,
            type: 'message',
            title: 'Новое сообщение',
            message: 'Работодатель ответил на ваше предложение',
            read: false,
            created_at: new Date(Date.now() - 3600000).toISOString(),
            data: { chatId: 1, adId: 1 }
        }
    ];
    
    updateNotificationBadge();
}

function addNotification(notification) {
    notifications.unshift({
        id: notifications.length + 1,
        ...notification,
        read: false,
        created_at: new Date().toISOString()
    });
    
    updateNotificationBadge();
}

function updateNotificationBadge() {
    const unreadCount = notifications.filter(n => !n.read).length;
    const badge = document.getElementById('unreadCount');
    if (badge) {
        badge.textContent = unreadCount;
        badge.style.display = unreadCount > 0 ? 'block' : 'none';
    }
}

function showNotificationsScreen() {
    const list = document.getElementById('notificationsList');
    
    if (notifications.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-bell-slash"></i>
                <h3>Нет уведомлений</h3>
                <p>Здесь будут появляться важные уведомления</p>
            </div>
        `;
    } else {
        list.innerHTML = '';
        notifications.forEach(notification => {
            const item = createNotificationElement(notification);
            list.appendChild(item);
        });
    }
    
    showScreen('notificationsScreen');
}

function createNotificationElement(notification) {
    const item = document.createElement('div');
    item.className = `notification-item ${notification.read ? '' : 'unread'}`;
    item.addEventListener('click', () => handleNotificationClick(notification));
    
    const icon = getNotificationIcon(notification.type);
    
    item.innerHTML = `
        <div class="notification-icon ${notification.type}">
            <i class="fas fa-${icon}"></i>
        </div>
        <div class="notification-content">
            <div class="notification-title">${notification.title}</div>
            <div class="notification-text">${notification.message}</div>
            <div class="notification-time">
                ${timeAgo(new Date(notification.created_at))}
            </div>
        </div>
        ${!notification.read ? '<div class="notification-unread-dot"></div>' : ''}
    `;
    
    return item;
}

function getNotificationIcon(type) {
    const icons = {
        'message': 'comments',
        'rating': 'star',
        'system': 'info-circle',
        'warning': 'exclamation-triangle',
        'moderation': 'shield-alt'
    };
    return icons[type] || 'bell';
}

function timeAgo(date) {
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return 'только что';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} мин. назад`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} ч. назад`;
    return `${Math.floor(seconds / 86400)} дн. назад`;
}

function handleNotificationClick(notification) {
    notification.read = true;
    updateNotificationBadge();
    
    // Обрабатываем клик в зависимости от типа уведомления
    switch (notification.type) {
        case 'message':
            if (notification.data?.adId && notification.data?.chatId) {
                openChat(notification.data.adId, getOtherUserId(notification.data.chatId));
            }
            break;
    }
}

function clearAllNotifications() {
    notifications.forEach(n => n.read = true);
    updateNotificationBadge();
    showNotificationsScreen();
    showNotification('Все уведомления отмечены как прочитанные');
}

// ============ МОДЕРАЦИЯ ============

async function showModerationScreen() {
    if (currentUser.role !== 'admin') {
        showNotification('У вас нет доступа к модерации');
        return;
    }
    
    // Загружаем объявления для модерации
    try {
        const response = await fetch(`${API_BASE_URL}/ads?type=moderation`, {
            headers: {
                'Authorization': currentUser.telegram_id.toString()
            }
        });
        
        if (!response.ok) throw new Error('Failed to load moderation ads');
        
        const data = await response.json();
        displayModerationList(data.ads || []);
    } catch (error) {
        console.error('Error loading moderation ads:', error);
        showNotification('Ошибка при загрузке объявлений для модерации');
    }
    
    showScreen('moderationScreen');
}

function displayModerationList(adsList) {
    const list = document.getElementById('moderationList');
    
    if (!adsList || adsList.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-clipboard-check"></i>
                <h3>Нет объявлений для модерации</h3>
                <p>Все объявления обработаны</p>
            </div>
        `;
        return;
    }
    
    list.innerHTML = '';
    adsList.forEach(ad => {
        const item = createModerationItem(ad);
        list.appendChild(item);
    });
}

function createModerationItem(ad) {
    const item = document.createElement('div');
    item.className = 'moderation-item';
    
    const employerName = ad.employer ? `${ad.employer.first_name} ${ad.employer.last_name}` : 'Неизвестный';
    
    item.innerHTML = `
        <div class="moderation-item-header">
            <div class="moderation-item-title">${ad.title}</div>
            <div class="moderation-item-price">${ad.price} ₽</div>
        </div>
        
        <div class="moderation-item-user">
            <div class="moderation-user-avatar">
                <i class="fas fa-user"></i>
            </div>
            <div class="moderation-user-info">
                <h4>${employerName}</h4>
                <p>Работодатель</p>
            </div>
        </div>
        
        <div class="moderation-item-description">
            ${ad.description}
        </div>
        
        <div class="moderation-item-meta">
            <div style="display: flex; gap: 15px; margin-bottom: 15px; font-size: 0.9rem;">
                <span><i class="fas fa-map-marker-alt"></i> ${ad.location}</span>
                <span><i class="fas fa-calendar"></i> ${new Date(ad.created_at).toLocaleDateString('ru-RU')}</span>
            </div>
        </div>
        
        <div class="moderation-item-actions">
            <button class="moderation-btn approve" data-ad-id="${ad.id}">
                <i class="fas fa-check"></i> Одобрить
            </button>
            <button class="moderation-btn reject" data-ad-id="${ad.id}">
                <i class="fas fa-times"></i> Отклонить
            </button>
            <button class="moderation-btn view" data-ad-id="${ad.id}">
                <i class="fas fa-eye"></i> Подробнее
            </button>
        </div>
    `;
    
    item.querySelector('.moderation-btn.approve').addEventListener('click', function() {
        moderateAd(ad.id, true);
    });
    
    item.querySelector('.moderation-btn.reject').addEventListener('click', function() {
        moderateAd(ad.id, false);
    });
    
    item.querySelector('.moderation-btn.view').addEventListener('click', function() {
        showAdDetail(ad.id);
    });
    
    return item;
}

async function moderateAd(adId, approve) {
    try {
        // В реальном приложении здесь был бы запрос к API
        showNotification(approve ? 'Объявление одобрено' : 'Объявление отклонено');
        
        // Обновляем список
        await showModerationScreen();
        
    } catch (error) {
        console.error('Error moderating ad:', error);
        showNotification('Ошибка при модерации объявления');
    }
}

// ============ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ============

function getStatusText(status) {
    const statusMap = {
        'active': 'Активно',
        'taken': 'В работе',
        'completed': 'Завершено',
        'moderation': 'На модерации',
        'rejected': 'Отклонено'
    };
    return statusMap[status] || status;
}

function updateEmployerStats() {
    if (!currentUser) return;
    
    const userAds = ads.filter(ad => ad.employer_id === currentUser.id);
    
    document.getElementById('employerBalance').textContent = `${currentUser.balance || 0} ₽`;
    document.getElementById('employerAdsCount').textContent = userAds.length;
    
    const subscriptionStatus = currentUser.subscription_until && new Date(currentUser.subscription_until) > new Date() ? 
        `До ${new Date(currentUser.subscription_until).toLocaleDateString('ru-RU')}` : 
        'Не активна';
    document.getElementById('employerSubscription').textContent = subscriptionStatus;
}

function updateWorkerStats() {
    if (!currentUser) return;
    
    const completedAds = ads.filter(ad => ad.taken_by === currentUser.id && ad.status === 'completed');
    
    document.getElementById('workerBalance').textContent = `${currentUser.balance || 0} ₽`;
    document.getElementById('workerCompleted').textContent = completedAds.length;
    
    const subscriptionStatus = currentUser.subscription_until && new Date(currentUser.subscription_until) > new Date() ? 
        `До ${new Date(currentUser.subscription_until).toLocaleDateString('ru-RU')}` : 
        'Не активна';
    document.getElementById('workerSubscription').textContent = subscriptionStatus;
}

// ============ МОДАЛЬНЫЕ ОКНА ============

function showModal(title, message, confirmCallback) {
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    const modalCancelBtn = document.getElementById('modalCancelBtn');
    const modalConfirmBtn = document.getElementById('modalConfirmBtn');
    const closeModalBtn = document.getElementById('closeModalBtn');
    
    modalTitle.textContent = title;
    modalBody.innerHTML = `<p>${message}</p>`;
    
    modal.classList.add('active');
    
    const closeModal = () => {
        modal.classList.remove('active');
    };
    
    modalCancelBtn.onclick = closeModal;
    closeModalBtn.onclick = closeModal;
    
    modalConfirmBtn.onclick = () => {
        confirmCallback();
        closeModal();
    };
    
    modal.onclick = (e) => {
        if (e.target === modal) {
            closeModal();
        }
    };
}

// ============ ОБРАБОТЧИКИ СОБЫТИЙ ============

function setupEventListeners() {
    // Выбор роли
    document.querySelectorAll('.role-card').forEach(card => {
        card.addEventListener('click', function() {
            const role = this.getAttribute('data-role');
            updateUserRole(role);
        });
    });
    
    // Кнопки навигации
    document.querySelectorAll('.nav-btn[data-screen]').forEach(btn => {
        btn.addEventListener('click', function() {
            const screenId = this.getAttribute('data-screen');
            showScreen(screenId);
            
            if (screenId === 'employerScreen') {
                loadEmployerAds();
                updateEmployerStats();
            } else if (screenId === 'workerScreen') {
                loadWorkerAds();
                updateWorkerStats();
            }
        });
    });
    
    // Кнопка создания объявления в навигации
    document.getElementById('addAdBtn').addEventListener('click', function() {
        if (currentUser.role === 'employer') {
            showScreen('createAdScreen');
        } else {
            showNotification('Только работодатели могут создавать объявления');
        }
    });
    
    // Кнопка профиля
    document.getElementById('profileBtn').addEventListener('click', function() {
        loadProfileScreen();
        showScreen('profileScreen');
    });
    
    // Кнопка закрытия профиля
    document.getElementById('closeProfileBtn').addEventListener('click', function() {
        if (currentUser.role === 'employer') {
            showScreen('employerScreen');
        } else {
            showScreen('workerScreen');
        }
    });
    
    // Кнопка создания объявления
    document.getElementById('createAdBtn')?.addEventListener('click', function() {
        if (currentUser.role === 'employer') {
            showScreen('createAdScreen');
        } else {
            showNotification('Только работодатели могут создавать объявления');
        }
    });
    
    // Кнопка создания первого объявления
    document.getElementById('createFirstAdBtn')?.addEventListener('click', function() {
        showScreen('createAdScreen');
    });
    
    // Кнопка назад на экране создания объявления
    document.getElementById('backToEmployerBtn')?.addEventListener('click', function() {
        showScreen('employerScreen');
    });
    
    // Кнопка обновления объявлений
    document.getElementById('refreshAdsBtn')?.addEventListener('click', async function() {
        const icon = this.querySelector('i');
        const button = this;
        
        if (button.classList.contains('loading')) return;
        
        button.classList.add('loading');
        button.disabled = true;
        icon.classList.add('fa-spin');
        
        try {
            if (currentUser.role === 'worker') {
                await loadWorkerAds();
            } else {
                await loadEmployerAds();
            }
            showNotification('Список обновлен');
        } catch (error) {
            console.error('Error refreshing ads:', error);
            showNotification('Ошибка при обновлении');
        } finally {
            button.classList.remove('loading');
            button.disabled = false;
            icon.classList.remove('fa-spin');
        }
    });
    
    // Кнопка публикации объявления
    document.getElementById('publishAdBtn')?.addEventListener('click', publishAd);
    
    // Аукцион переключатель
    document.getElementById('auctionToggle')?.addEventListener('change', function() {
        const settings = document.getElementById('auctionSettings');
        if (this.checked) {
            settings.style.display = 'block';
        } else {
            settings.style.display = 'none';
        }
    });
    
    // Кнопки подписки
    document.getElementById('buySubscriptionBtn')?.addEventListener('click', function() {
        showPaymentScreen('subscription', 300, 'Оформление подписки на 30 дней');
    });
    
    document.getElementById('buySubscriptionProfileBtn')?.addEventListener('click', function() {
        showPaymentScreen('subscription', 300, 'Оформление подписки на 30 дней');
    });
    
    document.getElementById('buySubscriptionMainBtn')?.addEventListener('click', function() {
        showPaymentScreen('subscription', 300, 'Оформление подписки на 30 дней');
    });
    
    // Кнопка пополнения баланса
    document.getElementById('depositBtn')?.addEventListener('click', function() {
        showPaymentScreen('deposit', 1000, 'Пополнение баланса');
    });
    
    // Кнопка смены роли
    document.getElementById('changeRoleBtn')?.addEventListener('click', function() {
        showModal(
            'Смена роли',
            'Вы уверены, что хотите сменить роль? При смене роли история ваших объявлений и заданий сохранится.',
            () => {
                const newRole = currentUser.role === 'employer' ? 'worker' : 'employer';
                updateUserRole(newRole);
            }
        );
    });
    
    // Кнопка отмены оплаты
    document.getElementById('cancelPaymentBtn')?.addEventListener('click', function() {
        if (currentUser.role === 'employer') {
            showScreen('employerScreen');
        } else {
            showScreen('workerScreen');
        }
    });
    
    // Табы на экране работодателя
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            
            document.querySelectorAll('.tab-btn').forEach(b => {
                b.classList.remove('active');
            });
            this.classList.add('active');
            
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(`${tabId}Tab`)?.classList.add('active');
            
            if (tabId === 'myAds') {
                displayEmployerAds();
            }
        });
    });
    
    // Фильтры на экране работника
    document.getElementById('categoryFilter')?.addEventListener('change', loadWorkerAds);
    document.getElementById('priceFilter')?.addEventListener('change', loadWorkerAds);
    
    // Кнопка отправки сообщения в чате
    document.getElementById('sendMessageBtn')?.addEventListener('click', sendMessage);
    
    // Enter для отправки сообщения
    document.getElementById('chatInput')?.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    
    // Кнопка назад из чата
    document.getElementById('backFromChatBtn')?.addEventListener('click', function() {
        if (currentUser.role === 'employer') {
            showScreen('employerScreen');
        } else {
            showScreen('workerScreen');
        }
    });
    
    // Кнопка уведомлений
    const notificationsBtn = document.createElement('button');
    notificationsBtn.id = 'notificationsBtn';
    notificationsBtn.className = 'btn-icon';
    notificationsBtn.innerHTML = '<i class="fas fa-bell"></i>';
    notificationsBtn.addEventListener('click', showNotificationsScreen);
    document.querySelector('.user-info')?.appendChild(notificationsBtn);
    
    // Кнопка очистки уведомлений
    document.getElementById('clearNotificationsBtn')?.addEventListener('click', clearAllNotifications);
    
    // Кнопка назад из рейтинга
    document.getElementById('backFromRatingBtn')?.addEventListener('click', function() {
        if (currentUser.role === 'employer') {
            showScreen('employerScreen');
        } else {
            showScreen('workerScreen');
        }
    });
    
    // Кнопка назад из модерации
    document.getElementById('backFromModerationBtn')?.addEventListener('click', function() {
        showScreen('profileScreen');
    });
}

// Глобальные функции для использования в HTML
window.placeBid = placeBid;
window.showAuctionScreen = showAuctionScreen;
window.updateBid = updateBid;

// Инициализация при загрузке
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

async function initApp() {
    await initUserFromTelegram();
    setupEventListeners();
    
    if (currentUser && currentUser.role) {
        if (currentUser.role === 'employer') {
            showScreen('employerScreen');
            await loadEmployerAds();
        } else {
            showScreen('workerScreen');
            await loadWorkerAds();
        }
        updateHeaderInfo();
    } else {
        showScreen('roleScreen');
    }
}


