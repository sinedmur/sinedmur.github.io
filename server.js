const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Подключение к Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// обычный клиент (для чтения)
const supabase = createClient(supabaseUrl, anonKey);

// админ-клиент (RLS bypass)
const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Обновите middleware authenticate
const authenticate = async (req, res, next) => {
  const telegramId = req.headers.authorization;
  
  if (!telegramId) {
    return res.status(401).json({ error: 'No Telegram ID provided' });
  }
  
  try {
    // Используем сервисную роль
    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    // Ищем пользователя
    const { data: users, error: findError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('telegram_id', telegramId);
    
    if (findError) {
      console.error('Auth query error:', findError);
      return res.status(500).json({ error: 'Database error' });
    }
    
    let user;
    
    if (users && users.length > 0) {
      // Пользователь найден
      user = users[0];
    } else {
      // Создаем нового пользователя
      const userData = tg.initDataUnsafe?.user;
      
      const newUserData = {
        telegram_id: telegramId,
        first_name: userData?.first_name || 'Пользователь',
        last_name: userData?.last_name || '',
        username: userData?.username,
        photo_url: userData?.photo_url,
        free_ads_available: 2,
        created_at: new Date().toISOString()
      };
      
      console.log('Creating new user:', newUserData);
      
      const { data: newUsers, error: createError } = await supabaseAdmin
        .from('users')
        .insert([newUserData]) // Используем массив
        .select('*');
      
      if (createError || !newUsers || newUsers.length === 0) {
        console.error('Create user error:', createError);
        // Создаем базового пользователя
        user = {
          id: Date.now(),
          telegram_id: telegramId,
          first_name: 'Пользователь',
          last_name: '',
          free_ads_available: 2,
          created_at: new Date().toISOString()
        };
      } else {
        user = newUsers[0];
      }
    }
    
    if (!user) {
      user = {
        id: Date.now(),
        telegram_id: telegramId,
        first_name: 'Пользователь',
        last_name: '',
        free_ads_available: 2
      };
    }
    
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    // Создаем минимального пользователя для продолжения работы
    req.user = {
      id: Date.now(),
      telegram_id: telegramId,
      first_name: 'Пользователь',
      last_name: '',
      free_ads_available: 2
    };
    next();
  }
};

// API Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'Telegram Job API'
  });
});

