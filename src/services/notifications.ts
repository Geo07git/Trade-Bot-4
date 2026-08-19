export async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    alert("Acest browser nu suportă notificări desktop.");
    return false;
  }
  
  if (Notification.permission === "granted") {
    return true;
  }
  
  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }
  
  return false;
}

export function sendWebPush(title: string, body: string) {
  if (!("Notification" in window)) return;
  
  if (Notification.permission === "granted") {
    new Notification(title, {
      body,
      icon: "https://cdn-icons-png.flaticon.com/512/2950/2950073.png" // Placeholder icon
    });
  } else {
    console.warn("Nu ai permisiuni pentru notificări. Mesaj:", title, body);
  }
}

export async function sendNotificationMessage(
  provider: 'telegram' | 'discord' | 'all' | string,
  discordWebhookUrl: string,
  telegramBotToken: string,
  telegramChatId: string,
  message: string
) {
  try {
    if (discordWebhookUrl && discordWebhookUrl.trim()) {
      fetch(discordWebhookUrl.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: message })
      }).catch(err => console.error("Eroare Discord webhook:", err));
    }

    if (telegramBotToken && telegramChatId) {
      const token = telegramBotToken.trim();
      const chatId = telegramChatId.trim();
      const url = `https://api.telegram.org/bot${token}/sendMessage`;
      const htmlText = message
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
        .replace(/\*(.*?)\*/g, '<b>$1</b>');

      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: htmlText, parse_mode: 'HTML' })
      })
      .then(async (res) => {
        if (!res.ok) {
          const plainText = message.replace(/\*\*/g, '').replace(/\*/g, '');
          fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: plainText })
          }).catch(err => console.error("Eroare Telegram fallback:", err));
        }
      })
      .catch(err => console.error("Eroare Telegram webhook:", err));
    }
  } catch (err) {
    console.error("Eroare la trimiterea notificărilor:", err);
  }
}
