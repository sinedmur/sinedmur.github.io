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
        updateLoadingStep(0);
        await updateProgress(10);
        await sleep(300);
        
        // Шаг 2: Авторизация
        updateLoadingStep(1);
        await updateProgress(30);
        
        if (!isUserInitialized && !isUserInitializing) {
            await initUserFromTelegram();
        }
        
        // Шаг 3: Загрузка данных
        updateLoadingStep(2);
        await updateProgress(60);
        
        if (currentUser) {
            await loadAds();
            await updateProgress(85);
        }
        
        // Шаг 4: Завершение
        updateLoadingStep(3);
        await updateProgress(100);
        await sleep(200);
        
        // Загрузка завершена
        completeLoading();
        
    } catch (error) {
        document.getElementById('loadingHint').textContent = 'Ошибка загрузки. Перезагрузите приложение.';
        setTimeout(completeLoading, 3000);
    }
}

// Обновление шага загрузки
function updateLoadingStep(step, hint = '') {
    loadingStep = step;
    
    const stepNames = [
        'Инициализация приложения...',
        'Авторизация пользователя...',
        'Загрузка данных...',
        'Завершение загрузки...'
    ];
    
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
    } else if (stepNames[step]) {
        document.getElementById('loadingHint').textContent = stepNames[step];
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
    } 
    finally {
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
// Обновленная функция initUserFromTelegram в app.js
async function initUserFromTelegram() {
  // Если уже инициализируемся или инициализированы - выходим
  if (isUserInitializing || isUserInitialized) {
    return;
  }
  
  isUserInitializing = true;
  
  try {
    // Используем данные из Telegram Web App
    const userData = tg.initDataUnsafe.user;
    
    if (!userData) {
      throw new Error('Telegram user data not found');
    }
    
    const telegramId = userData.id.toString();
    
    // Проверяем, есть ли уже currentUser с таким telegram_id
    if (currentUser && currentUser.telegram_id === telegramId) {
      isUserInitialized = true;
      return;
    }
    
    // Пытаемся получить пользователя с сервера
    const response = await fetch(`${API_BASE_URL}/user`, {
      headers: {
        'Authorization': telegramId,
        'X-Telegram-User': JSON.stringify({
          first_name: userData.first_name,
          last_name: userData.last_name || '',
          username: userData.username || null
        })
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      currentUser = data.user;
      updateFreeAdsCounter();
      isUserInitialized = true;
      
      // Обновляем UI с именем пользователя
      updateUserUI();
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
      isUserInitialized = true;
      
      // Обновляем UI с именем пользователя
      updateUserUI();
      
      showNotification('Используется локальный режим');
    }
    
    // Инициализируем WebSocket только если он еще не инициализирован
    if (currentUser && !socket) {
      initWebSocket();
    }
    
  } catch (error) {
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
      isUserInitialized = true;
      
      // Обновляем UI с именем пользователя
      updateUserUI();
    }
    showNotification(`Ошибка инициализации: ${error.message}`);
  } finally {
    isUserInitializing = false;
  }
}

// Новая функция для обновления UI с именем пользователя
function updateUserUI() {
  if (!currentUser) return;
  
  // Обновляем имя в профиле
  const profileUserName = document.getElementById('profileUserName');
  if (profileUserName) {
    profileUserName.textContent = `${currentUser.first_name} ${currentUser.last_name || ''}`.trim();
  }
  
  // Обновляем другие элементы, где может отображаться имя пользователя
  const userNameElements = document.querySelectorAll('[data-user-name]');
  userNameElements.forEach(el => {
    el.textContent = currentUser.first_name;
  });
}

// ============ WEBSOCKET ============

function initWebSocket() {
    if (!currentUser || socket) {
        return;
    }
    
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
    });
    
    socket.on('connect_error', (error) => {
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
            ${ad.auction ? '<span class="ad-card-auction-badge"><i class="fas fa-gavel"></i> Торги</span>' : ''}
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
        
        // Обновляем счетчик в заголовке
        const header = document.querySelector('#myAdsScreen .screen-header');
        if (header) {
            header.setAttribute('data-count', filteredAds.length);
        }
        
    } catch (error) {
        showNotification('Ошибка при загрузке ваших заданий');
        displayMyAds([]); // Показываем пустое состояние при ошибке
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
        
        // Обработчик для кнопки создания из пустого состояния
        setTimeout(() => {
            const createBtn = document.getElementById('createFromMyAdsBtn');
            if (createBtn) {
                createBtn.addEventListener('click', function() {
                    showScreen('createAdScreen');
                });
            }
        }, 100);
        
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
    adElement.className = `my-ad-card ${ad.auction ? 'auction-active' : ''}`;
    
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
    
    const canDelete = ad.status === 'active'; // Разрешаем удаление только активных
    
    // Информация об аукционе
    let auctionInfo = '';
    if (ad.auction && ad.status === 'active') {
        const timeLeft = getTimeLeft(ad.auction_ends_at);
        const bidsCount = ad.bids_count || 0;
        auctionInfo = `
            <div class="my-ad-auction-info">
                <div class="auction-bids-count">
                    <i class="fas fa-gavel"></i>
                    <span>${bidsCount} ставок</span>
                </div>
                <div class="auction-time-left">
                    <i class="fas fa-clock"></i>
                    <span>${timeLeft}</span>
                </div>
            </div>
        `;
    }
    
    adElement.innerHTML = `
        <div class="my-ad-header">
            <div class="my-ad-title">${ad.title}</div>
            <div class="my-ad-price">${ad.price} ₽</div>
        </div>
        <div class="my-ad-meta">
            <div class="my-ad-category" data-category="${ad.category}">
                ${categoryNames[ad.category]}
                ${ad.auction ? '<span class="my-ad-auction-badge"><i class="fas fa-gavel"></i> Аукцион</span>' : ''}
            </div>
            <div class="my-ad-status" style="color: ${statusColor}">${statusText}</div>
        </div>
        ${auctionInfo}
        <div class="my-ad-description">${ad.description?.substring(0, 80) || ''}${ad.description?.length > 80 ? '...' : ''}</div>
        <div class="my-ad-footer">
            <div class="my-ad-location">
                <i class="fas fa-map-marker-alt"></i>
                <span>${ad.location}</span>
            </div>
            <div class="my-ad-actions">
                <button class="my-ad-action-btn details" data-ad-id="${ad.id}">
                    <i class="fas fa-eye"></i> Подробнее
                </button>
                ${ad.status === 'active' ? `
                    <button class="my-ad-action-btn edit" data-ad-id="${ad.id}">
                        <i class="fas fa-edit"></i> Изменить
                    </button>
                    <button class="my-ad-action-btn delete" data-ad-id="${ad.id}">
                        <i class="fas fa-trash"></i> Удалить
                    </button>
                ` : ''}
            </div>
        </div>
    `;
    
    // Добавляем обработчики событий
    addMyAdEventListeners(adElement, ad);
    
    return adElement;
}

// Функция для добавления обработчиков событий к карточке
function addMyAdEventListeners(adElement, ad) {
    // Кнопка "Подробнее"
    const detailsBtn = adElement.querySelector('.my-ad-action-btn.details');
    if (detailsBtn) {
        detailsBtn.addEventListener('click', function() {
            const adId = this.getAttribute('data-ad-id');
            showAdDetail(adId);
        });
    }
    
    // Кнопка "Изменить" (только для активных)
    const editBtn = adElement.querySelector('.my-ad-action-btn.edit');
    if (editBtn) {
        editBtn.addEventListener('click', function() {
            const adId = this.getAttribute('data-ad-id');
            editAd(adId);
        });
    }
    
    // Кнопка "Удалить" (только для активных)
    const deleteBtn = adElement.querySelector('.my-ad-action-btn.delete');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async function() {
            const adId = this.getAttribute('data-ad-id');
            // Блокируем кнопку во время удаления
            this.disabled = true;
            this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Удаление...';
            try {
                await closeAd(adId);
            } finally {
                // Восстанавливаем кнопку
                this.disabled = false;
                this.innerHTML = '<i class="fas fa-trash"></i> Удалить';
            }
        });
    }
}

