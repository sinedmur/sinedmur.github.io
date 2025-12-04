// Инициализация Telegram Web App
const tg = window.Telegram.WebApp;

// Проверка прав доступа
function checkAdminAccess() {
    const userData = localStorage.getItem('telegramJobUser');
    if (!userData) {
        window.location.href = 'index.html';
        return;
    }
    
    const users = JSON.parse(userData);
    const currentUser = users.find(u => u.telegramId === tg.initDataUnsafe.user?.id);
    
    if (!currentUser || currentUser.role !== 'admin') {
        window.location.href = 'index.html';
        return;
    }
    
    return currentUser;
}

// Инициализация админ-панели
document.addEventListener('DOMContentLoaded', function() {
    const admin = checkAdminAccess();
    if (!admin) return;
    
    // Настройка интерфейса
    document.getElementById('adminName').textContent = `${admin.firstName} ${admin.lastName}`;
    document.getElementById('adminRole').textContent = 'Администратор';
    
    // Загрузка данных
    loadDashboard();
    loadModerationTable();
    loadUsersTable();
    loadReviews();
    
    // Настройка навигации
    setupAdminNavigation();
    
    // Настройка обработчиков событий
    setupAdminEventListeners();
    
    // Обновление данных каждые 30 секунд
    setInterval(updateAdminData, 30000);
});

// Навигация по админ-панели
function setupAdminNavigation() {
    document.querySelectorAll('.admin-menu-item').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            
            // Обновляем активный пункт меню
            document.querySelectorAll('.admin-menu-item').forEach(i => {
                i.classList.remove('active');
            });
            this.classList.add('active');
            
            // Показываем нужный раздел
            document.querySelectorAll('.admin-section').forEach(section => {
                section.classList.remove('active');
            });
            document.getElementById(targetId).classList.add('active');
        });
    });
}

// Загрузка дашборда
function loadDashboard() {
    // Загружаем данные из localStorage
    const ads = JSON.parse(localStorage.getItem('telegramJobAds') || '[]');
    const users = JSON.parse(localStorage.getItem('telegramJobUser') || '[]');
    const reviews = JSON.parse(localStorage.getItem('telegramJobReviews') || '[]');
    const transactions = JSON.parse(localStorage.getItem('telegramJobTransactions') || '[]');
    
    // Обновляем статистику
    const pendingCount = ads.filter(ad => ad.status === 'moderation').length;
    const usersCount = users.length;
    
    // Выручка за месяц
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const revenue = transactions
        .filter(t => new Date(t.createdAt) >= monthStart && t.amount > 0)
        .reduce((sum, t) => sum + t.amount, 0);
    
    // Средний рейтинг
    const avgRating = reviews.length > 0 
        ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
        : '0.0';
    
    // Обновляем UI
    document.getElementById('pendingCount').textContent = pendingCount;
    document.getElementById('usersCount').textContent = usersCount;
    document.getElementById('revenueCount').textContent = `${revenue} ₽`;
    document.getElementById('ratingAvg').textContent = avgRating;
    
    // Обновляем бейджи
    document.getElementById('moderationBadge').textContent = pendingCount;
    
    // Загружаем графики
    loadCharts(ads, users, transactions);
}

