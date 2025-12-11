// Инициализация Telegram Web App
const tg = window.Telegram.WebApp;
tg.expand(); // Развернуть приложение на весь экран
tg.enableClosingConfirmation(); // Подтверждение при закрытии

// Инициализация приложения
document.addEventListener('DOMContentLoaded', function() {

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

    // Инициализация данных пользователя
    initUser();
    
    // Инициализация данных приложения
    initAppData();
    
    // Настройка обработчиков событий
    setupEventListeners();
    
    // Показать экран выбора роли, если роль еще не выбрана
    const user = getUser();
    if (!user.role) {
        showScreen('roleScreen');
    } else if (user.role === 'employer') {
        showScreen('employerScreen');
        loadEmployerAds();
        updateEmployerStats();
    } else {
        showScreen('workerScreen');
        loadWorkerAds();
        updateWorkerStats();
    }
    
    // Обновить информацию в шапке
    updateHeaderInfo();
});

// Хранение данных (в реальном приложении это будет серверная часть)
let users = [];
let ads = [];
let transactions = [];
let bids = []; // Массив ставок

// Инициализация данных аукциона
function initAuctionData() {
    const savedBids = localStorage.getItem('telegramJobBids');
    if (savedBids) {
        bids = JSON.parse(savedBids);
    } else {
        bids = [];
        saveBids();
    }
}

function saveBids() {
    localStorage.setItem('telegramJobBids', JSON.stringify(bids));
}

// Добавьте в конец функции initAppData():
initAuctionData();

// Обновим функцию createAdElement для отображения аукциона
function createAdElement(ad, isEmployerView) {
    const adElement = document.createElement('div');
    adElement.className = `ad-card ${ad.auction ? 'ad-card-auction' : ''}`;
    
    // Определение цвета категории
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
    
    // Получаем текущую минимальную ставку
    const currentBid = ad.auction ? getCurrentBid(ad.id) : null;
    const auctionEnded = ad.auction && new Date(ad.auctionEndsAt) < new Date();
    
    // Статус объявления
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
        const timeLeft = getTimeLeft(ad.auctionEndsAt);
        auctionInfo = `
            <div class="auction-info">
                <h4>${auctionEnded ? 'Аукцион завершен' : 'Идет аукцион'}</h4>
                <div class="auction-stats">
                    <span class="auction-current-bid">Текущая ставка: ${currentBid ? currentBid.amount + ' ₽' : 'Нет ставок'}</span>
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
        <div class="ad-card-description">${ad.description.substring(0, 100)}${ad.description.length > 100 ? '...' : ''}</div>
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
    
    // Добавление обработчиков событий для стандартных кнопок
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

// Функции для работы с аукционами
function getCurrentBid(adId) {
    const adBids = bids.filter(bid => bid.adId === adId);
    if (adBids.length === 0) return null;
    return adBids.reduce((min, bid) => bid.amount < min.amount ? bid : min);
}

function getTimeLeft(endDate) {
    const end = new Date(endDate);
    const now = new Date();
    const diff = end - now;
    
    if (diff <= 0) return 'Завершен';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}ч ${minutes}м`;
}

// Обновим функцию publishAd() для добавления аукциона
function publishAd() {
    const user = getUser();
    
    // Получение данных из формы
    const title = document.getElementById('adTitle').value.trim();
    const category = document.getElementById('adCategory').value;
    const description = document.getElementById('adDescription').value.trim();
    const price = parseInt(document.getElementById('adPrice').value);
    const location = document.getElementById('adLocation').value.trim();
    const auctionEnabled = document.getElementById('auctionToggle').checked;
    const auctionHours = auctionEnabled ? parseInt(document.getElementById('auctionHours').value) : 0;
    const auctionMinutes = auctionEnabled ? parseInt(document.getElementById('auctionMinutes').value) : 0;
    
    // Проверка данных
    if (!title || !description || !location || price < 100) {
        showNotification('Заполните все поля корректно. Минимальная цена - 100 ₽');
        return;
    }
    
    // Проверка времени аукциона
    if (auctionEnabled && (auctionHours === 0 && auctionMinutes === 0)) {
        showNotification('Укажите время проведения аукциона');
        return;
    }
    
    // Проверка подписки
    const hasSubscription = checkUserSubscription();
    const createPrice = 50; // Цена за создание объявления
    
    if (!hasSubscription) {
        if (user.balance < createPrice) {
            showNotification(`Недостаточно средств. Нужно ${createPrice} ₽. Ваш баланс: ${user.balance} ₽`);
            showPaymentScreen('create_ad', createPrice, 'Оплата размещения объявления');
            return;
        }
        
        // Списание средств
        user.balance -= createPrice;
        transactions.push({
            id: transactions.length + 1,
            userId: user.id,
            amount: -createPrice,
            type: 'create_ad',
            description: `Создание объявления: ${title}`,
            createdAt: new Date().toISOString()
        });
        saveTransactions();
    }
    
    // Расчет времени окончания аукциона
    let auctionEndsAt = null;
    if (auctionEnabled) {
        auctionEndsAt = new Date();
        auctionEndsAt.setHours(auctionEndsAt.getHours() + auctionHours);
        auctionEndsAt.setMinutes(auctionEndsAt.getMinutes() + auctionMinutes);
    }
    
    // Создание объявления
    const newAd = {
        id: ads.length + 1,
        employerId: user.id,
        title,
        description,
        category,
        price,
        location,
        auction: auctionEnabled,
        auctionEndsAt: auctionEndsAt ? auctionEndsAt.toISOString() : null,
        status: user.role === 'admin' ? 'active' : 'moderation',
        moderated: user.role === 'admin',
        takenBy: null,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 86400000).toISOString()
    };
    
    ads.push(newAd);
    saveAds();
    
    // Обновление пользователя
    saveUsers();
    
    // Очистка формы и возврат
    document.getElementById('adTitle').value = '';
    document.getElementById('adDescription').value = '';
    document.getElementById('adPrice').value = '1000';
    document.getElementById('adLocation').value = '';
    document.getElementById('auctionToggle').checked = false;
    document.getElementById('auctionHours').value = '1';
    document.getElementById('auctionMinutes').value = '0';
    
    showNotification(`Объявление "${title}" успешно опубликовано!`);
    showScreen('employerScreen');
    loadEmployerAds();
    updateEmployerStats();
    updateHeaderInfo();
    
    if (user.role !== 'admin') {
        // Отправляем уведомление админам
        const adminUsers = users.filter(u => u.role === 'admin');
        adminUsers.forEach(admin => {
            sendNotification(
                admin.id,
                'moderation',
                'Новое объявление на модерацию',
                `Пользователь ${user.firstName} ${user.lastName} создал новое объявление`,
                { adId: newAd.id }
            );
        });
    }
}

