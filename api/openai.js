// api/openai.js

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido. Usa POST." });
  }

  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "Falta el prompt en la solicitud." });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "No API key set" });
  }

  try {
    const respuesta = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7
      })
    });

    if (!respuesta.ok) {
      throw new Error(`Error en OpenAI: ${respuesta.status} - ${respuesta.statusText}`);
    }

    const data = await respuesta.json();
    res.status(200).json({ respuesta: data.choices[0].message.content });
  } catch (error) {
    console.error("Error en /api/openai:", error);
    res.status(500).json({ error: `Error al procesar la solicitud: ${error.message}` });
  }
}