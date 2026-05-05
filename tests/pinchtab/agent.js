const Groq = require('groq-sdk');
const config = require('./config');
const helpers = require('./helpers');
const { reportResult } = require('./reporter');

const groq = new Groq({ apiKey: config.GROQ_API_KEY });

// Lược bớt dữ liệu snapshot để tiết kiệm token và giúp AI tập trung
function simplifySnapshot(snapshot) {
    if (!snapshot || !snapshot.nodes) return [];
    return snapshot.nodes.filter(n => 
        n.role === 'button' || 
        n.role === 'link' || 
        n.role === 'textbox' || 
        n.role === 'heading' ||
        n.role === 'alert' ||
        (n.name && n.name.trim() !== '')
    ).map(n => ({
        ref: n.ref,
        role: n.role,
        name: n.name,
        value: n.value
    }));
}

class TestAgent {
    constructor() {
        this.testCount = 1;
    }

    async run(testCase) {
        console.log(`\n========================================`);
        console.log(`🤖 [AI Agent] Đang xử lý TC: ${testCase.id}`);
        console.log(`🎯 Mục tiêu: ${testCase.goal}`);
        console.log(`========================================`);
        
        let stepCount = 0;
        const maxSteps = testCase.maxSteps || 25; // Cho phép truyền maxSteps, mặc định 25
        let history = []; // Lưu lại lịch sử các bước đã làm
        const startTime = Date.now();
        let finalResult = 'FAIL';
        let notes = `AI bỏ cuộc giữa chừng (vượt quá ${maxSteps} bước)`;

        while (stepCount < maxSteps) {
            console.log(`\n--- Bước ${stepCount + 1} ---`);
            
            // 1. Nhìn màn hình (Snapshot)
            const rawSnapshot = await helpers.snapshot();
            const uiElements = simplifySnapshot(rawSnapshot);

            // 2. Hỏi LLM
            const prompt = `Bạn là một AI Software Tester điều khiển trình duyệt.
Mục tiêu kiểm thử của bạn (Goal): "${testCase.goal}"
Website URL gốc: "${config.APP_URL}"

Các thao tác bạn đã làm trong quá khứ:
${JSON.stringify(history)}

Trạng thái màn hình hiện tại (Các element có thể tương tác):
${JSON.stringify(uiElements, null, 2)}

Luật:
1. Bạn phải suy luận (thought) về những gì bạn thấy trên màn hình so với mục tiêu.
2. Trả về HÀNH ĐỘNG TIẾP THEO dưới dạng JSON với cấu trúc chính xác sau:
{
    "thought": "Suy luận ngắn gọn của bạn",
    "action": "navigate" | "click" | "type" | "log_finding" | "done",
    "url": "Bắt buộc nếu action=navigate",
    "ref": "Bắt buộc nếu action=click hoặc action=type",
    "value": "Bắt buộc nếu action=type",
    "test_case": "Bắt buộc nếu action=log_finding (Tên tự đặt cho chức năng/kịch bản vừa test xong)",
    "result": "Bắt buộc nếu action=log_finding ('PASS' hoặc 'FAIL'). Đứng ở góc độ Tester: PASS = Hệ thống chạy đúng mong đợi (Bao gồm cả việc CHẶN THÀNH CÔNG dữ liệu sai). FAIL = Hệ thống bị lỗi (Vỡ UI, cho lưu dữ liệu sai, crash).",
    "message": "Bắt buộc nếu action=log_finding (Mô tả chi tiết lỗi hoặc lý do PASS)"
}
Lưu ý: 
- Bạn CÓ THỂ gọi 'log_finding' nhiều lần. Mỗi khi nhận ra một kịch bản đã xong (Dù là hệ thống báo lỗi hay thành công), hãy gọi 'log_finding'. 
- [QUAN TRỌNG] HÃY ĐỌC LỊCH SỬ. Nếu lịch sử cho thấy bạn vừa 'type' hoặc 'click' mà màn hình không chuyển trang (chỉ hiện thêm dòng chữ báo lỗi màu đỏ), ĐÓ LÀ KẾT QUẢ TEST. Hãy gọi 'log_finding' để ghi nhận, sau đó BẮT BUỘC phải chuyển sang test case khác (ví dụ: test tài khoản đúng) hoặc gọi 'done'. KHÔNG nhập đi nhập lại cùng một thông tin!
- Khi đã khám phá hết, gọi 'done' để dừng. 
Chỉ trả về MÃ JSON hợp lệ.`;

            try {
                const chatCompletion = await groq.chat.completions.create({
                    messages: [{ role: "user", content: prompt }],
                    model: "openai/gpt-oss-120b",
                    temperature: 0,
                    response_format: { type: "json_object" },
                });

                const responseText = chatCompletion.choices[0].message.content;
                const aiDecision = JSON.parse(responseText);

                console.log(`🧠 AI Suy luận: ${aiDecision.thought}`);
                console.log(`🛠️ AI Hành động: ${aiDecision.action} ${aiDecision.ref || ''} ${aiDecision.value || ''} ${aiDecision.url || ''}`);

                // Chỉ lưu lịch sử hành động để AI "nhớ"
                let historyStr = aiDecision.action;
                if (aiDecision.action === 'log_finding') {
                    historyStr += ` [${aiDecision.result}] ${aiDecision.test_case}`;
                } else if (aiDecision.action === 'navigate') {
                    historyStr += ` to ${aiDecision.url}`;
                } else {
                    historyStr += ` ${aiDecision.ref || ''} ${aiDecision.value || ''}`;
                }
                history.push(historyStr.trim());

                // 3. Thực thi hành động
                if (aiDecision.action === 'navigate') {
                    await helpers.navigate(aiDecision.url);
                } else if (aiDecision.action === 'click') {
                    await helpers.click(aiDecision.ref, true); // True = đợi reload (waitNav)
                } else if (aiDecision.action === 'type') {
                    await helpers.fill(aiDecision.ref, aiDecision.value);
                } else if (aiDecision.action === 'log_finding') {
                    console.log(`\n📝 GHI NHẬN KẾT QUẢ: [${aiDecision.result}] ${aiDecision.test_case} - ${aiDecision.message}`);
                    await reportResult({
                        stt: this.testCount++,
                        module: testCase.module,
                        tcId: aiDecision.test_case,
                        desc: aiDecision.test_case,
                        result: aiDecision.result === 'PASS' ? '✅ PASS' : '❌ FAIL',
                        time: Date.now() - startTime,
                        notes: aiDecision.message
                    });
                    // AI vẫn tiếp tục loop
                } else if (aiDecision.action === 'done') {
                    finalResult = 'DONE';
                    console.log(`\n🏁 HOÀN TẤT KHÁM PHÁ MODULE.`);
                    break; // Đã xong
                } else {
                    console.log("Hành động không hợp lệ:", aiDecision.action);
                }

                // Chờ xíu cho UI phản hồi
                await helpers.waitFor(1500);
                stepCount++;

            } catch (error) {
                console.error("Lỗi khi gọi Groq API hoặc Parse JSON:", error.message);
                notes = `Lỗi hệ thống: ${error.message}`;
                break;
            }
        }

        if (stepCount >= maxSteps || finalResult === 'FAIL') {
            // Chỉ ghi báo cáo tổng khi bị lỗi văng quá số bước
            await reportResult({
                stt: this.testCount++,
                module: testCase.module,
                tcId: "SYSTEM_TIMEOUT",
                desc: "Giới hạn các bước",
                result: '❌ FAIL',
                time: Date.now() - startTime,
                notes: notes
            });
        }
    }
}

module.exports = TestAgent;
