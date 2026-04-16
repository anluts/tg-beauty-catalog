/**
 * PM2 Ecosystem Config — конфиг процессов для Beget VPS
 *
 * Запуск:  pm2 start ecosystem.config.js
 * Стоп:    pm2 stop beauty-bot
 * Логи:    pm2 logs beauty-bot
 * Статус:  pm2 status
 */

module.exports = {
  apps: [
    {
      name: 'beauty-bot',
      script: './bot/platform.js',
      cwd: '/root/tg-beauty-catalog/backend',

      // Автоперезапуск при падении
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',

      // Задержка перезапуска при крэше (экспоненциальная)
      restart_delay: 5000,
      max_restarts: 10,

      // Env переменные берём из .env файла
      // (dotenv загружается внутри platform.js)
      env: {
        NODE_ENV: 'production',
      },

      // Логи
      out_file: '/root/logs/beauty-bot.out.log',
      error_file: '/root/logs/beauty-bot.err.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
    },
  ],
};
