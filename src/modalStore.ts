import { create } from 'zustand';

interface ModalState {
  isOpen: boolean;
  type: 'alert' | 'confirm' | 'loading' | 'prompt';
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  onConfirm: (val?: string) => void;
  onCancel: () => void;
  showAlert: (message: string, title?: string) => Promise<void>;
  showConfirm: (message: string, title?: string, confirmText?: string, cancelText?: string) => Promise<boolean>;
  showPrompt: (message: string, title?: string, confirmText?: string, cancelText?: string) => Promise<string | null>;
  showLoading: (message: string, title?: string) => void;
  closeModal: () => void;
}

export const useModalStore = create<ModalState>((set, get) => ({
  isOpen: false,
  type: 'alert',
  title: '',
  message: '',
  confirmText: 'OK',
  cancelText: 'Huỷ',
  onConfirm: () => {},
  onCancel: () => {},
  showAlert: (message, title = 'Thông báo') => {
    return new Promise<void>((resolve) => {
      set({
        isOpen: true,
        type: 'alert',
        title,
        message,
        confirmText: 'Đã hiểu',
        onConfirm: () => {
          get().closeModal();
          resolve();
        },
        onCancel: () => {
          get().closeModal();
          resolve();
        }
      });
    });
  },
  showConfirm: (message, title = 'Xác nhận thao tác', confirmText = 'Xác nhận', cancelText = 'Huỷ bỏ') => {
    return new Promise<boolean>((resolve) => {
      set({
        isOpen: true,
        type: 'confirm',
        title,
        message,
        confirmText,
        cancelText,
        onConfirm: () => {
          get().closeModal();
          resolve(true);
        },
        onCancel: () => {
          get().closeModal();
          resolve(false);
        }
      });
    });
  },
  showPrompt: (message, title = 'Yêu cầu thông tin', confirmText = 'Xác nhận', cancelText = 'Huỷ bỏ') => {
    return new Promise<string | null>((resolve) => {
      set({
        isOpen: true,
        type: 'prompt',
        title,
        message,
        confirmText,
        cancelText,
        onConfirm: (val?: string) => {
          get().closeModal();
          resolve(val || '');
        },
        onCancel: () => {
          get().closeModal();
          resolve(null);
        }
      });
    });
  },
  showLoading: (message, title = 'Đang xử lý...') => {
    set({
      isOpen: true,
      type: 'loading',
      title,
      message,
      confirmText: '',
      cancelText: '',
      onConfirm: () => {},
      onCancel: () => {}
    });
  },
  closeModal: () => set({ isOpen: false })
}));