// Функция для отображения экрана аукциона
function showAuctionScreen(adId) {
    const ad = ads.find(a => a.id === adId);
    if (!ad || !ad.auction) return;
    
    const currentBid = getCurrentBid(adId);
    const userBid = bids.find(bid => bid.adId === adId && bid.userId === getUser().id);
    
    const container = document.getElementById('adDetailContainer');
    container.innerHTML = `
        <div class="auction-screen">
            <div class="auction-header">
                <h2>${ad.title}</h2>
                <p>Аукцион за задание</p>
            </div>
            
            <div class="auction-timer-large" id="auctionTimer">
                ${getTimeLeft(ad.auctionEndsAt)}
            </div>
            
            <div class="auction-price">
                <div class="price-item">
                    <div class="price-label">Начальная цена</div>
                    <div class="price-value initial-price">${ad.price} ₽</div>
                </div>
                <div class="price-item">
                    <div class="price-label">Текущая ставка</div>
                    <div class="price-value current-price">${currentBid ? currentBid.amount + ' ₽' : 'Нет'}</div>
                </div>
            </div>
            
            <div class="auction-bid-container">
                <h4>Ваше предложение</h4>
                <p>Предложите цену ниже текущей ставки или начальной цены</p>
                
                <div class="bid-input-group">
                    <input type="number" id="auctionBidInput" 
                           value="${userBid ? userBid.amount - 10 : ad.price - 10}" 
                           min="1" max="${currentBid ? currentBid.amount - 1 : ad.price}">
                    <span style="font-size: 1.2rem; font-weight: 600;">₽</span>
                </div>
                
                <div class="bid-step-buttons">
                    <button class="bid-step-btn" onclick="updateBid(-10)">-10 ₽</button>
                    <button class="bid-step-btn" onclick="updateBid(-50)">-50 ₽</button>
                    <button class="bid-step-btn" onclick="updateBid(-100)">-100 ₽</button>
                    <button class="bid-step-btn" onclick="updateBid(-200)">-200 ₽</button>
                </div>
                
                <div class="bid-hint" id="bidHint">
                    ${currentBid ? `Текущая ставка: ${currentBid.amount} ₽` : `Начальная цена: ${ad.price} ₽`}
                </div>
                
                <button id="submitBidBtn" class="btn-primary btn-large">
                    <i class="fas fa-gavel"></i> Сделать ставку
                </button>
            </div>
            
            <div class="bids-history">
                <h5>История ставок</h5>
                <div id="bidsHistoryList">
                    <!-- История ставок будет загружена здесь -->
                </div>
            </div>
        </div>
    `;
    
    // Загружаем историю ставок
    loadBidsHistory(adId);
    
    // Обновляем таймер каждую минуту
    const timerElement = document.getElementById('auctionTimer');
    const updateTimer = () => {
        const timeLeft = getTimeLeft(ad.auctionEndsAt);
        timerElement.textContent = timeLeft;
        
        if (timeLeft === 'Завершен') {
            clearInterval(timerInterval);
            // Проверяем результаты аукциона
            checkAuctionResults(adId);
        }
    };
    
    const timerInterval = setInterval(updateTimer, 60000); // Обновляем каждую минуту
    
    // Настройка обработчиков событий
    const bidInput = document.getElementById('auctionBidInput');
    bidInput.addEventListener('input', function() {
        updateBidHint();
    });
    
    document.getElementById('submitBidBtn').addEventListener('click', function() {
        const amount = parseInt(bidInput.value);
        if (isValidBid(adId, amount)) {
            placeAuctionBid(adId, amount);
        } else {
            showNotification('Ставка должна быть ниже текущей минимальной');
        }
    });
    
    showScreen('adDetailScreen');
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
    const amount = parseInt(input.value) || 0;
    
    hint.textContent = `Вы предлагаете: ${amount} ₽`;
}

function isValidBid(adId, amount) {
    const ad = ads.find(a => a.id === adId);
    if (!ad) return false;
    
    const currentBid = getCurrentBid(adId);
    
    // Проверяем, что ставка ниже текущей минимальной или начальной цены
    if (currentBid) {
        return amount < currentBid.amount;
    } else {
        return amount < ad.price;
    }
}

function placeAuctionBid(adId, amount) {
    const user = getUser();
    const ad = ads.find(a => a.id === adId);
    
    if (!ad || !ad.auction) {
        showNotification('Аукцион не найден');
        return;
    }
    
    // Проверяем, что аукцион еще не закончился
    if (new Date(ad.auctionEndsAt) < new Date()) {
        showNotification('Аукцион уже завершен');
        return;
    }
    
    // Проверяем валидность ставки
    if (!isValidBid(adId, amount)) {
        showNotification('Ставка должна быть ниже текущей минимальной');
        return;
    }
    
    // Создаем ставку
    const bid = {
        id: bids.length + 1,
        adId: adId,
        userId: user.id,
        userName: `${user.firstName} ${user.lastName}`,
        amount: amount,
        createdAt: new Date().toISOString()
    };
    
    bids.push(bid);
    saveBids();
    
    // Отправляем уведомление работодателю
    sendNotification(
        ad.employerId,
        'system',
        'Новая ставка на аукционе',
        `Пользователь ${user.firstName} ${user.lastName} сделал ставку ${amount} ₽ на ваше задание "${ad.title}"`,
        { adId: adId, bidId: bid.id }
    );
    
    // Обновляем UI
    showNotification(`Ваша ставка ${amount} ₽ принята!`);
    
    // Обновляем экран аукциона
    showAuctionScreen(adId);
    
    // Обновляем список объявлений
    if (user.role === 'worker') {
        loadWorkerAds();
    }
}

function loadBidsHistory(adId) {
    const adBids = bids
        .filter(bid => bid.adId === adId)
        .sort((a, b) => a.amount - b.amount); // Сортируем по возрастанию цены
    
    const container = document.getElementById('bidsHistoryList');
    
    if (adBids.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #6c757d;">Ставок еще нет</p>';
        return;
    }
    
    container.innerHTML = adBids.map(bid => `
        <div class="bid-item">
            <div class="bid-user">
                <div class="bid-avatar">
                    <i class="fas fa-user"></i>
                </div>
                <span>${bid.userName}</span>
            </div>
            <div class="bid-amount">${bid.amount} ₽</div>
            <div class="bid-time">${new Date(bid.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
    `).join('');
}

function checkAuctionResults(adId) {
    const ad = ads.find(a => a.id === adId);
    if (!ad || !ad.auction || ad.status !== 'active') return;
    
    const adBids = bids.filter(bid => bid.adId === adId);
    
    if (adBids.length === 0) {
        // Нет ставок - аукцион завершился без победителя
        sendNotification(
            ad.employerId,
            'system',
            'Аукцион завершен',
            `Аукцион по заданию "${ad.title}" завершился без ставок`,
            { adId: adId }
        );
        return;
    }
    
    // Находим минимальную ставку
    const winningBid = adBids.reduce((min, bid) => bid.amount < min.amount ? bid : min);
    
    // Обновляем объявление
    ad.status = 'taken';
    ad.takenBy = winningBid.userId;
    ad.finalPrice = winningBid.amount;
    saveAds();
    
    // Отправляем уведомления
    sendNotification(
        ad.employerId,
        'system',
        'Аукцион завершен',
        `Победитель аукциона по заданию "${ad.title}": ${winningBid.userName} с ценой ${winningBid.amount} ₽`,
        { adId: adId, winnerId: winningBid.userId }
    );
    
    sendNotification(
        winningBid.userId,
        'system',
        'Вы выиграли аукцион!',
        `Вы выиграли аукцион по заданию "${ad.title}" с ценой ${winningBid.amount} ₽`,
        { adId: adId }
    );
    
    showNotification(`Аукцион по заданию "${ad.title}" завершен. Победитель: ${winningBid.userName}`);
}

// Обновим функцию acceptAd для работы с аукционами
function acceptAd(adId) {
    const user = getUser();
    const ad = ads.find(a => a.id === adId);
    
    if (!ad) {
        showNotification('Объявление не найдено');
        return;
    }
    
    if (ad.auction) {
        showAuctionScreen(adId);
        return;
    }
    
    // Остальной код функции остается без изменений...
    // [Существующий код функции acceptAd]
}

// Обновим setupEventListeners для добавления аукциона
function setupEventListeners() {
    // Существующий код...
    
    // Добавим обработчики для аукциона
    document.getElementById('auctionToggle')?.addEventListener('change', function() {
        const settings = document.getElementById('auctionSettings');
        if (this.checked) {
            settings.classList.add('active');
        } else {
            settings.classList.remove('active');
        }
    });
}

// Добавим проверку завершенных аукционов при загрузке
setInterval(() => {
    const activeAuctions = ads.filter(ad => 
        ad.auction && 
        ad.status === 'active' && 
        new Date(ad.auctionEndsAt) < new Date()
    );
    
    activeAuctions.forEach(ad => {
        checkAuctionResults(ad.id);
    });
}, 60000); // Проверяем каждую минуту


// Инициализация пользователя
function initUser() {
    const savedUser = localStorage.getItem('telegramJobUser');
    if (savedUser) {
        users = JSON.parse(savedUser);
    } else {
        // Создаем тестового пользователя
        users = [{
            id: 1,
            telegramId: tg.initDataUnsafe.user?.id || 123456789,
            username: tg.initDataUnsafe.user?.username || 'testuser',
            firstName: tg.initDataUnsafe.user?.first_name || 'Тестовый',
            lastName: tg.initDataUnsafe.user?.last_name || 'Пользователь',
            balance: 1000,
            role: null, // 'employer' или 'worker'
            subscriptionUntil: null,
            createdAt: new Date().toISOString()
        }];
        saveUsers();
    }
        // Создаем тестового администратора
    const adminUser = {
        id: 999,
        telegramId: 1019928513,
        username: 'admin',
        firstName: 'Администратор',
        lastName: 'Системы',
        balance: 10000,
        role: 'admin', // Новая роль
        subscriptionUntil: null,
        createdAt: new Date().toISOString()
    };
    
    // Добавляем админа, если его нет
    if (!users.find(u => u.role === 'admin')) {
        users.push(adminUser);
        saveUsers();
    }
}

