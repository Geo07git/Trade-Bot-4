#!/usr/bin/env bash
# ==============================================================================
# GS Trading Bot - 1-Click Installer for Oracle Cloud Infrastructure (OCI)
# Target OS: Ubuntu Minimal 22.04 / 24.04 (aarch64 / ARM64 - Ampere A1)
# ==============================================================================

set -e

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${CYAN}================================================================${NC}"
echo -e "${CYAN}   GS TRADING BOT - ORACLE CLOUD (OCI) ARM64 AUTO-INSTALLER     ${NC}"
echo -e "${CYAN}================================================================${NC}"

# 1. Architecture Check
ARCH=$(uname -m)
echo -e "${YELLOW}[1/6] Verificare arhitectură sistem...${NC}"
echo -e "Arhitectură detectată: ${GREEN}${ARCH}${NC}"
if [ "$ARCH" != "aarch64" ] && [ "$ARCH" != "arm64" ]; then
    echo -e "${YELLOW}Notă: Serverul nu este aarch64 (${ARCH}), dar scriptul va continua instalarea compatibilă.${NC}"
fi

# 2. Privileges check
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Eroare: Vă rugăm rulați scriptul cu drepturi de root (ex: sudo bash scripts/install-oci-arm64.sh)${NC}"
    exit 1
fi

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo -e "Director proiect: ${GREEN}${APP_DIR}${NC}"

# 3. Update & Essential Tools
echo -e "\n${YELLOW}[2/6] Actualizare pachete Ubuntu Minimal & instalare unelte esențiale...${NC}"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y --no-install-recommends \
    curl \
    git \
    build-essential \
    python3 \
    iptables \
    iptables-persistent \
    netfilter-persistent \
    ca-certificates \
    lsb-release \
    gnupg

# 4. Node.js 20 LTS Setup for ARM64 / aarch64
echo -e "\n${YELLOW}[3/6] Instalare Node.js v20 LTS pentru arhitectura ${ARCH}...${NC}"
if ! command -v node &> /dev/null || [[ $(node -v) != v20* ]]; then
    mkdir -p /etc/apt/keyrings
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg --yes
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list
    apt-get update -y
    apt-get install -y nodejs
fi

echo -e "Node.js instalat: ${GREEN}$(node -v)${NC}"
echo -e "NPM instalat:     ${GREEN}$(npm -v)${NC}"

# 5. Oracle Cloud Specific Firewall Rules (Crucial for OCI!)
echo -e "\n${YELLOW}[4/6] Configurare firewall Oracle Cloud (iptables port 3000)...${NC}"
# Oracle Cloud Ubuntu Minimal has default REJECT rules in iptables
if iptables -C INPUT -p tcp --dport 3000 -j ACCEPT 2>/dev/null; then
    echo -e "Regula iptables pentru portul 3000 este deja activă."
else
    # Insert rule before the last REJECT rule
    iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3000 -j ACCEPT || iptables -A INPUT -p tcp --dport 3000 -j ACCEPT
    netfilter-persistent save || true
    echo -e "${GREEN}Portul 3000 a fost deschis în iptables.${NC}"
fi

# Also configure UFW if active
if command -v ufw &> /dev/null && ufw status | grep -q "Status: active"; then
    ufw allow 3000/tcp
    echo -e "${GREEN}Portul 3000 a fost autorizat în UFW.${NC}"
fi

# 6. Build Project
echo -e "\n${YELLOW}[5/6] Instalare dependințe npm & compilare producție...${NC}"
cd "$APP_DIR"
npm ci || npm install
npm run build

# 7. Setup Systemd Service for 24/7 Autostart
echo -e "\n${YELLOW}[6/6] Configurare serviciu de fundal 24/7 (systemd)...${NC}"

SERVICE_FILE="/etc/systemd/system/gs-tradebot.service"

cat << EOF > "$SERVICE_FILE"
[Unit]
Description=GS Trading Bot 24/7 Service (Autonomous Trading Engine)
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${APP_DIR}
ExecStart=$(which node) ${APP_DIR}/dist/server.cjs
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
Environment=NODE_ENV=production
Environment=PORT=3000

# Security and resource limits
LimitNOFILE=65536
KillMode=process

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable gs-tradebot.service
systemctl restart gs-tradebot.service

# Obtain public IP
PUBLIC_IP=$(curl -s https://api.ipify.org || curl -s ifconfig.me || echo "<IP-UL_SERVERULUI>")

echo -e "\n${GREEN}================================================================${NC}"
echo -e "${GREEN}   INSTALARE COMPLETĂ CU SUCCES PE ORACLE CLOUD ARM64!          ${NC}"
echo -e "${GREEN}================================================================${NC}"
echo -e "Aplicația rulează acum în fundal 24/7 ca serviciu de sistem."
echo -e "\nAcces interfață Matrix Terminal:"
echo -e "➡️  ${CYAN}http://${PUBLIC_IP}:3000${NC}\n"
echo -e "Comenzi utile de gestionare:"
echo -e "  • Stare serviciu:    ${YELLOW}systemctl status gs-tradebot${NC}"
echo -e "  • Loguri în timp real: ${YELLOW}journalctl -u gs-tradebot -f${NC}"
echo -e "  • Repornire bot:     ${YELLOW}systemctl restart gs-tradebot${NC}"
echo -e "  • Oprire bot:        ${YELLOW}systemctl stop gs-tradebot${NC}"
echo -e "\n${YELLOW}IMPORTANT PENTRU ORACLE CLOUD (OCI):${NC}"
echo -e "Nu uitați să adăugați o regulă de intrare (Ingress Rule) în panoul OCI:"
echo -e "  Virtual Cloud Network (VCN) -> Security Lists -> Default Security List -> Add Ingress Rule:"
echo -e "  - Source CIDR: 0.0.0.0/0"
echo -e "  - IP Protocol: TCP"
echo -e "  - Destination Port Range: 3000"
echo -e "${GREEN}================================================================${NC}"
