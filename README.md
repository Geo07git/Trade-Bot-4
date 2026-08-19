# 🚀 G&S-Trade-Bot v3.0
### Multi-Platform AI Trading, Scalping & Smart Grid System (Web • Desktop • Mobile)

**G&S-Trade-Bot v3.0** este o platformă completă de tranzacționare automată alimentată de modele Machine Learning (Random Forest Ensemble, XGBoost Classifier) și Inteligență Artificială (Google Gemini AI). Sistemul include server autonom 24/7, Motor de Scalping de Înaltă Frecvență, Bot Smart Grid, monitorizare live a costurilor API și suport nativ pentru **Web**, **Desktop Executable (Windows .exe)** și **Mobile (Android .apk)**.

---

## 🌟 Ce este nou în Versiunea 3.0?

1. **Garantare Execuție Unificată Max Hold Scalping**:
   - Corecție completă a buclei de verificare pe pozițiile deschise. Limita `Max Hold` (ex: 10 minute) este acum verificată la fiecare ciclu pe **toate** pozițiile active, eliminând definitiv depășirile accidentale de timp pe pierdere.
2. **Sincronizare Unificată a Setărilor de Risc**:
   - Schimbarea parametrilor din **Motor Scalping ML** (Stop Loss, Max Hold, Capital Sizing) se reflectă automat și instantaneu în meniul **Settings** și în engine-ul serverului.
3. **AI Cost Monitor Integrat**:
   - Panou dedicat de monitorizare în timp real a cheltuielilor API Gemini. Calculează exact consumul de tokeni Input/Output și oferă estimări de cost în USD și RON.
4. **Suport Nativ Android (.apk via Capacitor)**:
   - Integrare completă a framework-ului `@capacitor/core` și `@capacitor/android` pentru compilarea proiectului direct într-o aplicație mobilă Android `.apk`.
5. **Aplicație Desktop Independentă (.exe via Electron)**:
   - Compilare ca aplicație nativă Windows cu installer automat (NSIS) și varianta portabilă (`dist-electron/`).

---

## 🏗️ Arhitectură Tehnică

- **Frontend UI**: React 19, TypeScript, Tailwind CSS v4, Motion Animation, Recharts, Lucide Icons, Zustand Store.
- **Backend Server**: Node.js, Express, ESBuild CJS bundler (rulează pe portul 3000).
- **Modele ML & AI**:
  - Ensemble Random Forest + XGBoost Classifier (calcul scor oportunitate 0-100).
  - Google Gemini AI (analiză macro, sentiment de piață, calibrare recomandări).
- **Runtime Desktop**: Electron v43, Electron Builder.
- **Runtime Mobil**: Capacitor v8 (Android Native Container).

---

## 🛠️ Ghid de Rulare și Compilare (Step-by-Step)

### Cerințe Prealabile
- **Node.js** v18+ (recomandat v20)
- **npm** v9+
- **Android Studio** (opțional, doar pentru compilarea versiunii mobile `.apk`)

---

### 1. Rulare în Mediu Web / Local

```bash
# 1. Instalare dependențe
npm install

# 2. Rulare în mediu de dezvoltare (cu Server & UI Live)
npm run dev

# 3. Compilare & Rulare Server de Producție 24/7
npm run build
npm start
```
> Deschideți browserul la adresa: `http://localhost:3000`

---

### 2. Compilare Aplicație Desktop Executabilă (.exe Windows)

```bash
# Rulați comanda de construire a executabilului Electron
npm run electron:build
# sau
npm run build:exe
```
> Executabilul creat și kitul de instalare NSIS vor fi generate în directorul:
> `dist-electron/G&S-Trade-Bot-Setup-3.0.0.exe`

---

### 3. Compilare Aplicație Mobilă Android (.apk)

Sistemul folosește Capacitor pentru a împacheta aplicația într-o aplicație nativă Android.

```bash
# Step 1: Compilare proiect Web
npm run build

# Step 2: Adăugare platformă Android (se execută doar o singură dată)
npm run cap:add

# Step 3: Sincronizare cod în containerul Android și compilare APK Debug
npm run build:apk
```

> **Unde găsești fișierul .APK generat?**
> După finalizarea comenzii `npm run build:apk`, fișierul executabil Android se află la calea:
> `android/app/build/outputs/apk/debug/app-debug.apk`
> 
> Îl puteți transfera direct pe telefonul Android pentru instalare!

Pentru versiunea de Producție Semnată (Release APK):
```bash
npm run build:apk:release
```

---

## ⚙️ Configurare & Securitate

### 1. Chei API Binance
Accesați secțiunea **Settings** din interfața aplicației:
- **Paper Trading (Simulare)**: Nu necesită chei. Tranzacționare virtuală în mediu izolat.
- **Binance Testnet**: Introduceți *Testnet API Key* și *Testnet API Secret*.
- **Binance Real Live**: Introduceți *API Key* și *API Secret* obținute din contul dumneavoastră Binance.

### 2. Gemini AI Key
Pentru analiză inteligentă și recomandări de piață, adăugați cheia API în fișierul `.env`:
```env
GEMINI_API_KEY=cheia_ta_gemini_aici
```

### 3. Notificări Telegram & Discord
În meniul **Alerts** puteți configura:
- **Telegram Bot Token** + **Chat ID**
- **Discord Webhook URL**
- **Web Push Notifications** (notificări de sistem pe mobil și desktop)

---

## 📊 Reguli & Ierarhie de Risc în Scalping

| Parametru | Setare Recomandată | Comportament Închidere Poziție |
| :--- | :--- | :--- |
| **Stop Loss Siguranță** | `-3.0%` ... `-4.0%` | Eliminare imediată dacă pierderea depășește pragul. |
| **Max Hold Duration** | `10 minute` | Închidere obligatorie dacă poziția este pe pierdere/stagnare la finalul celor 10 min. |
| **Capital per Position** | `10%` | Fiecare poziție nouă alocă maxim 10% din capitalul liber. |
| **ATR Trailing Stop** | Activ (`+1.2%` trigger) | Securizează profitul și lasă câștigătorii să rulați în tendințe tari. |

---

## 📜 Licență & Disclaimer

*Acest software este creat exclusiv în scopuri educaționale și de automatizare personală. Tranzacționarea criptomonedelor implică risc financiar ridicat. Verificați întotdeauna parametrii în mediu Paper Trading înainte de activarea tranzacționării cu fonduri reale.*
