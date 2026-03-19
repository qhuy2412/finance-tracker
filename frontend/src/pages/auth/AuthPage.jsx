import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/store/AuthContext";

export default function AuthPage() {
    const {login, register} = useAuth();
    const navigate = useNavigate();
    const [mode, setMode] = useState("login");
    const isRegister = mode === "register";
    const [loginForm, setLoginForm] = useState({email: "", password: ""});
    const [registerForm, setRegisterForm] = useState({username: "", email: "", password: "", confirmPassword: ""});
    const [error, setError] = useState("");
    const handleSwitch = (newMode) => {
        setMode(newMode);
        setLoginForm({email: "", password: ""});
        setRegisterForm({username: "", email: "", password: "", confirmPassword: ""});
        setError("");
    };
    const handleLogin = async () => {
        try{
            await login(loginForm.email, loginForm.password);
            navigate("/dashboard");
        } catch (error) {
            setError(error.response?.data?.message || "Đăng nhập thất bại");
        }
    };
    const handleRegister = async () => {
        if(registerForm.password !== registerForm.confirmPassword) {
            setError("Mật khẩu xác nhận không khớp");
            return;
        }
        try{
            await register(registerForm.username, registerForm.email, registerForm.password);
            navigate("/dashboard");
        } catch (error) {
            setError(error.response?.data?.message || "Đăng ký thất bại");
        }
    };
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
                            <Input type="email" value={loginForm.email} onChange={(e) => setLoginForm({...loginForm, email: e.target.value})} placeholder="you@fintra.io" />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Mật khẩu</Label>
                            <Input type="password" value={loginForm.password} onChange={(e) => setLoginForm({...loginForm, password: e.target.value})} placeholder="••••••••" />
                        </div>
                        <div className="text-right">
                            <button className="text-xs text-blue-600 hover:underline">Quên mật khẩu</button>
                        </div>
                        <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={handleLogin}>
                            Đăng nhập
                        </Button>
                        <p className="text-center text-xs text-slate-400">
                            Chưa có tài khoản?{" "}
                            <span onClick={() => handleSwitch("login")} className="text-blue-600 cursor-pointer hover:underline font-medium">
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
                            <Label>Tên người dùng</Label>
                            <Input type="text" placeholder="Xuân Thưởng" value={registerForm.username} onChange={(e) => setRegisterForm({...registerForm, username: e.target.value})}/>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Email</Label>
                            <Input type="email" placeholder="you@gmail.com" value={registerForm.email} onChange={(e) => setRegisterForm({...registerForm, email: e.target.value})} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Password</Label>
                            <Input type="password" placeholder="••••••••" value={registerForm.password} onChange={(e) => setRegisterForm({...registerForm, password: e.target.value})} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Mật khẩu</Label>
                            <Input type="password" placeholder="••••••••" value={registerForm.confirmPassword} onChange={(e) => setRegisterForm({...registerForm, confirmPassword: e.target.value})} />
                        </div>
                        <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={handleRegister}>
                            Đăng ký
                        </Button>
                        <p className="text-center text-xs text-slate-400">
                            Đã có tài khoản?{" "}
                            <span onClick={() => handleSwitch("register")} className="text-blue-600 cursor-pointer hover:underline font-medium">
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
                        {isRegister ? "Mừng bạn trở lại!" : "Chào mừng đến với FinTra!"}
                    </h3>
                    <p className="text-white/60 text-sm leading-relaxed mb-8 max-w-[180px]">
                        {isRegister
                            ? "Đăng nhập để tiếp tục quản lý tài chính của bạn một cách dễ dàng và hiệu quả."
                            : "Đăng ký để bắt đầu quản lý tài chính của bạn một cách dễ dàng và hiệu quả."}
                    </p>

                    <Button
                        variant="outline"
                        onClick={() => setMode(isRegister ? "login" : "register")}
                        className="rounded-full border-white/40 text-white bg-transparent hover:bg-white/10 hover:text-white hover:border-white/60"
                    >
                        {isRegister ? "Đăng ký" : "Đăng nhập"}
                    </Button>
                </div>

            </div>
        </div>
    );
}