# Gemini AI Studio Telegram Bot

This Telegram bot allows you to interact with Gemini AI Studio directly through Telegram.

## How to Set Up

1. **Create a Cloudflare Worker:** Use `wrangler` to create a new worker on Cloudflare.

2. **Create a Telegram Bot:** Create a new bot using BotFather (https://t.me/BotFather). This will provide you with your bot token.

3. **Set the Bot Webhook:** Configure your bot's webhook using the following URL structure: `https://api.telegram.org/bot{bot_token}/setWebhook?url={worker_url_on_cloudflare}`. Replace `{bot_token}` with your bot token and `{worker_url_on_cloudflare}` with the URL of your Cloudflare worker (no need to include `https://`).

4. **Create a Gemini AI Studio API Key:** Generate a new API key in Gemini AI Studio (https://aistudio.google.com/app/apikey).

5. **Set Cloudflare Environment Variables:** Configure the following environment variables in your Cloudflare worker:

   - `TELEGRAM_ANUGGAHA_API_KEY`: Your Telegram bot token.
   - `GOOGLE_AI_API_KEY`: Your Gemini AI Studio API key.
   - `MY_TELEGRAM_USERNAME`: Your Telegram username (for security purposes; retrieve it by reading the payload using `console.log(payload)`).


## References

- Cloudflare Workers & JavaScript Modules: https://blog.cloudflare.com/workers-javascript-modules/
- Gemini AI Studio Text Quickstart: https://developers.generativeai.google/tutorials/text_quickstart
