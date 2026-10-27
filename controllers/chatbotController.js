
export async function chatWithAI(req, res) {
    try {
        const { message } = req.body;

        if (!message || typeof message !== "string" || !message.trim()) {
            return res.status(400).json({
                message: "Scrivi un messaggio."
            });
        }

        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return res.status(500).json({
                message: "Chiave API Gemini mancante."
            });
        }

        console.log("Invio richiesta REST a Gemini...");

        const response = await fetch(
            "https://generativelanguage.googleapis.com/v1beta/interactions",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": apiKey
                },
                body: JSON.stringify({
                    model: "gemini-3.5-flash-lite",
                    input: `
                        Sei l'assistente virtuale di ProntoFatto,
                        un marketplace di annunci.
                        Rispondi in italiano, in modo semplice e cordiale.
                        Non inventare annunci o prezzi.

                        Messaggio dell'utente: ${message.trim()}
                    `
                }),
                signal: AbortSignal.timeout(30000)
            }
        );

        const data = await response.json();

        console.log("Stato HTTP Gemini:", response.status);

        if (!response.ok) {
            console.error("Errore API Gemini:", data);

            return res.status(502).json({
                message: data.error?.message || "Errore API Gemini."
            });
        }

        const reply =
            data.steps
                ?.filter(step => step.type === "model_output")
                .flatMap(step => step.content || [])
                .filter(item => item.type === "text")
                .map(item => item.text)
                .join("\n") || "";

        if (!reply) {
            return res.status(502).json({
                message: "Gemini non ha restituito una risposta testuale."
            });
        }

        console.log("Risposta Gemini ricevuta:", reply);

        return res.json({ reply });

    } catch (error) {
        console.error("Errore chatbot:", error.name, error.message);

        return res.status(502).json({
            message: error.name === "TimeoutError"
                ? "Gemini non ha risposto entro 30 secondi."
                : "Impossibile contattare Gemini."
        });
    }
}