// Инициализация данных приложения
function initAppData() {
    const savedAds = localStorage.getItem('telegramJobAds');
    const savedTransactions = localStorage.getItem('telegramJobTransactions');
    
    if (savedAds) {
        ads = JSON.parse(savedAds);
    } else {
        // Создаем тестовые объявления
        ads = [
            {
                id: 1,
                employerId: 1,
                title: "Помощь с переездом",
                description: "Нужно помочь перевезти вещи из квартиры в новый дом. Грузчиков двое, нужна помощь с погрузкой и разгрузкой.",
                category: "delivery",
                price: 3000,
                location: "Москва, центр",
                status: "active", // active, taken, completed
                takenBy: null,
                createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 день назад
                expiresAt: new Date(Date.now() + 7 * 86400000).toISOString() // через 7 дней
            },
            {
                id: 2,
                employerId: 1,
                title: "Уборка квартиры после ремонта",
                description: "Требуется генеральная уборка 3-комнатной квартиры после ремонта. Нужно вынести строительный мусор и вымыть все поверхности.",
                category: "cleaning",
                price: 5000,
                location: "Санкт-Петербург, Невский проспект",
                status: "active",
                takenBy: null,
                createdAt: new Date(Date.now() - 43200000).toISOString(), // 12 часов назад
                expiresAt: new Date(Date.now() + 6 * 86400000).toISOString()
            },
            {
                id: 3,
                employerId: 1,
                title: "Ремонт ноутбука",
                description: "Ноутбук не включается после падения. Нужна диагностика и ремонт. Запчасти есть.",
                category: "repair",
                price: 2000,
                location: "Казань, центр",
                status: "taken",
                takenBy: 2,
                createdAt: new Date(Date.now() - 172800000).toISOString(), // 2 дня назад
                expiresAt: new Date(Date.now() + 5 * 86400000).toISOString()
            }
        ];
        saveAds();
    }
    
    if (savedTransactions) {
        transactions = JSON.parse(savedTransactions);
    } else {
        transactions = [];
        saveTransactions();
    }
        const savedChats = localStorage.getItem('telegramJobChats');
    const savedReviews = localStorage.getItem('telegramJobReviews');
    const savedNotifications = localStorage.getItem('telegramJobNotifications');
    
    if (savedChats) {
        chats = JSON.parse(savedChats);
    } else {
        chats = [];
        saveChats();
    }
    
    if (savedReviews) {
        reviews = JSON.parse(savedReviews);
    } else {
        reviews = [];
        saveReviews();
    }
    
    if (savedNotifications) {
        notifications = JSON.parse(savedNotifications);
    } else {
        // Создаем тестовые уведомления
        notifications = [
            {
                id: 1,
                userId: 1,
                type: 'system',
                title: 'Добро пожаловать!',
                message: 'Спасибо за регистрацию в JobFinder. Начните использовать все возможности приложения.',
                read: true,
                createdAt: new Date(Date.now() - 86400000).toISOString(),
                data: {}
            },
            {
                id: 2,
                userId: 1,
                type: 'message',
                title: 'Новое сообщение',
                message: 'Работодатель ответил на ваше предложение',
                read: false,
                createdAt: new Date(Date.now() - 3600000).toISOString(),
                data: { chatId: 1, adId: 1 }
            }
        ];
        saveNotifications();
    }
}

let chats = [];
let reviews = [];
let notifications = [];

// Сохранение данных
function saveUsers() {
    localStorage.setItem('telegramJobUser', JSON.stringify(users));
}

function saveAds() {
    localStorage.setItem('telegramJobAds', JSON.stringify(ads));
}

function saveTransactions() {
    localStorage.setItem('telegramJobTransactions', JSON.stringify(transactions));
}

// Получение текущего пользователя
function getUser() {
    return users[0];
}

// Показать уведомление
function showNotification(message, duration = 3000) {
    const notification = document.getElementById('notification');
    const notificationText = document.getElementById('notificationText');
    
    notificationText.textContent = message;
    notification.classList.add('show');
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, duration);
}

// Переключение между экранами
function showScreen(screenId) {
    // Скрыть все экраны
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    // Показать нужный экран
    const screen = document.getElementById(screenId);
    if (screen) {
        screen.classList.add('active');
    }
    
    // Обновить активную кнопку в навигации
    if (screenId === 'employerScreen' || screenId === 'workerScreen') {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.getAttribute('data-screen') === screenId) {
                btn.classList.add('active');
            }
        });
    }
    
    // Скрыть нижнюю навигацию на некоторых экранах
    const bottomNav = document.getElementById('bottomNav');
    if (screenId === 'roleScreen' || screenId === 'createAdScreen' || 
        screenId === 'adDetailScreen' || screenId === 'profileScreen' || 
        screenId === 'paymentScreen') {
        bottomNav.style.display = 'none';
    } else {
        bottomNav.style.display = 'flex';
    }
}

// Обновление информации в шапке
function updateHeaderInfo() {
    const user = getUser();
    document.getElementById('userBalance').textContent = `${user.balance} ₽`;
}

// Настройка обработчиков событий
function setupEventListeners() {
    // Выбор роли
    document.querySelectorAll('.role-card').forEach(card => {
        card.addEventListener('click', function() {
            const role = this.getAttribute('data-role');
            setUserRole(role);
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
        const user = getUser();
        if (user.role === 'employer') {
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
        const user = getUser();
        if (user.role === 'employer') {
            showScreen('employerScreen');
        } else {
            showScreen('workerScreen');
        }
    });
    
    // Кнопка создания объявления (на экране работодателя)
    document.getElementById('createAdBtn').addEventListener('click', function() {
        showScreen('createAdScreen');
    });
    
    // Кнопка создания первого объявления
    document.getElementById('createFirstAdBtn').addEventListener('click', function() {
        showScreen('createAdScreen');
    });
    
    // Кнопка назад на экране создания объявления
    document.getElementById('backToEmployerBtn').addEventListener('click', function() {
        showScreen('employerScreen');
    });
    
    // Кнопка обновления объявлений
    document.getElementById('refreshAdsBtn').addEventListener('click', function() {
        loadWorkerAds();
        showNotification('Список обновлен');
    });
    
    // Кнопка публикации объявления
    document.getElementById('publishAdBtn').addEventListener('click', publishAd);
    
    // Кнопка покупки подписки
    document.getElementById('buySubscriptionBtn').addEventListener('click', function() {
        showPaymentScreen('subscription', 300, 'Оформление подписки на 30 дней');
    });
    
    document.getElementById('buySubscriptionProfileBtn').addEventListener('click', function() {
        showPaymentScreen('subscription', 300, 'Оформление подписки на 30 дней');
    });
    
    document.getElementById('buySubscriptionMainBtn').addEventListener('click', function() {
        showPaymentScreen('subscription', 300, 'Оформление подписки на 30 дней');
    });
    
    // Кнопка пополнения баланса
    document.getElementById('depositBtn').addEventListener('click', function() {
        showPaymentScreen('deposit', 1000, 'Пополнение баланса');
    });
    
    // Кнопка смены роли
    document.getElementById('changeRoleBtn').addEventListener('click', function() {
        showModal(
            'Смена роли',
            'Вы уверены, что хотите сменить роль? При смене роли история ваших объявлений и заданий сохранится.',
            () => {
                const user = getUser();
                user.role = user.role === 'employer' ? 'worker' : 'employer';
                saveUsers();
                
                if (user.role === 'employer') {
                    showScreen('employerScreen');
                    loadEmployerAds();
                    updateEmployerStats();
                } else {
                    showScreen('workerScreen');
                    loadWorkerAds();
                    updateWorkerStats();
                }
                
                updateHeaderInfo();
                loadProfileScreen();
                showNotification('Роль успешно изменена');
            }
        );
    });
    
    // Кнопка отмены оплаты
    document.getElementById('cancelPaymentBtn').addEventListener('click', function() {
        const user = getUser();
        if (user.role === 'employer') {
            showScreen('employerScreen');
        } else {
            showScreen('workerScreen');
        }
    });
    
    // Табы на экране работодателя
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            
            // Обновить активную кнопку
            document.querySelectorAll('.tab-btn').forEach(b => {
                b.classList.remove('active');
            });
            this.classList.add('active');
            
            // Показать соответствующий контент
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(`${tabId}Tab`).classList.add('active');
            
            // Загрузить объявления для этой вкладки
            if (tabId === 'myAds') {
                loadEmployerAds();
            }
        });
    });
    
    // Фильтры на экране работника
    document.getElementById('categoryFilter').addEventListener('change', loadWorkerAds);
    document.getElementById('priceFilter').addEventListener('change', loadWorkerAds);

        // Кнопка уведомлений в шапке
    const notificationsBtn = document.createElement('button');
    notificationsBtn.id = 'notificationsBtn';
    notificationsBtn.className = 'btn-icon';
    notificationsBtn.innerHTML = '<i class="fas fa-bell"></i>';
    notificationsBtn.addEventListener('click', toggleNotificationsDropdown);
    document.querySelector('.user-info').appendChild(notificationsBtn);
    
    // Кнопка открытия чата
    document.addEventListener('click', function(e) {
        if (e.target.closest('.open-chat-btn')) {
            const adId = parseInt(e.target.closest('.open-chat-btn').getAttribute('data-ad-id'));
            const userId = parseInt(e.target.closest('.open-chat-btn').getAttribute('data-user-id'));
            openChat(adId, userId);
        }
    });
    
    // Кнопка отправки сообщения
    document.getElementById('sendMessageBtn').addEventListener('click', sendMessage);
    
    // Enter для отправки сообщения
    document.getElementById('chatInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    
    // Кнопка назад из чата
    document.getElementById('backFromChatBtn').addEventListener('click', function() {
        const user = getUser();
        if (user.role === 'employer') {
            showScreen('employerScreen');
        } else {
            showScreen('workerScreen');
        }
    });
    
    // Кнопка открытия уведомлений
    document.getElementById('viewAllNotificationsBtn')?.addEventListener('click', function() {
        showNotificationsScreen();
        hideNotificationsDropdown();
    });
    
    // Очистка уведомлений
    document.getElementById('clearNotificationsBtn')?.addEventListener('click', clearAllNotifications);
    
    // Закрытие выпадающих меню при клике вне их
    document.addEventListener('click', function(e) {
        if (!e.target.closest('#notificationsDropdown') && !e.target.closest('#notificationsBtn')) {
            hideNotificationsDropdown();
        }
        if (!e.target.closest('#chatMenu') && !e.target.closest('#chatMenuBtn')) {
            hideChatMenu();
        }
    });
}

