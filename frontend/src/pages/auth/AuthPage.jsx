import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/store/AuthContext";
import { toast } from "react-toastify";

// ─── OTP Input Component ────────────────────────────────────────────────────
function OtpInput({ value, onChange }) {
    const refs = useRef([]);
    const digits = value.split("");

    const handleKey = (e, idx) => {
        if (e.key === "Backspace") {
            e.preventDefault();
            const next = [...digits];
            if (next[idx]) {
                next[idx] = "";
                onChange(next.join(""));
            } else if (idx > 0) {
                next[idx - 1] = "";
                onChange(next.join(""));
                refs.current[idx - 1]?.focus();
            }
            return;
        }
        if (e.key === "ArrowLeft" && idx > 0) { refs.current[idx - 1]?.focus(); return; }
        if (e.key === "ArrowRight" && idx < 5) { refs.current[idx + 1]?.focus(); return; }
    };

    const handleChange = (e, idx) => {
        const val = e.target.value.replace(/\D/g, "");
        if (!val) return;
        const char = val[val.length - 1];
        const next = [...digits];
        // Fill from current index forward if pasting
        const chars = val.slice(0, 6 - idx);
        chars.split("").forEach((c, i) => { next[idx + i] = c; });
        onChange(next.join("").slice(0, 6));
        const nextIdx = Math.min(idx + chars.length, 5);
        refs.current[nextIdx]?.focus();
    };

    const handleFocus = (e) => e.target.select();

    const handlePaste = (e) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
        const next = (pasted + "      ").slice(0, 6).split("").map((c, i) => i < pasted.length ? c : "");
        onChange(next.join(""));
        const focusIdx = Math.min(pasted.length, 5);
        refs.current[focusIdx]?.focus();
    };

    return (
        <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
            {[0, 1, 2, 3, 4, 5].map((idx) => (
                <input
                    key={idx}
                    ref={(el) => (refs.current[idx] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={digits[idx] || ""}
                    onChange={(e) => handleChange(e, idx)}
                    onKeyDown={(e) => handleKey(e, idx)}
                    onFocus={handleFocus}
                    onPaste={handlePaste}
                    style={{
                        width: "48px",
                        height: "56px",
                        textAlign: "center",
                        fontSize: "24px",
                        fontWeight: "700",
                        fontFamily: "'Courier New', monospace",
                        border: digits[idx] ? "2px solid #1d4ed8" : "2px solid #e2e8f0",
                        borderRadius: "10px",
                        background: digits[idx] ? "#eff6ff" : "#f8fafc",
                        color: "#0f172a",
                        outline: "none",
                        transition: "border-color 0.15s, background 0.15s",
                        caretColor: "transparent",
                    }}
                />
            ))}
        </div>
    );
}

// ─── Main Auth Page ─────────────────────────────────────────────────────────
export default function AuthPage() {
    const { login, register, verifyEmail } = useAuth();
    const navigate = useNavigate();

    // mode: "login" | "register" | "verify"
    const [mode, setMode] = useState("login");
    const isRegister = mode === "register";
    const isVerify = mode === "verify";

    const [loginForm, setLoginForm] = useState({ email: "", password: "" });
    const [registerForm, setRegisterForm] = useState({ username: "", email: "", password: "", confirmPassword: "" });
    const [pendingEmail, setPendingEmail] = useState("");
    const [otpCode, setOtpCode] = useState("");
    const [resendCooldown, setResendCooldown] = useState(0);
    const [loading, setLoading] = useState(false);
    
    // Field-level errors
    const [registerErrors, setRegisterErrors] = useState({ username: "", email: "", password: "", confirmPassword: "" });
    const [verifyError, setVerifyError] = useState("");

    // Resend countdown timer
    useEffect(() => {
        if (resendCooldown <= 0) return;
        const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [resendCooldown]);

    const handleSwitch = (newMode) => {
        setMode(newMode);
        setLoginForm({ email: "", password: "" });
        setRegisterForm({ username: "", email: "", password: "", confirmPassword: "" });
        setOtpCode("");
        setRegisterErrors({ username: "", email: "", password: "", confirmPassword: "" });
        setVerifyError("");
    };

    const handleLogin = async () => {
        if (loading) return;
        setLoading(true);
        try {
            await login(loginForm.email, loginForm.password);
            toast.success("Đăng nhập thành công!");
            navigate("/dashboard");
        } catch (error) {
            toast.error(error.response?.data?.message || "Đăng nhập thất bại");
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async () => {
        if (loading) return;
        
        // Clear previous errors
        setRegisterErrors({ username: "", email: "", password: "", confirmPassword: "" });
        
        // Client-side validation
        if (registerForm.password !== registerForm.confirmPassword) {
            setRegisterErrors(prev => ({
                ...prev,
                confirmPassword: "Mật khẩu xác nhận không khớp"
            }));
            return;
        }
        
        setLoading(true);
        try {
            await register(registerForm.username, registerForm.email, registerForm.password);
            setPendingEmail(registerForm.email);
            setOtpCode("");
            setResendCooldown(60);
            setMode("verify");
            toast.success("Mã xác minh đã được gửi tới email của bạn!");
        } catch (error) {
            const errorData = error.response?.data;
            
            // Check if error has field-specific messages
            if (errorData?.errors && typeof errorData.errors === "object") {
                const newErrors = { username: "", email: "", password: "", confirmPassword: "" };
                Object.keys(errorData.errors).forEach(field => {
                    if (field in newErrors) {
                        newErrors[field] = Array.isArray(errorData.errors[field])
                            ? errorData.errors[field][0]
                            : errorData.errors[field];
                    }
                });
                setRegisterErrors(newErrors);
            } else if (errorData?.message) {
                // If no specific field errors, show general message
                setRegisterErrors(prev => ({ ...prev, email: errorData.message }));
            }
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async () => {
        if (loading) return;
        
        // Clear previous error
        setVerifyError("");
        
        if (otpCode.length < 6) {
            setVerifyError("Vui lòng nhập đủ 6 chữ số");
            return;
        }
        setLoading(true);
        try {
            await verifyEmail(pendingEmail, otpCode);
            toast.success("Xác minh thành công! Hãy đăng nhập.");
            setMode("login");
            setLoginForm({ email: pendingEmail, password: "" });
            setOtpCode("");
        } catch (error) {
            const errorData = error.response?.data;
            setVerifyError(errorData?.message || "Mã xác minh không đúng");
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        if (resendCooldown > 0 || loading) return;
        setVerifyError("");
        setLoading(true);
        try {
            await register(registerForm.username || "", pendingEmail, registerForm.password || "");
            setOtpCode("");
            setResendCooldown(60);
            toast.success("Mã xác minh mới đã được gửi!");
        } catch (error) {
            const errorData = error.response?.data;
            setVerifyError(errorData?.message || "Gửi lại thất bại");
        } finally {
            setLoading(false);
        }
    };

    // ── OTP Verify Panel ──────────────────────────────────────────────────
    if (isVerify) {
        return (
            <div
                style={{
                    minHeight: "100vh",
                    background: "linear-gradient(135deg, #f1f5f9 0%, #e0eaff 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "16px",
                }}
            >
                <div
                    style={{
                        background: "#ffffff",
                        borderRadius: "20px",
                        boxShadow: "0 8px 40px rgba(29,78,216,0.12)",
                        width: "100%",
                        maxWidth: "420px",
                        overflow: "hidden",
                    }}
                >
                    {/* Header strip */}
                    <div
                        style={{
                            background: "linear-gradient(135deg, #1d4ed8, #0ea5e9)",
                            padding: "28px 32px",
                            textAlign: "center",
                        }}
                    >
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                            <svg width="26" height="26" viewBox="0 0 40 40" fill="none">
                                <path d="M20 2L5 8.5v10.5C5 29.2 11.8 37 20 39 28.2 37 35 29.2 35 19V8.5L20 2z"
                                    fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
                                <polyline points="10,25 15,18 20,22 26,13 32,8"
                                    stroke="white" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                                <polyline points="27,8 32,8 32,13"
                                    stroke="white" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <span style={{ color: "#fff", fontWeight: 800, fontSize: "20px" }}>FinTra</span>
                        </div>
                        <p style={{ color: "rgba(255,255,255,0.65)", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", margin: 0 }}>
                            Xác minh email
                        </p>
                    </div>

                    {/* Body */}
                    <div style={{ padding: "36px 32px" }}>
                        {/* Email icon */}
                        <div style={{ textAlign: "center", marginBottom: "24px" }}>
                            <div style={{
                                display: "inline-flex", alignItems: "center", justifyContent: "center",
                                width: "64px", height: "64px", borderRadius: "50%",
                                background: "linear-gradient(135deg, #eff6ff, #dbeafe)",
                                marginBottom: "16px",
                            }}>
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="2" y="4" width="20" height="16" rx="2" />
                                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                                </svg>
                            </div>
                            <h2 style={{ margin: "0 0 8px", fontSize: "20px", fontWeight: 700, color: "#0f172a" }}>
                                Kiểm tra email của bạn
                            </h2>
                            <p style={{ margin: 0, fontSize: "14px", color: "#64748b", lineHeight: 1.6 }}>
                                Chúng tôi đã gửi mã 6 chữ số tới
                                <br />
                                <strong style={{ color: "#0f172a" }}>{pendingEmail}</strong>
                            </p>
                        </div>

                        {/* OTP input */}
                        <div style={{ marginBottom: "24px" }}>
                            <OtpInput value={otpCode} onChange={setOtpCode} />
                            {verifyError && <p style={{ color: "#dc2626", fontSize: "13px", marginTop: "8px", textAlign: "center" }}>{verifyError}</p>}
                        </div>

                        {/* Verify button */}
                        <button
                            onClick={handleVerify}
                            disabled={loading || otpCode.length < 6}
                            style={{
                                width: "100%",
                                padding: "13px",
                                borderRadius: "10px",
                                border: "none",
                                background: otpCode.length === 6 ? "linear-gradient(135deg, #1d4ed8, #0ea5e9)" : "#e2e8f0",
                                color: otpCode.length === 6 ? "#fff" : "#94a3b8",
                                fontSize: "15px",
                                fontWeight: 600,
                                cursor: otpCode.length === 6 && !loading ? "pointer" : "not-allowed",
                                transition: "all 0.2s",
                                marginBottom: "16px",
                            }}
                        >
                            {loading ? "Đang xác minh..." : "Xác minh"}
                        </button>

                        {/* Resend */}
                        <p style={{ textAlign: "center", fontSize: "13px", color: "#64748b", margin: "0 0 16px" }}>
                            Không nhận được mã?{" "}
                            <button
                                onClick={handleResend}
                                disabled={resendCooldown > 0 || loading}
                                style={{
                                    background: "none",
                                    border: "none",
                                    padding: 0,
                                    fontSize: "13px",
                                    fontWeight: 600,
                                    color: resendCooldown > 0 ? "#94a3b8" : "#1d4ed8",
                                    cursor: resendCooldown > 0 ? "default" : "pointer",
                                    textDecoration: resendCooldown > 0 ? "none" : "underline",
                                }}
                            >
                                {resendCooldown > 0 ? `Gửi lại sau ${resendCooldown}s` : "Gửi lại"}
                            </button>
                        </p>

                        {/* Back to register */}
                        <p style={{ textAlign: "center", fontSize: "13px", color: "#64748b", margin: 0 }}>
                            <button
                                onClick={() => handleSwitch("register")}
                                style={{
                                    background: "none", border: "none", padding: 0,
                                    fontSize: "13px", color: "#64748b", cursor: "pointer",
                                    display: "inline-flex", alignItems: "center", gap: "4px",
                                }}
                            >
                                ← Quay lại đăng ký
                            </button>
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // ── Login / Register Panel ────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
            <div className="relative w-full max-w-3xl h-[500px] flex rounded-2xl overflow-hidden shadow-xl">

                {/* Login */}
                <Card className="flex-1 rounded-none border-0 border-r flex flex-col justify-center">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-2xl">Đăng nhập</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-1.5">
                            <Label>Email</Label>
                            <Input type="email" value={loginForm.email} onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })} placeholder="you@fintra.io" />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Mật khẩu</Label>
                            <Input type="password" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} placeholder="••••••••"
                                onKeyDown={(e) => e.key === "Enter" && handleLogin()} />
                        </div>
                        <div className="text-right">
                            <button className="text-xs text-blue-600 hover:underline">Quên mật khẩu</button>
                        </div>
                        <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={handleLogin} disabled={loading}>
                            {loading ? "Đang đăng nhập..." : "Đăng nhập"}
                        </Button>
                        <p className="text-center text-xs text-slate-400">
                            Chưa có tài khoản?{" "}
                            <span onClick={() => handleSwitch("register")} className="text-blue-600 cursor-pointer hover:underline font-medium">
                                Đăng ký
                            </span>
                        </p>
                    </CardContent>
                </Card>

                {/* Register */}
                <Card className="flex-1 rounded-none border-0 flex flex-col justify-center">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-2xl">Đăng ký</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="space-y-1.5">
                            <Label>Tên người dùng<p style={{ color: "red" }}>*</p></Label>
                            <Input type="text" placeholder="yourname" value={registerForm.username} onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })} />
                            {registerErrors.username && <p className="text-red-500 text-xs mt-1">{registerErrors.username}</p>}
                        </div>
                        <div className="space-y-1.5">
                            <Label>Email<p style={{ color: "red" }}>*</p></Label>
                            <Input type="email" placeholder="you@gmail.com" value={registerForm.email} onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })} />
                            {registerErrors.email && <p className="text-red-500 text-xs mt-1">{registerErrors.email}</p>}
                        </div>
                        <div className="space-y-1.5">
                            <Label>Mật khẩu <p style={{ color: "red" }}>*</p></Label>
                            <Input type="password" placeholder="••••••••" value={registerForm.password} onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })} />
                            {registerErrors.password && <p className="text-red-500 text-xs mt-1">{registerErrors.password}</p>}
                        </div>
                        <div className="space-y-1.5">
                            <Label>Xác nhận mật khẩu<p style={{ color: "red" }}>*</p></Label>
                            <Input type="password" placeholder="••••••••" value={registerForm.confirmPassword} onChange={(e) => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })}
                                onKeyDown={(e) => e.key === "Enter" && handleRegister()} />
                            {registerErrors.confirmPassword && <p className="text-red-500 text-xs mt-1">{registerErrors.confirmPassword}</p>}
                        </div>
                        <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={handleRegister} disabled={loading}>
                            {loading ? "Đang gửi mã..." : "Đăng ký"}
                        </Button>
                        <p className="text-center text-xs text-slate-400">
                            Đã có tài khoản?{" "}
                            <span onClick={() => handleSwitch("login")} className="text-blue-600 cursor-pointer hover:underline font-medium">
                                Đăng nhập
                            </span>
                        </p>
                    </CardContent>
                </Card>

                {/* Sliding overlay */}
                <div
                    className="absolute top-0 bottom-0 w-1/2 flex flex-col items-center justify-center text-center p-10 transition-all duration-700"
                    style={{
                        left: !isRegister ? "50%" : "0%",
                        background: "linear-gradient(150deg, #1d4ed8, #0ea5e9)",
                        transitionTimingFunction: "cubic-bezier(0.77,0,0.175,1)",
                    }}
                >
                    {/* Logo */}
                    <div className="flex items-center gap-2.5 mb-8">
                        <svg width="34" height="34" viewBox="0 0 40 40" fill="none">
                            <path d="M20 2L5 8.5v10.5C5 29.2 11.8 37 20 39 28.2 37 35 29.2 35 19V8.5L20 2z"
                                fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
                            <polyline points="10,25 15,18 20,22 26,13 32,8"
                                stroke="white" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                            <polyline points="27,8 32,8 32,13"
                                stroke="white" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <div className="text-left">
                            <div className="text-white font-bold text-xl leading-none">FinTra</div>
                            <div className="text-[9px] tracking-widest uppercase text-white/40 mt-1">Financial Services</div>
                        </div>
                    </div>

                    <h3 className="text-white font-bold text-xl mb-3 leading-snug">
                        {!isRegister ? "Mừng bạn trở lại!" : "Chào mừng đến với FinTra!"}
                    </h3>
                    <p className="text-white/60 text-sm leading-relaxed mb-8 max-w-[180px]">
                        {!isRegister
                            ? "Đăng nhập để tiếp tục quản lý tài chính của bạn một cách dễ dàng và hiệu quả."
                            : "Đăng ký để bắt đầu quản lý tài chính của bạn một cách dễ dàng và hiệu quả."}
                    </p>

                    <Button
                        variant="outline"
                        onClick={() => setMode(isRegister ? "login" : "register")}
                        className="rounded-full border-white/40 text-white bg-transparent hover:bg-white/10 hover:text-white hover:border-white/60"
                    >
                        {!isRegister ? "Đăng ký" : "Đăng nhập"}
                    </Button>
                </div>

            </div>
        </div>
    );
}