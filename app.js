// app.js - упрощенная версия без ролей и баланса

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
let ads = [];
let notifications = [];
let isLoading = false;
let loadingProgress = 0;
let loadingStep = 0;
let isUserInitializing = false;
let isUserInitialized = false;

// Инициализация приложения
document.addEventListener('DOMContentLoaded', async function() {
    setupTelegramBackButton();
    // Сразу показываем экран загрузки
    showScreen('loadingScreen');
    
    // Начинаем процесс загрузки
    await startLoading();
    // Добавляем класс loaded после загрузки
    setTimeout(() => {
        document.body.classList.add('loaded');
    }, 500);

    // Инициализация пользователя
    await initUserFromTelegram();
    
    // Настройка обработчиков событий
    setupEventListeners();
    
    // Загрузка данных
    if (currentUser) {
        showScreen('mainScreen');
        await loadAds();
        await loadNotifications();
        updateProfileStats();
    }
});

// Процесс загрузки приложения
async function startLoading() {
    isLoading = true;
    loadingStep = 0;
    loadingProgress = 0;
    
    try {
        // Шаг 1: Инициализация
        updateLoadingStep(0, 'Инициализация приложения...');
        await updateProgress(20);
        await sleep(500); // Имитация загрузки
        
        // Шаг 2: Инициализация пользователя
        updateLoadingStep(1, 'Загрузка профиля...');
        await updateProgress(40);
        if (!isUserInitialized && !isUserInitializing) {
            await initUserFromTelegram();
        }
        // Шаг 3: Загрузка основных данных
        updateLoadingStep(2, 'Загрузка заданий...');
        await updateProgress(60);
        
        if (currentUser) {
            // Параллельная загрузка данных
            await Promise.all([
                loadAds(),
                loadNotifications()
            ]);
            
            await updateProgress(80);
        }
        
        // Шаг 4: Подготовка интерфейса
        updateLoadingStep(3, 'Подготовка интерфейса...');
        await updateProgress(100);
        await sleep(300);
        
        // Загрузка завершена
        completeLoading();
        
    } catch (error) {
        console.error('Error during loading:', error);
        // Даже при ошибке показываем основной интерфейс
        completeLoading();
        showNotification('Ошибка загрузки, некоторые данные могут быть недоступны');
    }
}

// Обновление шага загрузки
function updateLoadingStep(step, hint = '') {
    loadingStep = step;
    
    // Обновляем иконки шагов
    const steps = document.querySelectorAll('.loading-step');
    steps.forEach((stepEl, index) => {
        if (index < step) {
            stepEl.classList.add('completed');
            stepEl.classList.remove('active');
        } else if (index === step) {
            stepEl.classList.add('active');
            stepEl.classList.remove('completed');
        } else {
            stepEl.classList.remove('active', 'completed');
        }
    });
    
    // Обновляем подсказку
    if (hint) {
        document.getElementById('loadingHint').textContent = hint;
    }
}

// Обновление прогресса
async function updateProgress(percent) {
    loadingProgress = percent;
    const progressFill = document.getElementById('progressFill');
    if (progressFill) {
        progressFill.style.width = `${percent}%`;
    }
    await sleep(100); // Плавное обновление
}

// Завершение загрузки
function completeLoading() {
    isLoading = false;
    
    // Плавный переход на главный экран
    setTimeout(() => {
        if (currentUser) {
            showScreen('mainScreen');
            updateProfileStats();
            
            // Добавляем анимацию появления элементов
            document.body.classList.add('loaded');
        } else {
            // Если пользователь не загрузился, остаемся на экране загрузки
            document.getElementById('loadingHint').textContent = 'Ошибка загрузки. Обновите страницу.';
        }
    }, 500);
}

// Восстановление после спячки
async function restoreAfterSleep() {
    if (isLoading) return;
    
    // Показываем экран загрузки
    showScreen('loadingScreen');
    isLoading = true;
    
    try {
        updateLoadingStep(0, 'Восстановление сессии...');
        await updateProgress(20);
        
        // Восстанавливаем данные
        if (currentUser) {
            await initUserFromTelegram();
        }
        
        await updateProgress(50);
        updateLoadingStep(1, 'Обновление данных...');
        
        // Обновляем текущий экран
        if (currentScreen === 'mainScreen') {
            await loadAds();
        } else if (currentScreen === 'myAdsScreen') {
            await loadMyAds('active');
        }
        
        await updateProgress(80);
        updateLoadingStep(2, 'Завершение...');
        
        await updateProgress(100);
        await sleep(300);
        
    } catch (error) {
        console.error('Error during restoration:', error);
    } finally {
        completeLoading();
    }
}

// Утилита для задержки
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Отслеживаем видимость страницы
let visibilityChange, hidden;
if (typeof document.hidden !== "undefined") {
    hidden = "hidden";
    visibilityChange = "visibilitychange";
} else if (typeof document.msHidden !== "undefined") {
    hidden = "msHidden";
    visibilityChange = "msvisibilitychange";
} else if (typeof document.webkitHidden !== "undefined") {
    hidden = "webkitHidden";
    visibilityChange = "webkitvisibilitychange";
}

// Обработчик изменения видимости
let lastVisibleTime = Date.now();
const SLEEP_THRESHOLD = 10000; // 10 секунд

document.addEventListener(visibilityChange, handleVisibilityChange, false);

function handleVisibilityChange() {
    if (document[hidden]) {
        // Страница скрыта - запоминаем время
        lastVisibleTime = Date.now();
    } else {
        // Страница снова видна
        const timeHidden = Date.now() - lastVisibleTime;
        
        // Если приложение было скрыто более порогового времени, восстанавливаем
        if (timeHidden > SLEEP_THRESHOLD && !isLoading) {
            restoreAfterSleep();
        }
    }
}

// Обновляем функцию showScreen для отслеживания текущего экрана
let currentScreen = 'loadingScreen';

// ============ ФУНКЦИИ АУТЕНТИФИКАЦИИ ============