async function showAdDetail(adId) {
    try {    
        // Преобразуем ID в строку для корректной работы с UUID
        const adIdStr = adId.toString();   
        const response = await fetch(`${API_BASE_URL}/ads/${adIdStr}`, {
            headers: {
                'Authorization': currentUser.telegram_id.toString()
            }
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            showNotification('Ошибка загрузки задания: ' + (errorData.error || 'Unknown error'));
            return;
        }
        
        const data = await response.json();
        const ad = data.ad;
        
        if (!ad) {
            showNotification('Задание не найдено');
            return;
        }
        displayAdDetail(ad);
        
    } catch (error) {
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
    const auctionEnded = ad.auction && ad.auction_ends_at && new Date(ad.auction_ends_at) < new Date();
    
    container.innerHTML = `
        <div class="ad-detail-screen">
            <div class="ad-detail-header">
                <button class="ad-detail-header-back" id="adDetailBackBtn">
                    <i class="fas fa-arrow-left"></i>
                </button>
                <div class="ad-detail-title-section">
                    <h1 class="ad-detail-title">${ad.title}</h1>
                    <div class="ad-detail-price">${ad.price} ₽</div>
                    <div class="ad-detail-badges">
                        <span class="ad-detail-badge">
                            <i class="fas fa-tag"></i>
                            ${categoryNames[ad.category]}
                        </span>
                        ${ad.auction ? `
                            <span class="ad-detail-badge" style="background: rgba(255, 193, 7, 0.3);">
                                <i class="fas fa-gavel"></i>
                                ${auctionEnded ? 'Аукцион завершен' : 'Идёт аукцион'}
                            </span>
                        ` : ''}
                        <span class="ad-detail-badge" style="background: ${ad.status === 'active' ? 'rgba(40, 167, 69, 0.3)' : ad.status === 'taken' ? 'rgba(255, 193, 7, 0.3)' : 'rgba(108, 117, 125, 0.3)'}">
                            <i class="fas fa-${ad.status === 'active' ? 'check-circle' : ad.status === 'taken' ? 'clock' : 'flag'}"></i>
                            ${getStatusText(ad.status)}
                        </span>
                    </div>
                </div>
            </div>
            
            <div class="ad-detail-container">
                <div class="ad-detail-meta-grid">
                    <div class="ad-detail-meta-card">
                        <div class="ad-detail-meta-icon">
                            <i class="fas fa-user"></i>
                        </div>
                        <div class="ad-detail-meta-label">Автор</div>
                        <div class="ad-detail-meta-value">${employerName}</div>
                    </div>
                    
                    <div class="ad-detail-meta-card">
                        <div class="ad-detail-meta-icon">
                            <i class="fas fa-map-marker-alt"></i>
                        </div>
                        <div class="ad-detail-meta-label">Местоположение</div>
                        <div class="ad-detail-meta-value">${ad.location}</div>
                    </div>
                    
                    <div class="ad-detail-meta-card">
                        <div class="ad-detail-meta-icon">
                            <i class="fas fa-calendar-alt"></i>
                        </div>
                        <div class="ad-detail-meta-label">Дата</div>
                        <div class="ad-detail-meta-value">${new Date(ad.created_at).toLocaleDateString('ru-RU')}</div>
                    </div>
                    
                    ${ad.auction_ends_at ? `
                        <div class="ad-detail-meta-card">
                            <div class="ad-detail-meta-icon">
                                <i class="fas fa-clock"></i>
                            </div>
                            <div class="ad-detail-meta-label">${auctionEnded ? 'Завершён' : 'Завершится'}</div>
                            <div class="ad-detail-meta-value">${new Date(ad.auction_ends_at).toLocaleString('ru-RU', { 
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit'
                            })}</div>
                        </div>
                    ` : ''}
                </div>
                
                ${ad.contacts && isMyAd ? `
                    <div class="ad-detail-contacts">
                        <div class="ad-detail-section-title">
                            <i class="fas fa-address-card"></i>
                            Контакты автора
                        </div>
                        <div class="contact-item">
                            <div class="contact-icon">
                                <i class="fas fa-phone"></i>
                            </div>
                            <div class="contact-info">
                                <div class="contact-label">Телефон/контакты</div>
                                <div class="contact-value">${ad.contacts}</div>
                            </div>
                        </div>
                    </div>
                ` : ''}
                
                <div class="ad-detail-section">
                    <div class="ad-detail-section-title">
                        <i class="fas fa-align-left"></i>
                        Описание задания
                    </div>
                    <div class="ad-detail-description">
                        ${ad.description || 'Описание не указано'}
                    </div>
                </div>
                
                ${ad.auction ? `
                    <div class="ad-detail-auction-section">
                        <div class="ad-detail-section-title">
                            <i class="fas fa-gavel"></i>
                            Аукцион
                        </div>
                        
                        <div class="auction-timer">
                            ${getTimeLeft(ad.auction_ends_at)}
                        </div>
                        
                        <div class="auction-price-comparison">
                            <div class="auction-price-item">
                                <div class="auction-price-label">Начальная цена</div>
                                <div class="auction-price-value initial">${ad.price} ₽</div>
                            </div>
                            <div class="auction-price-item">
                                <div class="auction-price-label">Текущая ставка</div>
                                <div class="auction-price-value current">${ad.min_bid || ad.price} ₽</div>
                            </div>
                        </div>
                        
                        ${!auctionEnded && !isMyAd ? `
                            <div style="text-align: center; margin-top: 20px;">
                                <button id="participateAuctionBtn" class="btn-primary" data-ad-id="${ad.id}" style="padding: 12px 24px;">
                                    <i class="fas fa-gavel"></i> Участвовать в аукционе
                                </button>
                            </div>
                        ` : ''}
                        
                        <div class="bids-history-compact" id="bidsHistoryList">
                            Загрузка истории ставок...
                        </div>
                    </div>
                ` : ''}
                
                <div class="ad-detail-status">
                    <div class="status-progress">
                        <div class="status-progress-bar">
                            <div class="status-progress-fill" style="width: ${
                                ad.status === 'active' ? '33%' : 
                                ad.status === 'taken' ? '66%' : 
                                '100%'
                            }"></div>
                        </div>
                        <div class="status-progress-text">
                            ${getStatusText(ad.status)}
                        </div>
                    </div>
                    <div class="status-description">
                        ${ad.status === 'active' ? 'Задание активно и ждёт исполнителя' : 
                          ad.status === 'taken' ? 'Задание в работе' : 
                          'Задание завершено'}
                    </div>
                </div>
            </div>
            
            <div class="ad-detail-actions">
                ${isMyAd ? `
                    <button class="ad-detail-action-btn secondary" id="editAdBtn" data-ad-id="${ad.id}">
                        <i class="fas fa-edit"></i> Редактировать
                    </button>
                    <button class="ad-detail-action-btn danger" id="closeAdBtn" data-ad-id="${ad.id}">
                        <i class="fas fa-trash"></i> Удалить
                    </button>
                ` : !isMyAd && ad.status === 'active' && !ad.auction ? `
                    <button class="ad-detail-action-btn secondary" id="openChatBtn" data-ad-id="${ad.id}" data-user-id="${ad.employer_id}">
                        <i class="fas fa-comment"></i> Чат
                    </button>
                    <button class="ad-detail-action-btn primary" id="respondAdBtn" data-ad-id="${ad.id}">
                        <i class="fas fa-check"></i> Откликнуться
                    </button>
                ` : ad.auction && !auctionEnded && !isMyAd ? `
                    <button class="ad-detail-action-btn primary" id="participateAuctionBtn2" data-ad-id="${ad.id}">
                        <i class="fas fa-gavel"></i> Участвовать
                    </button>
                ` : ''}
            </div>
        </div>
    `;
    
    // Загружаем историю ставок для аукциона
    if (ad.auction) {
        loadBidsForAd(ad.id);
    }
    
    // Настройка обработчиков
    document.getElementById('adDetailBackBtn').addEventListener('click', function() {
        showScreen('mainScreen');
    });
    
    // Остальные обработчики остаются такими же...
    if (!isMyAd && ad.status === 'active' && !ad.auction) {
        document.getElementById('respondAdBtn').addEventListener('click', function() {
            const adId = this.getAttribute('data-ad-id');
            respondToAd(adId);
        });
        
        document.getElementById('openChatBtn').addEventListener('click', function() {
            const adId = this.getAttribute('data-ad-id');
            const userId = this.getAttribute('data-user-id');
            openChat(adId, userId);
        });
    }
    
    if (ad.auction && !auctionEnded && !isMyAd) {
        const participateBtn = document.getElementById('participateAuctionBtn') || document.getElementById('participateAuctionBtn2');
        if (participateBtn) {
            participateBtn.addEventListener('click', function() {
                const adId = this.getAttribute('data-ad-id');
                showAuctionScreen(adId);
            });
        }
    }
    
    if (isMyAd && ad.status === 'active') {
        document.getElementById('editAdBtn').addEventListener('click', function() {
            const adId = this.getAttribute('data-ad-id');
            editAd(adId);
        });
        
        document.getElementById('closeAdBtn').addEventListener('click', function() {
            const adId = this.getAttribute('data-ad-id');
            closeAd(adId);
        });
    }
    
    showScreen('adDetailScreen');
}

async function respondToAd(adId) {
    try {
        showModal(
            'Отклик на задание',
            'Вы уверены, что хотите откликнуться на это задание? После отклика вы сможете обсудить детали с автором.',
            async () => {
                try {
                    // Преобразуем ID в строку для корректной работы с UUID
                    const adIdStr = adId.toString();                  
                    const response = await fetch(`${API_BASE_URL}/ads/${adIdStr}`, {
                        headers: {
                            'Authorization': currentUser.telegram_id.toString()
                        }
                    });
                    
                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
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
                    showNotification('Ошибка при отклике на задание');
                }
            }
        );
    } catch (error) {
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
            method: 'POST', // Изменяем на POST
            headers: {
                'Authorization': currentUser.telegram_id.toString(),
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            return await response.json();
        } else {
            // Если запрос не удался, создаем локальные данные
            return {
                referral_code: generateReferralCode(),
                referral_link: `https://t.me/your_bot?start=ref_${currentUser.id}`,
                stats: {
                    referrals_count: 0,
                    bonus_ads_earned: 0
                }
            };
        }
    } catch (error) {
        // Возвращаем fallback данные
        return {
            referral_code: generateReferralCode(),
            referral_link: `https://t.me/your_bot?start=ref_${currentUser.id}`,
            stats: {
                referrals_count: 0,
                bonus_ads_earned: 0
            }
        };
    }
}

// Вспомогательная функция для генерации кода
function generateReferralCode() {
    return 'REF' + Math.random().toString(36).substr(2, 6).toUpperCase();
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
        showNotification('Ошибка оформления подписки');
        return null;
    }
}

// Обновленная функция редактирования задания (заглушка)
async function editAd(adId) {
    try {
        const adIdStr = adId.toString();
        const response = await fetch(`${API_BASE_URL}/ads/${adIdStr}`, {
            headers: {
                'Authorization': currentUser.telegram_id.toString()
            }
        });
        
        if (!response.ok) {
            throw new Error('Не удалось загрузить данные задания');
        }
        
        const data = await response.json();
        const ad = data.ad;
        
        showModal(
            'Редактирование задания',
            `
            <div style="text-align: center; padding: 20px 0;">
                <i class="fas fa-edit" style="font-size: 3rem; color: #4361ee; margin-bottom: 15px;"></i>
                <h3 style="margin-bottom: 10px;">${ad.title}</h3>
                <p style="color: #6c757d;">Функция редактирования в разработке</p>
                <div style="background: #f8f9fa; padding: 15px; border-radius: var(--border-radius); margin-top: 20px;">
                    <p style="margin-bottom: 10px;">Вместо редактирования вы можете:</p>
                    <ul style="text-align: left; padding-left: 20px; color: #6c757d;">
                        <li>Удалить текущее задание и создать новое</li>
                        <li>Обсудить изменения с исполнителем в чате</li>
                        <li>Обновить информацию в описании через чат</li>
                    </ul>
                </div>
            </div>
            `,
            () => {
            },
            'Понятно'
        );
        
    } catch (error) {
        showNotification('Ошибка при загрузке данных задания');
    }
}

async function closeAd(adId) {
    try {
        // Преобразуем ID в строку для избежания проблем с типами
        const adIdStr = adId.toString();
        
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
        
        // Показываем подтверждение удаления
        showModal(
            'Удаление задания',
            `
            <div style="padding: 15px 0;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: #ef233c; margin-bottom: 15px;"></i>
                    <h3 style="margin-bottom: 10px; color: var(--dark-color);">Вы уверены?</h3>
                    <p style="color: #6c757d; line-height: 1.5;">
                        Задание "<strong>${ad.title}</strong>" будет удалено без возможности восстановления.
                    </p>
                </div>
                <div style="background: #f8f9fa; padding: 15px; border-radius: var(--border-radius); margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span style="color: #6c757d;">Стоимость:</span>
                        <span style="font-weight: 600;">${ad.price} ₽</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span style="color: #6c757d;">Категория:</span>
                        <span style="font-weight: 600;">${getCategoryName(ad.category)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: #6c757d;">Статус:</span>
                        <span style="font-weight: 600; color: ${ad.status === 'active' ? '#28a745' : '#6c757d'}">
                            ${getStatusText(ad.status)}
                        </span>
                    </div>
                </div>
                ${ad.auction ? '<p style="color: #ffc107; text-align: center;"><i class="fas fa-exclamation-circle"></i> Все ставки по аукциону также будут удалены</p>' : ''}
            </div>
            `,
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
                        throw new Error(result.error || `Ошибка ${deleteResponse.status}`);
                    }
                    
                    showNotification(result.message || 'Задание успешно удалено');
                    
                    // Обновляем интерфейс
                    await loadAds();
                    
                    // Перезагружаем мои задания с текущим фильтром
                    const activeTab = document.querySelector('#myAdsScreen .tab-btn.active');
                    const currentFilter = activeTab ? activeTab.getAttribute('data-tab') : 'active';
                    await loadMyAds(currentFilter);
                    
                    // Если мы на экране деталей удаленного задания - возвращаемся
                    if (currentScreen === 'adDetailScreen') {
                        showScreen('myAdsScreen');
                    }
                    
                } catch (deleteError) {
                    showNotification(`Ошибка удаления: ${deleteError.message}`);
                }
            },
            'Удалить',
            'danger'
        );
        
    } catch (error) {
        showNotification(`Ошибка: ${error.message}`);
    }
}

