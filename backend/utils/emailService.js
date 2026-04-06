const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_ADDRESS,
        pass: process.env.PASSWORD,
    },
});

const sendVerificationEmail = async (to, code) => {
    await transporter.sendMail({
        from: `"FinTra" <${process.env.GMAIL_ADDRESS}>`,
        to,
        subject: 'Xác minh email của bạn - FinTra',
        html: `
        <!DOCTYPE html>
        <html lang="vi">
        <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
            <title>Xác minh email</title>
        </head>
        <body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 0;">
                <tr>
                    <td align="center">
                        <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
                            <!-- Header -->
                            <tr>
                                <td style="background:linear-gradient(135deg,#1d4ed8,#0ea5e9);padding:36px 40px;text-align:center;">
                                    <div style="display:inline-flex;align-items:center;gap:10px;">
                                        <span style="font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">FinTra</span>
                                    </div>
                                    <p style="color:rgba(255,255,255,0.7);font-size:12px;letter-spacing:3px;text-transform:uppercase;margin:8px 0 0;">Financial Services</p>
                                </td>
                            </tr>
                            <!-- Body -->
                            <tr>
                                <td style="padding:40px 40px 32px;">
                                    <h2 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#0f172a;">Xác minh địa chỉ email</h2>
                                    <p style="margin:0 0 28px;font-size:15px;color:#64748b;line-height:1.6;">
                                        Cảm ơn bạn đã đăng ký FinTra! Hãy nhập mã xác minh bên dưới để hoàn tất đăng ký.
                                    </p>
                                    <!-- OTP Box -->
                                    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:28px;text-align:center;margin-bottom:28px;">
                                        <p style="margin:0 0 8px;font-size:13px;color:#94a3b8;text-transform:uppercase;letter-spacing:2px;font-weight:600;">Mã xác minh của bạn</p>
                                        <div style="font-size:42px;font-weight:800;letter-spacing:12px;color:#1d4ed8;font-family:'Courier New',monospace;">${code}</div>
                                        <p style="margin:12px 0 0;font-size:13px;color:#94a3b8;">Mã có hiệu lực trong <strong style="color:#0f172a;">10 phút</strong></p>
                                    </div>
                                    <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.6;">
                                        Nếu bạn không yêu cầu đăng ký tài khoản, hãy bỏ qua email này. Không ai có thể truy cập tài khoản của bạn nếu không có mã này.
                                    </p>
                                </td>
                            </tr>
                            <!-- Footer -->
                            <tr>
                                <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;">
                                    <p style="margin:0;font-size:12px;color:#94a3b8;">© 2026 FinTra · Financial Services</p>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
        `,
    });
    console.log(`[EmailService] ✅ Verification email sent to ${to}`);
};

module.exports = { sendVerificationEmail };
