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
  provider: 'telegram' | string,
  discordWebhookUrl: string,
  telegramBotToken: string,
  telegramChatId: string,
  message: string
) {
  try {
    if (telegramBotToken && telegramChatId) {
      const url = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`;
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: telegramChatId, text: message })
      });
    }
  } catch (err) {
    console.error("Eroare la trimiterea notificării Telegram:", err);
  }
}
