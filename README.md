# AI.TRADE Bot

Platformă inteligentă pentru Paper Trading și Simularea Algoritmilor de Machine Learning.

Această aplicație este o platformă completă ("full-stack") care folosește React, Tailwind CSS, Vite și un backend integrat în Node.js (Express). Ea rulează un server de fundal 24/7 care continuă simularea pieței și execută deciziile strategice chiar și atunci când interfața web este închisă.

## Funcționalități Principale

- **Server 24/7 Autonom**: Preia prețuri simulate de piață (sau prin Binance API, dacă ar fi conectat cu credențiale reale) și generează semnale de ML.
- **Paper Trading**: Un portofoliu virtual pentru a testa eficiența strategiilor fără risc.
- **Integrări de Notificări**: Semnale transmise live prin Discord Webhooks, Telegram Bot sau notificări native Web Push (Android/Desktop).
- **Control UI Premium**: Interfață adaptată atât pentru ecrane mari cât și pentru mobile, cu funcții de control direct al bot-ului din Header sau Sidebar.
- **Setări Dinamice**: Posibilitatea de a controla frecvența tranzacțiilor și probabilitățile de succes.

## Cum rulezi aplicația local

1. Asigură-te că ai instalat **Node.js** (recomandat v18 sau mai nou).
2. Deschide un terminal în acest folder și rulează comanda pentru instalarea dependențelor:
   ```bash
   npm install
   ```
3. Pentru rularea în mediu de producție (sau a lăsa serverul 24/7 pornit independent):
   ```bash
   npm run build
   npm start
   ```
4. Pentru dezvoltare și editare de cod (cu Hot Reload pentru UI):
   ```bash
   npm run dev
   ```

Aplicația va fi disponibilă la `http://localhost:3000`.

## Configurare Telegram & Discord

Pentru a primi notificări direct pe mobil:
1. Mergi în meniul **Settings** al aplicației.
2. Selectează platforma preferată (Telegram sau Discord).
3. Pentru Discord: Creează un Webhook dintr-un canal și lipește URL-ul.
4. Pentru Telegram: 
   - Caută @BotFather pe Telegram, tastează `/newbot`.
   - Obține *Bot Token*-ul.
   - Accesează API-ul pentru a obține *Chat ID*-ul. (Caută bot-ul nou creat, trimite-i un mesaj, apoi accesează `https://api.telegram.org/bot<TOKEN>/getUpdates`).
   - Introdu *Bot Token* și *Chat ID* în setările aplicației.
5. Mergi în **Alerts** și apasă *Testează Alertele*.

---
*Disclaimer: Această aplicație funcționează într-un mediu simulat de Paper Trading, creat în scopuri educaționale.*
