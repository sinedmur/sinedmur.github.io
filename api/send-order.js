// Импортируем fetch для Node.js
const fetch = require('node-fetch');

module.exports = async (req, res) => {
  // Разрешаем CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Обработка preflight запроса
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Проверяем метод
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Используйте POST запрос' });
    return;
  }

  try {
    const body = req.body;
    console.log('Получен заказ:', body);

    // ВАЖНО: Замените на ваши реальные данные
    const BOT_TOKEN = '8123660798:AAEKKD8H1478Mqrb9r9GtAQT1wDoDHkUVk8';
    const MANAGER_CHAT_ID = '1019928513';

    // Формируем сообщение
    const message = `🛎 НОВЫЙ ЗАКАЗ!

👤 <b>Клиент:</b> ${body.userName}
🆔 <b>ID клиента:</b> <code>${body.userId}</code>
${body.userUsername !== 'не указан' ? `📛 <b>Username:</b> @${body.userUsername}` : ''}
📞 <b>Телефон:</b> ${body.phone}

📅 <b>Дата:</b> ${body.date}
📍 <b>Адрес:</b> ${body.address}

🍽 <b>Состав заказа:</b>
${body.items.map((item, i) => 
  `${i+1}. ${item.name} ×${item.quantity} = ${item.price * item.quantity}₽`
).join('\n')}

💰 <b>Сумма:</b> ${body.total} ₽
🔥 <b>Калорийность:</b> ${body.kcal} ккал

🚀 <b>Статус:</b> Ожидает подтверждения

<a href="tg://user?id=${body.userId}">📩 Написать клиенту в ЛС</a>`;

    // Отправляем в Telegram
    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: MANAGER_CHAT_ID,
          text: message,
          parse_mode: 'HTML',
          disable_web_page_preview: false
        })
      }
    );

    const telegramData = await telegramResponse.json();
    console.log('Ответ Telegram:', telegramData);

    if (!telegramData.ok) {
      throw new Error(telegramData.description || 'Ошибка Telegram API');
    }

    // Успешный ответ
    res.status(200).json({ 
      success: true, 
      message: 'Заказ отправлен менеджеру' 
    });

  } catch (error) {
    console.error('Ошибка:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};
