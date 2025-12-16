import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { content } = await request.json();

    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenRouter API key is not configured" },
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
            content: "Ты профессиональный переводчик. Переведи следующий английский текст на русский язык, сохраняя стиль и структуру оригинала. Переведи только текст, без дополнительных комментариев.",
          },
          {
            role: "user",
            content: `Переведи на русский язык следующий текст:\n\n${content}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter API error:", errorText);
      return NextResponse.json(
        { error: `Translation failed: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      return NextResponse.json(
        { error: "Invalid response from translation service" },
        { status: 500 }
      );
    }

    const translatedText = data.choices[0].message.content;

    return NextResponse.json({
      translation: translatedText,
    });
  } catch (error) {
    console.error("Error translating:", error);
    return NextResponse.json(
      { error: "Failed to translate", details: String(error) },
      { status: 500 }
    );
  }
}