function getCategoryName(category) {
    const categories = {
        delivery: 'Доставка',
        cleaning: 'Уборка',
        repair: 'Ремонт',
        computer: 'Компьютерная помощь',
        other: 'Другое'
    };
    return categories[category] || category;
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
    
    // Очищаем старые элементы перед обновлением
    removeOldProfileElements();
    
    // Обновляем UI
    updateSubscriptionUI(subscription);
}

// Новая функция для очистки старых элементов
function removeOldProfileElements() {
    // Удаляем старый блок подписки
    const oldSubscription = document.querySelector('.subscription-info, .subscription-offer');
    if (oldSubscription) {
        oldSubscription.remove();
    }
}

function updateSubscriptionUI(subscription) {
    const profileStats = document.querySelector('.profile-stats');
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

// Экран реферальной системы
function showReferralScreen(referralInfo = null) {
    // Если данные не переданы, используем fallback
    const info = referralInfo || {
        referral_code: generateReferralCode(),
        referral_link: `https://t.me/your_bot?start=ref_${currentUser.id}`,
        stats: {
            referrals_count: 0,
            bonus_ads_earned: 0
        }
    };
    
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
                    <div class="stat-value">${info.stats.referrals_count || 0}</div>
                    <div class="stat-label">Приглашено</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${info.stats.bonus_ads_earned || 0}</div>
                    <div class="stat-label">Бонусов получено</div>
                </div>
            </div>
            
            <div class="referral-code">
                <h4>Ваш реферальный код:</h4>
                <div class="code-display">${info.referral_code}</div>
                <button id="copyReferralCode" class="btn-secondary btn-small">
                    <i class="fas fa-copy"></i> Копировать
                </button>
            </div>
            
            <div class="referral-link">
                <h4>Или отправьте ссылку:</h4>
                <div class="link-display">${info.referral_link}</div>
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
        () => {
        }
    );
    
    // Настройка копирования
    setTimeout(() => {
        const copyCodeBtn = document.getElementById('copyReferralCode');
        const copyLinkBtn = document.getElementById('copyReferralLink');
        
        if (copyCodeBtn) {
            copyCodeBtn.addEventListener('click', function() {
                navigator.clipboard.writeText(info.referral_code)
                    .then(() => showNotification('Код скопирован в буфер обмена'))
                    .catch(() => showNotification('Не удалось скопировать код'));
            });
        }
        
        if (copyLinkBtn) {
            copyLinkBtn.addEventListener('click', function() {
                navigator.clipboard.writeText(info.referral_link)
                    .then(() => showNotification('Ссылка скопирована в буфер обмена'))
                    .catch(() => showNotification('Не удалось скопировать ссылку'));
            });
        }
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

function showModal(title, message, confirmCallback, confirmText = 'Подтвердить', confirmType = 'primary') {
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    const modalCancelBtn = document.getElementById('modalCancelBtn');
    const modalConfirmBtn = document.getElementById('modalConfirmBtn');
    const closeModalBtn = document.getElementById('closeModalBtn');
    
    modalTitle.textContent = title;
    modalBody.innerHTML = message;
    
    // Настраиваем кнопки в зависимости от типа
    modalConfirmBtn.textContent = confirmText;
    
    // Сбрасываем стили кнопок
    modalCancelBtn.className = 'btn-secondary';
    modalConfirmBtn.className = 'btn-primary';
    
    // Применяем специальные стили для кнопок
    if (confirmType === 'danger') {
        modalConfirmBtn.style.background = 'linear-gradient(135deg, #ef233c, #d90429)';
        modalConfirmBtn.style.boxShadow = '0 4px 15px rgba(239, 35, 60, 0.3)';
    } else {
        modalConfirmBtn.style.background = '';
        modalConfirmBtn.style.boxShadow = '';
    }
    
    modal.classList.add('active');
    
    const closeModal = () => {
        modal.classList.remove('active');
        // Сбрасываем обработчики
        modalCancelBtn.onclick = null;
        closeModalBtn.onclick = null;
        modalConfirmBtn.onclick = null;
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
    
    document.getElementById('referralBtn').addEventListener('click', async function() {
        // Загружаем данные рефералов перед показом экрана
        const referralInfo = await loadReferralInfo();
        if (referralInfo) {
            showReferralScreen(referralInfo);
        } else {
            showNotification('Не удалось загрузить информацию о рефералах');
        }
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
            
            // Обновляем активную вкладку
            document.querySelectorAll('#myAdsScreen .tab-btn').forEach(b => {
                b.classList.remove('active');
            });
            this.classList.add('active');
            
            // Загружаем задания с выбранным фильтром
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
