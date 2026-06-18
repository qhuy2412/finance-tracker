import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import {
    Send,
    Link,
    Link2Off,
    CheckCircle2,
    XCircle,
    Copy,
    RefreshCw,
    MessageCircle,
} from 'lucide-react';
import telegramService from '../../services/telegram.service';
import ConfirmModal from '../../components/ConfirmModal';

// ── Token Display Card ─────────────────────────────────────────────────────
function TokenCard({ token, onCopy }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        onCopy(token);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-2xl">
            <p className="text-xs text-blue-600 font-semibold uppercase tracking-wider mb-2">
                Mã liên kết của bạn (hiệu lực 10 phút)
            </p>
            <div className="flex items-center gap-3">
                <code className="flex-1 text-xl font-bold text-blue-700 tracking-widest select-all bg-white px-4 py-2.5 rounded-xl border border-blue-200">
                    {token}
                </code>
                <button
                    id="btn-copy-telegram-token"
                    onClick={handleCopy}
                    className="h-10 w-10 flex items-center justify-center rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors shrink-0"
                    title="Sao chép"
                >
                    {copied ? <CheckCircle2 size={18} /> : <Copy size={18} />}
                </button>
            </div>

            <div className="mt-4 space-y-1.5">
                <p className="text-sm font-semibold text-slate-700">Cách liên kết:</p>
                <ol className="text-sm text-slate-600 space-y-1 list-none">
                    <li className="flex items-start gap-2">
                        <span className="text-blue-500 font-bold shrink-0">1.</span>
                        Mở Telegram và tìm bot{' '}
                        <a
                            href="https://t.me/FinTraAssistantBot"
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 font-semibold hover:underline"
                        >
                            @FinTraAssistantBot
                        </a>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-blue-500 font-bold shrink-0">2.</span>
                        Gửi lệnh:{' '}
                        <code className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-xs font-mono">
                            /link {token}
                        </code>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-blue-500 font-bold shrink-0">3.</span>
                        Bot sẽ xác nhận liên kết thành công ✅
                    </li>
                </ol>
            </div>
        </div>
    );
}

