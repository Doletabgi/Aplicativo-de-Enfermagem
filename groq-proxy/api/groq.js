export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-device-id");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const { model, messages, prompt, temperature, max_tokens, maxTokens } = req.body || {};

  // Aceita tanto o formato { messages: [...] } (usado pelo app)
  // quanto { prompt: "..." } (formato simplificado), para compatibilidade.
  const finalMessages = Array.isArray(messages) && messages.length > 0
    ? messages
    : prompt
      ? [{ role: "user", content: prompt }]
      : null;

  if (!finalMessages) {
    return res.status(400).json({ error: "É necessário enviar 'messages' ou 'prompt'." });
  }

  const finalMaxTokens = max_tokens || maxTokens || 900;
  const finalTemperature = temperature ?? 0.3;

  // ───────────── 1ª tentativa: Groq ─────────────
  try {
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: model || "openai/gpt-oss-120b",
        messages: finalMessages,
        temperature: finalTemperature,
        max_tokens: finalMaxTokens,
      }),
    });

    if (groqRes.ok) {
      const data = await groqRes.json();
      const text = data.choices?.[0]?.message?.content || "";
      if (text.trim()) {
        return res.status(200).json({ text, provider: "groq" });
      }
      // Resposta vazia (ex: modelo gastou os tokens "pensando") -> cai pro Gemini
      console.warn("Groq retornou texto vazio, tentando Gemini como fallback.");
    } else {
      const errText = await groqRes.text();
      console.error("Erro Groq:", groqRes.status, errText);
      // Continua para o fallback do Gemini abaixo, seja qual for o erro
    }
  } catch (e) {
    console.error("Falha de rede ao chamar Groq:", e.message);
  }

  // ───────────── 2ª tentativa: Gemini (fallback) ─────────────
  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({ error: "IA temporariamente indisponível (Groq falhou e não há Gemini configurado)." });
  }

  try {
    // Converte o formato OpenAI-style (messages) para o formato do Gemini (contents)
    const geminiContents = finalMessages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: geminiContents,
          generationConfig: { temperature: finalTemperature, maxOutputTokens: finalMaxTokens },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("Erro Gemini:", geminiRes.status, errText);
      return res.status(503).json({ error: "IA temporariamente indisponível (Groq e Gemini falharam)." });
    }

    const data = await geminiRes.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return res.status(200).json({ text, provider: "gemini" });
  } catch (e) {
    console.error("Falha de rede ao chamar Gemini:", e.message);
    return res.status(503).json({ error: "IA temporariamente indisponível (Groq e Gemini falharam)." });
  }
}