// Установка роли пользователя
function setUserRole(role) {
    const user = getUser();
    user.role = role;
    saveUsers();
    
    if (role === 'employer') {
        showScreen('employerScreen');
        loadEmployerAds();
        updateEmployerStats();
    } else {
        showScreen('workerScreen');
        loadWorkerAds();
        updateWorkerStats();
    }
    
    updateHeaderInfo();
    showNotification(`Роль "${role === 'employer' ? 'работодатель' : 'работник'}" успешно установлена`);
}

// Загрузка объявлений работодателя
function loadEmployerAds() {
    const user = getUser();
    const adsList = document.getElementById('employerAdsList');
    
    // Фильтрация объявлений по статусу
    let filteredAds = ads.filter(ad => ad.employerId === user.id);
    
    // Определяем активную вкладку
    const activeTab = document.querySelector('.tab-btn.active').getAttribute('data-tab');
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
    
    // Сортировка по дате (новые сначала)
    filteredAds.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    adsList.innerHTML = '';
    filteredAds.forEach(ad => {
        const adElement = createAdElement(ad, true);
        adsList.appendChild(adElement);
    });
}

// Загрузка объявлений для работника
function loadWorkerAds() {
    const user = getUser();
    const adsList = document.getElementById('workerAdsList');
    
    // Фильтрация активных объявлений
    let filteredAds = ads.filter(ad => ad.status === 'active' && ad.employerId !== user.id);
    
    // Применение фильтров
    const categoryFilter = document.getElementById('categoryFilter').value;
    const priceFilter = document.getElementById('priceFilter').value;
    
    if (categoryFilter !== 'all') {
        filteredAds = filteredAds.filter(ad => ad.category === categoryFilter);
    }
    
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
        adsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search"></i>
                <h3>Нет доступных заданий</h3>
                <p>Попробуйте обновить список или изменить фильтры</p>
            </div>
        `;
        return;
    }
    
    // Сортировка по дате (новые сначала)
    filteredAds.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    adsList.innerHTML = '';
    filteredAds.forEach(ad => {
        const adElement = createAdElement(ad, false);
        adsList.appendChild(adElement);
    });
}

// Создание элемента объявления
function createAdElement(ad, isEmployerView) {
    const adElement = document.createElement('div');
    adElement.className = 'ad-card';
    
    // Определение цвета категории
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
    
    // Статус объявления
    let statusBadge = '';
    if (ad.status === 'taken') {
        statusBadge = '<span class="ad-card-status" style="color: #ffc107; font-weight: 600;">В работе</span>';
    } else if (ad.status === 'completed') {
        statusBadge = '<span class="ad-card-status" style="color: #28a745; font-weight: 600;">Завершено</span>';
    }
    
    adElement.innerHTML = `
        <div class="ad-card-header">
            <div class="ad-card-title">${ad.title}</div>
            <div class="ad-card-price">${ad.price} ₽</div>
        </div>
        <div class="ad-card-category" style="background-color: ${categoryColors[ad.category] + '20'}; color: ${categoryColors[ad.category]}">
            ${categoryNames[ad.category]}
        </div>
        <div class="ad-card-description">${ad.description.substring(0, 100)}${ad.description.length > 100 ? '...' : ''}</div>
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
                 <button class="ad-card-action-btn accept" data-ad-id="${ad.id}">Принять</button>`
            }
        </div>
    `;
    
    // Добавление обработчиков событий
    const detailsBtn = adElement.querySelector('.ad-card-action-btn.details');
    detailsBtn.addEventListener('click', function() {
        const adId = parseInt(this.getAttribute('data-ad-id'));
        showAdDetail(adId);
    });
    
    if (!isEmployerView) {
        const acceptBtn = adElement.querySelector('.ad-card-action-btn.accept');
        acceptBtn.addEventListener('click', function() {
            const adId = parseInt(this.getAttribute('data-ad-id'));
            acceptAd(adId);
        });
    }
    
    return adElement;
}

// Показать детали объявления
function showAdDetail(adId) {
    const ad = ads.find(a => a.id === adId);
    if (!ad) return;
    
    const container = document.getElementById('adDetailContainer');
    const user = getUser();
    const isEmployer = user.role === 'employer';
    
    const categoryNames = {
        delivery: 'Доставка',
        cleaning: 'Уборка',
        repair: 'Ремонт',
        computer: 'Компьютерная помощь',
        other: 'Другое'
    };
    
    container.innerHTML = `
        <div class="ad-detail-header">
            <div class="ad-detail-title">${ad.title}</div>
            <div class="ad-detail-price">${ad.price} ₽</div>
        </div>
        
        <div class="ad-detail-category">${categoryNames[ad.category]}</div>
        
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
                <i class="fas fa-calendar-alt"></i>
                <span><strong>Дата публикации:</strong> ${new Date(ad.createdAt).toLocaleDateString('ru-RU')}</span>
            </div>
            <div class="meta-item">
                <i class="fas fa-clock"></i>
                <span><strong>Срок выполнения:</strong> до ${new Date(ad.expiresAt).toLocaleDateString('ru-RU')}</span>
            </div>
            <div class="meta-item">
                <i class="fas fa-info-circle"></i>
                <span><strong>Статус:</strong> ${ad.status === 'active' ? 'Активно' : ad.status === 'taken' ? 'В работе' : 'Завершено'}</span>
            </div>
        </div>
        
        <div class="ad-detail-actions">
            <button id="backToListBtn" class="btn-secondary">
                <i class="fas fa-arrow-left"></i> Назад к списку
            </button>
            
            ${!isEmployer && ad.status === 'active' ? `
                <button id="acceptAdDetailBtn" class="btn-primary" data-ad-id="${ad.id}">
                    <i class="fas fa-check"></i> Принять задание
                </button>
            ` : ''}
            
            ${isEmployer && ad.status === 'active' ? `
                <button id="editAdBtn" class="btn-secondary" data-ad-id="${ad.id}">
                    <i class="fas fa-edit"></i> Редактировать
                </button>
            ` : ''}
        </div>
    `;
    
    // Обработчики событий для кнопок на экране деталей
    document.getElementById('backToListBtn').addEventListener('click', function() {
        const user = getUser();
        if (user.role === 'employer') {
            showScreen('employerScreen');
        } else {
            showScreen('workerScreen');
        }
    });
    
    if (!isEmployer && ad.status === 'active') {
        document.getElementById('acceptAdDetailBtn').addEventListener('click', function() {
            const adId = parseInt(this.getAttribute('data-ad-id'));
            acceptAd(adId);
        });
    }
    
    showScreen('adDetailScreen');
}

