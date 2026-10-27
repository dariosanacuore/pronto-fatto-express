
import transporter from "../config/mailer.js";

export const sendContactMessage = async (req, res) => {
    const { nome, email, oggetto, messaggio } = req.body;

    if (!nome || !email || !oggetto || !messaggio) {
        return res.status(400).json({
            message: "Compila tutti i campi."
        });
    }

    try {
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_USER,
            replyTo: email,
            subject: `Contatti ProntoFatto: ${oggetto}`,
            text: `
Nome: ${nome}
Email: ${email}

Messaggio:
${messaggio}
            `
        });

        return res.status(200).json({
            message: "Messaggio inviato correttamente!"
        });
    } catch (error) {
        console.error("Errore invio contatto:", error);

        return res.status(500).json({
            message: "Errore durante l'invio. Riprova più tardi."
        });
    }
};