// Загрузка графиков
function loadCharts(ads, users, transactions) {
    // График активности пользователей
    const activityCtx = document.getElementById('activityChart')?.getContext('2d');
    if (activityCtx) {
        // Группируем по дням
        const last7Days = [...Array(7)].map((_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - (6 - i));
            return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
        });
        
        new Chart(activityCtx, {
            type: 'line',
            data: {
                labels: last7Days,
                datasets: [{
                    label: 'Новые пользователи',
                    data: [5, 8, 12, 7, 15, 10, 18],
                    borderColor: '#2481cc',
                    backgroundColor: 'rgba(36, 129, 204, 0.1)',
                    tension: 0.4
                }, {
                    label: 'Новые объявления',
                    data: [3, 7, 5, 10, 8, 12, 15],
                    borderColor: '#28a745',
                    backgroundColor: 'rgba(40, 167, 69, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }
    
    // График статистики объявлений
    const adsCtx = document.getElementById('adsChart')?.getContext('2d');
    if (adsCtx) {
        new Chart(adsCtx, {
            type: 'doughnut',
            data: {
                labels: ['Активные', 'В работе', 'Завершены', 'На модерации'],
                datasets: [{
                    data: [
                        ads.filter(a => a.status === 'active').length,
                        ads.filter(a => a.status === 'taken').length,
                        ads.filter(a => a.status === 'completed').length,
                        ads.filter(a => a.status === 'moderation').length
                    ],
                    backgroundColor: [
                        '#28a745',
                        '#ffc107',
                        '#17a2b8',
                        '#dc3545'
                    ]
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                    }
                }
            }
        });
    }
}

// Загрузка таблицы модерации
function loadModerationTable() {
    const ads = JSON.parse(localStorage.getItem('telegramJobAds') || '[]');
    const users = JSON.parse(localStorage.getItem('telegramJobUser') || '[]');
    const filter = document.getElementById('moderationFilter')?.value || 'all';
    const search = document.getElementById('searchAds')?.value.toLowerCase() || '';
    
    let filteredAds = ads;
    
    if (filter !== 'all') {
        filteredAds = filteredAds.filter(ad => {
            if (filter === 'pending') return ad.status === 'moderation';
            if (filter === 'approved') return ad.moderated === true;
            if (filter === 'rejected') return ad.moderated === false;
            return true;
        });
    }
    
    if (search) {
        filteredAds = filteredAds.filter(ad => 
            ad.title.toLowerCase().includes(search) ||
            ad.description.toLowerCase().includes(search)
        );
    }
    
    const table = document.getElementById('moderationTable');
    
    if (filteredAds.length === 0) {
        table.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">
                    <div class="empty-state">
                        <i class="fas fa-clipboard-check"></i>
                        <p>Нет объявлений</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    table.innerHTML = filteredAds.map(ad => {
        const user = users.find(u => u.id === ad.employerId);
        const userName = user ? `${user.firstName} ${user.lastName}` : 'Неизвестно';
        const statusClass = getStatusClass(ad.status, ad.moderated);
        const statusText = getStatusTextAdmin(ad.status, ad.moderated);
        
        return `
            <tr>
                <td>${ad.id}</td>
                <td>
                    <strong>${ad.title}</strong><br>
                    <small>${ad.category}</small>
                </td>
                <td>${userName}</td>
                <td>${ad.price} ₽</td>
                <td>${new Date(ad.createdAt).toLocaleDateString('ru-RU')}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td>
                    <div class="action-buttons">
                        ${ad.status === 'moderation' ? `
                            <button class="btn-icon btn-success" onclick="moderateAdAdmin(${ad.id}, true)" title="Одобрить">
                                <i class="fas fa-check"></i>
                            </button>
                            <button class="btn-icon btn-danger" onclick="moderateAdAdmin(${ad.id}, false)" title="Отклонить">
                                <i class="fas fa-times"></i>
                            </button>
                        ` : ''}
                        <button class="btn-icon btn-info" onclick="viewAdAdmin(${ad.id})" title="Просмотр">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn-icon btn-warning" onclick="editAdAdmin(${ad.id})" title="Редактировать">
                            <i class="fas fa-edit"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function getStatusClass(status, moderated) {
    if (status === 'moderation') return 'status-pending';
    if (moderated === true) return 'status-approved';
    if (moderated === false) return 'status-rejected';
    if (status === 'active') return 'status-active';
    if (status === 'taken') return 'status-in-progress';
    if (status === 'completed') return 'status-completed';
    return 'status-unknown';
}

function getStatusTextAdmin(status, moderated) {
    if (status === 'moderation') return 'На модерации';
    if (moderated === true) return 'Одобрено';
    if (moderated === false) return 'Отклонено';
    if (status === 'active') return 'Активно';
    if (status === 'taken') return 'В работе';
    if (status === 'completed') return 'Завершено';
    return 'Неизвестно';
}

// Модерация объявления из админ-панели
function moderateAdAdmin(adId, approve) {
    const ads = JSON.parse(localStorage.getItem('telegramJobAds') || '[]');
    const ad = ads.find(a => a.id === adId);
    
    if (!ad) return;
    
    ad.moderated = approve;
    ad.status = approve ? 'active' : 'rejected';
    ad.moderatedAt = new Date().toISOString();
    ad.moderatedBy = 'admin';
    
    localStorage.setItem('telegramJobAds', JSON.stringify(ads));
    
    // Показываем уведомление
    showAdminNotification(
        approve ? 'Объявление одобрено' : 'Объявление отклонено',
        approve ? 'success' : 'error'
    );
    
    // Обновляем таблицу
    loadModerationTable();
    loadDashboard();
}

// Просмотр объявления
function viewAdAdmin(adId) {
    const ads = JSON.parse(localStorage.getItem('telegramJobAds') || '[]');
    const ad = ads.find(a => a.id === adId);
    
    if (!ad) return;
    
    showAdminModal(
        `Объявление #${ad.id}`,
        `
        <div class="ad-detail-admin">
            <h3>${ad.title}</h3>
            <p><strong>Категория:</strong> ${ad.category}</p>
            <p><strong>Описание:</strong> ${ad.description}</p>
            <p><strong>Цена:</strong> ${ad.price} ₽</p>
            <p><strong>Местоположение:</strong> ${ad.location}</p>
            <p><strong>Статус:</strong> <span class="status-badge ${getStatusClass(ad.status, ad.moderated)}">${getStatusTextAdmin(ad.status, ad.moderated)}</span></p>
            <p><strong>Дата создания:</strong> ${new Date(ad.createdAt).toLocaleString('ru-RU')}</p>
            ${ad.moderatedAt ? `<p><strong>Дата модерации:</strong> ${new Date(ad.moderatedAt).toLocaleString('ru-RU')}</p>` : ''}
        </div>
        `
    );
}

// Загрузка пользователей
function loadUsersTable() {
    const users = JSON.parse(localStorage.getItem('telegramJobUser') || '[]');
    const reviews = JSON.parse(localStorage.getItem('telegramJobReviews') || '[]');
    const filter = document.getElementById('userRoleFilter')?.value || 'all';
    const search = document.getElementById('searchUsers')?.value.toLowerCase() || '';
    
    let filteredUsers = users;
    
    if (filter !== 'all') {
        filteredUsers = filteredUsers.filter(user => user.role === filter);
    }
    
    if (search) {
        filteredUsers = filteredUsers.filter(user => 
            user.firstName.toLowerCase().includes(search) ||
            user.lastName.toLowerCase().includes(search) ||
            user.username?.toLowerCase().includes(search)
        );
    }
    
    const table = document.getElementById('usersTable');
    
    if (filteredUsers.length === 0) {
        table.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">
                    <div class="empty-state">
                        <i class="fas fa-users"></i>
                        <p>Нет пользователей</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    table.innerHTML = filteredUsers.map(user => {
        // Расчет рейтинга пользователя
        const userReviews = reviews.filter(r => r.revieweeId === user.id);
        const avgRating = userReviews.length > 0 
            ? (userReviews.reduce((sum, r) => sum + r.rating, 0) / userReviews.length).toFixed(1)
            : 'Нет';
        
        const roleClass = user.role === 'admin' ? 'role-admin' : 
                         user.role === 'employer' ? 'role-employer' : 'role-worker';
        const roleText = user.role === 'admin' ? 'Админ' :
                        user.role === 'employer' ? 'Работодатель' : 'Работник';
        
        return `
            <tr>
                <td>${user.id}</td>
                <td>
                    <strong>${user.firstName} ${user.lastName}</strong><br>
                    <small>@${user.username || 'без username'}</small>
                </td>
                <td><span class="role-badge ${roleClass}">${roleText}</span></td>
                <td>${user.balance || 0} ₽</td>
                <td>${avgRating}</td>
                <td>${new Date(user.createdAt).toLocaleDateString('ru-RU')}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon btn-info" onclick="viewUserAdmin(${user.id})" title="Просмотр">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn-icon btn-warning" onclick="editUserAdmin(${user.id})" title="Редактировать">
                            <i class="fas fa-edit"></i>
                        </button>
                        ${user.role !== 'admin' ? `
                            <button class="btn-icon btn-danger" onclick="deleteUserAdmin(${user.id})" title="Удалить">
                                <i class="fas fa-trash"></i>
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Загрузка отзывов
function loadReviews() {
    const reviews = JSON.parse(localStorage.getItem('telegramJobReviews') || '[]');
    const users = JSON.parse(localStorage.getItem('telegramJobUser') || '[]');
    
    // Фильтруем ненужные отзывы
    const pendingReviews = reviews.filter(r => !r.moderated);
    const approvedReviews = reviews.filter(r => r.moderated);
    
    // Обновляем бейдж
    document.getElementById('reviewsBadge').textContent = pendingReviews.length;
    
    // Отображаем отзывы
    const list = document.getElementById('adminReviewsList');
    
    if (reviews.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-star"></i>
                <p>Нет отзывов для модерации</p>
            </div>
        `;
        return;
    }
    
    list.innerHTML = reviews.map(review => {
        const reviewer = users.find(u => u.id === review.reviewerId);
        const reviewee = users.find(u => u.id === review.revieweeId);
        
        const reviewerName = reviewer ? `${reviewer.firstName} ${reviewer.lastName}` : 'Неизвестно';
        const revieweeName = reviewee ? `${reviewee.firstName} ${reviewee.lastName}` : 'Неизвестно';
        
        return `
            <div class="review-item-admin ${review.moderated ? 'moderated' : 'pending'}">
                <div class="review-header-admin">
                    <div class="review-users">
                        <div class="review-user-admin">
                            <i class="fas fa-user"></i>
                            <span><strong>От:</strong> ${reviewerName}</span>
                        </div>
                        <div class="review-user-admin">
                            <i class="fas fa-user-tie"></i>
                            <span><strong>Кому:</strong> ${revieweeName}</span>
                        </div>
                    </div>
                    <div class="review-rating-admin">
                        ${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}
                    </div>
                </div>
                
                <div class="review-content-admin">
                    <p>${review.comment}</p>
                    <div class="review-meta-admin">
                        <span><i class="fas fa-clipboard-list"></i> ${review.adTitle}</span>
                        <span><i class="fas fa-calendar"></i> ${new Date(review.createdAt).toLocaleDateString('ru-RU')}</span>
                    </div>
                </div>
                
                <div class="review-actions-admin">
                    ${!review.moderated ? `
                        <button class="btn-primary btn-small" onclick="moderateReview(${review.id}, true)">
                            <i class="fas fa-check"></i> Одобрить
                        </button>
                        <button class="btn-danger btn-small" onclick="moderateReview(${review.id}, false)">
                            <i class="fas fa-times"></i> Отклонить
                        </button>
                    ` : ''}
                    <button class="btn-secondary btn-small" onclick="deleteReview(${review.id})">
                        <i class="fas fa-trash"></i> Удалить
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Модерация отзыва
function moderateReview(reviewId, approve) {
    const reviews = JSON.parse(localStorage.getItem('telegramJobReviews') || '[]');
    const review = reviews.find(r => r.id === reviewId);
    
    if (!review) return;
    
    review.moderated = approve;
    review.moderatedAt = new Date().toISOString();
    
    localStorage.setItem('telegramJobReviews', JSON.stringify(reviews));
    
    showAdminNotification(
        approve ? 'Отзыв одобрен' : 'Отзыв отклонен',
        approve ? 'success' : 'error'
    );
    
    loadReviews();
    loadDashboard();
}

// Удаление отзыва
function deleteReview(reviewId) {
    if (!confirm('Удалить этот отзыв? Это действие нельзя отменить.')) return;
    
    const reviews = JSON.parse(localStorage.getItem('telegramJobReviews') || '[]');
    const filteredReviews = reviews.filter(r => r.id !== reviewId);
    
    localStorage.setItem('telegramJobReviews', JSON.stringify(filteredReviews));
    
    showAdminNotification('Отзыв удален', 'success');
    loadReviews();
}

// Настройка обработчиков событий
function setupAdminEventListeners() {
    // Фильтры модерации
    document.getElementById('moderationFilter')?.addEventListener('change', loadModerationTable);
    document.getElementById('searchAds')?.addEventListener('input', loadModerationTable);
    document.getElementById('refreshModerationBtn')?.addEventListener('click', loadModerationTable);
    
    // Фильтры пользователей
    document.getElementById('userRoleFilter')?.addEventListener('change', loadUsersTable);
    document.getElementById('searchUsers')?.addEventListener('input', loadUsersTable);
    document.getElementById('addUserBtn')?.addEventListener('click', addNewUser);
    
    // Настройки оплаты
    document.getElementById('savePaymentSettings')?.addEventListener('click', savePaymentSettings);
    
    // Выход из системы
    document.getElementById('logoutBtn')?.addEventListener('click', function() {
        window.location.href = 'index.html';
    });
    
    // Обновление данных
    document.querySelectorAll('[data-refresh]').forEach(btn => {
        btn.addEventListener('click', updateAdminData);
    });
}

// Обновление всех данных
function updateAdminData() {
    loadDashboard();
    loadModerationTable();
    loadUsersTable();
    loadReviews();
    
    showAdminNotification('Данные обновлены', 'info');
}

// Добавление нового пользователя
function addNewUser() {
    showAdminModal(
        'Добавить пользователя',
        `
        <div class="user-form">
            <div class="form-group">
                <label for="newUserName">Имя</label>
                <input type="text" id="newUserName" class="form-control" placeholder="Введите имя">
            </div>
            
            <div class="form-group">
                <label for="newUserLastName">Фамилия</label>
                <input type="text" id="newUserLastName" class="form-control" placeholder="Введите фамилию">
            </div>
            
            <div class="form-group">
                <label for="newUserRole">Роль</label>
                <select id="newUserRole" class="form-control">
                    <option value="worker">Работник</option>
                    <option value="employer">Работодатель</option>
                    <option value="admin">Администратор</option>
                </select>
            </div>
            
            <div class="form-group">
                <label for="newUserBalance">Начальный баланс (₽)</label>
                <input type="number" id="newUserBalance" class="form-control" value="0" min="0">
            </div>
        </div>
        `,
        () => {
            const name = document.getElementById('newUserName').value.trim();
            const lastName = document.getElementById('newUserLastName').value.trim();
            const role = document.getElementById('newUserRole').value;
            const balance = parseInt(document.getElementById('newUserBalance').value) || 0;
            
            if (!name || !lastName) {
                showAdminNotification('Заполните все поля', 'error');
                return;
            }
            
            const users = JSON.parse(localStorage.getItem('telegramJobUser') || '[]');
            const newUser = {
                id: users.length + 1,
                telegramId: Date.now(), // Генерируем временный ID
                firstName: name,
                lastName: lastName,
                username: `${name.toLowerCase()}.${lastName.toLowerCase()}`,
                balance: balance,
                role: role,
                subscriptionUntil: null,
                createdAt: new Date().toISOString()
            };
            
            users.push(newUser);
            localStorage.setItem('telegramJobUser', JSON.stringify(users));
            
            showAdminNotification('Пользователь добавлен', 'success');
            loadUsersTable();
        }
    );
}

// Сохранение настроек оплаты
function savePaymentSettings() {
    const createPrice = document.getElementById('createAdPrice').value;
    const acceptPrice = document.getElementById('acceptAdPrice').value;
    const subscriptionPrice = document.getElementById('subscriptionPrice').value;
    
    // Сохраняем в localStorage (в реальном приложении - на сервер)
    localStorage.setItem('paymentSettings', JSON.stringify({
        createAdPrice: createPrice,
        acceptAdPrice: acceptPrice,
        subscriptionPrice: subscriptionPrice
    }));
    
    showAdminNotification('Настройки сохранены', 'success');
}

// Вспомогательные функции
function showAdminModal(title, content, onConfirm = null) {
    const modal = document.getElementById('adminModal');
    const modalTitle = document.getElementById('adminModalTitle');
    const modalBody = document.getElementById('adminModalBody');
    const confirmBtn = document.getElementById('adminModalConfirm');
    const cancelBtn = document.getElementById('adminModalCancel');
    
    modalTitle.textContent = title;
    modalBody.innerHTML = content;
    
    modal.classList.add('active');
    
    const closeModal = () => {
        modal.classList.remove('active');
        confirmBtn.onclick = null;
        cancelBtn.onclick = null;
    };
    
    cancelBtn.onclick = closeModal;
    document.querySelector('.close-modal').onclick = closeModal;
    
    if (onConfirm) {
        confirmBtn.onclick = () => {
            onConfirm();
            closeModal();
        };
    } else {
        confirmBtn.style.display = 'none';
    }
    
    modal.onclick = (e) => {
        if (e.target === modal) closeModal();
    };
}

function showAdminNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `admin-notification ${type}`;
    notification.innerHTML = `
        <div class="notification-icon">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        </div>
        <div class="notification-content">${message}</div>
        <button class="close-notification">&times;</button>
    `;
    
    document.body.appendChild(notification);
    
    notification.querySelector('.close-notification').onclick = () => {
        notification.remove();
    };
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}

// Стили для админ-панели (добавьте в style.css)
const adminStyles = `
.admin-header {
    background-color: #343a40;
    color: white;
    padding: 15px 30px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: fixed;
    top: 0;
    left: 250px;
    right: 0;
    z-index: 100;
}

.admin-sidebar {
    width: 250px;
    background-color: #2d2d2d;
    color: white;
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    overflow-y: auto;
}

.admin-main {
    margin-left: 250px;
    padding: 80px 30px 30px;
    min-height: 100vh;
    background-color: #f8f9fa;
}

.admin-section {
    display: none;
}

.admin-section.active {
    display: block;
}

.admin-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 20px;
    margin: 20px 0;
}

.admin-stat-card {
    background-color: white;
    border-radius: var(--border-radius);
    padding: 20px;
    display: flex;
    align-items: center;
    gap: 20px;
    box-shadow: var(--box-shadow);
}

.admin-stat-icon {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background-color: var(--primary-color);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
}

.admin-stat-info h3 {
    font-size: 1.8rem;
    margin: 0;
    color: var(--dark-color);
}

.admin-stat-info p {
    margin: 5px 0 0;
    color: var(--secondary-color);
}

.admin-charts {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
    gap: 30px;
    margin-top: 40px;
}

.chart-container {
    background-color: white;
    border-radius: var(--border-radius);
    padding: 25px;
    box-shadow: var(--box-shadow);
}

.admin-table-container {
    background-color: white;
    border-radius: var(--border-radius);
    padding: 20px;
    margin-top: 20px;
    box-shadow: var(--box-shadow);
    overflow-x: auto;
}

.admin-table {
    width: 100%;
    border-collapse: collapse;
}

.admin-table th,
.admin-table td {
    padding: 12px 15px;
    text-align: left;
    border-bottom: 1px solid #eee;
}

.admin-table th {
    background-color: #f8f9fa;
    font-weight: 600;
    color: var(--dark-color);
}

.admin-table tr:hover {
    background-color: #f8f9fa;
}

.status-badge {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 15px;
    font-size: 0.8rem;
    font-weight: 600;
}

.status-pending {
    background-color: #fff3cd;
    color: #856404;
}

.status-approved {
    background-color: #d4edda;
    color: #155724;
}

.status-rejected {
    background-color: #f8d7da;
    color: #721c24;
}

.role-badge {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 15px;
    font-size: 0.8rem;
    font-weight: 600;
}

.role-admin {
    background-color: #6610f2;
    color: white;
}

.role-employer {
    background-color: #17a2b8;
    color: white;
}

.role-worker {
    background-color: #28a745;
    color: white;
}

.action-buttons {
    display: flex;
    gap: 8px;
}

.btn-icon {
    width: 35px;
    height: 35px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    cursor: pointer;
    transition: var(--transition);
}

.btn-success {
    background-color: #28a745;
    color: white;
}

.btn-danger {
    background-color: #dc3545;
    color: white;
}

.btn-info {
    background-color: #17a2b8;
    color: white;
}

.btn-warning {
    background-color: #ffc107;
    color: white;
}

.admin-notification {
    position: fixed;
    top: 20px;
    right: 20px;
    background-color: white;
    border-radius: var(--border-radius);
    padding: 15px 20px;
    display: flex;
    align-items: center;
    gap: 15px;
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
    z-index: 1000;
    animation: slideInRight 0.3s ease;
}

.admin-notification.success {
    border-left: 4px solid #28a745;
}

.admin-notification.error {
    border-left: 4px solid #dc3545;
}

.admin-notification.info {
    border-left: 4px solid #17a2b8;
}

@keyframes slideInRight {
    from {
        transform: translateX(100%);
        opacity: 0;
    }
    to {
        transform: translateX(0);
        opacity: 1;
    }
}
`;

// Добавьте стили в документ
const styleSheet = document.createElement('style');
styleSheet.textContent = adminStyles;
document.head.appendChild(styleSheet);