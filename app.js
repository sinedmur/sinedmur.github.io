// Инициализация Telegram Web App
const tg = window.Telegram.WebApp;
tg.expand(); // Развернуть приложение на весь экран
tg.enableClosingConfirmation(); // Подтверждение при закрытии

// Инициализация приложения
document.addEventListener('DOMContentLoaded', function() {
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
}

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
        status: 'active',
        takenBy: null,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 86400000).toISOString() // через 7 дней
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