// Принятие объявления работником
function acceptAd(adId) {
    const user = getUser();
    const ad = ads.find(a => a.id === adId);
    
    if (!ad) {
        showNotification('Объявление не найдено');
        return;
    }
    
    if (ad.status !== 'active') {
        showNotification('Это объявление уже занято или завершено');
        return;
    }
    
    // Проверка подписки
    const hasSubscription = checkUserSubscription();
    const acceptPrice = 30; // Цена за принятие объявления
    
    if (!hasSubscription) {
        if (user.balance < acceptPrice) {
            showNotification(`Недостаточно средств. Нужно ${acceptPrice} ₽. Ваш баланс: ${user.balance} ₽`);
            showPaymentScreen('accept_ad', acceptPrice, 'Оплата принятия объявления');
            return;
        }
        
        // Списание средств
        user.balance -= acceptPrice;
        transactions.push({
            id: transactions.length + 1,
            userId: user.id,
            amount: -acceptPrice,
            type: 'accept_ad',
            description: `Принятие объявления: ${ad.title}`,
            createdAt: new Date().toISOString()
        });
        saveTransactions();
    }
    
    // Обновление объявления
    ad.status = 'taken';
    ad.takenBy = user.id;
    saveAds();
    
    // Обновление пользователя
    saveUsers();
    
    // Обновление интерфейса
    showNotification(`Вы приняли задание "${ad.title}"! Свяжитесь с работодателем для уточнения деталей.`);
    
    if (user.role === 'worker') {
        showScreen('workerScreen');
        loadWorkerAds();
        updateWorkerStats();
    }
    
    updateHeaderInfo();
}

// Публикация нового объявления
function publishAd() {
    const user = getUser();
    
    // Получение данных из формы
    const title = document.getElementById('adTitle').value.trim();
    const category = document.getElementById('adCategory').value;
    const description = document.getElementById('adDescription').value.trim();
    const price = parseInt(document.getElementById('adPrice').value);
    const location = document.getElementById('adLocation').value.trim();
    
    // Проверка данных
    if (!title || !description || !location || price < 100) {
        showNotification('Заполните все поля корректно. Минимальная цена - 100 ₽');
        return;
    }
    
    // Проверка подписки
    const hasSubscription = checkUserSubscription();
    const createPrice = 50; // Цена за создание объявления
    
    if (!hasSubscription) {
        if (user.balance < createPrice) {
            showNotification(`Недостаточно средств. Нужно ${createPrice} ₽. Ваш баланс: ${user.balance} ₽`);
            showPaymentScreen('create_ad', createPrice, 'Оплата размещения объявления');
            return;
        }
        
        // Списание средств
        user.balance -= createPrice;
        transactions.push({
            id: transactions.length + 1,
            userId: user.id,
            amount: -createPrice,
            type: 'create_ad',
            description: `Создание объявления: ${title}`,
            createdAt: new Date().toISOString()
        });
        saveTransactions();
    }
    
    // Создание объявления
    const newAd = {
        id: ads.length + 1,
        employerId: user.id,
        title,
        description,
        category,
        price,
        location,
        status: user.role === 'admin' ? 'active' : 'moderation', // Админы публикуют сразу
        moderated: user.role === 'admin', // Админы не требуют модерации
        takenBy: null,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 86400000).toISOString()
    };
    
    ads.push(newAd);
    saveAds();
    
    // Обновление пользователя
    saveUsers();
    
    // Очистка формы и возврат
    document.getElementById('adTitle').value = '';
    document.getElementById('adDescription').value = '';
    document.getElementById('adPrice').value = '1000';
    document.getElementById('adLocation').value = '';
    
    showNotification(`Объявление "${title}" успешно опубликовано!`);
    showScreen('employerScreen');
    loadEmployerAds();
    updateEmployerStats();
    updateHeaderInfo();

        if (user.role !== 'admin') {
        // В реальном приложении находим всех админов
        const adminUsers = users.filter(u => u.role === 'admin');
        adminUsers.forEach(admin => {
            sendNotification(
                admin.id,
                'moderation',
                'Новое объявление на модерацию',
                `Пользователь ${user.firstName} ${user.lastName} создал новое объявление`,
                { adId: newAd.id }
            );
        });
    }
}

// Проверка подписки пользователя
function checkUserSubscription() {
    const user = getUser();
    if (!user.subscriptionUntil) return false;
    
    const subscriptionDate = new Date(user.subscriptionUntil);
    const now = new Date();
    
    return subscriptionDate > now;
}

// Обновление статистики работодателя
function updateEmployerStats() {
    const user = getUser();
    const userAds = ads.filter(ad => ad.employerId === user.id);
    
    document.getElementById('employerBalance').textContent = `${user.balance} ₽`;
    document.getElementById('employerAdsCount').textContent = userAds.length;
    
    const subscriptionStatus = checkUserSubscription() ? 
        `До ${new Date(user.subscriptionUntil).toLocaleDateString('ru-RU')}` : 
        'Не активна';
    document.getElementById('employerSubscription').textContent = subscriptionStatus;
}

// Обновление статистики работника
function updateWorkerStats() {
    const user = getUser();
    const completedAds = ads.filter(ad => ad.takenBy === user.id && ad.status === 'completed');
    
    document.getElementById('workerBalance').textContent = `${user.balance} ₽`;
    document.getElementById('workerCompleted').textContent = completedAds.length;
    
    const subscriptionStatus = checkUserSubscription() ? 
        `До ${new Date(user.subscriptionUntil).toLocaleDateString('ru-RU')}` : 
        'Не активна';
    document.getElementById('workerSubscription').textContent = subscriptionStatus;
}

