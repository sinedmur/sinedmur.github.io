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
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Простой аутентификационный middleware
const authenticate = async (req, res, next) => {
  const telegramId = req.headers.authorization;
  
  if (!telegramId) {
    return res.status(401).json({ error: 'No Telegram ID provided' });
  }
  
  try {
    // Используем сервисную роль для обхода RLS
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    // Ищем пользователя
    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('telegram_id', telegramId);
    
    if (error) {
      console.error('Auth query error:', error);
      return res.status(500).json({ error: 'Database error' });
    }
    
    let user;
    
    if (users && users.length > 0) {
      // Пользователь найден
      user = users[0];
    } else {
      // Создаем нового пользователя с сервисной ролью
      const newUserData = {
        telegram_id: telegramId,
        first_name: 'Пользователь',
        last_name: `#${telegramId}`,
        created_at: new Date().toISOString()
      };
      
      const { data: newUsers, error: createError } = await supabaseAdmin
        .from('users')
        .insert(newUserData)
        .select();
      
      if (createError || !newUsers || newUsers.length === 0) {
        console.error('Create user error:', createError);
        return res.status(500).json({ 
          error: 'Failed to create user',
          details: createError?.message 
        });
      }
      
      user = newUsers[0];
    }
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ 
      error: 'Authentication failed',
      details: error.message 
    });
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

// Инициализация пользователя
app.post('/api/user/init', authenticate, async (req, res) => {
  try {
    const { username, first_name, last_name } = req.body;
    
    // Обновляем данные пользователя
    const { data: updatedUsers, error } = await supabase
      .from('users')
      .update({
        username,
        first_name: first_name || req.user.first_name,
        last_name: last_name || req.user.last_name
      })
      .eq('id', req.user.id)
      .select();
    
    if (error) {
      console.error('Update user error:', error);
      throw error;
    }
    
    if (!updatedUsers || updatedUsers.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ user: updatedUsers[0] });
  } catch (error) {
    console.error('Init user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Получить пользователя
app.get('/api/user', authenticate, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(404).json({ error: 'User not found in request' });
    }
    res.json({ user: req.user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Получить объявления
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

// Получить конкретное объявление
app.get('/api/ads/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Используем явное указание связи
    const { data: ad, error } = await supabase
      .from('ads')
      .select(`
        *,
        employer:users!ads_employer_id_fkey(first_name, last_name, telegram_id)
      `)
      .eq('id', id)
      .single();
    
    if (error) throw error;
    
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

// Создать объявление
app.post('/api/ads', authenticate, async (req, res) => {
  try {
    const { title, description, category, price, location, contacts, auction, auction_hours } = req.body;
    const user = req.user;
    
    let auction_ends_at = null;
    if (auction && auction_hours) {
      auction_ends_at = new Date(Date.now() + auction_hours * 60 * 60 * 1000).toISOString();
    }
    
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
      .select(`
        *,
        employer:users!ads_employer_id_fkey(first_name, last_name, telegram_id)
      `)
    
    if (error) {
      console.error('Create ad error:', error);
      throw error;
    }
    
    if (!ads || ads.length === 0) {
      return res.status(500).json({ error: 'Failed to create ad' });
    }
    
    const ad = ads[0];
    
    res.json({ ad });
  } catch (error) {
    console.error('Create ad error:', error);
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

// Удалить объявление
app.delete('/api/ads/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    
    // Проверяем, что объявление принадлежит пользователю
    const { data: ad, error: fetchError } = await supabase
      .from('ads')
      .select('*')
      .eq('id', id)
      .eq('employer_id', user.id);
    
    if (fetchError) {
      console.error('Fetch ad error:', fetchError);
      return res.status(500).json({ error: 'Ошибка при проверке объявления' });
    }
    
    if (!ad || ad.length === 0) {
      return res.status(404).json({ error: 'Объявление не найдено или вы не являетесь его владельцем' });
    }
    
    // Удаляем связанные данные в правильном порядке
    // 1. Удаляем ставки (если есть)
    const { error: bidsError } = await supabase
      .from('bids')
      .delete()
      .eq('ad_id', id);
    
    if (bidsError) {
      console.error('Delete bids error:', bidsError);
      // Продолжаем удаление даже если ошибка с ставками
    }
    
    // 2. Удаляем сообщения (если есть)
    const { error: messagesError } = await supabase
      .from('messages')
      .delete()
      .eq('ad_id', id);
    
    if (messagesError) {
      console.error('Delete messages error:', messagesError);
      // Продолжаем удаление
    }
    
    // 3. Удаляем само объявление
    const { error: deleteError } = await supabase
      .from('ads')
      .delete()
      .eq('id', id);
    
    if (deleteError) {
      console.error('Delete ad error:', deleteError);
      throw deleteError;
    }
    
    // Отправляем уведомление через WebSocket
    io.emit('ad-deleted', {
      adId: id,
      userId: user.id
    });
    
    res.json({ 
      success: true,
      message: 'Объявление успешно удалено' 
    });
    
  } catch (error) {
    console.error('Delete ad error:', error);
    res.status(500).json({ error: 'Ошибка при удалении объявления' });
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
