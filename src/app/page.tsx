/* Главная страница: форма URL + кнопки действий + блок результата */
"use client";

import { useState, useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export default function Home() {
  // Управление видимостью кнопки "Перевести"
  // Чтобы показать кнопку, измените значение на true
  const SHOW_TRANSLATE_BUTTON = true;

  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState<"about" | "thesis" | "telegram" | "translate" | "illustration" | null>(
    null,
  );
  const [result, setResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [processStatus, setProcessStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Загружаем тему из localStorage при монтировании и применяем сразу
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "dark" | "light" | null;
    const initialTheme = savedTheme || "dark";
    setTheme(initialTheme);
    if (initialTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  // Сохраняем тему в localStorage и применяем к документу при изменении
  useEffect(() => {
    localStorage.setItem("theme", theme);
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  // Функция для преобразования ошибок в дружественные сообщения
  const getFriendlyErrorMessage = (
    errorType: "parse" | "ai" | "translate" | "network" | "unknown",
    statusCode?: number,
    originalError?: string
  ): string => {
    switch (errorType) {
      case "parse":
        // Ошибки загрузки статьи (404, 500, таймаут и т.п.)
        if (statusCode === 404) {
          return "Не удалось загрузить статью по этой ссылке.";
        }
        if (statusCode === 500 || statusCode === 502 || statusCode === 503) {
          return "Не удалось загрузить статью по этой ссылке.";
        }
        if (statusCode === 408 || statusCode === 504) {
          return "Не удалось загрузить статью по этой ссылке.";
        }
        return "Не удалось загрузить статью по этой ссылке.";
      
      case "ai":
        if (statusCode === 401) {
          return "Ошибка аутентификации с AI сервисом. Проверьте настройки.";
        }
        if (statusCode === 429) {
          return "Превышен лимит запросов к AI сервису. Попробуйте позже.";
        }
        if (statusCode && (statusCode === 500 || statusCode >= 502)) {
          return "Временная ошибка AI сервиса. Попробуйте позже.";
        }
        return "Не удалось обработать статью с помощью AI. Попробуйте еще раз.";
      
      case "translate":
        if (statusCode === 401) {
          return "Ошибка аутентификации с сервисом перевода. Проверьте настройки.";
        }
        if (statusCode === 429) {
          return "Превышен лимит запросов к сервису перевода. Попробуйте позже.";
        }
        if (statusCode && (statusCode === 500 || statusCode >= 502)) {
          return "Временная ошибка сервиса перевода. Попробуйте позже.";
        }
        return "Не удалось перевести статью. Попробуйте еще раз.";
      
      case "network":
        return "Ошибка подключения к интернету. Проверьте соединение и попробуйте еще раз.";
      
      case "unknown":
      default:
        return "Произошла непредвиденная ошибка. Попробуйте еще раз.";
    }
  };

  const handleAction = async (nextMode: "about" | "thesis" | "telegram" | "translate" | "illustration") => {
    if (!url.trim()) {
      setResult("Пожалуйста, введите URL статьи.");
      setMode(null);
      setProcessStatus(null);
      setError(null);
      return;
    }

    setIsLoading(true);
    setMode(nextMode);
    setProcessStatus("Загружаю статью…");
    setError(null);
    setResult(null);

    try {
      // Сначала парсим статью
      const parseResponse = await fetch("/api/parse-article", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: url.trim() }),
      });

      if (!parseResponse.ok) {
        const errorMessage = getFriendlyErrorMessage("parse", parseResponse.status);
        setError(errorMessage);
        setResult(null);
        setIsLoading(false);
        setProcessStatus(null);
        return;
      }

      const parsedData = await parseResponse.json();

      // Проверяем наличие контента
      if (!parsedData.content) {
        setError("Не удалось загрузить статью по этой ссылке.");
        setResult(null);
        setIsLoading(false);
        setProcessStatus(null);
        return;
      }

      // Проверяем минимальную длину контента
      if (parsedData.content.trim().length < 50) {
        setError("Не удалось загрузить статью по этой ссылке.");
        setResult(null);
        setIsLoading(false);
        setProcessStatus(null);
        return;
      }

      // Если режим перевода, переводим контент
      if (nextMode === "translate") {
        setProcessStatus("Перевожу статью…");
        const translateResponse = await fetch("/api/translate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ content: parsedData.content }),
        });

        if (!translateResponse.ok) {
          const errorMessage = getFriendlyErrorMessage("translate", translateResponse.status);
          setError(errorMessage);
          setResult(null);
          setIsLoading(false);
          setProcessStatus(null);
          return;
        }

        const translateData = await translateResponse.json();
        setResult(translateData.translation || "Перевод не получен.");
        setProcessStatus(null);
        setError(null);
      } else {
        // Для режимов about, thesis, telegram, illustration вызываем AI-обработку
        const statusMessages = {
          about: "Анализирую статью…",
          thesis: "Формирую тезисы…",
          telegram: "Создаю пост для Telegram…",
          illustration: "Создаю иллюстрацию…"
        };
        setProcessStatus(statusMessages[nextMode]);
        const aiResponse = await fetch("/api/ai-process", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ 
            content: parsedData.content,
            mode: nextMode 
          }),
        });

        if (!aiResponse.ok) {
          const errorMessage = getFriendlyErrorMessage("ai", aiResponse.status);
          setError(errorMessage);
          setResult(null);
          setIsLoading(false);
          setProcessStatus(null);
          return;
        }

        const aiData = await aiResponse.json();
        
        if (!aiData.result || aiData.result.trim().length === 0) {
          setError("AI сервис вернул пустой результат. Попробуйте еще раз или выберите другую статью.");
          setResult(null);
          setIsLoading(false);
          setProcessStatus(null);
          return;
        }
        
        setResult(aiData.result);
        setProcessStatus(null);
        setError(null);
      }
    } catch (error) {
      console.error("Error in handleAction:", error);
      // Проверяем, является ли ошибка сетевой
      if (error instanceof TypeError && error.message.includes("fetch")) {
        setError(getFriendlyErrorMessage("network"));
      } else {
        setError(getFriendlyErrorMessage("unknown"));
      }
      setResult(null);
      setProcessStatus(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen dark:bg-slate-950 bg-slate-50 dark:text-slate-50 text-slate-900 flex items-center justify-center px-4 py-10">
      <main className="w-full max-w-3xl rounded-2xl dark:bg-slate-900/40 bg-white/80 dark:border-slate-800 border-slate-200 border shadow-xl dark:shadow-black/40 shadow-slate-900/20 backdrop-blur-md p-6 sm:p-8 space-y-8">
        <header className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-[0.25em] dark:text-sky-400/90 text-sky-600">
              референт‑переводчик
            </p>
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg dark:bg-slate-800/80 bg-slate-100 dark:border-slate-700 border-slate-300 dark:hover:bg-slate-700/90 hover:bg-slate-200 transition-colors"
              aria-label="Переключить тему"
            >
              {theme === "dark" ? (
                <svg
                  className="w-5 h-5 dark:text-slate-50 text-slate-900"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5 dark:text-slate-50 text-slate-900"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                  />
                </svg>
              )}
            </button>
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight dark:text-slate-50 text-slate-900">
            Кратко и по делу про любую англоязычную статью
          </h1>
          <p className="text-sm sm:text-base dark:text-slate-300 text-slate-600 max-w-xl">
            Вставьте ссылку на статью на английском языке, выберите действие —
            и получите выжимку, тезисы или пост для Telegram.
          </p>
        </header>

        <section className="space-y-4">
          <label className="block text-sm font-medium dark:text-slate-200 text-slate-700">
            URL статьи
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="url"
              placeholder="Введите URL статьи, например: https://example.com/article"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1 rounded-xl dark:border-slate-700 border-slate-300 dark:bg-slate-900/60 bg-white dark:text-slate-50 text-slate-900 px-3 py-2.5 text-sm dark:placeholder:text-slate-500 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition border"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={() => handleAction("about")}
              disabled={isLoading}
              title="Получить краткое описание статьи"
              className={`inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-medium transition border ${
                mode === "about"
                  ? "bg-sky-500 text-white border-sky-400 shadow-lg shadow-sky-500/30"
                  : "dark:bg-slate-800/80 bg-slate-100 dark:text-slate-50 text-slate-900 dark:border-slate-700 border-slate-300 dark:hover:bg-slate-700/90 hover:bg-slate-200"
              } ${isLoading ? "opacity-70 cursor-wait" : ""}`}
            >
              О чем статья?
            </button>
            <button
              type="button"
              onClick={() => handleAction("thesis")}
              disabled={isLoading}
              title="Сформировать тезисы статьи"
              className={`inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-medium transition border ${
                mode === "thesis"
                  ? "bg-sky-500 text-white border-sky-400 shadow-lg shadow-sky-500/30"
                  : "dark:bg-slate-800/80 bg-slate-100 dark:text-slate-50 text-slate-900 dark:border-slate-700 border-slate-300 dark:hover:bg-slate-700/90 hover:bg-slate-200"
              } ${isLoading ? "opacity-70 cursor-wait" : ""}`}
            >
              Тезисы
            </button>
            <button
              type="button"
              onClick={() => handleAction("telegram")}
              disabled={isLoading}
              title="Создать пост для Telegram на основе статьи"
              className={`inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-medium transition border ${
                mode === "telegram"
                  ? "bg-sky-500 text-white border-sky-400 shadow-lg shadow-sky-500/30"
                  : "dark:bg-slate-800/80 bg-slate-100 dark:text-slate-50 text-slate-900 dark:border-slate-700 border-slate-300 dark:hover:bg-slate-700/90 hover:bg-slate-200"
              } ${isLoading ? "opacity-70 cursor-wait" : ""}`}
            >
              Пост для Telegram
            </button>
            <button
              type="button"
              onClick={() => handleAction("illustration")}
              disabled={isLoading}
              title="Создать иллюстрацию на основе статьи"
              className={`inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-medium transition border ${
                mode === "illustration"
                  ? "bg-sky-500 text-white border-sky-400 shadow-lg shadow-sky-500/30"
                  : "dark:bg-slate-800/80 bg-slate-100 dark:text-slate-50 text-slate-900 dark:border-slate-700 border-slate-300 dark:hover:bg-slate-700/90 hover:bg-slate-200"
              } ${isLoading ? "opacity-70 cursor-wait" : ""}`}
            >
              Иллюстрация
            </button>
            {SHOW_TRANSLATE_BUTTON && (
              <button
                type="button"
                onClick={() => handleAction("translate")}
                disabled={isLoading}
                title="Перевести статью на русский язык"
                className={`inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-medium transition border ${
                  mode === "translate"
                    ? "bg-sky-500 text-white border-sky-400 shadow-lg shadow-sky-500/30"
                    : "dark:bg-slate-800/80 bg-slate-100 dark:text-slate-50 text-slate-900 dark:border-slate-700 border-slate-300 dark:hover:bg-slate-700/90 hover:bg-slate-200"
                } ${isLoading ? "opacity-70 cursor-wait" : ""}`}
              >
                Перевести
              </button>
            )}
          </div>
        </section>

        {processStatus && (
          <div className="rounded-xl dark:bg-sky-500/10 bg-sky-50 dark:border-sky-500/20 border-sky-200 border p-3 sm:p-4">
            <p className="text-sm dark:text-sky-400 text-sky-600 font-medium">
              {processStatus}
            </p>
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Ошибка</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <section className="rounded-xl dark:border-slate-800 border-slate-200 dark:bg-slate-950/40 bg-slate-50/80 border p-4 sm:p-5 min-h-[140px] space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold dark:text-slate-100 text-slate-900">
              Результат
            </h2>
            {isLoading && (
              <span className="text-xs dark:text-sky-400 text-sky-600 animate-pulse">
                Идет генерация…
              </span>
            )}
          </div>

          <div className="mt-1 text-sm leading-relaxed dark:text-slate-200 text-slate-700 whitespace-pre-wrap">
            {result ?? "Здесь появится результат обработки статьи."}
          </div>
        </section>

        <footer className="pt-1 text-[11px] dark:text-slate-500 text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>Сервис-помощник для работы с англоязычными текстами.</span>
          <span className="hidden sm:inline">·</span>
          <span>Обработка с помощью AI через OpenRouter.</span>
        </footer>
      </main>
    </div>
  );
}
