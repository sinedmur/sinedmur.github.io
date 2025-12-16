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
    // Пытаемся найти пользователя
    let { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', telegramId)
      .single();
    
    if (error || !user) {
      // Если пользователь не найден, создаем нового
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          telegram_id: telegramId,
          first_name: 'Пользователь',
          last_name: `#${telegramId}`,
          balance: 1000,
          role: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (createError) {
        console.error('Create user error:', createError);
        return res.status(500).json({ error: 'Failed to create user' });
      }
      
      req.user = newUser;
    } else {
      req.user = user;
    }
    
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ error: 'Authentication failed' });
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
    const { data: user, error } = await supabase
      .from('users')
      .update({
        username,
        first_name: first_name || req.user.first_name,
        last_name: last_name || req.user.last_name,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.user.id)
      .select()
      .single();
    
    if (error) throw error;
    res.json({ user });
  } catch (error) {
    console.error('Init user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Получить пользователя
app.get('/api/user', authenticate, async (req, res) => {
  try {
    res.json({ user: req.user });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Обновить роль пользователя
app.post('/api/user/role', authenticate, async (req, res) => {
    try {
        const { role } = req.body;
        const user = req.user; // пользователь из middleware
        
        if (!user) {
            return res.status(404).json({ 
                error: 'User not found',
                code: 'USER_NOT_FOUND' 
            });
        }
        
        // Проверяем валидность роли
        const validRoles = ['employer', 'worker', 'admin'];
        if (!role || !validRoles.includes(role)) {
            return res.status(400).json({ 
                error: 'Invalid role',
                valid_roles: validRoles 
            });
        }
        
        console.log(`Updating role for user ${user.id} to ${role}`);
        
        // Обновляем роль
        const { data: updatedUser, error } = await supabase
            .from('users')
            .update({ 
                role: role,
                updated_at: new Date().toISOString()
            })
            .eq('id', user.id)
            .select()
            .single();
        
        if (error) {
            console.error('Supabase update error:', error);
            return res.status(500).json({ 
                error: 'Database error',
                details: error.message 
            });
        }
        
        if (!updatedUser) {
            return res.status(404).json({ 
                error: 'User not found after update',
                code: 'UPDATE_FAILED' 
            });
        }
        
        res.json({ 
            success: true,
            user: updatedUser,
            message: `Role updated to ${role}`
        });
        
    } catch (error) {
        console.error('Update role error:', error);
        res.status(500).json({ 
            error: 'Server error',
            details: error.message 
        });
    }
});

// Получить объявления
app.get('/api/ads', async (req, res) => {
  try {
    const { category, type, user_id } = req.query;
    
    let query = supabase
      .from('ads')
      .select(`
        *,
        employer:users(first_name, last_name)
      `)
      .eq('status', 'active');
    
    if (category && category !== 'all') {
      query = query.eq('category', category);
    }
    
    if (type === 'employer' && user_id) {
      query = query.eq('employer_id', user_id);
    }
    
    if (type === 'worker' && user_id) {
      query = query.neq('employer_id', user_id);
    }
    
    const { data: ads, error } = await query.order('created_at', { ascending: false });
    
    if (error) throw error;
    
    // Получаем минимальные ставки для аукционов
    const adsWithBids = await Promise.all(ads.map(async (ad) => {
      if (ad.auction) {
        const { data: minBid } = await supabase
          .from('bids')
          .select('amount')
          .eq('ad_id', ad.id)
          .order('amount', { ascending: true })
          .limit(1)
          .single();
        
        return {
          ...ad,
          min_bid: minBid?.amount || ad.price
        };
      }
      return ad;
    }));
    
    res.json({ ads: adsWithBids });
  } catch (error) {
    console.error('Get ads error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Создать объявление
app.post('/api/ads', authenticate, async (req, res) => {
  try {
    const { title, description, category, price, location, auction } = req.body;
    const user = req.user;
    
    const { data: ad, error } = await supabase
      .from('ads')
      .insert({
        employer_id: user.id,
        title,
        description,
        category,
        price,
        location,
        auction,
        auction_ends_at: auction ? 
          new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : 
          null,
        status: 'active'
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // Добавляем информацию о работодателе
    const adWithEmployer = {
      ...ad,
      employer: {
        first_name: user.first_name,
        last_name: user.last_name
      }
    };
    
    res.json({ ad: adWithEmployer });
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
    const { data: ad, error: adError } = await supabase
      .from('ads')
      .select('*')
      .eq('id', id)
      .single();
    
    if (adError || !ad) {
      return res.status(404).json({ error: 'Объявление не найдено' });
    }
    
    if (!ad.auction) {
      return res.status(400).json({ error: 'Это не аукцион' });
    }
    
    if (ad.auction_ends_at && new Date(ad.auction_ends_at) < new Date()) {
      return res.status(400).json({ error: 'Аукцион уже завершен' });
    }
    
    // Проверяем минимальную ставку
    const { data: minBid } = await supabase
      .from('bids')
      .select('amount')
      .eq('ad_id', id)
      .order('amount', { ascending: true })
      .limit(1)
      .single();
    
    const minAmount = minBid?.amount || ad.price;
    if (amount >= minAmount) {
      return res.status(400).json({ 
        error: 'Ставка должна быть ниже текущей минимальной',
        min_amount: minAmount 
      });
    }
    
    // Создаем ставку
    const { data: bid, error } = await supabase
      .from('bids')
      .insert({
        ad_id: id,
        user_id: user.id,
        amount
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // Отправляем через WebSocket
    io.emit('new-bid', {
      adId: id,
      bid,
      userName: `${user.first_name} ${user.last_name}`
    });
    
    res.json({ 
      success: true, 
      bid,
      message: 'Ставка принята'
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
        user:users(first_name, last_name)
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
        sender:users!sender_id(first_name, last_name),
        receiver:users!receiver_id(first_name, last_name)
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
