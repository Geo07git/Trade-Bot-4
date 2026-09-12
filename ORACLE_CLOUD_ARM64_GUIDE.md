# Ghid de Instalare și Rulare 24/7 pe Oracle Cloud Infrastructure (OCI)
### Arhitectură: **Ubuntu Minimal (aarch64 / ARM64 - Ampere A1 Compute)**

Acest ghid oferă instrucțiuni pas cu pas pentru instalarea și rularea continuă a **GS Trading Bot (Matrix Terminal)** pe o instanță gratuită sau plătită de **Oracle Cloud Infrastructure (OCI)** cu procesoare **ARM64 / aarch64 (Ampere A1)**.

---

## 💡 De ce NU folosim Electron pe un server Cloud (Headless)?

- **Electron** este destinat calculatoarelor personale (desktop/laptop cu ecran - Windows, macOS, Ubuntu Desktop) deoarece împachetează un browser Chromium complet și necesită un server grafic (X11/Wayland) și biblioteci de interfață grafică (GTK, ALSA etc.).
- Pe un server **Ubuntu Minimal în Cloud** (care este *headless*, adică fără ecran/desktop grafic), Electron ar consuma inutil 1–2 GB RAM și ar necesita instalarea unui ecran virtual (`xvfb`).
- **Soluția optimă și profesională**:
  1. Pe serverul Oracle Cloud ARM64 rulați botul ca **serviciu nativ de sistem (systemd / PM2 sau Docker)**. Consumă doar **~120 MB RAM**, este ultra-rapid și rulează 24/7.
  2. Vă conectați la el de pe orice dispozitiv (PC, laptop, telefon) din browser la adresa `http://<IP_ORACLE>:3000`.
  3. **Vreți experiență identică cu o aplicație nativă de Desktop (stil Electron)?** În Google Chrome, Brave sau Microsoft Edge, deschideți link-ul și apăsați pe pictograma **"Install GS-Trade-Bot"** din bara de adrese. Aplicația se va deschide într-o fereastră separată, cu iconiță proprie pe Desktop și Taskbar, fără să consume resurse de server.

---

## 🚀 Pasul 1: Configurare Port în Oracle Cloud (Ingress Rule)

Pentru ca serverul Oracle Cloud să accepte conexiuni externe pe portul `3000`, trebuie să deschideți portul în rețeaua OCI:

1. Autentificați-vă în consola **Oracle Cloud Infrastructure**.
2. Navigați la: **Networking** ➔ **Virtual Cloud Networks (VCN)**.
3. Faceți clic pe VCN-ul asociat instanței dvs.
4. În meniul din stânga, selectați **Security Lists** și faceți clic pe **Default Security List for...**.
5. Faceți clic pe butonul **Add Ingress Rules** și completați:
   - **Source Type**: `CIDR`
   - **Source CIDR**: `0.0.0.0/0`
   - **IP Protocol**: `TCP`
   - **Source Port Range**: *(lăsați gol)*
   - **Destination Port Range**: `3000`
   - **Description**: `GS Trading Bot Web & API Port`
6. Apăsați **Add Ingress Rules**.

---

## ⚡ Pasul 2: Instalare Automată (1-Click Installer)

Conectați-vă prin SSH la instanța Oracle Cloud Ubuntu Minimal aarch64:

```bash
ssh -i ~/.ssh/id_rsa ubuntu@<IP_PUBLIC_ORACLE>
```

Clonați proiectul pe server (sau copiați fișierele prin `git` / `scp` / `rsync`):

```bash
git clone <URL_REPOSITORIU> gs-tradebot
cd gs-tradebot
```

Rulați scriptul automat optimizat pentru Ubuntu Minimal aarch64:

```bash
sudo bash scripts/install-oci-arm64.sh
```

### Ce face automat acest script:
1. Detectează arhitectura **aarch64 / ARM64**.
2. Instalează dependențele de sistem (`build-essential`, `python3`, `curl`, `git`).
3. Instalează **Node.js 20 LTS** compilat nativ pentru arhitectura ARM64.
4. **Deblochează firewall-ul intern OCI**: Ubuntu Minimal pe Oracle Cloud vine din fabrică cu o regulă `iptables` care blochează traficul pe alte porturi decât 22. Scriptul introduce automat regula de deblocare a portului 3000 și o salvează persistent prin `netfilter-persistent`.
5. Compilează aplicația în producție (`dist/server.cjs` și bundle-ul Vite).
6. Configurează și activează un serviciu **systemd** (`gs-tradebot.service`) care repornește automat botul la crash sau la repornirea serverului.

---

## 🐳 Alternativă: Rulare cu Docker Compose (Opțional)

Dacă preferați rularea izolată în containere Docker:

```bash
# 1. Instalați Docker pe Ubuntu Minimal ARM64
sudo apt update && sudo apt install -y docker.io docker-compose-v2
sudo usermod -aG docker $USER

# 2. Deblocați portul 3000 în firewall-ul intern OCI
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3000 -j ACCEPT
sudo apt install -y netfilter-persistent && sudo netfilter-persistent save

# 3. Lansați containerul optimizat multi-arch (ARM64)
docker compose up -d --build
```

---

## 🛠️ Comenzi de Administrare pe Server

Pentru monitorizarea botului pe Oracle Cloud:

| Acțiune | Comandă systemd | Comandă Docker |
| :--- | :--- | :--- |
| **Verificare stare** | `sudo systemctl status gs-tradebot` | `docker ps` |
| **Loguri în timp real** | `sudo journalctl -u gs-tradebot -f` | `docker logs -f gs-tradebot` |
| **Repornire bot** | `sudo systemctl restart gs-tradebot` | `docker compose restart` |
| **Oprire bot** | `sudo systemctl stop gs-tradebot` | `docker compose down` |

---

## 🌐 Acces și Autentificare

După instalare, deschideți în orice browser:
```
http://<IP_PUBLIC_ORACLE>:3000
```
- Autonomia completă de 24/7 rulează independent pe server, chiar dacă închideți browserul sau laptopul.
- Puteți adăuga un domeniu și un certificat SSL gratuit (HTTPS) folosind Caddy sau Nginx cu Let's Encrypt dacă doriți conexiune securizată fără a tasta portul `:3000`.
