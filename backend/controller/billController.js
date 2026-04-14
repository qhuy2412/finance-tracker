const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const EXTRACT_PROMPT = `
        You are a Vietnamese receipt/bill data extractor.
        Analyze this bill image and extract the following fields.
        Respond ONLY with a valid JSON object — no markdown, no explanation, no extra text.

        Required JSON format:
            {
                "amount": <final total as a plain integer in VND, e.g. 480000, or null if not found>,
                "date": <receipt date as "YYYY-MM-DD", or null if not found>,
                "note": <store or merchant name as a short string, or "" if not found>
            }

            Rules:
                - "amount" must be the FINAL total, not a subtotal or individual item price.
                - Look for labels: Tổng cộng, T.Cộng, Tiền mặt, Thanh toán, Grand Total, Total.
                - "date" must be the receipt date (not time). Convert DD/MM/YYYY to YYYY-MM-DD.
                - "note" should be the store/restaurant name, usually at the top of the receipt.
                - Skip generic labels like "HÓA ĐƠN THANH TOÁN".
                - If a field cannot be determined with confidence, use null (amount/date) or "" (note).`;

const extractBill = async (req, res) => {
    const { imageBase64, mimeType } = req.body;

    if (!imageBase64 || !mimeType) {
        return res.status(400).json({ message: 'imageBase64 and mimeType are required' });
    }

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(mimeType)) {
        return res.status(400).json({ message: 'Unsupported image type. Use JPEG, PNG, WebP, or GIF.' });
    }

    try {
        const response = await groq.chat.completions.create({
            model: 'meta-llama/llama-4-scout-17b-16e-instruct',
            messages: [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: EXTRACT_PROMPT },
                        {
                            type: 'image_url',
                            image_url: {
                                url: `data:${mimeType};base64,${imageBase64}`,
                            },
                        },
                    ],
                },
            ],
            max_tokens: 256,
            temperature: 0,
        });

        const raw = response.choices[0]?.message?.content?.replace(/```json|```/g, '').trim();

        let parsed;
        try {
            parsed = JSON.parse(raw);
        } catch {
            console.error('Groq returned non-JSON:', raw);
            return res.status(422).json({ message: 'Không thể phâna tích hóa đơn. Vui lòng thử ảnh khác.' });
        }

        const amount = typeof parsed.amount === 'number' && parsed.amount > 0
            ? Math.round(parsed.amount)
            : null;

        const dateStr = typeof parsed.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date)
            ? parsed.date
            : null;

        const note = typeof parsed.note === 'string' ? parsed.note.trim() : '';

        return res.json({ amount, date: dateStr, note });

    } catch (err) {
        console.error('extractBill error:', err);
        return res.status(500).json({ message: 'Lỗi nhận dạng hóa đơn. Vui lòng thử lại.' });
    }
};

module.exports = { extractBill };
