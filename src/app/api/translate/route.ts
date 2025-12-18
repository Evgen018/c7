import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { content, targetLanguage = "ru" } = await request.json();

    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    if (targetLanguage !== "ru" && targetLanguage !== "me") {
      return NextResponse.json(
        { error: "Invalid target language. Must be 'ru' or 'me'" },
        { status: 400 }
      );
    }

    // Ограничиваем длину контента для перевода (примерно 8000 токенов)
    const maxLength = 30000; // примерно 8000 токенов
    const contentToTranslate = content.length > maxLength 
      ? content.substring(0, maxLength) + "\n\n[... текст обрезан ...]"
      : content;

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.error("OPENROUTER_API_KEY is not set in environment variables");
      return NextResponse.json(
        { 
          error: "OpenRouter API key is not configured",
          details: "Please set OPENROUTER_API_KEY in your environment variables"
        },
        { status: 500 }
      );
    }

    // Вызываем OpenRouter API для перевода
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "Article Translator",
      },
      body: JSON.stringify({
        model: "mistralai/devstral-2512:free",
        messages: [
          {
            role: "system",
            content: targetLanguage === "ru" 
              ? "Ты профессиональный переводчик. Переведи следующий английский текст на русский язык, сохраняя стиль и структуру оригинала. Переведи только текст, без дополнительных комментариев."
              : "Ti si profesionalni prevodilac. Prevedi sljedeći tekst sa engleskog jezika na crnogorski jezik, zadržavajući stil i strukturu originala. Prevedi samo tekst, bez dodatnih komentara.",
          },
          {
            role: "user",
            content: targetLanguage === "ru"
              ? `Переведи на русский язык следующий текст:\n\n${contentToTranslate}`
              : `Prevedi na crnogorski jezik sljedeći tekst:\n\n${contentToTranslate}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }
      console.error("OpenRouter API error:", {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
      });
      return NextResponse.json(
        { 
          error: `Translation failed: ${response.statusText}`,
          details: errorData.message || errorText,
          status: response.status
        },
        { status: 500 }
      );
    }

    const data = await response.json();

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error("Invalid response structure:", JSON.stringify(data, null, 2));
      return NextResponse.json(
        { 
          error: "Invalid response from translation service",
          details: "Response structure is not as expected"
        },
        { status: 500 }
      );
    }

    const translatedText = data.choices[0].message.content;

    if (!translatedText) {
      console.error("Empty translation received");
      return NextResponse.json(
        { 
          error: "Empty translation received",
          details: "The translation service returned an empty response"
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      translation: translatedText,
    });
  } catch (error) {
    console.error("Error translating:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    return NextResponse.json(
      { 
        error: "Failed to translate",
        details: errorMessage,
        stack: process.env.NODE_ENV === "development" ? errorStack : undefined
      },
      { status: 500 }
    );
  }
}