// Функция initUserFromTelegram - упрощаем
async function initUserFromTelegram() {
    // Если уже инициализируемся или инициализированы - выходим
    if (isUserInitializing || isUserInitialized) {
        console.log('User initialization already in progress or completed');
        return;
    }
    
    isUserInitializing = true;
    
    try {
        // Используем данные из Telegram Web App
        const userData = tg.initDataUnsafe.user;
        
        if (!userData) {
            throw new Error('Telegram user data not found');
        }
        
        console.log('Initializing user with Telegram data:', userData);
        
        const telegramId = userData.id.toString();
        
        // Проверяем, есть ли уже currentUser с таким telegram_id
        if (currentUser && currentUser.telegram_id === telegramId) {
            console.log('User already initialized:', currentUser);
            isUserInitialized = true;
            return;
        }
        
        // Пытаемся получить пользователя с сервера
        const response = await fetch(`${API_BASE_URL}/user`, {
            headers: {
                'Authorization': telegramId
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
            updateFreeAdsCounter();
            console.log('User loaded from server:', currentUser);
            isUserInitialized = true;
        } else {
            // Если сервер вернул ошибку, создаем временного пользователя
            currentUser = {
                id: Date.now(), // временный ID
                telegram_id: telegramId,
                username: userData.username,
                first_name: userData.first_name || 'Пользователь',
                last_name: userData.last_name || '',
                photo_url: userData.photo_url
            };
            console.log('Using temporary user:', currentUser);
            isUserInitialized = true;
            showNotification('Используется локальный режим');
        }
        
        // Инициализируем WebSocket только если он еще не инициализирован
        if (currentUser && !socket) {
            console.log('Initializing WebSocket for user ID:', currentUser.id);
            initWebSocket();
        }
        
    } catch (error) {
        console.error('Error initializing user:', error);
        // Создаем временного пользователя при ошибке
        const userData = tg.initDataUnsafe.user;
        if (userData) {
            currentUser = {
                id: Date.now(),
                telegram_id: userData.id.toString(),
                username: userData.username,
                first_name: userData.first_name || 'Пользователь',
                last_name: userData.last_name || '',
                photo_url: userData.photo_url
            };
            console.log('Created temporary user due to error:', currentUser);
            isUserInitialized = true;
        }
        showNotification(`Ошибка инициализации: ${error.message}`);
    } finally {
        isUserInitializing = false;
    }
}

// ============ WEBSOCKET ============

function initWebSocket() {
    if (!currentUser || socket) {
        console.log('WebSocket already initialized or no user');
        return;
    }
    
    console.log('Initializing WebSocket connection for user:', currentUser.id);
    
    socket = io(SOCKET_URL, {
        query: {
            userId: currentUser.id,
            telegramId: currentUser.telegram_id
        },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
    });
    
    socket.on('connect', () => {
        console.log('WebSocket connected, ID:', socket.id);
    });
    
    socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
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
        showNotification(`Новая ставка на ваше задание: ${data.bid.amount} ₽`);
        addNotification({
            type: 'system',
            title: 'Новая ставка',
            message: `Пользователь ${data.userName} сделал ставку ${data.bid.amount} ₽`
        });
    });
    
    socket.on('ad-deleted', (data) => {
    if (data.userId === currentUser.id) {
        showNotification('Ваше задание успешно удалено');
    }
    
    // Если мы на экране удаленного задания - возвращаемся к списку
    if (currentScreen === 'adDetailScreen') {
        // Нужно проверить, какое задание сейчас просматривается
        // Для простоты просто возвращаем к списку
        showScreen('mainScreen');
    }
    
    // Обновляем данные
    if (currentScreen === 'mainScreen') {
        loadAds();
    }
    });

    socket.on('disconnect', () => {
        console.log('WebSocket disconnected');
    });

}

// ============ ОСНОВНЫЕ ФУНКЦИИ ============

function showScreen(screenId) {
    currentScreen = screenId;
    
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    const screen = document.getElementById(screenId);
    if (screen) {
        screen.classList.add('active');
    }
    
    // Обновляем активную кнопку в навигации
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-screen') === screenId) {
            btn.classList.add('active');
        }
    });
    
    // Обновляем кнопку назад в Telegram
    updateBackButtonForScreen(screenId);
    
    // Скрываем навигацию на некоторых экранах
    const bottomNav = document.getElementById('bottomNav');
    if (screenId === 'loadingScreen' || screenId === 'createAdScreen') {
        bottomNav.style.display = 'none';
    } else {
        bottomNav.style.display = 'flex';
    }
}

// Константы цен
const PRICES = {
    AD_PUBLICATION: 50,
    SUBSCRIPTION_MONTHLY: 299,
    SUBSCRIPTION_YEARLY: 2990
};

// Проверка возможности публикации
async function checkAdPublication() {
    if (!currentUser) return { allowed: false, reason: 'no_user' };
    
    try {
        // Измените метод с GET на POST
        const response = await fetch(`${API_BASE_URL}/ads/check`, {
            method: 'POST', // Добавьте этот метод
            headers: {
                'Authorization': currentUser.telegram_id.toString(),
                'Content-Type': 'application/json' // Добавьте заголовок
            }
        });
        
        if (response.ok) {
            return await response.json();
        }
        return { allowed: true, reason: 'fallback', free: true };
    } catch (error) {
        console.error('Check ad publication error:', error);
        return { allowed: true, reason: 'error', free: true };
    }
}

// Обновляем функцию showNotification для использования виброотклика
function showNotification(message, duration = 3000) {
    const notification = document.getElementById('notification');
    const notificationText = document.getElementById('notificationText');
    
    notificationText.textContent = message;
    notification.classList.add('show');
    
    // Виброотклик для уведомлений
    if (window.vibrate) {
        window.vibrate('light');
    }
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, duration);
}

// Функция для закрытия приложения
function closeApp() {
    if (tg && tg.close) {
        tg.close();
    }
}

// Инициализация цвета темы Telegram
function setupTelegramTheme() {
    if (tg && tg.colorScheme) {
        // Используем тему Telegram
        document.documentElement.style.setProperty('--primary-color', tg.themeParams.bg_color || '#007bff');
        document.documentElement.style.setProperty('--text-color', tg.themeParams.text_color || '#333333');
        document.documentElement.style.setProperty('--bg-color', tg.themeParams.bg_color || '#ffffff');
        document.documentElement.style.setProperty('--secondary-bg-color', tg.themeParams.secondary_bg_color || '#f8f9fa');
    }
}

// ============ РАБОТА С ОБЪЯВЛЕНИЯМИ ============

// Добавляем небольшие анимации при загрузке данных
async function loadAds() {
    try {
        const categoryFilter = document.getElementById('categoryFilter').value;
        const sortFilter = document.getElementById('sortFilter').value;
        
        let url = `${API_BASE_URL}/ads?status=active`;
        
        if (categoryFilter !== 'all') {
            url += `&category=${categoryFilter}`;
        }
        
        const response = await fetch(url, {
            headers: {
                'Authorization': currentUser.telegram_id.toString()
            }
        });
        
        if (!response.ok) throw new Error('Failed to load ads');
        
        const data = await response.json();
        ads = data.ads || [];
        
        // Сортировка
        if (sortFilter === 'price_high') {
            ads.sort((a, b) => b.price - a.price);
        } else if (sortFilter === 'price_low') {
            ads.sort((a, b) => a.price - b.price);
        } else {
            ads.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }
        
        displayAds();
    } catch (error) {
        console.error('Error loading ads:', error);
        showNotification('Ошибка при загрузке заданий');
    }
}