// Получить пользователя - исправленная версия
app.get('/api/user', authenticate, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(404).json({ error: 'User not found in request' });
    }
    
    // Получаем актуальные данные пользователя из базы
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.user.id);
    
    if (error) {
      console.error('Get user error:', error);
      return res.json({ user: req.user });
    }
    
    if (users && users.length > 0) {
      res.json({ user: users[0] });
    } else {
      res.json({ user: req.user });
    }
    
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Получить объявления - ИСПРАВЛЕННАЯ ВЕРСИЯ
app.get('/api/ads', async (req, res) => {
  try {
    const { category, status, type, user_id } = req.query;
    
    let query = supabase
      .from('ads')
      .select(`
        *,
        employer:users!ads_employer_id_fkey(first_name, last_name, telegram_id)
      `)
    
    if (status) {
      query = query.eq('status', status);
    } else {
      query = query.eq('status', 'active');
    }
    
    if (category && category !== 'all') {
      query = query.eq('category', category);
    }
    
    if (type === 'my' && user_id) {
      query = query.eq('employer_id', user_id);
    }
    
    const { data: ads, error } = await query.order('created_at', { ascending: false });
    
    if (error) throw error;
    
    // Если в объявлениях есть taken_by, получаем данные исполнителей
    const adsWithDetails = await Promise.all(ads.map(async (ad) => {
      const adData = { ...ad };
      
      if (ad.taken_by) {
        const { data: executor } = await supabase
          .from('users')
          .select('first_name, last_name, telegram_id')
          .eq('id', ad.taken_by)
          .single();
        
        adData.executor = executor;
      }
      
      // Получаем минимальные ставки для аукционов
      if (ad.auction) {
        const { data: minBid } = await supabase
          .from('bids')
          .select('amount')
          .eq('ad_id', ad.id)
          .order('amount', { ascending: true })
          .limit(1)
          .single();
        
        adData.min_bid = minBid?.amount || ad.price;
      }
      
      return adData;
    }));
    
    res.json({ ads: adsWithDetails });
  } catch (error) {
    console.error('Get ads error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Получить конкретное объявление - ИСПРАВЛЕННАЯ ВЕРСИЯ С UUID
app.get('/api/ads/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('Get ad request for ID:', id, 'Type:', typeof id);
    
    // Пробуем получить объявление как UUID
    const { data: ad, error } = await supabase
      .from('ads')
      .select(`
        *,
        employer:users!ads_employer_id_fkey(first_name, last_name, telegram_id)
      `)
      .eq('id', id)
      .single();
    
    if (error) {
      console.error('Get ad error:', error);
      
      // Если ошибка связана с форматом UUID, пробуем найти по числовому ID
      if (error.code === '22P02') {
        console.log('UUID format error, trying to find by numeric id...');
        
        // Пытаемся найти объявление с числовым полем (если оно есть)
        // Или преобразуем запрос
        const { data: numericAd, error: numericError } = await supabase
          .from('ads')
          .select(`
            *,
            employer:users!ads_employer_id_fkey(first_name, last_name, telegram_id)
          `)
          .eq('numeric_id', parseInt(id)) // если у вас есть numeric_id поле
          .single();
        
        if (numericError) {
          return res.status(404).json({ 
            error: 'Объявление не найдено',
            details: 'Invalid ID format or ad does not exist'
          });
        }
        
        return res.json({ ad: numericAd });
      }
      
      return res.status(404).json({ 
        error: 'Объявление не найдено',
        details: error.message 
      });
    }
    
    // Если есть исполнитель, получаем и его данные
    if (ad && ad.taken_by) {
      const { data: executor } = await supabase
        .from('users')
        .select('first_name, last_name, telegram_id')
        .eq('id', ad.taken_by)
        .single();
      
      ad.executor = executor;
    }
    
    res.json({ ad });
  } catch (error) {
    console.error('Get ad error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Сделать ставку
app.post('/api/ads/:id/bids', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;
    const user = req.user;
    
    // Проверяем объявление
    const { data: ads, error: adError } = await supabase
      .from('ads')
      .select('*')
      .eq('id', id);
    
    if (adError || !ads || ads.length === 0) {
      return res.status(404).json({ error: 'Объявление не найдено' });
    }
    
    const ad = ads[0];
    
    // Проверяем, что объявление активно и аукцион еще не закончился
    if (ad.status !== 'active' || !ad.auction) {
      return res.status(400).json({ error: 'Невозможно сделать ставку на это объявление' });
    }
    
    if (ad.auction_ends_at && new Date(ad.auction_ends_at) < new Date()) {
      return res.status(400).json({ error: 'Аукцион уже завершен' });
    }
    
    // Проверяем, что ставка ниже текущей минимальной
    const { data: currentMinBid } = await supabase
      .from('bids')
      .select('amount')
      .eq('ad_id', id)
      .order('amount', { ascending: true })
      .limit(1)
      .single();
    
    const currentMin = currentMinBid?.amount || ad.price;
    
    if (amount >= currentMin) {
      return res.status(400).json({ error: 'Ставка должна быть ниже текущей минимальной' });
    }
    
    // Создаем ставку
    const { data: bids, error } = await supabase
      .from('bids')
      .insert({
        ad_id: id,
        user_id: user.id,
        amount
      })
      .select();
    
    if (error) throw error;
    
    if (!bids || bids.length === 0) {
      return res.status(500).json({ error: 'Failed to create bid' });
    }
    
    const bid = bids[0];
    
    // Отправляем уведомление через WebSocket
    io.emit('new-bid', {
      bid,
      userName: `${user.first_name} ${user.last_name}`,
      adId: id
    });
    
    res.json({ 
      success: true,
      bid,
      message: 'Ставка успешно размещена' 
    });
    
  } catch (error) {
    console.error('Bid error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Удалить объявление - ИСПРАВЛЕННАЯ ВЕРСИЯ С UUID
app.delete('/api/ads/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    
    console.log(`Delete request - Ad ID: "${id}", User ID: ${user.id}`);
    
    // Сначала попробуем найти объявление как UUID
    let { data: ad, error: fetchError } = await supabase
      .from('ads')
      .select('*')
      .eq('id', id);
    
    // Если ошибка UUID, ищем альтернативными способами
    if (fetchError && fetchError.code === '22P02') {
      console.log('UUID error, trying alternative lookup...');
      
      // Вариант 1: Ищем по numeric_id если есть такое поле
      ad = await findAdByNumericId(id, user.id);
      
      // Вариант 2: Ищем по title или другому полю
      if (!ad) {
        ad = await findAdByOtherFields(id, user.id);
      }
    }
    
    console.log('Found ad:', ad);
    
    if (!ad || ad.length === 0) {
      return res.status(404).json({ 
        error: 'Объявление не найдено',
        debug: { 
          requestedId: id, 
          userId: user.id,
          isUuid: isUuid(id)
        }
      });
    }
    
    // Проверяем, можно ли удалить объявление
    const adToDelete = ad[0];
    
    if (adToDelete.status === 'taken' || adToDelete.status === 'completed') {
      return res.status(400).json({ 
        error: 'Нельзя удалить задание, которое уже взято в работу или завершено',
        currentStatus: adToDelete.status
      });
    }
    
    // Удаляем объявление по его реальному UUID
    const { error: deleteError } = await supabase
      .from('ads')
      .delete()
      .eq('id', adToDelete.id); // Используем реальный UUID из найденной записи
    
    if (deleteError) {
      console.error('Delete ad error:', deleteError);
      throw deleteError;
    }
    
    console.log('Ad successfully deleted:', adToDelete.id);
    
    res.json({ 
      success: true, 
      message: 'Объявление успешно удалено',
      deletedId: adToDelete.id
    });
    
  } catch (error) {
    console.error('Delete ad error:', error);
    res.status(500).json({ 
      error: 'Ошибка сервера при удалении объявления',
      details: error.message 
    });
  }
});

// Вспомогательные функции для поиска объявлений
async function findAdByNumericId(id, userId) {
  try {
    const numericId = parseInt(id);
    if (isNaN(numericId)) return null;
    
    const { data, error } = await supabase
      .from('ads')
      .select('*')
      .eq('numeric_id', numericId)
      .eq('employer_id', userId);
    
    if (error) {
      console.error('Find by numeric_id error:', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('findAdByNumericId error:', error);
    return null;
  }
}

async function findAdByOtherFields(id, userId) {
  try {
    // Пытаемся найти по части title или другому полю
    const { data, error } = await supabase
      .from('ads')
      .select('*')
      .eq('employer_id', userId)
      .ilike('title', `%${id}%`)
      .limit(1);
    
    if (error) {
      console.error('Find by other fields error:', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('findAdByOtherFields error:', error);
    return null;
  }
}

function isUuid(str) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// Альтернативный endpoint для работы с числовыми ID
app.get('/api/ads/by-numeric/:numericId', authenticate, async (req, res) => {
  try {
    const { numericId } = req.params;
    const numericIdInt = parseInt(numericId);
    
    if (isNaN(numericIdInt)) {
      return res.status(400).json({ error: 'Invalid numeric ID' });
    }
    
    const { data: ads, error } = await supabase
      .from('ads')
      .select(`
        *,
        employer:users!ads_employer_id_fkey(first_name, last_name, telegram_id)
      `)
      .eq('numeric_id', numericIdInt);
    
    if (error) {
      console.error('Get ad by numeric error:', error);
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!ads || ads.length === 0) {
      return res.status(404).json({ error: 'Ad not found' });
    }
    
    res.json({ ad: ads[0] });
  } catch (error) {
    console.error('Get ad by numeric error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Получить ставки для объявления
app.get('/api/ads/:id/bids', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data: bids, error } = await supabase
      .from('bids')
      .select(`
        *,
        user:users!bids_user_id_fkey(first_name, last_name)
      `)
      .eq('ad_id', id)
      .order('amount', { ascending: true });
    
    if (error) throw error;
    res.json({ bids });
  } catch (error) {
    console.error('Get bids error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Получить сообщения
app.get('/api/messages', authenticate, async (req, res) => {
  try {
    const { ad_id, other_user_id } = req.query;
    const user = req.user;
    
    let query = supabase
      .from('messages')
      .select(`
        *,
        sender:users!messages_sender_id_fkey(first_name, last_name),
        receiver:users!messages_receiver_id_fkey(first_name, last_name)
      `)
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${other_user_id}),and(sender_id.eq.${other_user_id},receiver_id.eq.${user.id})`);
    
    if (ad_id) {
      query = query.eq('ad_id', ad_id);
    }
    
    const { data: messages, error } = await query.order('created_at', { ascending: true });
    
    if (error) throw error;
    res.json({ messages });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Отправить сообщение
app.post('/api/messages', authenticate, async (req, res) => {
  try {
    const { ad_id, receiver_id, text } = req.body;
    const user = req.user;
    
    const { data: message, error } = await supabase
      .from('messages')
      .insert({
        ad_id,
        sender_id: user.id,
        receiver_id,
        text
      })
      .select(`
        *,
        sender:users!sender_id(first_name, last_name)
      `)
      .single();
    
    if (error) throw error;
    
    // Отправляем через WebSocket
    io.emit('new-message', {
      message,
      adId: ad_id,
      receiverId: receiver_id
    });
    
    res.json({ message });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Цены и конфигурация
const PRICES = {
    ad_publication: 50, // 50 рублей за публикацию
    subscription_monthly: 299, // 299 рублей в месяц
    subscription_yearly: 2990, // 2990 рублей в год (экономия 2 месяца)
    referral_bonus_ads: 2, // 2 бесплатных объявления за приглашенного друга
    free_ads_on_registration: 2 // 2 бесплатных объявления при регистрации
};

// Проверка возможности публикации объявления
app.post('/api/ads/check', authenticate, async (req, res) => {
    try {
        const user = req.user;
        
        // Проверяем активную подписку
        const { data: subscription } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .gt('ends_at', new Date().toISOString())
            .single();
        
        if (subscription) {
            return res.json({ 
                allowed: true,
                reason: 'active_subscription',
                free: true,
                subscription_end: subscription.ends_at
            });
        }
        
        // Проверяем бесплатные объявления
        if (user.free_ads_available > 0) {
            return res.json({ 
                allowed: true,
                reason: 'free_ads_available',
                free: true,
                free_ads_left: user.free_ads_available
            });
        }
        
        // Если нет бесплатных объявлений и подписки
        return res.json({
            allowed: true, // Разрешаем, но с оплатой
            reason: 'needs_payment',
            free: false,
            price: PRICES.ad_publication
        });
        
    } catch (error) {
        console.error('Check ad publication error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Создание объявления с оплатой/проверкой
app.post('/api/ads', authenticate, async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      price,
      location,
      contacts,
      auction,
      auction_hours
    } = req.body;

    const user = req.user;

    // ❗ ПРОВЕРКА ЛИМИТА
    if (user.free_ads_available <= 0) {
      return res.status(403).json({
        error: 'Бесплатные объявления закончились'
      });
    }

    let auction_ends_at = null;
    if (auction && auction_hours) {
      auction_ends_at = new Date(
        Date.now() + auction_hours * 60 * 60 * 1000
      ).toISOString();
    }

    // ✅ СОЗДАЁМ ОБЪЯВЛЕНИЕ
    const { data: ads, error } = await supabase
      .from('ads')
      .insert({
        employer_id: user.id,
        title,
        description,
        category,
        price,
        location,
        contacts,
        auction,
        auction_ends_at,
        status: 'active'
      })
      .select();

    if (error || !ads?.length) {
      throw error;
    }

    // ✅ ВОТ ЗДЕСЬ УМЕНЬШАЕМ free_ads_available
    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    await supabaseAdmin
      .from('users')
      .update({
        free_ads_available: user.free_ads_available - 1
      })
      .eq('id', user.id);

    res.json({ ad: ads[0] });

  } catch (error) {
    console.error('Create ad error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});



// Реферальная система
app.post('/api/referrals/create', authenticate, async (req, res) => {
    try {
        const user = req.user;
        
        // Генерируем реферальный код, если нет
        if (!user.referral_code) {
            const referralCode = generateReferralCode();
            await supabase
                .from('users')
                .update({ referral_code: referralCode })
                .eq('id', user.id);
        }
        
        const { data: updatedUser } = await supabase
            .from('users')
            .select('referral_code')
            .eq('id', user.id)
            .single();
        
        res.json({ 
            referral_code: updatedUser.referral_code,
            referral_link: `https://t.me/your_bot?start=${updatedUser.referral_code}`,
            stats: {
                referrals_count: user.referral_count || 0,
                bonus_ads_earned: user.referral_bonus_ads || 0
            }
        });
        
    } catch (error) {
        console.error('Create referral error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/referrals/use', authenticate, async (req, res) => {
    try {
        const { referral_code } = req.body;
        const user = req.user;
        
        // Находим пользователя, который пригласил
        const { data: referrer } = await supabase
            .from('users')
            .select('id')
            .eq('referral_code', referral_code)
            .single();
        
        if (!referrer) {
            return res.status(400).json({ error: 'Неверный реферальный код' });
        }
        
        // Проверяем, не использовал ли уже пользователь реферальный код
        const { data: existingReferral } = await supabase
            .from('referrals')
            .select('id')
            .eq('referred_id', user.id)
            .single();
        
        if (existingReferral) {
            return res.status(400).json({ error: 'Вы уже использовали реферальный код' });
        }
        
        // Создаем запись о реферале
        const { data: referral } = await supabase
            .from('referrals')
            .insert({
                referrer_id: referrer.id,
                referred_id: user.id,
                status: 'pending'
            })
            .select()
            .single();
        
        // Начисляем бонус пригласившему (после публикации первого объявления)
        // или сразу, в зависимости от логики
        
        res.json({ 
            success: true,
            message: 'Реферальный код успешно применен',
            referrer_id: referrer.id
        });
        
    } catch (error) {
        console.error('Use referral error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Система подписок
app.post('/api/subscriptions/create', authenticate, async (req, res) => {
    try {
        const { plan } = req.body; // 'monthly' или 'yearly'
        const user = req.user;
        
        const subscriptionPrice = plan === 'yearly' 
            ? PRICES.subscription_yearly 
            : PRICES.subscription_monthly;
        
        const duration = plan === 'yearly' ? 365 : 30; // дней
        
        // Здесь должна быть интеграция с платежной системой
        // Для демо создаем подписку сразу
        
        const endsAt = new Date(Date.now() + duration * 24 * 60 * 60 * 1000);
        
        const { data: subscription } = await supabase
            .from('subscriptions')
            .upsert({
                user_id: user.id,
                plan,
                price: subscriptionPrice,
                starts_at: new Date().toISOString(),
                ends_at: endsAt.toISOString(),
                is_active: true
            })
            .select()
            .single();
        
        // Обновляем статус пользователя
        await supabase
            .from('users')
            .update({ has_active_subscription: true })
            .eq('id', user.id);
        
        // Создаем транзакцию
        await createTransaction(user.id, {
            amount: -subscriptionPrice,
            type: 'subscription',
            description: `Подписка "${plan === 'yearly' ? 'Годовая' : 'Месячная'}"`
        });
        
        res.json({ 
            subscription,
            message: `Подписка успешно оформлена. Действует до: ${endsAt.toLocaleDateString('ru-RU')}`
        });
        
    } catch (error) {
        console.error('Create subscription error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/subscriptions/my', authenticate, async (req, res) => {
    try {
        const user = req.user;
        
        const { data: subscription } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .gt('ends_at', new Date().toISOString())
            .single();
        
        res.json({ subscription });
        
    } catch (error) {
        console.error('Get subscription error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

async function createTransaction(userId, data) {
    const { data: transaction } = await supabase
        .from('transactions')
        .insert({
            user_id: userId,
            amount: data.amount,
            type: data.type,
            description: data.description,
            status: 'completed'
        })
        .select()
        .single();
    
    return transaction;
}

async function getUserBalance(userId) {
    const { data: transactions } = await supabase
        .from('transactions')
        .select('amount')
        .eq('user_id', userId)
        .eq('status', 'completed');
    
    if (!transactions) return 0;
    
    return transactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
}

function generateReferralCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Обновляем регистрацию пользователя для рефералов
app.post('/api/user/init', authenticate, async (req, res) => {
    try {
        const { username, first_name, last_name, referral_code } = req.body;
        
        // Обновляем данные пользователя
        const updateData = {
            username,
            first_name: first_name || req.user.first_name,
            last_name: last_name || req.user.last_name
        };
        
        // Если передан реферальный код, обрабатываем его
        if (referral_code) {
            const { data: referrer } = await supabase
                .from('users')
                .select('id')
                .eq('referral_code', referral_code)
                .single();
            
            if (referrer && referrer.id !== req.user.id) {
                // Создаем запись о реферале
                await supabase
                    .from('referrals')
                    .insert({
                        referrer_id: referrer.id,
                        referred_id: req.user.id,
                        status: 'completed'
                    });
                
                // Начисляем бонус пригласившему
                await supabase
                    .from('users')
                    .update({ 
                        free_ads_available: supabase.raw('COALESCE(free_ads_available, 0) + ?', [PRICES.referral_bonus_ads]),
                        referral_count: supabase.raw('COALESCE(referral_count, 0) + 1'),
                        referral_bonus_ads: supabase.raw('COALESCE(referral_bonus_ads, 0) + ?', [PRICES.referral_bonus_ads])
                    })
                    .eq('id', referrer.id);
                
                // Начисляем бонус новому пользователю (опционально)
                updateData.free_ads_available = supabase.raw('COALESCE(free_ads_available, 0) + 1');
            }
        }
        
        const { data: updatedUsers, error } = await supabase
            .from('users')
            .update(updateData)
            .eq('id', req.user.id)
            .select();
        
        if (error) throw error;
        
        res.json({ user: updatedUsers[0] });
        
    } catch (error) {
        console.error('Init user error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Обновите маршрут /api/user (или добавьте новый)
app.post('/api/user/update-telegram', authenticate, async (req, res) => {
  try {
    const { 
      username, 
      first_name, 
      last_name, 
      photo_url 
    } = req.body;
    
    console.log('Updating Telegram data for user:', req.user.id, req.body);
    
    // Создаем объект для обновления
    const updateData = {};
    
    // Проверяем наличие полей и добавляем их
    if (username !== undefined) updateData.username = username;
    if (first_name !== undefined) updateData.first_name = first_name;
    if (last_name !== undefined) updateData.last_name = last_name;
    if (photo_url !== undefined) updateData.photo_url = photo_url;
    
    console.log('Update data:', updateData);
    
    // Если нечего обновлять, возвращаем текущего пользователя
    if (Object.keys(updateData).length === 0) {
      console.log('Nothing to update');
      return res.json({ user: req.user });
    }
    
    // Обновляем пользователя
    const { data: updatedUsers, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', req.user.id)
      .select('*'); // Используем select() вместо single()
    
    if (error) {
      console.error('Update error:', error);
      // В случае ошибки возвращаем текущего пользователя с обновленными локально данными
      const mergedUser = { ...req.user, ...updateData };
      return res.json({ user: mergedUser });
    }
    
    console.log('Updated users:', updatedUsers);
    
    if (!updatedUsers || updatedUsers.length === 0) {
      console.log('No users returned after update, returning merged user');
      const mergedUser = { ...req.user, ...updateData };
      return res.json({ user: mergedUser });
    }
    
    // Возвращаем первого обновленного пользователя
    res.json({ user: updatedUsers[0] });
    
  } catch (error) {
    console.error('Update Telegram data error:', error);
    // В случае ошибки возвращаем текущего пользователя
    res.json({ user: req.user });
  }
});

// WebSocket подключения
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  
  socket.on('join-ad', (adId) => {
    socket.join(`ad-${adId}`);
    console.log(`Client joined ad-${adId}`);
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Supabase connected: ${supabaseUrl ? 'Yes' : 'No'}`);
});
