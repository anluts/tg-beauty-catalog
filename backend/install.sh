#!/bin/bash
# =============================================================================
# install.sh — установка бота на чистый Beget VPS (Ubuntu 22.04)
# Запускать от root: bash install.sh
# =============================================================================

set -e  # остановить при любой ошибке

echo "======================================"
echo " Beauty Bot — установка на VPS"
echo "======================================"

# --- 1. Обновляем пакеты -------------------------------------------------------
echo ""
echo "[ 1/6 ] Обновляем систему..."
apt-get update -qq && apt-get upgrade -y -qq

# --- 2. Устанавливаем Node.js 20 LTS -------------------------------------------
echo ""
echo "[ 2/6 ] Устанавливаем Node.js 20..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
echo "    Node: $(node -v)"
echo "    NPM:  $(npm -v)"

# --- 3. Устанавливаем PM2 -------------------------------------------------------
echo ""
echo "[ 3/6 ] Устанавливаем PM2..."
npm install -g pm2 --quiet

# --- 4. Создаём папку для логов ------------------------------------------------
echo ""
echo "[ 4/6 ] Создаём папки..."
mkdir -p /root/logs
mkdir -p /root/tg-beauty-catalog

# --- 5. Клонируем репозиторий --------------------------------------------------
echo ""
echo "[ 5/6 ] Клонируем проект с GitHub..."
if [ -d "/root/tg-beauty-catalog/.git" ]; then
  echo "    Репозиторий уже есть — обновляем..."
  cd /root/tg-beauty-catalog && git pull
else
  git clone https://github.com/anluts/tg-beauty-catalog.git /root/tg-beauty-catalog
fi

# --- 6. Устанавливаем зависимости ----------------------------------------------
echo ""
echo "[ 6/6 ] Устанавливаем зависимости..."
cd /root/tg-beauty-catalog/backend
npm install --omit=dev

echo ""
echo "======================================"
echo " Установка завершена!"
echo ""
echo " СЛЕДУЮЩИЙ ШАГ:"
echo " Создай файл с переменными окружения:"
echo "   nano /root/tg-beauty-catalog/backend/.env"
echo ""
echo " Затем запусти бота:"
echo "   cd /root/tg-beauty-catalog/backend"
echo "   pm2 start ecosystem.config.js"
echo "   pm2 save"
echo "   pm2 startup"
echo "======================================"
