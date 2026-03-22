#!/usr/bin/env bash
set -euo pipefail

TURN_USER="${TURN_USER:-mega_admin}"
TURN_PASS="${TURN_PASS:-mega_password_2026}"
TURN_REALM="${TURN_REALM:-megaconvert.business}"
PUBLIC_IP="${PUBLIC_IP:-$(curl -4 -fsS https://api.ipify.org)}"

echo "[MegaConvert] Installing Coturn..."
sudo apt-get update
sudo apt-get install coturn -y

echo "[MegaConvert] Stopping Coturn before reconfiguration..."
sudo systemctl stop coturn || true

echo "[MegaConvert] Writing /etc/turnserver.conf..."
sudo tee /etc/turnserver.conf > /dev/null <<EOF
listening-port=3478
finger-print
lt-cred-mech
user=${TURN_USER}:${TURN_PASS}
realm=${TURN_REALM}
log-file=/var/log/turnserver.log
simple-log
external-ip=${PUBLIC_IP}
min-port=49152
max-port=65535
EOF

echo "[MegaConvert] Enabling Coturn autostart..."
if grep -q '^#TURNSERVER_ENABLED=1' /etc/default/coturn; then
  sudo sed -i 's/^#TURNSERVER_ENABLED=1/TURNSERVER_ENABLED=1/' /etc/default/coturn
elif grep -q '^TURNSERVER_ENABLED=0' /etc/default/coturn; then
  sudo sed -i 's/^TURNSERVER_ENABLED=0/TURNSERVER_ENABLED=1/' /etc/default/coturn
elif ! grep -q '^TURNSERVER_ENABLED=1' /etc/default/coturn; then
  echo 'TURNSERVER_ENABLED=1' | sudo tee -a /etc/default/coturn > /dev/null
fi

echo "[MegaConvert] Opening firewall ports..."
sudo ufw allow 3478/tcp
sudo ufw allow 3478/udp
sudo ufw allow 49152:65535/udp

echo "[MegaConvert] Restarting Coturn..."
sudo systemctl restart coturn
sudo systemctl enable coturn

echo "[MegaConvert] Coturn configured successfully."
echo "[MegaConvert] Public IP: ${PUBLIC_IP}"
