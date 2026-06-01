const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getSystemPrompt } = require('../utils/agentPromptV3');
const { toolDeclarations, executeTool } = require('../utils/agentToolsV3');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const MODEL = 'gemma-4-31b-it';
const MAX_ITERATIONS = 4;
const SIGNAL_CLARIFICATION = 'CLARIFICATION_REQUEST';
const SIGNAL_PENDING_TXN = 'PENDING_TRANSACTION';

/**
 * Run Agentic ReAct loop (Google GenAI SDK):
 *
 * Flow:
 *   1. sendMessage(userMessage)        → response may contain functionCalls
 *   2. Execute tools → gather observations
 *   3. sendMessage(toolResponseParts)  → next response
 *   4. Repeat from step 2 if there are more functionCalls
 *   5. When response has no functionCalls → it is a FINAL_ANSWER
 *
 * @param {string} userId       - User ID from JWT middleware
 * @param {string} userMessage  - Current user message
 * @param {Array}  history      - Chat history (already trimmed externally)
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
        }, { timeout: 15000 }); // 15 seconds network timeout

        // history is already trimmed by the caller (buildGenAIHistory)
        const chat = model.startChat({ history });

        // Send first message — always the userMessage
        let result = await chat.sendMessage(userMessage);

        let sessionPendingTxns = [];

        for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
            const response = result.response;
            const functionCalls = response.functionCalls();

            // ── No tool calls → AI has the final answer ────────────────
            if (!functionCalls || functionCalls.length === 0) {
                if (sessionPendingTxns.length > 0) {
                    return { type: 'PENDING_TRANSACTION', payload: sessionPendingTxns };
                }
                return { type: 'FINAL_ANSWER', payload: response.text().trim() };
            }

            // ── Execute all tools requested in this turn ───────────────
            const toolResponseParts = [];

            for (const call of functionCalls) {
                const observation = await executeTool(call.name, call.args, userId);

                // Catch special signals → interrupt loop immediately, do not call AI further
                if (observation?.action === SIGNAL_CLARIFICATION) {
                    return { type: 'CLARIFICATION', payload: observation.data };
                }
                if (observation?.action === SIGNAL_PENDING_TXN) {
                    sessionPendingTxns.push(observation.data);
                    // Report back to AI that transaction is staged and waiting for confirmation
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

            // ── Send observations back to AI → get the next response immediately ──────
            result = await chat.sendMessage(toolResponseParts);
        }

        // Check final response after the for loop ends
        const lastResponse = result.response;
        const lastCalls = lastResponse.functionCalls();
        if (!lastCalls || lastCalls.length === 0) {
            if (sessionPendingTxns.length > 0) {
                return { type: 'PENDING_TRANSACTION', payload: sessionPendingTxns };
            }
            return { type: 'FINAL_ANSWER', payload: lastResponse.text().trim() };
        }

        // AI still wants to call tools after MAX_ITERATIONS → safe exit
        if (sessionPendingTxns.length > 0) {
            return { type: 'PENDING_TRANSACTION', payload: sessionPendingTxns };
        }
        return {
            type: 'ERROR',
            payload: 'Yêu cầu của bạn hơi phức tạp, mình chưa xử lý được ngay lúc này. Bạn thử diễn đạt lại nhé!'
        };

    } catch (err) {
        // Catch all unexpected errors (API timeout, network, parse error...)
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