// Загрузка экрана профиля
function loadProfileScreen() {
    const user = getUser();
    
    document.getElementById('profileUserName').textContent = `${user.firstName} ${user.lastName}`;
    document.getElementById('profileUserRole').textContent = user.role === 'employer' ? 'Работодатель' : 'Работник';
    document.getElementById('profileBalance').textContent = `${user.balance} ₽`;
    document.getElementById('profileAdsCount').textContent = ads.filter(ad => ad.employerId === user.id).length;
    
    const subscriptionStatus = checkUserSubscription() ? 
        `Активна до ${new Date(user.subscriptionUntil).toLocaleDateString('ru-RU')}` : 
        'Не активна';
    document.getElementById('profileSubscriptionStatus').textContent = subscriptionStatus;

        // Добавляем кнопку модерации для админов
    if (user.role === 'admin') {
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

// Показать экран оплаты
function showPaymentScreen(paymentType, amount, description) {
    const container = document.getElementById('paymentContainer');
    const user = getUser();
    
    container.innerHTML = `
        <div class="payment-summary">
            <h3>${description}</h3>
            <div class="payment-summary-item">
                <span>Сумма:</span>
                <span>${amount} ₽</span>
            </div>
            <div class="payment-summary-item">
                <span>Ваш баланс:</span>
                <span>${user.balance} ₽</span>
            </div>
            <div class="payment-summary-item total">
                <span>Итого к оплате:</span>
                <span>${amount} ₽</span>
            </div>
        </div>
        
        <div class="payment-methods">
            <h4>Выберите способ оплаты:</h4>
            
            <div class="payment-method active" data-method="balance">
                <div class="payment-method-icon">
                    <i class="fas fa-wallet"></i>
                </div>
                <div>
                    <h5>Баланс аккаунта</h5>
                    <p>Использовать средства с баланса</p>
                </div>
            </div>
            
            <div class="payment-method" data-method="card">
                <div class="payment-method-icon">
                    <i class="fas fa-credit-card"></i>
                </div>
                <div>
                    <h5>Банковская карта</h5>
                    <p>Visa, Mastercard, МИР</p>
                </div>
            </div>
            
            <div class="payment-method" data-method="telegram">
                <div class="payment-method-icon">
                    <i class="fab fa-telegram"></i>
                </div>
                <div>
                    <h5>Telegram Stars</h5>
                    <p>Встроенная платежная система Telegram</p>
                </div>
            </div>
        </div>
        
        <button id="processPaymentBtn" class="btn-primary btn-large" data-type="${paymentType}" data-amount="${amount}">
            <i class="fas fa-lock"></i> Оплатить ${amount} ₽
        </button>
    `;
    
    // Выбор способа оплаты
    document.querySelectorAll('.payment-method').forEach(method => {
        method.addEventListener('click', function() {
            document.querySelectorAll('.payment-method').forEach(m => {
                m.classList.remove('active');
            });
            this.classList.add('active');
        });
    });
    
    // Обработка оплаты
    document.getElementById('processPaymentBtn').addEventListener('click', function() {
        const paymentMethod = document.querySelector('.payment-method.active').getAttribute('data-method');
        const paymentType = this.getAttribute('data-type');
        const amount = parseInt(this.getAttribute('data-amount'));
        
        processPayment(paymentType, amount, paymentMethod);
    });
    
    showScreen('paymentScreen');
}

// Обработка платежа
function processPayment(paymentType, amount, paymentMethod) {
    const user = getUser();
    
    if (paymentMethod === 'balance') {
        if (user.balance < amount) {
            showNotification(`Недостаточно средств на балансе. Нужно ${amount} ₽`);
            return;
        }
        
        // Списание с баланса
        user.balance -= amount;
        
        // Регистрация транзакции
        transactions.push({
            id: transactions.length + 1,
            userId: user.id,
            amount: -amount,
            type: paymentType,
            description: getPaymentDescription(paymentType, amount),
            createdAt: new Date().toISOString()
        });
        
        // Если это подписка - активируем ее
        if (paymentType === 'subscription') {
            const subscriptionDate = new Date();
            subscriptionDate.setMonth(subscriptionDate.getMonth() + 1);
            user.subscriptionUntil = subscriptionDate.toISOString();
            
            showNotification(`Подписка активирована до ${subscriptionDate.toLocaleDateString('ru-RU')}`);
        }
        
        saveUsers();
        saveTransactions();
        
        // Обновление интерфейса
        updateHeaderInfo();
        
        if (user.role === 'employer') {
            updateEmployerStats();
            showScreen('employerScreen');
        } else {
            updateWorkerStats();
            showScreen('workerScreen');
        }
        
        showNotification(`Оплата прошла успешно! Списано ${amount} ₽`);
        
    } else {
        // Имитация внешней платежной системы
        showModal(
            'Внешний платеж',
            `Для завершения оплаты через ${paymentMethod === 'card' ? 'банковскую карту' : 'Telegram Stars'} вы будете перенаправлены на страницу платежной системы.`,
            () => {
                // Имитация успешной оплаты
                if (paymentType === 'subscription') {
                    const subscriptionDate = new Date();
                    subscriptionDate.setMonth(subscriptionDate.getMonth() + 1);
                    user.subscriptionUntil = subscriptionDate.toISOString();
                    
                    showNotification(`Подписка активирована до ${subscriptionDate.toLocaleDateString('ru-RU')}`);
                } else {
                    user.balance += paymentType === 'deposit' ? amount : 0;
                    
                    transactions.push({
                        id: transactions.length + 1,
                        userId: user.id,
                        amount: paymentType === 'deposit' ? amount : -amount,
                        type: paymentType,
                        description: getPaymentDescription(paymentType, amount),
                        createdAt: new Date().toISOString()
                    });
                }
                
                saveUsers();
                saveTransactions();
                
                // Обновление интерфейса
                updateHeaderInfo();
                
                if (user.role === 'employer') {
                    updateEmployerStats();
                    showScreen('employerScreen');
                } else {
                    updateWorkerStats();
                    showScreen('workerScreen');
                }
                
                showNotification(`Оплата прошла успешно!`);
            }
        );
    }
}

// Получение описания платежа
function getPaymentDescription(paymentType, amount) {
    switch(paymentType) {
        case 'subscription':
            return `Оформление подписки на 30 дней`;
        case 'deposit':
            return `Пополнение баланса на ${amount} ₽`;
        case 'create_ad':
            return `Оплата размещения объявления`;
        case 'accept_ad':
            return `Оплата принятия объявления`;
        default:
            return `Платеж: ${paymentType}`;
    }
}

// Показать модальное окно
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
    
    // Обработчики событий
    const closeModal = () => {
        modal.classList.remove('active');
    };
    
    modalCancelBtn.onclick = closeModal;
    closeModalBtn.onclick = closeModal;
    
    modalConfirmBtn.onclick = () => {
        confirmCallback();
        closeModal();
    };
    
    // Закрытие по клику вне модального окна
    modal.onclick = (e) => {
        if (e.target === modal) {
            closeModal();
        }
    };
}

// Функции сохранения новых данных
function saveChats() {
    localStorage.setItem('telegramJobChats', JSON.stringify(chats));
}

function saveReviews() {
    localStorage.setItem('telegramJobReviews', JSON.stringify(reviews));
}

function saveNotifications() {
    localStorage.setItem('telegramJobNotifications', JSON.stringify(notifications));
}

// Функции для чата
function openChat(adId, otherUserId) {
    const user = getUser();
    const ad = ads.find(a => a.id === adId);
    const otherUser = getOtherUser(otherUserId);
    
    if (!ad || !otherUser) return;
    
    // Сохраняем информацию о текущем чате
    currentChat = {
        adId,
        otherUserId,
        ad,
        otherUser
    };
    
    // Обновляем UI
    document.getElementById('chatUserName').textContent = `${otherUser.firstName} ${otherUser.lastName}`;
    document.getElementById('chatUserStatus').textContent = 'online';
    document.getElementById('chatUserStatus').className = 'status-online';
    
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
    loadChatMessages(adId, user.id, otherUserId);
    
    // Показываем экран чата
    showScreen('chatScreen');
    
    // Прокручиваем вниз
    setTimeout(() => {
        const chatMessages = document.getElementById('chatMessages');
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }, 100);
}

function getOtherUser(userId) {
    // В реальном приложении здесь был бы запрос к серверу
    // Для демо возвращаем тестового пользователя
    return {
        id: userId,
        firstName: userId === 2 ? 'Иван' : 'Мария',
        lastName: userId === 2 ? 'Петров' : 'Сидорова',
        role: userId === 2 ? 'employer' : 'worker',
        rating: 4.5
    };
}

function getStatusText(status) {
    const statusMap = {
        'active': 'Активно',
        'taken': 'В работе',
        'completed': 'Завершено',
        'moderation': 'На модерации'
    };
    return statusMap[status] || status;
}

function loadChatMessages(adId, userId1, userId2) {
    const chatMessages = document.getElementById('chatMessages');
    
    // Находим или создаем чат
    let chat = chats.find(c => 
        c.adId === adId && 
        ((c.userId1 === userId1 && c.userId2 === userId2) || 
         (c.userId1 === userId2 && c.userId2 === userId1))
    );
    
    if (!chat) {
        chat = {
            id: chats.length + 1,
            adId,
            userId1,
            userId2,
            messages: [],
            createdAt: new Date().toISOString(),
            lastMessageAt: new Date().toISOString()
        };
        chats.push(chat);
        saveChats();
    }
    
    // Очищаем контейнер
    chatMessages.innerHTML = '';
    
    // Добавляем приветственное сообщение
    if (chat.messages.length === 0) {
        const welcomeMessage = document.createElement('div');
        welcomeMessage.className = 'message message-incoming';
        welcomeMessage.innerHTML = `
            <p>Здравствуйте! Это начало вашего чата по объявлению.</p>
            <div class="message-time">${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</div>
        `;
        chatMessages.appendChild(welcomeMessage);
    } else {
        // Отображаем все сообщения
        chat.messages.forEach(message => {
            const messageElement = createMessageElement(message, userId1);
            chatMessages.appendChild(messageElement);
        });
    }
}

function createMessageElement(message, currentUserId) {
    const messageElement = document.createElement('div');
    const isOutgoing = message.senderId === currentUserId;
    
    messageElement.className = `message ${isOutgoing ? 'message-outgoing' : 'message-incoming'}`;
    messageElement.innerHTML = `
        <p>${message.text}</p>
        <div class="message-time">
            ${new Date(message.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
            ${isOutgoing ? `<span class="message-status ${message.read ? 'status-read' : 'status-unread'}">
                ${message.read ? '✓✓' : '✓'}
            </span>` : ''}
        </div>
    `;
    
    return messageElement;
}

function sendMessage() {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    
    if (!text || !currentChat) return;
    
    const user = getUser();
    const chat = chats.find(c => 
        c.adId === currentChat.adId && 
        ((c.userId1 === user.id && c.userId2 === currentChat.otherUserId) || 
         (c.userId1 === currentChat.otherUserId && c.userId2 === user.id))
    );
    
    if (!chat) return;
    
    // Создаем сообщение
    const message = {
        id: chat.messages.length + 1,
        senderId: user.id,
        text,
        createdAt: new Date().toISOString(),
        read: false
    };
    
    // Добавляем в чат
    chat.messages.push(message);
    chat.lastMessageAt = new Date().toISOString();
    saveChats();
    
    // Добавляем в UI
    const chatMessages = document.getElementById('chatMessages');
    const messageElement = createMessageElement(message, user.id);
    chatMessages.appendChild(messageElement);
    
    // Очищаем поле ввода
    input.value = '';
    
    // Прокручиваем вниз
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Отправляем уведомление другому пользователю
    sendNotification(
        currentChat.otherUserId,
        'message',
        'Новое сообщение',
        `${user.firstName}: ${text.substring(0, 50)}...`,
        { chatId: chat.id, adId: currentChat.adId }
    );
}

// Функции для уведомлений
function toggleNotificationsDropdown() {
    const dropdown = document.getElementById('notificationsDropdown');
    if (dropdown.classList.contains('active')) {
        hideNotificationsDropdown();
    } else {
        showNotificationsDropdown();
    }
}

function showNotificationsDropdown() {
    const dropdown = document.getElementById('notificationsDropdown');
    loadNotificationsDropdown();
    dropdown.classList.add('active');
}

function hideNotificationsDropdown() {
    const dropdown = document.getElementById('notificationsDropdown');
    dropdown.classList.remove('active');
}

function loadNotificationsDropdown() {
    const user = getUser();
    const userNotifications = notifications
        .filter(n => n.userId === user.id)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5);
    
    const list = document.getElementById('notificationsDropdownList');
    const unreadCount = userNotifications.filter(n => !n.read).length;
    
    document.getElementById('unreadCount').textContent = unreadCount;
    
    if (userNotifications.length === 0) {
        list.innerHTML = `
            <div class="notification-dropdown-item">
                <div class="notification-dropdown-content">
                    <div class="notification-dropdown-text">Нет уведомлений</div>
                </div>
            </div>
        `;
        return;
    }
    
    list.innerHTML = '';
    userNotifications.forEach(notification => {
        const item = document.createElement('div');
        item.className = `notification-dropdown-item ${notification.read ? '' : 'unread'}`;
        item.addEventListener('click', () => handleNotificationClick(notification));
        
        const icon = getNotificationIcon(notification.type);
        
        item.innerHTML = `
            ${!notification.read ? '<div class="notification-dropdot"></div>' : ''}
            <div class="notification-icon ${notification.type}">
                <i class="fas fa-${icon}"></i>
            </div>
            <div class="notification-dropdown-content">
                <div class="notification-dropdown-title">${notification.title}</div>
                <div class="notification-dropdown-text">${notification.message}</div>
                <div class="notification-dropdown-time">
                    ${timeAgo(new Date(notification.createdAt))}
                </div>
            </div>
        `;
        
        list.appendChild(item);
    });
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
    
    const intervals = [
        {name: 'год', seconds: 31536000},
        {name: 'месяц', seconds: 2592000},
        {name: 'неделю', seconds: 604800},
        {name: 'день', seconds: 86400},
        {name: 'час', seconds: 3600},
        {name: 'минуту', seconds: 60}
    ];
    
    for (const interval of intervals) {
        const count = Math.floor(seconds / interval.seconds);
        if (count >= 1) {
            const word = getRussianWord(count, interval.name);
            return `${count} ${word} назад`;
        }
    }
    
    return 'только что';
}

