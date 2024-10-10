import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from "@google/generative-ai"

// https://core.telegram.org/bots/api#sendmessage length 1-4096
const MAX_TELEGRAM_MESSAGE_LENGTH = 3800

// (free) requests per minute: gemini-1.5-flash:15, gemini-1.5-pro: 2
// https://ai.google.dev/pricing
const GEMINI_REQUEST_LIMIT_PER_MINUTE = 12

let currentRequestCount = 0
let lastRateLimitResetTime = Date.now()

const geminiSafetySettings = [
  /* The model still refuses to respond even when we set block none here */
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
]

export async function sendTelegramMessage(text, chatId, env, useHtmlFormatting = true, maxChunkLength = MAX_TELEGRAM_MESSAGE_LENGTH) {
  const messageChunks = []
  let currentChunk = ""
  const telegramApiUrl = `https://api.telegram.org/bot${env.TELEGRAM_ANUGGAHA_API_KEY}/sendMessage`

  const words = text.split(" ")
  for (const word of words) {
    if (currentChunk.length + word.length + 1 > maxChunkLength) {
      messageChunks.push(currentChunk.trim())
      currentChunk = ""
    }
    currentChunk += (currentChunk ? " " : "") + word
  }

  if (currentChunk.length > 0) {
    messageChunks.push(currentChunk.trim())
  }

  for (const chunk of messageChunks) {
    let requestBody
    if (useHtmlFormatting) {
      requestBody = {
        chat_id: chatId,
        text: chunk,
        parse_mode: "HTML", // may cause error if the response is not properly formatted
      }
    } else {
      requestBody = { chat_id: chatId, text: chunk }
    }

    try {
      const response = await fetch(telegramApiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`Failed to send message: ${errorText}`)
      }
    } catch (error) {
      console.error(`Error sending message: ${error.message}`)
    }
  }
}

export async function askGeminiAI(selectedAIModel, env, chatId, userMessage) {
  const currentTime = Date.now()
  if (currentTime - lastRateLimitResetTime >= 60000) {
    currentRequestCount = 0
    lastRateLimitResetTime = currentTime
  }

  // Check if the rate limit has been exceeded

  // Check if the rate limit has been exceeded
  let requestLimit = GEMINI_REQUEST_LIMIT_PER_MINUTE
  if (selectedAIModel.includes("-pro-")) {
    requestLimit = 2
  }

  if (currentRequestCount >= requestLimit) {
    const errorMessage = `Rate limit exceeded ${requestLimit}/minute. Please try again later.`
    console.error(errorMessage)
    await sendTelegramMessage(errorMessage, chatId, env, false)
    return
  }

  currentRequestCount++

  const genAI = new GoogleGenerativeAI(env.GOOGLE_AI_API_KEY)
  const model = genAI.getGenerativeModel({ model: selectedAIModel, safetySettings: geminiSafetySettings })

  if (userMessage === "model") {
    const modelListResponse = await fetchGeminiModelList(env)
    const formattedModelList = parseModelList(modelListResponse)

    return await sendTelegramMessage(removeNonAllowedHtmlTags(formattedModelList), chatId, env, false)
  }

  const geminiPrompt = userMessage + "\n\nYou must always format your response with HTML syntax and use only these HTML tags: <b>,<i>,<u>,<s>,<a>,<code>,<pre>,<blockquote>. Do not use any other HTML tags. Do not respond with the whole HTML page code, only the content."

  try {
    const result = await model.generateContent(geminiPrompt)
    const aiResponse = result.response.text() + "\n\nAnswered with: " + selectedAIModel + "\nSend 'model' to list available models."
    if (aiResponse && aiResponse.length > 1) {
      await sendTelegramMessage(removeNonAllowedHtmlTags(aiResponse), chatId, env)
    }
  } catch (error) {
    console.error(`Error in askGeminiAI: ${error.message}`)
    await sendTelegramMessage(`An error occurred: ${error.message}`, chatId, env, false)
  }
}

async function fetchGeminiModelList(env) {
  // https://ai.google.dev/api/models#models_list-SHELL
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/?key=${env.GOOGLE_AI_API_KEY}`)
  const data = await response.json()
  return data
}

function parseModelList(data) {
  let output = ""
  if (data.models) {
    for (const model of data.models) {
      const modelName = model.name.split("/").pop()
      output += `Model name: ${model.displayName}\n`
      output += `<b>Model code:</b><code>${modelName}</code>\n`
      output += `• Model descriptions: ${model.description}\n`
      output += `• Input Token Limit: ${model.inputTokenLimit}\n`
      output += `• Output Token Limit: ${model.outputTokenLimit}\n--------\n`
    }
    return "You can set a new model for the bot by sending: model model_code\n--------\n" + output.trim()
  }
  return "Error occurred while trying to fetch models"
}

function removeNonAllowedHtmlTags(response) {
  // List of allowed tags
  const allowedTags = ["b", "i", "u", "s", "a", "code", "pre", "blockquote"]

  // Create a regular expression to match all HTML tags
  const tagRegex = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi

  // Replace function
  return response.replace(tagRegex, (match, tagName) => {
    // Convert tag name to lowercase for case-insensitive comparison
    tagName = tagName.toLowerCase()

    // If the tag is in the allowed list, keep it; otherwise, remove it
    if (allowedTags.includes(tagName)) {
      return match
    } else {
      return ""
    }
  })
}
