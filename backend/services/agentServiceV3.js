const { GoogleGenerativeAI } = require('@google/generative-ai');
const Groq = require('groq-sdk');
const { getSystemPrompt } = require('../utils/agentPromptV3');
const { toolDeclarations, executeTool } = require('../utils/agentToolsV3');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MODEL = 'gemma-4-31b-it'; // Đổi sang Gemini 2.5 Flash vì Gemma 4 hay bị dính lỗi tự "lẩm bẩm" (Chain of Thought) tiếng Anh.
const MAX_ITERATIONS = 4;
const SIGNAL_CLARIFICATION = 'CLARIFICATION_REQUEST';
const SIGNAL_PENDING_TXN   = 'PENDING_TRANSACTION';

/**
 * Chạy vòng lặp Agentic ReAct (Google GenAI SDK):
 *
 * Luồng:
 *   1. sendMessage(userMessage)        → response có thể có functionCalls
 *   2. Thực thi tools → thu thập observations
 *   3. sendMessage(toolResponseParts)  → response tiếp theo
 *   4. Lặp lại từ bước 2 nếu có thêm functionCalls
 *   5. Khi response không còn functionCalls → đó là FINAL_ANSWER
 *
 * @param {string} userId       - ID người dùng từ JWT middleware
 * @param {string} userMessage  - Tin nhắn hiện tại của người dùng
 * @param {Array}  history      - Lịch sử chat (đã được cắt tỉa bên ngoài)
 * @returns {Promise<{type: string, payload: any}>}
 */
const runAgentLoop = async (userId, userMessage, history = []) => {
    try {
        const today = new Date().toLocaleDateString('vi-VN', {
            year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
        });

        const model = genAI.getGenerativeModel({
            model: MODEL,
            tools: [{ functionDeclarations: toolDeclarations }],
            toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
            systemInstruction: getSystemPrompt(userId, today),
        });

        // Cắt tỉa lịch sử: giữ 7 lượt gần nhất (14 messages) để tiết kiệm token
        const trimmedHistory = history.slice(-14);
        const chat = model.startChat({ history: trimmedHistory });

        // Gửi tin nhắn đầu tiên — luôn là userMessage
        let result = await chat.sendMessage(userMessage);

        for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
            const response = result.response;
            const functionCalls = response.functionCalls();

            // ── Không có tool call → AI đã có câu trả lời cuối ────────────────
            if (!functionCalls || functionCalls.length === 0) {
                return { type: 'FINAL_ANSWER', payload: response.text().trim() };
            }

            // ── Thực thi tất cả tool được yêu cầu trong lượt này ───────────────
            const toolResponseParts = [];

            for (const call of functionCalls) {
                const observation = await executeTool(call.name, call.args, userId);

                // Bắt tín hiệu đặc biệt → ngắt vòng lặp ngay, không gọi AI thêm
                if (observation?.action === SIGNAL_CLARIFICATION) {
                    return { type: 'CLARIFICATION', payload: observation.data };
                }
                if (observation?.action === SIGNAL_PENDING_TXN) {
                    return { type: 'PENDING_TRANSACTION', payload: observation.data };
                }

                toolResponseParts.push({
                    functionResponse: {
                        name: call.name,
                        response: observation,
                    }
                });
            }

            // ── Gửi observations về cho AI → nhận ngay response tiếp theo ──────
            result = await chat.sendMessage(toolResponseParts);
        }

        // Kiểm tra response cuối sau khi for loop kết thúc
        const lastResponse = result.response;
        const lastCalls = lastResponse.functionCalls();
        if (!lastCalls || lastCalls.length === 0) {
            return { type: 'FINAL_ANSWER', payload: lastResponse.text().trim() };
        }

        // AI vẫn muốn gọi thêm tool sau MAX_ITERATIONS → dừng an toàn
        return {
            type: 'ERROR',
            payload: 'Yêu cầu của bạn hơi phức tạp, mình chưa xử lý được ngay lúc này. Bạn thử diễn đạt lại nhé!'
        };

    } catch (err) {
        // Bắt mọi lỗi ngoài dự kiến (API timeout, network, parse error...)
        console.error('[AgentV3] Error:', err);
        return {
            type: 'ERROR',
            payload: 'Có lỗi kết nối với AI. Vui lòng thử lại sau.'
        };
    }
};

const checkConfirmationIntent = async (userMessage) => {
    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: "Bạn là trợ lý phân loại ý định người dùng. Người dùng vừa được hỏi xác nhận có muốn tạo giao dịch không.\nNhiệm vụ của bạn là phân tích câu trả lời của người dùng:\n- Nếu người dùng ĐỒNG Ý (ví dụ: ok, tạo đi, duyệt, yes, ừ, chuẩn rồi, đúng rồi, lưu đi, dạ đồng ý...): Trả về ĐÚNG 1 từ \"CONFIRM\".\n- Nếu người dùng TỪ CHỐI hoặc HỦY (ví dụ: thôi, hủy, cancel, khoan, đừng tạo, sai rồi...): Trả về ĐÚNG 1 từ \"CANCEL\".\n- Nếu người dùng nói chuyện khác hoặc không rõ ràng: Trả về ĐÚNG 1 từ \"UNKNOWN\".\nChỉ trả về 1 trong 3 từ trên, không giải thích gì thêm."
                },
                {
                    role: "user",
                    content: userMessage
                }
            ],
            model: "llama3-8b-8192",
            temperature: 0,
            max_tokens: 10,
        });

        const text = chatCompletion.choices[0]?.message?.content?.trim().toUpperCase() || '';
        if (text.includes('CONFIRM')) return 'CONFIRM';
        if (text.includes('CANCEL')) return 'CANCEL';
        return 'UNKNOWN';
    } catch (err) {
        console.error('[checkConfirmationIntent] Groq Error:', err);
        return 'UNKNOWN';
    }
};

module.exports = { runAgentLoop, checkConfirmationIntent };