function getRussianWord(number, word) {
    const forms = {
        'год': ['год', 'года', 'лет'],
        'месяц': ['месяц', 'месяца', 'месяцев'],
        'неделю': ['неделю', 'недели', 'недель'],
        'день': ['день', 'дня', 'дней'],
        'час': ['час', 'часа', 'часов'],
        'минуту': ['минуту', 'минуты', 'минут']
    };
    
    const lastDigit = number % 10;
    const lastTwoDigits = number % 100;
    
    if (lastTwoDigits >= 11 && lastTwoDigits <= 19) {
        return forms[word][2];
    }
    
    switch (lastDigit) {
        case 1: return forms[word][0];
        case 2:
        case 3:
        case 4: return forms[word][1];
        default: return forms[word][2];
    }
}

function sendNotification(userId, type, title, message, data = {}) {
    const notification = {
        id: notifications.length + 1,
        userId,
        type,
        title,
        message,
        read: false,
        createdAt: new Date().toISOString(),
        data
    };
    
    notifications.push(notification);
    saveNotifications();
    
    // Обновляем счетчик уведомлений
    updateNotificationBadge();
    
    // Показываем всплывающее уведомление
    if (type !== 'system') {
        showNotification(message);
    }
    
    // В реальном приложении здесь был бы вызов API для отправки push-уведомления через бота
    sendTelegramNotification(userId, title, message);
}

function sendTelegramNotification(userId, title, message) {
    // В реальном приложении:
    // 1. Сохраняем уведомление в базе данных
    // 2. Используем Telegram Bot API для отправки сообщения пользователю
    // 3. Если пользователь онлайн в мини-приложении, можно использовать WebSocket
    
    console.log(`Отправка уведомления пользователю ${userId}: ${title} - ${message}`);
    
    // Пример запроса к Telegram Bot API:
    // fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({
    //         chat_id: userId,
    //         text: `${title}\n\n${message}`,
    //         parse_mode: 'HTML'
    //     })
    // });
}

function updateNotificationBadge() {
    const user = getUser();
    const unreadCount = notifications.filter(n => n.userId === user.id && !n.read).length;
    const badge = document.getElementById('unreadCount');
    if (badge) {
        badge.textContent = unreadCount;
        badge.style.display = unreadCount > 0 ? 'block' : 'none';
    }
}

