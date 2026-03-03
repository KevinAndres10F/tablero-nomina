#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/tablero-nomina"
BACKEND_DIR="$APP_DIR/backend"
REPO_URL="${1:-}"
BRANCH="${2:-main}"

if [[ -z "$REPO_URL" ]]; then
  echo "Uso: $0 <repo_url> [branch]"
  echo "Ejemplo: $0 git@github.com:KevinAndres10F/tablero-nomina.git main"
  exit 1
fi

sudo apt update
sudo apt install -y python3 python3-venv python3-pip nginx

if [[ ! -d "$APP_DIR/.git" ]]; then
  sudo mkdir -p "$APP_DIR"
  sudo chown -R "$USER":"$USER" "$APP_DIR"
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
else
  git -C "$APP_DIR" fetch origin "$BRANCH"
  git -C "$APP_DIR" checkout "$BRANCH"
  git -C "$APP_DIR" pull --ff-only origin "$BRANCH"
fi

cd "$BACKEND_DIR"
python3 -m venv .venv
. .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Se creó backend/.env desde .env.example. Completa credenciales antes de iniciar."
fi

sudo cp deploy/hetzner/kapiroll-api.service /etc/systemd/system/kapiroll-api.service
sudo cp deploy/hetzner/kapiroll-api.nginx.conf /etc/nginx/sites-available/kapiroll-api
sudo ln -sf /etc/nginx/sites-available/kapiroll-api /etc/nginx/sites-enabled/kapiroll-api
sudo rm -f /etc/nginx/sites-enabled/default

sudo systemctl daemon-reload
sudo systemctl enable kapiroll-api
sudo systemctl restart kapiroll-api

sudo nginx -t
sudo systemctl reload nginx

echo "Despliegue base completado."
echo "Prueba salud local: curl http://127.0.0.1:8000/api/health"
echo "Prueba por dominio: curl http://api.tu-dominio.com/api/health"
