"use client";

import { useModalStore } from "@/modalStore";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { useEffect, useState, useRef } from "react";

export function GlobalModal() {
  const { isOpen, type, title, message, confirmText, cancelText, onConfirm, onCancel, closeModal } = useModalStore();
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
        setInputValue("");
        if (type === 'prompt') {
            setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
        }
    }
  }, [isOpen, type]);

  // Escape key to cancel
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && type !== 'loading') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  // Determine icon and colors based on type and title keywords (danger/warning usually have specific words)
  const isDanger = message.toLowerCase().includes('xoá') || message.toLowerCase().includes('xóa') || message.toLowerCase().includes('hủy') || message.toLowerCase().includes('tiêu diệt');
  const isSuccess = title.toLowerCase().includes('thành công');
  
  let Icon = Info;
  let iconColor = "text-blue-500 bg-blue-50";
  let confirmColor = "bg-teal-500 hover:bg-teal-600 focus:ring-teal-200";

  if (isDanger) {
    Icon = AlertTriangle;
    iconColor = "text-red-500 bg-red-50";
    confirmColor = "bg-red-500 hover:bg-red-600 focus:ring-red-200";
  } else if (isSuccess) {
    Icon = CheckCircle2;
    iconColor = "text-emerald-500 bg-emerald-50";
    confirmColor = "bg-emerald-500 hover:bg-emerald-600 focus:ring-emerald-200";
  } else if (type === 'alert') {
    Icon = AlertCircle;
    iconColor = "text-amber-500 bg-amber-50";
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-0">
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity ${type === 'loading' ? 'cursor-not-allowed' : ''}`}
        onClick={() => { if (type !== 'loading') onCancel(); }}
      ></div>

      {/* Modal Box */}
      <div className="relative bg-white rounded-3xl shadow-2xl p-6 sm:p-8 w-full max-w-sm animate-in fade-in zoom-in-95 duration-200">
        
        {/* Close Button top right */}
        {type !== 'loading' && (
          <button 
            onClick={onCancel}
            className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-colors outline-none"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="flex flex-col items-center text-center">
          {/* Icon */}
          {type === 'loading' ? (
              <div className="w-16 h-16 rounded-full flex items-center justify-center mb-5 text-indigo-500 bg-indigo-50">
                 <svg className="animate-spin w-8 h-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                 </svg>
              </div>
          ) : (
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-5 ${iconColor}`}>
                <Icon className="w-8 h-8" />
              </div>
          )}

          {/* Texts */}
          <h3 className="text-xl font-extrabold text-slate-800 mb-2">
            {title}
          </h3>
          <p className="text-sm font-medium text-slate-500 mb-6 whitespace-pre-wrap">
            {message}
          </p>

          {/* Prompt Input */}
          {type === 'prompt' && (
             <div className="w-full mb-8 relative group">
                <input
                    ref={inputRef}
                    type={message.toLowerCase().includes('mật khẩu') ? 'password' : 'text'}
                    autoComplete="new-password"
                    data-form-type="other"
                    data-lpignore="true"
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-50 font-bold text-slate-800 transition-all text-center"
                    placeholder="Nhập thông tin tại đây..."
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') onConfirm(inputValue);
                    }}
                />
             </div>
          )}

          {/* Action Buttons */}
          {type !== 'loading' && (
            <div className="flex gap-3 w-full">
              {(type === 'confirm' || type === 'prompt') && (
                <button 
                  onClick={onCancel}
                  className="flex-1 px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-all outline-none focus:ring-4 focus:ring-slate-100"
                >
                  {cancelText}
                </button>
              )}
              <button 
                onClick={() => {
                  if (type === 'prompt') onConfirm(inputValue);
                  else onConfirm();
                }}
                className={`flex-1 px-4 py-3 rounded-xl text-white font-bold transition-all outline-none shadow-md focus:ring-4 ${confirmColor}`}
              >
                {confirmText}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
