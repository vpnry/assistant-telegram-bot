import { askGeminiAI, sendTelegramMessage } from "./functions"

// let aiModel = "gemini-1.5-pro-latest"
let aiModel = "gemini-1.5-flash-latest"

/**
 * Request limit:
 * https://ai.google.dev/pricing
 * The pro-exp... models are much better than the other models
 */

export default {
  async fetch(request, env, context) {
    // context.waitUntil does not block the exe flow
    // and it will run later

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 })
    }
    try {
      const payload = await request.json()
      // console.log(payload)
      if ("message" in payload) {
        let isConfiguredUser = payload.message.from.username
        if (isConfiguredUser !== env.MY_TELEGRAM_USERNAME) {
          return new Response("OK")
        }
        const chatId = payload.message.chat.id
        let fromUsername = payload.message.from.username
        const userMessage = payload.message.text.trim()

        // list and set new model from telegram app
        if (userMessage.toLowerCase().trim().startsWith("model")) {
          let aiResponse = `Current AI model: ${aiModel}\n\n`
          if (userMessage.toLowerCase().trim() === "model") {
            context.waitUntil(askGeminiAI(aiModel, env, chatId, userMessage))
            return new Response("OK")
          }

          aiModel = userMessage.replace("model", "").trim()
          aiResponse += `Successfully set to the new model: ${aiModel}`
          context.waitUntil(sendTelegramMessage(aiResponse, chatId, env))
          return new Response("OK")
        }
        // handle user prompt
        context.waitUntil(askGeminiAI(aiModel, env, chatId, userMessage))
        return new Response("OK")
      } else {
        return new Response("OK")
      }
    } catch (error) {
      console.error(`Error in fetch: ${error.message}`)
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    }
  },
}
