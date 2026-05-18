const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getSystemPrompt } = require('../utils/agentPromptV3');
const { toolDeclarations, executeTool } = require('../utils/agentToolsV3');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const MODEL = 'gemma-4-31b-it';
const MAX_ITERATIONS = 4;
const SIGNAL_CLARIFICATION = 'CLARIFICATION_REQUEST';
const SIGNAL_PENDING_TXN = 'PENDING_TRANSACTION';

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

        // history is already trimmed by the caller (buildGenAIHistory)
        const chat = model.startChat({ history });

        // Gửi tin nhắn đầu tiên — luôn là userMessage
        let result = await chat.sendMessage(userMessage);

        let sessionPendingTxns = [];

        for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
            const response = result.response;
            const functionCalls = response.functionCalls();

            // ── Không có tool call → AI đã có câu trả lời cuối ────────────────
            if (!functionCalls || functionCalls.length === 0) {
                if (sessionPendingTxns.length > 0) {
                    return { type: 'PENDING_TRANSACTION', payload: sessionPendingTxns };
                }
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
                    sessionPendingTxns.push(observation.data);
                    // Báo lại cho AI rằng giao dịch đã được ghi nhận chờ xác nhận
                    toolResponseParts.push({
                        functionResponse: {
                            name: call.name,
                            response: { status: "SUCCESS", message: "Transaction staged for user confirmation. You can proceed with other operations or provide the final answer." },
                        }
                    });
                } else {
                    toolResponseParts.push({
                        functionResponse: {
                            name: call.name,
                            response: observation,
                        }
                    });
                }
            }

            // ── Gửi observations về cho AI → nhận ngay response tiếp theo ──────
            result = await chat.sendMessage(toolResponseParts);
        }

        // Kiểm tra response cuối sau khi for loop kết thúc
        const lastResponse = result.response;
        const lastCalls = lastResponse.functionCalls();
        if (!lastCalls || lastCalls.length === 0) {
            if (sessionPendingTxns.length > 0) {
                return { type: 'PENDING_TRANSACTION', payload: sessionPendingTxns };
            }
            return { type: 'FINAL_ANSWER', payload: lastResponse.text().trim() };
        }

        // AI vẫn muốn gọi thêm tool sau MAX_ITERATIONS → dừng an toàn
        if (sessionPendingTxns.length > 0) {
            return { type: 'PENDING_TRANSACTION', payload: sessionPendingTxns };
        }
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

const CONFIRM_KEYWORDS = /^(ok|đồng ý|xác nhận|có|oke|lưu|yes|confirm|uh|ừ|ờ|đúng rồi)\s*[.!]?$/i;
const CANCEL_KEYWORDS = /^(hủy|không|thôi|bỏ|cancel|no|ko)\s*[.!]?$/i;

const checkConfirmationIntent = async (message) => {
    const text = message.trim();
    if (CONFIRM_KEYWORDS.test(text)) return 'CONFIRM';
    if (CANCEL_KEYWORDS.test(text)) return 'CANCEL';
    return 'OTHER';
};

module.exports = { runAgentLoop, checkConfirmationIntent };
