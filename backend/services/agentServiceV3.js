const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getSystemPrompt } = require('../utils/agentPromptV3');
const { toolDeclarations, executeTool } = require('../utils/agentToolsV3');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const MAX_ITERATIONS = 4;
const SIGNAL_CLARIFICATION = 'CLARIFICATION_REQUEST';
const SIGNAL_PENDING_TXN   = 'PENDING_TRANSACTION';

/**
 * Chạy vòng lặp Agentic ReAct (Fix #1 & #5):
 *
 * Luồng đúng của Google GenAI function calling:
 *   1. sendMessage(userMessage)        → response có thể có functionCalls
 *   2. Thực thi tools → thu thập observations
 *   3. sendMessage(toolResponseParts)  → response tiếp theo (đây chính là "vòng lặp")
 *   4. Lặp lại từ bước 2 nếu có thêm functionCalls
 *   5. Khi response không còn functionCalls → đó là FINAL_ANSWER
 *
 * Mỗi lần `sendMessage` đều trả về response ngay — không cần gửi thêm
 * một message "thừa" để trigger AI tiếp tục như thiết kế cũ.
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
            model: 'gemma-3-27b-it',
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
            // TODO: remove in production — giúp debug khi test
            // console.log(`[AgentV3] iteration ${iteration + 1}/${MAX_ITERATIONS}`);

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

        // Kiểm tra response cuối sau khi for loop kết thúc (edge case: AI cần đúng MAX_ITERATIONS lượt)
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
        // để Controller luôn nhận được object thay vì unhandled rejection
        return {
            type: 'ERROR',
            payload: 'Có lỗi kết nối với AI. Vui lòng thử lại sau.'
        };
    }
};

module.exports = { runAgentLoop };