// ── Main Settings Page ─────────────────────────────────────────────────────
export default function Settings() {
    const [isLinked, setIsLinked] = useState(null); // null = loading
    const [linkToken, setLinkToken] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isUnlinking, setIsUnlinking] = useState(false);
    const [showUnlinkConfirm, setShowUnlinkConfirm] = useState(false);

    const fetchStatus = useCallback(async () => {
        try {
            const res = await telegramService.getLinkStatus();
            setIsLinked(res.data.linked);
        } catch {
            setIsLinked(false);
        }
    }, []);

    useEffect(() => {
        fetchStatus();
    }, [fetchStatus]);

    const handleGenerateToken = async () => {
        setIsGenerating(true);
        setLinkToken(null);
        try {
            const res = await telegramService.generateLinkToken();
            setLinkToken(res.data.token);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Không thể tạo mã liên kết.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleUnlink = async () => {
        setIsUnlinking(true);
        try {
            await telegramService.unlinkAccount();
            setIsLinked(false);
            setLinkToken(null);
            toast.success('Đã hủy liên kết tài khoản Telegram.');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Không thể hủy liên kết.');
        } finally {
            setIsUnlinking(false);
            setShowUnlinkConfirm(false);
        }
    };

    const handleCopyToken = (token) => {
        navigator.clipboard.writeText(`/link ${token}`).catch(() => {});
        toast.success('Đã sao chép lệnh liên kết!');
    };

    // Re-check status after linking — stop after MAX_POLLS (2 minutes) or when linked
    useEffect(() => {
        if (!linkToken || isLinked) return;
        const MAX_POLLS = 24; // 2 minutes at 5s interval
        let polls = 0;
        const interval = setInterval(async () => {
            polls++;
            if (polls > MAX_POLLS) { clearInterval(interval); return; }
            const res = await telegramService.getLinkStatus().catch(() => null);
            if (res?.data?.linked) {
                setIsLinked(true);
                setLinkToken(null);
                toast.success('🎉 Đã liên kết Telegram thành công!');
                clearInterval(interval);
            }
        }, 5000);
        return () => clearInterval(interval);
    }, [linkToken, isLinked]);

    return (
        <>
        <div className="max-w-2xl mx-auto space-y-6">
            {/* Page header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-800">Cài đặt</h1>
                <p className="text-sm text-slate-400 mt-1">Quản lý tích hợp và tùy chỉnh tài khoản</p>
            </div>

            {/* ── Telegram Integration Card ── */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Card header */}
                <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-4">
                    <div className="h-11 w-11 rounded-xl bg-[#229ED9]/10 flex items-center justify-center shrink-0">
                        <Send size={22} className="text-[#229ED9]" />
                    </div>
                    <div>
                        <h2 className="text-base font-semibold text-slate-800">Telegram Bot</h2>
                        <p className="text-sm text-slate-400">
                            Chat với AI tài chính FinTra ngay trong Telegram
                        </p>
                    </div>

                    {/* Status badge */}
                    {isLinked !== null && (
                        <div className="ml-auto">
                            {isLinked ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 text-xs font-semibold">
                                    <CheckCircle2 size={12} />
                                    Đã liên kết
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-500 text-xs font-semibold">
                                    <XCircle size={12} />
                                    Chưa liên kết
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* Card body */}
                <div className="px-6 py-5">
                    {/* Feature highlights */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
                        {[
                            { icon: MessageCircle, label: 'Chat AI tài chính' },
                            { icon: CheckCircle2, label: 'Ghi giao dịch nhanh' },
                            { icon: RefreshCw, label: 'Đồng bộ thời gian thực' },
                        // eslint-disable-next-line no-unused-vars
                        ].map(({ icon: Icon, label }) => (
                            <div
                                key={label}
                                className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 text-sm text-slate-600"
                            >
                                <Icon size={15} className="text-blue-500 shrink-0" />
                                {label}
                            </div>
                        ))}
                    </div>

                    {isLinked === null ? (
                        <div className="h-10 bg-slate-100 rounded-xl animate-pulse" />
                    ) : isLinked ? (
                        // Already linked — show unlink option
                        <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                            <div>
                                <p className="text-sm font-semibold text-emerald-700">
                                    Telegram đã được liên kết
                                </p>
                                <p className="text-xs text-emerald-600 mt-0.5">
                                    Mở Telegram và chat với bot để sử dụng
                                </p>
                            </div>
                            <button
                                id="btn-unlink-telegram"
                                onClick={() => setShowUnlinkConfirm(true)}
                                disabled={isUnlinking}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
                            >
                                {isUnlinking ? (
                                    <RefreshCw size={15} className="animate-spin" />
                                ) : (
                                    <Link2Off size={15} />
                                )}
                                Hủy liên kết
                            </button>
                        </div>
                    ) : (
                        // Not linked — show generate token flow
                        <div>
                            <button
                                id="btn-generate-telegram-token"
                                onClick={handleGenerateToken}
                                disabled={isGenerating}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60 shadow-md shadow-blue-200"
                            >
                                {isGenerating ? (
                                    <RefreshCw size={15} className="animate-spin" />
                                ) : (
                                    <Link size={15} />
                                )}
                                {linkToken ? 'Tạo mã mới' : 'Lấy mã liên kết'}
                            </button>

                            {linkToken && (
                                <TokenCard token={linkToken} onCopy={handleCopyToken} />
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>

        <ConfirmModal
            isOpen={showUnlinkConfirm}
            onClose={() => setShowUnlinkConfirm(false)}
            onConfirm={handleUnlink}
            title="Hủy liên kết Telegram"
            message="Bạn có chắc muốn hủy liên kết tài khoản Telegram? Sau khi hủy, bot Telegram sẽ không còn truy cập được dữ liệu của bạn."
            confirmText="Hủy liên kết"
            isLoading={isUnlinking}
        />
        </>
    );
}