function showNotificationsScreen() {
    const user = getUser();
    const userNotifications = notifications
        .filter(n => n.userId === user.id)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    const list = document.getElementById('notificationsList');
    
    if (userNotifications.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-bell-slash"></i>
                <h3>Нет уведомлений</h3>
                <p>Здесь будут появляться важные уведомления</p>
            </div>
        `;
    } else {
        list.innerHTML = '';
        userNotifications.forEach(notification => {
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
                ${new Date(notification.createdAt).toLocaleDateString('ru-RU')} в 
                ${new Date(notification.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
            </div>
        </div>
            ${notification.data.adId ? `
                <div class="notification-actions">
                    <button class="btn-secondary btn-small" data-action="view-ad" data-ad-id="${notification.data.adId}">
                        Открыть
                    </button>
                </div>
            ` : ''}
    `;
    
    return item;
}

function handleNotificationClick(notification) {
    // Помечаем как прочитанное
    notification.read = true;
    saveNotifications();
    updateNotificationBadge();
    
    // Обрабатываем клик в зависимости от типа уведомления
    switch (notification.type) {
        case 'message':
            if (notification.data.adId && notification.data.chatId) {
                openChat(notification.data.adId, getOtherUserId(notification.data.chatId));
            }
            break;
        case 'rating':
            showRatingScreen(notification.data.reviewId);
            break;
        case 'moderation':
            if (notification.data.adId) {
                showAdDetail(notification.data.adId);
            }
            break;
    }
}

function getOtherUserId(chatId) {
    const chat = chats.find(c => c.id === chatId);
    const user = getUser();
    return chat.userId1 === user.id ? chat.userId2 : chat.userId1;
}

function clearAllNotifications() {
    const user = getUser();
    notifications = notifications.filter(n => n.userId !== user.id);
    saveNotifications();
    updateNotificationBadge();
    showNotificationsScreen();
    showNotification('Все уведомления удалены');
}

// Функции для рейтингов и отзывов
function showRatingScreen(reviewId = null) {
    const user = getUser();
    const container = document.getElementById('ratingContainer');
    
    if (reviewId) {
        // Просмотр существующего отзыва
        const review = reviews.find(r => r.id === reviewId);
        if (!review) return;
        
        const targetUser = getOtherUser(review.revieweeId);
        
        container.innerHTML = `
            <div class="rating-header">
                <div class="rating-avatar">
                    <i class="fas fa-user"></i>
                </div>
                <h3 class="rating-user-name">${targetUser.firstName} ${targetUser.lastName}</h3>
                <p class="rating-role">${targetUser.role === 'employer' ? 'Работодатель' : 'Работник'}</p>
            </div>
            
            <div class="review-detail">
                <div class="review-header">
                    <div class="review-user">
                        <div class="review-user-avatar">
                            <i class="fas fa-user"></i>
                        </div>
                        <div class="review-user-info">
                            <h4>${review.reviewerName}</h4>
                            <p>${new Date(review.createdAt).toLocaleDateString('ru-RU')}</p>
                        </div>
                    </div>
                    <div class="review-rating">
                        ${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}
                    </div>
                </div>
                <div class="review-text">
                    ${review.comment}
                </div>
                <div class="review-meta">
                    <span class="review-ad-title">${review.adTitle}</span>
                </div>
            </div>
        `;
    } else {
        // Создание нового отзыва
        container.innerHTML = `
            <div class="rating-header">
                <div class="rating-avatar">
                    <i class="fas fa-user"></i>
                </div>
                <h3 class="rating-user-name">Иван Петров</h3>
                <p class="rating-role">Работодатель</p>
            </div>
            
            <div class="rating-stars" id="ratingStars">
                ${[1, 2, 3, 4, 5].map(i => `
                    <button class="star-btn" data-rating="${i}">
                        <i class="far fa-star"></i>
                    </button>
                `).join('')}
            </div>
            
            <div class="rating-form">
                <textarea id="ratingComment" placeholder="Опишите ваш опыт работы..."></textarea>
                <button id="submitRatingBtn" class="btn-primary btn-large">
                    <i class="fas fa-paper-plane"></i> Опубликовать отзыв
                </button>
            </div>
            
            <div class="rating-tips">
                <h4>Советы по написанию отзыва:</h4>
                <ul>
                    <li>Опишите конкретные задачи, которые были выполнены</li>
                    <li>Укажите сильные стороны исполнителя/работодателя</li>
                    <li>Будьте объективны и честны</li>
                    <li>Избегайте личных оскорблений</li>
                </ul>
            </div>
        `;
        
        // Настройка звезд рейтинга
        let selectedRating = 0;
        document.querySelectorAll('.star-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const rating = parseInt(this.getAttribute('data-rating'));
                selectedRating = rating;
                
                document.querySelectorAll('.star-btn').forEach((star, index) => {
                    if (index < rating) {
                        star.innerHTML = '<i class="fas fa-star"></i>';
                        star.classList.add('active');
                    } else {
                        star.innerHTML = '<i class="far fa-star"></i>';
                        star.classList.remove('active');
                    }
                });
            });
        });
        
        // Отправка отзыва
        document.getElementById('submitRatingBtn').addEventListener('click', function() {
            const comment = document.getElementById('ratingComment').value.trim();
            
            if (selectedRating === 0) {
                showNotification('Пожалуйста, выберите рейтинг');
                return;
            }
            
            if (comment.length < 10) {
                showNotification('Отзыв должен содержать минимум 10 символов');
                return;
            }
            
            const review = {
                id: reviews.length + 1,
                reviewerId: user.id,
                reviewerName: `${user.firstName} ${user.lastName}`,
                revieweeId: 2, // ID пользователя, которому оставляем отзыв
                adId: currentChat?.adId || 1,
                adTitle: currentChat?.ad?.title || 'Тестовое объявление',
                rating: selectedRating,
                comment,
                createdAt: new Date().toISOString(),
                moderated: false
            };
            
            reviews.push(review);
            saveReviews();
            
            // Отправляем уведомление пользователю
            sendNotification(
                2,
                'rating',
                'Новый отзыв',
                `${user.firstName} ${user.lastName} оставил вам отзыв`,
                { reviewId: review.id }
            );
            
            showNotification('Спасибо за ваш отзыв!');
            
            const userRole = user.role;
            if (userRole === 'employer') {
                showScreen('employerScreen');
            } else {
                showScreen('workerScreen');
            }
        });
    }
    
    showScreen('ratingScreen');
}

// Функции для модерации
function showModerationScreen() {
    const user = getUser();
    
    // Проверяем, является ли пользователь администратором
    if (user.role !== 'admin') {
        showNotification('У вас нет доступа к модерации');
        return;
    }
    
    loadModerationList();
    showScreen('moderationScreen');
}

function loadModerationList() {
    const user = getUser();
    if (user.role !== 'admin') return;
    
    const tab = document.querySelector('.moderation-tabs .tab-btn.active')?.getAttribute('data-tab') || 'pending';
    const list = document.getElementById('moderationList');
    
    let filteredAds = ads.filter(ad => {
        if (tab === 'pending') return ad.status === 'moderation';
        if (tab === 'approved') return ad.moderated === true;
        if (tab === 'rejected') return ad.moderated === false && ad.status === 'rejected';
        return false;
    });
    
    if (filteredAds.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-clipboard-check"></i>
                <h3>Нет объявлений</h3>
                <p>Все объявления обработаны</p>
            </div>
        `;
        return;
    }
    
    list.innerHTML = '';
    filteredAds.forEach(ad => {
        const adElement = createModerationItem(ad);
        list.appendChild(adElement);
    });
}

function createModerationItem(ad) {
    const item = document.createElement('div');
    item.className = `moderation-item ${ad.moderated === true ? 'approved' : ad.moderated === false ? 'rejected' : ''}`;
    
    const employer = getOtherUser(ad.employerId);
    
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
                <h4>${employer.firstName} ${employer.lastName}</h4>
                <p>${employer.role === 'employer' ? 'Работодатель' : 'Работник'}</p>
            </div>
        </div>
        
        <div class="moderation-item-description">
            ${ad.description}
        </div>
        
        <div class="moderation-item-meta">
            <div style="display: flex; gap: 15px; margin-bottom: 15px; font-size: 0.9rem;">
                <span><i class="fas fa-map-marker-alt"></i> ${ad.location}</span>
                <span><i class="fas fa-calendar"></i> ${new Date(ad.createdAt).toLocaleDateString('ru-RU')}</span>
            </div>
        </div>
        
        <div class="moderation-item-actions">
            ${ad.status === 'moderation' ? `
                <button class="moderation-btn approve" data-ad-id="${ad.id}">
                    <i class="fas fa-check"></i> Одобрить
                </button>
                <button class="moderation-btn reject" data-ad-id="${ad.id}">
                    <i class="fas fa-times"></i> Отклонить
                </button>
            ` : ''}
            <button class="moderation-btn view" data-ad-id="${ad.id}">
                <i class="fas fa-eye"></i> Подробнее
            </button>
        </div>
    `;
    
    // Добавляем обработчики событий
    if (ad.status === 'moderation') {
        item.querySelector('.moderation-btn.approve').addEventListener('click', function() {
            moderateAd(ad.id, true);
        });
        
        item.querySelector('.moderation-btn.reject').addEventListener('click', function() {
            moderateAd(ad.id, false);
        });
    }
    
    item.querySelector('.moderation-btn.view').addEventListener('click', function() {
        showAdDetail(ad.id);
    });
    
    return item;
}

function moderateAd(adId, approve) {
    const ad = ads.find(a => a.id === adId);
    if (!ad) return;
    
    ad.moderated = approve;
    ad.status = approve ? 'active' : 'rejected';
    ad.moderatedAt = new Date().toISOString();
    ad.moderatedBy = getUser().id;
    
    saveAds();
    
    // Отправляем уведомление автору объявления
    sendNotification(
        ad.employerId,
        'moderation',
        approve ? 'Объявление одобрено' : 'Объявление отклонено',
        approve ? 'Ваше объявление прошло модерацию и теперь видно всем пользователям' : 'Ваше объявление не прошло модерацию',
        { adId: ad.id }
    );
    
    showNotification(approve ? 'Объявление одобрено' : 'Объявление отклонено');
    loadModerationList();
}