// Обновляем displayAds для анимации появления
function displayAds() {
    const container = document.getElementById('adsList');
    
    if (!ads || ads.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search"></i>
                <h3>Нет доступных заданий</h3>
                <p>Попробуйте обновить список или создайте первое задание</p>
                <button id="createFirstAdBtn" class="btn-primary">Создать задание</button>
            </div>
        `;
        
        document.getElementById('createFirstAdBtn')?.addEventListener('click', function() {
            showScreen('createAdScreen');
        });
        return;
    }
    
    container.innerHTML = '';
    ads.forEach((ad, index) => {
        const adElement = createAdElement(ad);
        
        // Добавляем задержку для анимации появления
        adElement.style.opacity = '0';
        adElement.style.transform = 'translateY(10px)';
        container.appendChild(adElement);
        
        setTimeout(() => {
            adElement.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            adElement.style.opacity = '1';
            adElement.style.transform = 'translateY(0)';
        }, index * 50); // Постепенное появление
    });
}


function createAdElement(ad) {
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
    const auctionEnded = ad.auction && ad.auction_ends_at && new Date(ad.auction_ends_at) < new Date();
    const isMyAd = ad.employer_id === currentUser.id;
    
    let statusBadge = '';
    if (isMyAd) {
        statusBadge = '<span class="ad-card-status" style="color: #007bff; font-weight: 600;">Мое</span>';
    } else if (ad.status === 'taken') {
        statusBadge = '<span class="ad-card-status" style="color: #ffc107; font-weight: 600;">В работе</span>';
    } else if (ad.status === 'completed') {
        statusBadge = '<span class="ad-card-status" style="color: #28a745; font-weight: 600;">Завершено</span>';
    } else if (ad.auction && !auctionEnded) {
        statusBadge = '<span class="ad-card-status" style="color: #6610f2; font-weight: 600;">Аукцион</span>';
    }
    
    let auctionInfo = '';
    if (ad.auction && !isMyAd) {
        const timeLeft = getTimeLeft(ad.auction_ends_at);
        auctionInfo = `
            <div class="auction-info">
                <div class="auction-stats">
                    <span class="auction-current-bid">Текущая ставка: ${currentBid ? currentBid + ' ₽' : 'Нет ставок'}</span>
                    <span class="auction-time-left">${auctionEnded ? 'Завершен' : 'Осталось: ' + timeLeft}</span>
                </div>
                ${!auctionEnded ? `
                    <div class="auction-bid-form">
                        <input type="number" id="bidInput_${ad.id}" placeholder="Ваша ставка" min="1" max="${ad.price}">
                        <button class="btn-secondary btn-small" onclick="placeBid('${ad.id}')">Предложить</button>
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
            <button class="ad-card-action-btn details" data-ad-id="${ad.id}">Подробнее</button>
            ${!isMyAd && ad.status === 'active' && !ad.auction ? 
                `<button class="ad-card-action-btn accept" data-ad-id="${ad.id}">Откликнуться</button>` : 
                ''
            }
            ${ad.auction && !auctionEnded && !isMyAd ? 
                `<button class="ad-card-action-btn accept" onclick="showAuctionScreen('${ad.id}')">Участвовать</button>` : 
                ''
            }
        </div>
    `;
    
        const detailsBtn = adElement.querySelector('.ad-card-action-btn.details');
        detailsBtn.addEventListener('click', function() {
            const adId = this.getAttribute('data-ad-id'); // Оставляем как строку
            showAdDetail(adId);
        });
    
        // Для кнопки отклика:
            if (!isMyAd && ad.status === 'active' && !ad.auction) {
                const acceptBtn = adElement.querySelector('.ad-card-action-btn.accept');
                acceptBtn.addEventListener('click', function() {
                    const adId = this.getAttribute('data-ad-id');
                    console.log('Responding to ad ID from card:', adId, 'Type:', typeof adId);
                    respondToAd(adId);
                });
            }
    
    return adElement;
}

async function loadMyAds(filter = 'active') {
    try {
        const response = await fetch(`${API_BASE_URL}/ads?type=my&user_id=${currentUser.id}`, {
            headers: {
                'Authorization': currentUser.telegram_id.toString()
            }
        });
        
        if (!response.ok) throw new Error('Failed to load my ads');
        
        const data = await response.json();
        const myAds = data.ads || [];
        
        let filteredAds = myAds;
        if (filter === 'active') {
            filteredAds = myAds.filter(ad => ad.status === 'active');
        } else if (filter === 'inProgress') {
            filteredAds = myAds.filter(ad => ad.status === 'taken');
        } else if (filter === 'completed') {
            filteredAds = myAds.filter(ad => ad.status === 'completed');
        }
        
        displayMyAds(filteredAds);
    } catch (error) {
        console.error('Error loading my ads:', error);
        showNotification('Ошибка при загрузке ваших заданий');
    }
}

function displayMyAds(adsList) {
    const container = document.getElementById('myAdsList');
    
    if (!adsList || adsList.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-clipboard"></i>
                <h3>У вас пока нет заданий</h3>
                <p>Создайте первое задание</p>
                <button id="createFromMyAdsBtn" class="btn-primary">Создать задание</button>
            </div>
        `;
        
        document.getElementById('createFromMyAdsBtn')?.addEventListener('click', function() {
            showScreen('createAdScreen');
        });
        return;
    }
    
    container.innerHTML = '';
    adsList.forEach(ad => {
        const adElement = createMyAdElement(ad);
        container.appendChild(adElement);
    });
}

function createMyAdElement(ad) {
    const adElement = document.createElement('div');
    adElement.className = `my-ad-card`;
    
    const categoryNames = {
        delivery: 'Доставка',
        cleaning: 'Уборка',
        repair: 'Ремонт',
        computer: 'Компьютерная помощь',
        other: 'Другое'
    };
    
    const statusText = getStatusText(ad.status);
    const statusColor = ad.status === 'active' ? '#28a745' : 
                       ad.status === 'taken' ? '#ffc107' : 
                       ad.status === 'completed' ? '#6c757d' : '#dc3545';
    
    // Разрешаем удаление только активных объявлений
    const canDelete = ad.status === 'active';
    
    adElement.innerHTML = `
        <div class="my-ad-header">
            <div class="my-ad-title">${ad.title}</div>
            <div class="my-ad-price">${ad.price} ₽</div>
        </div>
        <div class="my-ad-meta">
            <span class="my-ad-category">${categoryNames[ad.category]}</span>
            <span class="my-ad-status" style="color: ${statusColor}">${statusText}</span>
        </div>
        <div class="my-ad-description">${ad.description?.substring(0, 80) || ''}${ad.description?.length > 80 ? '...' : ''}</div>
        <div class="my-ad-footer">
            <div class="my-ad-location">
                <i class="fas fa-map-marker-alt"></i>
                <span>${ad.location}</span>
            </div>
            <div class="my-ad-actions">
                <button class="my-ad-action-btn details" data-ad-id="${ad.id}">Подробнее</button>
                ${ad.status === 'active' ? `
                    <button class="my-ad-action-btn edit" data-ad-id="${ad.id}">Изменить</button>
                    <button class="my-ad-action-btn delete" data-ad-id="${ad.id}">Удалить</button>
                ` : ''}
            </div>
        </div>
    `;
    
        // В функции createMyAdElement измените обработчики:
        adElement.querySelector('.details').addEventListener('click', function() {
            const adId = this.getAttribute('data-ad-id'); // Не преобразуем в число!
            showAdDetail(adId);
        });

        if (ad.status === 'active') {
            adElement.querySelector('.edit')?.addEventListener('click', function() {
                const adId = this.getAttribute('data-ad-id'); // Не преобразуем в число!
                editAd(adId);
            });
        }
    
    return adElement;
}

async function showAdDetail(adId) {
    try {
        console.log('Show ad detail for ID:', adId, 'Type:', typeof adId);
        
        // Преобразуем ID в строку для корректной работы с UUID
        const adIdStr = adId.toString();
        
        const response = await fetch(`${API_BASE_URL}/ads/${adIdStr}`, {
            headers: {
                'Authorization': currentUser.telegram_id.toString()
            }
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('Failed to load ad details:', errorData);
            showNotification('Ошибка загрузки задания: ' + (errorData.error || 'Unknown error'));
            return;
        }
        
        const data = await response.json();
        const ad = data.ad;
        
        if (!ad) {
            showNotification('Задание не найдено');
            return;
        }
        
        console.log('Ad loaded successfully:', ad);
        displayAdDetail(ad);
        
    } catch (error) {
        console.error('Error loading ad details:', error);
        showNotification('Ошибка при загрузке задания: ' + error.message);
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
    
    const isMyAd = ad.employer_id === currentUser.id;
    const employerName = ad.employer ? `${ad.employer.first_name} ${ad.employer.last_name}` : 'Пользователь';
    
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
                <span><strong>Автор:</strong> ${employerName}</span>
            </div>
            <div class="meta-item">
                <i class="fas fa-calendar-alt"></i>
                <span><strong>Дата публикации:</strong> ${new Date(ad.created_at).toLocaleDateString('ru-RU')}</span>
            </div>
            ${ad.contacts && isMyAd ? `
                <div class="meta-item">
                    <i class="fas fa-phone"></i>
                    <span><strong>Контакты автора:</strong> ${ad.contacts}</span>
                </div>
            ` : ''}
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
            
            ${!isMyAd && ad.status === 'active' && !ad.auction ? `
                <button id="respondAdBtn" class="btn-primary" data-ad-id="${ad.id}">
                    <i class="fas fa-check"></i> Откликнуться
                </button>
                <button id="openChatBtn" class="btn-secondary" data-ad-id="${ad.id}" data-user-id="${ad.employer_id}">
                    <i class="fas fa-comment"></i> Написать
                </button>
            ` : ''}
            
                    ${isMyAd && ad.status === 'active' ? `
                <button id="editAdBtn" class="btn-secondary" data-ad-id="${ad.id}">
                    <i class="fas fa-edit"></i> Редактировать
                </button>
                <button id="closeAdBtn" class="btn-danger" data-ad-id="${ad.id}">
                    <i class="fas fa-trash"></i> Удалить
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
        showScreen('mainScreen');
    });
    
        if (!isMyAd && ad.status === 'active' && !ad.auction) {
            document.getElementById('respondAdBtn').addEventListener('click', function() {
                const adId = this.getAttribute('data-ad-id'); // Не преобразуем в число!
                respondToAd(adId);
            });
            
            document.getElementById('openChatBtn').addEventListener('click', function() {
                const adId = this.getAttribute('data-ad-id'); // Не преобразуем в число!
                const userId = this.getAttribute('data-user-id');
                openChat(adId, userId);
            });
        }

        if (isMyAd && ad.status === 'active') {
            document.getElementById('editAdBtn').addEventListener('click', function() {
                const adId = this.getAttribute('data-ad-id'); // Не преобразуем в число!
                editAd(adId);
            });
            
            document.getElementById('closeAdBtn').addEventListener('click', function() {
                const adId = this.getAttribute('data-ad-id'); // Не преобразуем в число!
                closeAd(adId);
            });
        }
    
    showScreen('adDetailScreen');
}

async function respondToAd(adId) {
    try {
        console.log('Responding to ad with ID:', adId, 'Type:', typeof adId);
        
        showModal(
            'Отклик на задание',
            'Вы уверены, что хотите откликнуться на это задание? После отклика вы сможете обсудить детали с автором.',
            async () => {
                try {
                    // Преобразуем ID в строку для корректной работы с UUID
                    const adIdStr = adId.toString();
                    console.log('Fetching ad details for ID:', adIdStr);
                    
                    const response = await fetch(`${API_BASE_URL}/ads/${adIdStr}`, {
                        headers: {
                            'Authorization': currentUser.telegram_id.toString()
                        }
                    });
                    
                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        console.error('Failed to load ad details:', errorData);
                        showNotification('Ошибка загрузки задания: ' + (errorData.error || 'Unknown error'));
                        return;
                    }
                    
                    const data = await response.json();
                    const ad = data.ad;
                    
                    if (!ad) {
                        showNotification('Задание не найдено');
                        return;
                    }
                    
                    showNotification(`Отклик отправлен! Контакты автора: ${ad.contacts || 'не указаны'}`);
                    
                    // Открываем чат с автором
                    openChat(adId, ad.employer_id);
                    
                } catch (error) {
                    console.error('Error in respondToAd callback:', error);
                    showNotification('Ошибка при отклике на задание');
                }
            }
        );
    } catch (error) {
        console.error('Error in respondToAd:', error);
        showNotification('Ошибка при отклике на задание');
    }
}

