# Ghid de Instalare și Rulare 24/7 pe VPS (Ubuntu / Debian)

Aplicația **Crypto AI Trading Bot** este pregătită 100% pentru instalare pe orice VPS (Contabo, Hetzner, DigitalOcean, Linode, AWS etc.).

---

## 1. Cerințe Minime VPS
- **Sistem de Operare**: Ubuntu 22.04 LTS sau Debian 12 (recomandat)
- **Specificații**: 1 CPU, 1-2 GB RAM, 10-20 GB SSD
- **Node.js**: v20.x sau mai nou

---

## 2. Pași Rapid de Instalare

### Pasul 1: Actualizare VPS & Instalare Node.js v20
Conectează-te prin SSH la VPS:
```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git build-essential
```

Verifică instalarea:
```bash
node -v   # Trebuia să afișeze v20.x.x
npm -v
```

### Pasul 2: Clonare/Copiere Proiect pe VPS
```bash
git clone <URL-ul-repo-ului-tau.git> crypto-ai-bot
cd crypto-ai-bot
```

### Pasul 3: Instalare Dependințe & Builduire
```bash
npm install
npm run build
```

---

## 3. Rulare 24/7 cu PM2 (Process Manager)

Instalează PM2 global pentru ca robotul să ruleze continuu în fundal, chiar dacă închizi terminalul SSH sau dacă repornești VPS-ul:

```bash
sudo npm install -g pm2
```

Lansează aplicația folosind fișierul de configurare pregătit:
```bash
pm2 start ecosystem.config.cjs
```

Activează auto-start la repornirea VPS-ului:
```bash
pm2 save
pm2 startup
# Execută comanda afișată în terminal de 'pm2 startup'
```

---

## 4. Comenzi Utile PM2
- **Vezi logurile live**: `pm2 logs crypto-ai-bot`
- **Stare robot**: `pm2 status`
- **Repornire**: `pm2 restart crypto-ai-bot`
- **Oprire**: `pm2 stop crypto-ai-bot`

---

## 5. Accesare Interfață Web (Opțional Nginx sau Port Direct)

Aplicația ascultă pe portul `3000`. Poți accesa panoul la:
`http://IP_VPS_TAU:3000`

Dacă dorești HTTPS și domeniu propriu, configurează Nginx + Certbot (Let's Encrypt) cu reverse proxy pe `http://localhost:3000`.