// Обновленная функция публикации объявления
async function publishAd() {
    try {
        const title = document.getElementById('adTitle').value.trim();
        const category = document.getElementById('adCategory').value;
        const description = document.getElementById('adDescription').value.trim();
        const price = parseInt(document.getElementById('adPrice').value);
        const location = document.getElementById('adLocation').value.trim();
        const contacts = document.getElementById('adContacts').value.trim();
        const auctionEnabled = document.getElementById('auctionToggle').checked;
        
        // Валидация
        if (!title || !description || !location || !contacts || price < 100) {
            showNotification('Заполните все обязательные поля. Минимальная стоимость работы - 100 ₽');
            return;
        }
        
        // Проверяем возможность публикации
        const checkResult = await checkAdPublication();
        
        if (!checkResult.allowed) {
            showNotification('Не удалось проверить возможность публикации');
            return;
        }
        
        let paymentRequired = false;
        let paymentMethod = 'free';
        
        // Если нужна оплата, показываем экран оплаты
        if (!checkResult.free) {
            paymentRequired = true;
            const paymentResult = await showPaymentScreen(checkResult.price);
            
            if (!paymentResult.success) {
                showNotification('Публикация отменена');
                return;
            }
            
            paymentMethod = paymentResult.method;
        }
        
        // Подготавливаем данные
        const adData = {
            title,
            description,
            category,
            price,
            location,
            contacts,
            auction: auctionEnabled,
            payment_method: paymentMethod
        };
        
        if (auctionEnabled) {
            const auctionHours = parseInt(document.getElementById('auctionHours').value) || 24;
            adData.auction_hours = auctionHours;
        }
        
        // Отправляем запрос на создание
        const response = await fetch(`${API_BASE_URL}/ads`, {
            method: 'POST',
            headers: {
                'Authorization': currentUser.telegram_id.toString(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(adData)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to create ad');
        }
        
        const data = await response.json();
        
        // Очистка формы
        document.getElementById('adTitle').value = '';
        document.getElementById('adDescription').value = '';
        document.getElementById('adPrice').value = '1000';
        document.getElementById('adLocation').value = '';
        document.getElementById('adContacts').value = '';
        document.getElementById('auctionToggle').checked = false;
        
        // Показываем сообщение в зависимости от типа публикации
        if (data.used_free_ad) {
            showNotification(`Задание "${title}" опубликовано бесплатно! Осталось ${checkResult.free_ads_left - 1} бесплатных публикаций`);
        } else if (paymentRequired) {
            showNotification(`Задание "${title}" опубликовано! Стоимость: ${checkResult.price} ₽`);
        } else {
            showNotification(`Задание "${title}" успешно опубликовано!`);
        }
        
        // Обновляем данные
        showScreen('mainScreen');
        
        await initUserFromTelegram(); // 🔥 получаем новое значение
        updateFreeAdsCounter();
        await loadAds();
        await updateProfileStats();
        
    } catch (error) {
        console.error('Error publishing ad:', error);
        showNotification('Ошибка при создании задания: ' + error.message);
    }
}

function updateFreeAdsCounter() {
    if (!currentUser) return;

    const el = document.getElementById('freeAdsCount');
    if (el) {
        el.textContent = currentUser.free_ads_available ?? 0;
    }
}

// Экран оплаты
async function showPaymentScreen(amount) {
    return new Promise((resolve) => {
        showModal(
            'Оплата публикации',
            `
            <div class="payment-screen">
                <div class="payment-amount">
                    <h3>Сумма к оплате:</h3>
                    <div class="payment-sum">${amount} ₽</div>
                </div>
                
                <div class="payment-methods">
                    <h4>Способ оплаты:</h4>
                    
                    <div class="payment-method" data-method="card">
                        <div class="payment-method-icon">
                            <i class="fas fa-credit-card"></i>
                        </div>
                        <div class="payment-method-info">
                            <div class="payment-method-name">Банковская карта</div>
                            <div class="payment-method-desc">Visa, Mastercard, МИР</div>
                        </div>
                        <i class="fas fa-chevron-right"></i>
                    </div>
                    
                    <div class="payment-method" data-method="balance">
                        <div class="payment-method-icon">
                            <i class="fas fa-wallet"></i>
                        </div>
                        <div class="payment-method-info">
                            <div class="payment-method-name">Баланс приложения</div>
                            <div class="payment-method-desc">Использовать средства на балансе</div>
                        </div>
                        <i class="fas fa-chevron-right"></i>
                    </div>
                </div>
                
                <div class="payment-promo">
                    <p style="margin-bottom: 10px;">Есть промокод?</p>
                    <div class="promo-input">
                        <input type="text" id="promoCodeInput" placeholder="Введите промокод">
                        <button id="applyPromoBtn" class="btn-secondary">Применить</button>
                    </div>
                </div>
            </div>
            `,
            () => resolve({ success: true, method: 'card' })
        );
        
        // Настройка обработчиков методов оплаты
        setTimeout(() => {
            document.querySelectorAll('.payment-method').forEach(method => {
                method.addEventListener('click', function() {
                    const methodType = this.getAttribute('data-method');
                    resolve({ success: true, method: methodType });
                    document.getElementById('modal').classList.remove('active');
                });
            });
            
            document.getElementById('applyPromoBtn').addEventListener('click', function() {
                const promoCode = document.getElementById('promoCodeInput').value.trim();
                if (promoCode) {
                    // Проверка промокода
                    showNotification('Промокод проверяется...');
                }
            });
        }, 100);
    });
}

// Реферальная система
async function loadReferralInfo() {
    try {
        const response = await fetch(`${API_BASE_URL}/referrals/create`, {
            headers: {
                'Authorization': currentUser.telegram_id.toString()
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            return data;
        }
        return null;
    } catch (error) {
        console.error('Load referral info error:', error);
        return null;
    }
}

// Использование реферального кода
async function useReferralCode(code) {
    try {
        const response = await fetch(`${API_BASE_URL}/referrals/use`, {
            method: 'POST',
            headers: {
                'Authorization': currentUser.telegram_id.toString(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ referral_code: code })
        });
        
        if (response.ok) {
            const data = await response.json();
            showNotification('Реферальный код успешно применен!');
            return data;
        } else {
            const errorData = await response.json();
            showNotification(errorData.error || 'Ошибка применения кода');
            return null;
        }
    } catch (error) {
        console.error('Use referral code error:', error);
        showNotification('Ошибка применения реферального кода');
        return null;
    }
}

// Система подписок
async function loadSubscriptionInfo() {
    try {
        const response = await fetch(`${API_BASE_URL}/subscriptions/my`, {
            headers: {
                'Authorization': currentUser.telegram_id.toString()
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            return data.subscription;
        }
        return null;
    } catch (error) {
        console.error('Load subscription error:', error);
        return null;
    }
}

async function createSubscription(plan) {
    try {
        const response = await fetch(`${API_BASE_URL}/subscriptions/create`, {
            method: 'POST',
            headers: {
                'Authorization': currentUser.telegram_id.toString(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ plan })
        });
        
        if (response.ok) {
            const data = await response.json();
            showNotification(data.message || 'Подписка оформлена успешно!');
            return data.subscription;
        } else {
            const errorData = await response.json();
            showNotification(errorData.error || 'Ошибка оформления подписки');
            return null;
        }
    } catch (error) {
        console.error('Create subscription error:', error);
        showNotification('Ошибка оформления подписки');
        return null;
    }
}

async function editAd(adId) {
    // Реализация редактирования задания
    showNotification('Редактирование задания (в разработке)');
}

async function closeAd(adId) {
  try {
    // Преобразуем ID в строку для избежания проблем с типами
    const adIdStr = adId.toString();
    
    console.log('Attempting to delete ad:', {
      adId: adIdStr,
      userId: currentUser?.id,
      userName: currentUser?.first_name
    });
    
    // Сначала загрузим детали объявления для проверки
    const response = await fetch(`${API_BASE_URL}/ads/${adIdStr}`, {
      headers: {
        'Authorization': currentUser.telegram_id.toString()
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Не удалось загрузить данные объявления');
    }
    
    const data = await response.json();
    const ad = data.ad;
    
    if (!ad) {
      showNotification('Объявление не найдено');
      return;
    }
    
    // Проверяем, является ли пользователь автором
    if (ad.employer_id !== currentUser.id) {
      showNotification('Вы не являетесь автором этого объявления');
      return;
    }
    
    // Проверяем статус
    if (ad.status === 'taken' || ad.status === 'completed') {
      showNotification(`Нельзя удалить задание со статусом "${getStatusText(ad.status)}"`);
      return;
    }
    
    showModal(
      'Удаление задания',
      `Вы уверены, что хотите удалить задание "${ad.title}"?`,
      async () => {
        try {
          const deleteResponse = await fetch(`${API_BASE_URL}/ads/${adIdStr}`, {
            method: 'DELETE',
            headers: {
              'Authorization': currentUser.telegram_id.toString()
            }
          });
          
          const result = await deleteResponse.json();
          
          if (!deleteResponse.ok) {
            console.error('Delete API error:', result);
            throw new Error(result.error || `Ошибка ${deleteResponse.status}`);
          }
          
          showNotification(result.message || 'Задание успешно удалено');
          
          // Обновляем интерфейс
          await loadAds();
          
          // Если мы на экране моих заданий, обновляем и его
          if (currentScreen === 'myAdsScreen') {
            await loadMyAds('active');
          }
          
          showScreen('mainScreen');
          
        } catch (deleteError) {
          console.error('Delete error:', deleteError);
          showNotification(`Ошибка удаления: ${deleteError.message}`);
        }
      },
      'Удалить',
      'danger' // Добавим параметр для красной кнопки
    );
    
  } catch (error) {
    console.error('Error in closeAd:', error);
    showNotification(`Ошибка: ${error.message}`);
  }
}

// ============ АУКЦИОНЫ ============

async function showAuctionScreen(adId) {
    try {
        const adIdStr = adId.toString(); // Преобразуем в строку
        
        const response = await fetch(`${API_BASE_URL}/ads/${adIdStr}`, {
            headers: {
                'Authorization': currentUser.telegram_id.toString()
            }
        });
        
        if (!response.ok) throw new Error('Failed to load ad');
        
        const data = await response.json();
        const ad = data.ad;
        
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
    const isMyAd = ad.employer_id === currentUser.id;
    
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
            
            ${!auctionEnded && !isMyAd ? `
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
            ` : auctionEnded ? `
                <div class="auction-ended">
                    <h4><i class="fas fa-flag-checkered"></i> Аукцион завершен</h4>
                    <p>${isMyAd ? 'Победитель определен' : 'Победитель будет определен автоматически'}</p>
                </div>
            ` : isMyAd ? `
                <div class="auction-owner">
                    <h4><i class="fas fa-user-tie"></i> Вы автор аукциона</h4>
                    <p>Дождитесь окончания торгов для выбора победителя</p>
                </div>
            ` : ''}
            
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
    if (!auctionEnded && !isMyAd) {
        const bidInput = document.getElementById('auctionBidInput');
        bidInput.addEventListener('input', updateBidHint);
        
        document.getElementById('submitBidBtn').addEventListener('click', function() {
            const amount = parseInt(bidInput.value);
            const adId = this.getAttribute('data-ad-id'); // Не преобразуем в число!
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
    const ad = ads.find(a => a.id === adId); // UUID сравнение работает и со строками
    if (!ad) {
        showNotification('Задание не найдено');
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
    // В реальном приложении здесь был бы запрос к API
    // Пока используем заглушку
    const user = {
        id: userId,
        first_name: 'Пользователь',
        last_name: `#${userId}`
    };
    
    return user;
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
            <p>Здравствуйте! Это начало вашего чата по заданию.</p>
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

// ============ ПРОФИЛЬ ============

// Обновленный экран профиля
function loadProfileScreen() {
    if (!currentUser) return;
    
    document.getElementById('profileUserName').textContent = `${currentUser.first_name} ${currentUser.last_name}`;
    
    // Загружаем информацию о подписках и рефералах
    loadExtendedProfileInfo();
    updateProfileStats();
}

async function loadExtendedProfileInfo() {
    // Загружаем информацию о подписке
    const subscription = await loadSubscriptionInfo();
    
    // Загружаем реферальную информацию
    const referralInfo = await loadReferralInfo();
    
    // Очищаем старые элементы перед обновлением
    removeOldProfileElements();
    
    // Обновляем UI
    updateSubscriptionUI(subscription);
    updateReferralUI(referralInfo);
}

// Новая функция для очистки старых элементов
function removeOldProfileElements() {
    // Удаляем старый блок подписки
    const oldSubscription = document.querySelector('.subscription-info, .subscription-offer');
    if (oldSubscription) {
        oldSubscription.remove();
    }
    
    // Удаляем старую реферальную кнопку
    const oldReferralBtn = document.getElementById('referralBtn');
    if (oldReferralBtn) {
        oldReferralBtn.remove();
    }
}

function updateSubscriptionUI(subscription) {
    const profileStats = document.querySelector('.profile-actions');
    if (!profileStats) return;
    
    // Создаем новый элемент подписки
    const subscriptionElement = document.createElement('div');
    
    if (subscription) {
        const endDate = new Date(subscription.ends_at);
        const now = new Date();
        const daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
        
        subscriptionElement.className = 'subscription-info';
        subscriptionElement.innerHTML = `
            <h3>Активная подписка</h3>
            <div class="subscription-details">
                <div class="subscription-plan">${subscription.plan === 'yearly' ? 'Годовая' : 'Месячная'}</div>
                <div class="subscription-days">Осталось дней: ${daysLeft}</div>
                <div class="subscription-end">Действует до: ${endDate.toLocaleDateString('ru-RU')}</div>
            </div>
        `;
    } else {
        subscriptionElement.className = 'subscription-offer';
        subscriptionElement.innerHTML = `
            <h3>Подписка на публикации</h3>
            <div class="subscription-plans">
                <div class="subscription-plan-card">
                    <div class="plan-header">
                        <h4>Месячная</h4>
                        <div class="plan-price">${PRICES.SUBSCRIPTION_MONTHLY} ₽</div>
                    </div>
                    <ul class="plan-features">
                        <li><i class="fas fa-check"></i> Неограниченные публикации</li>
                        <li><i class="fas fa-check"></i> 30 дней доступа</li>
                        <li><i class="fas fa-check"></i> Приоритет в поиске</li>
                    </ul>
                    <button class="btn-primary btn-small" onclick="buySubscription('monthly')">Купить</button>
                </div>
                
                <div class="subscription-plan-card recommended">
                    <div class="plan-badge">Выгодно</div>
                    <div class="plan-header">
                        <h4>Годовая</h4>
                        <div class="plan-price">${PRICES.SUBSCRIPTION_YEARLY} ₽</div>
                        <div class="plan-save">Экономия 598 ₽</div>
                    </div>
                    <ul class="plan-features">
                        <li><i class="fas fa-check"></i> Неограниченные публикации</li>
                        <li><i class="fas fa-check"></i> 365 дней доступа</li>
                        <li><i class="fas fa-check"></i> Приоритет в поиске</li>
                        <li><i class="fas fa-check"></i> Выделение объявлений</li>
                    </ul>
                    <button class="btn-primary btn-small" onclick="buySubscription('yearly')">Купить</button>
                </div>
            </div>
        `;
    }
    
    // Добавляем блок подписки перед статистикой
    profileStats.parentNode.insertBefore(subscriptionElement, profileStats);
}

function updateReferralUI(referralInfo) {
    if (!referralInfo) return;
    
    const profileActions = document.querySelector('.profile-actions');
    if (!profileActions) return;
    
    // Создаем новую реферальную кнопку
    const referralElement = document.createElement('button');
    referralElement.className = 'profile-action-btn';
    referralElement.id = 'referralBtn';
    referralElement.innerHTML = `
        <i class="fas fa-user-plus"></i>
        <span>Пригласить друга</span>
        <i class="fas fa-chevron-right"></i>
    `;
    
    // Добавляем кнопку в профиль
    profileActions.appendChild(referralElement);
    
    // Устанавливаем обработчик событий
    referralElement.addEventListener('click', function() {
        showReferralScreen(referralInfo);
    });
}

// Экран реферальной системы
function showReferralScreen(referralInfo) {
    showModal(
        'Пригласите друга',
        `
        <div class="referral-screen">
            <div class="referral-header">
                <i class="fas fa-gift" style="font-size: 3rem; color: #007bff; margin-bottom: 20px;"></i>
                <h3>Приглашайте друзей и получайте бонусы!</h3>
            </div>
            
            <div class="referral-stats">
                <div class="stat-item">
                    <div class="stat-value">${referralInfo.stats.referrals_count || 0}</div>
                    <div class="stat-label">Приглашено</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${referralInfo.stats.bonus_ads_earned || 0}</div>
                    <div class="stat-label">Бонусов получено</div>
                </div>
            </div>
            
            <div class="referral-code">
                <h4>Ваш реферальный код:</h4>
                <div class="code-display">${referralInfo.referral_code}</div>
                <button id="copyReferralCode" class="btn-secondary btn-small">
                    <i class="fas fa-copy"></i> Копировать
                </button>
            </div>
            
            <div class="referral-link">
                <h4>Или отправьте ссылку:</h4>
                <div class="link-display">${referralInfo.referral_link}</div>
                <button id="copyReferralLink" class="btn-secondary btn-small">
                    <i class="fas fa-copy"></i> Копировать ссылку
                </button>
            </div>
            
            <div class="referral-benefits">
                <h4>Как это работает:</h4>
                <ul>
                    <li><i class="fas fa-check-circle" style="color: #28a745;"></i> За каждого приглашенного друга вы получаете <strong>2 бесплатных публикации</strong></li>
                    <li><i class="fas fa-check-circle" style="color: #28a745;"></i> Ваш друг получает <strong>+1 бесплатную публикацию</strong></li>
                    <li><i class="fas fa-check-circle" style="color: #28a745;"></i> Бонусы начисляются после первой публикации друга</li>
                </ul>
            </div>
        </div>
        `,
        () => {}
    );
    
    // Настройка копирования
    setTimeout(() => {
        document.getElementById('copyReferralCode').addEventListener('click', function() {
            navigator.clipboard.writeText(referralInfo.referral_code)
                .then(() => showNotification('Код скопирован в буфер обмена'))
                .catch(() => showNotification('Не удалось скопировать код'));
        });
        
        document.getElementById('copyReferralLink').addEventListener('click', function() {
            navigator.clipboard.writeText(referralInfo.referral_link)
                .then(() => showNotification('Ссылка скопирована в буфер обмена'))
                .catch(() => showNotification('Не удалось скопировать ссылку'));
        });
    }, 100);
}

// Обновленная функция обновления статистики профиля
function updateProfileStats() {
    if (!currentUser) return;    
    // Обновляем базовую статистику
    const createdCount = ads.filter(ad => ad.employer_id === currentUser.id).length;
    document.getElementById('profileUserStats').textContent = `${createdCount} заданий создано`;
}

// Глобальные функции
window.buySubscription = async function(plan) {
    const result = await showSubscriptionPaymentScreen(plan);
    if (result) {
        await createSubscription(plan);
        loadProfileScreen(); // Перезагружаем профиль
    }
};

// Экран оплаты подписки
async function showSubscriptionPaymentScreen(plan) {
    const price = plan === 'yearly' ? PRICES.SUBSCRIPTION_YEARLY : PRICES.SUBSCRIPTION_MONTHLY;
    const period = plan === 'yearly' ? 'год' : 'месяц';
    
    return new Promise((resolve) => {
        showModal(
            'Оформление подписки',
            `
            <div class="subscription-payment">
                <div class="payment-summary">
                    <h3>Подписка на ${period}</h3>
                    <div class="payment-amount">${price} ₽</div>
                    <p>Доступ к неограниченным публикациям на ${plan === 'yearly' ? '365 дней' : '30 дней'}</p>
                </div>
                
                <div class="payment-features">
                    <h4>Включено в подписку:</h4>
                    <ul>
                        <li><i class="fas fa-check"></i> Неограниченное количество публикаций</li>
                        <li><i class="fas fa-check"></i> Приоритетное отображение в поиске</li>
                        ${plan === 'yearly' ? '<li><i class="fas fa-check"></i> Выделение объявлений цветом</li>' : ''}
                        <li><i class="fas fa-check"></i> Поддержка 24/7</li>
                        <li><i class="fas fa-check"></i> Отмена в любой момент</li>
                    </ul>
                </div>
                
                <div class="payment-method-select">
                    <h4>Способ оплаты:</h4>
                    <select id="subscriptionPaymentMethod" class="form-control">
                        <option value="card">Банковская карта</option>
                        <option value="balance">Баланс приложения</option>
                    </select>
                </div>
            </div>
            `,
            () => {
                const method = document.getElementById('subscriptionPaymentMethod')?.value || 'card';
                resolve({ success: true, plan, method });
            }
        );
    });
}

// ============ УВЕДОМЛЕНИЯ ============

async function loadNotifications() {
    // В реальном приложении здесь был бы запрос к API
    notifications = [
        {
            id: 1,
            type: 'system',
            title: 'Добро пожаловать!',
            message: 'Спасибо за использование Шабашка. Начните создавать задания или откликайтесь на существующие.',
            read: true,
            created_at: new Date(Date.now() - 86400000).toISOString()
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
    const badge = document.querySelector('#notificationsBtn .badge');
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
        'system': 'info-circle',
        'warning': 'exclamation-triangle'
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
}

function clearAllNotifications() {
    notifications.forEach(n => n.read = true);
    updateNotificationBadge();
    showNotificationsScreen();
    showNotification('Все уведомления отмечены как прочитанные');
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
    // Навигация
    document.querySelectorAll('.nav-btn[data-screen]').forEach(btn => {
        btn.addEventListener('click', function() {
            const screenId = this.getAttribute('data-screen');
            showScreen(screenId);
            
            if (screenId === 'mainScreen') {
                loadAds();
            } else if (screenId === 'myAdsScreen') {
                loadMyAds('active');
            } else if (screenId === 'profileScreen') {
                loadProfileScreen();
            }
        });
    });
    
    // Кнопка создания в навигации
    document.getElementById('createNavBtn').addEventListener('click', function() {
        showScreen('createAdScreen');
    });
    
    // Кнопка создания в главном экране
    document.getElementById('createAdBtn')?.addEventListener('click', function() {
        showScreen('createAdScreen');
    });
    
    // Кнопка создания первого задания
    document.getElementById('createFirstAdBtn')?.addEventListener('click', function() {
        showScreen('createAdScreen');
    });
    
    // Кнопка создания из моих заданий
    document.getElementById('createFromMyAdsBtn')?.addEventListener('click', function() {
        showScreen('createAdScreen');
    });
    
    // Кнопка закрытия профиля
    document.getElementById('profileBtn').addEventListener('click', function() {
        showScreen('profileScreen');
    });

    document.getElementById('closeProfileBtn')?.addEventListener('click', function() {
        showScreen('mainScreen');
    });
    
    // Кнопка обновления списка
    document.getElementById('refreshAdsBtn')?.addEventListener('click', async function() {
        const icon = this.querySelector('i');
        const button = this;
        
        if (button.classList.contains('loading')) return;
        
        button.classList.add('loading');
        button.disabled = true;
        icon.classList.add('fa-spin');
        
        try {
            await loadAds();
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
    
    // Фильтры
    document.getElementById('categoryFilter')?.addEventListener('change', loadAds);
    document.getElementById('sortFilter')?.addEventListener('change', loadAds);
    
    // Табы в моих заданиях
    document.querySelectorAll('#myAdsScreen .tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const tab = this.getAttribute('data-tab');
            
            document.querySelectorAll('#myAdsScreen .tab-btn').forEach(b => {
                b.classList.remove('active');
            });
            this.classList.add('active');
            
            loadMyAds(tab);
        });
    });
    
    // Кнопки в профиле
    document.getElementById('myAdsBtn')?.addEventListener('click', function() {
        showScreen('myAdsScreen');
    });
    
    // Кнопка отправки сообщения в чате
    document.getElementById('sendMessageBtn')?.addEventListener('click', sendMessage);
    
    // Enter для отправки сообщения
    document.getElementById('chatInput')?.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    
    // Кнопка уведомлений
    document.getElementById('notificationsBtn')?.addEventListener('click', showNotificationsScreen);
    
    // Кнопка очистки уведомлений
    document.getElementById('clearNotificationsBtn')?.addEventListener('click', clearAllNotifications);

        // Кнопка принудительного обновления
    document.getElementById('refreshAdsBtn')?.addEventListener('click', async function() {
        const icon = this.querySelector('i');
        const button = this;
        
        if (button.classList.contains('loading')) return;
        
        button.classList.add('loading');
        button.disabled = true;
        icon.classList.add('fa-spin');
        
        try {
            await loadAds();
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
    // Уведомления в Telegram
    setupTelegramNotifications();
}

// Настройка уведомлений в Telegram
function setupTelegramNotifications() {
    if (tg && tg.showAlert) {
        // Пример использования алерта Telegram
        window.showTelegramAlert = function(message) {
            tg.showAlert(message);
        };
    }
    
    if (tg && tg.HapticFeedback) {
        // Виброотклик для важных действий
        window.vibrate = function(type = 'light') {
            switch(type) {
                case 'light':
                    tg.HapticFeedback.impactOccurred('light');
                    break;
                case 'medium':
                    tg.HapticFeedback.impactOccurred('medium');
                    break;
                case 'heavy':
                    tg.HapticFeedback.impactOccurred('heavy');
                    break;
                case 'success':
                    tg.HapticFeedback.notificationOccurred('success');
                    break;
                case 'error':
                    tg.HapticFeedback.notificationOccurred('error');
                    break;
            }
        };
    }
}

// Глобальные функции для использования в HTML
window.placeBid = function(adId) {
    const input = document.getElementById(`bidInput_${adId}`);
    const amount = parseInt(input?.value);
    if (amount) {
        placeBid(adId, amount);
    }
};

window.showAuctionScreen = showAuctionScreen;
window.updateBid = updateBid;

// ============ ТЕЛЕГРАМ КНОПКА НАЗАД ============

let isTelegramBackButtonVisible = false;

// Показываем кнопку назад в Telegram
function showTelegramBackButton() {
    if (tg && tg.BackButton && !isTelegramBackButtonVisible) {
        tg.BackButton.show();
        isTelegramBackButtonVisible = true;
    }
}

// Скрываем кнопку назад в Telegram
function hideTelegramBackButton() {
    if (tg && tg.BackButton && isTelegramBackButtonVisible) {
        tg.BackButton.hide();
        isTelegramBackButtonVisible = false;
    }
}

// Обновляем кнопку назад в зависимости от экрана
function updateBackButtonForScreen(screenId) {
    // Скрываем кнопку на главном экране и экране загрузки
    if (screenId === 'mainScreen' || screenId === 'loadingScreen') {
        hideTelegramBackButton();
    } else {
        showTelegramBackButton();
    }
}

// Настройка обработчика кнопки назад
function setupTelegramBackButton() {
    if (tg && tg.BackButton) {
        tg.BackButton.onClick(() => {
            handleTelegramBackButton();
        });
    }
}

// Обработчик нажатия кнопки назад
function handleTelegramBackButton() {
    switch (currentScreen) {
        case 'createAdScreen':
            showScreen('mainScreen');
            break;
            
        case 'adDetailScreen':
            showScreen('mainScreen');
            break;
            
        case 'chatScreen':
            showScreen('mainScreen');
            break;
            
        case 'profileScreen':
            showScreen('mainScreen');
            break;
            
        case 'notificationsScreen':
            showScreen('mainScreen');
            break;
            
        case 'myAdsScreen':
            showScreen('mainScreen');
            break;
            
        default:
            // Если это вложенный экран, возвращаемся на предыдущий
            if (window.history.length > 1) {
                window.history.back();
            } else {
                showScreen('mainScreen');
            }
    }
}


// Инициализация при загрузке
async function initApp() {
    await initUserFromTelegram();
    setupEventListeners();
    
    if (currentUser) {
        showScreen('mainScreen');
        await loadAds();
        updateProfileStats();
    }
}

// if (document.readyState === 'loading') {
//     document.addEventListener('DOMContentLoaded', function() {
//         // Экран загрузки уже показан в основном обработчике
//     });
// } else {
//     // Если DOM уже загружен, запускаем загрузку
//     startLoading();
// }
