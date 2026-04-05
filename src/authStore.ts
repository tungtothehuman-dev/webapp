import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { db } from '@/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export type Role = 'admin' | 'warehouse' | 'support';

export interface UserAccount {
  id: string; // username
  passwordHash: string; // Thực tế là plain text cho nhanh
  displayName: string;
  role: Role;
}

interface AuthState {
  currentUser: UserAccount | null;
  login: (id: string, pass: string) => Promise<boolean>;
  logout: () => void;
  updateProfile: (displayName: string, newPass: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      
      login: async (id, pass) => {
         try {
             // Cơ chế Tự Nảy Hạt Giống: Đảm bảo có acc admin gốc!
             if (id === 'admin' && pass === 'admin123') {
                 const adminDoc = await getDoc(doc(db, 'users', 'admin'));
                 if (!adminDoc.exists()) {
                     await setDoc(doc(db, 'users', 'admin'), {
                         id: 'admin',
                         passwordHash: 'admin123',
                         displayName: 'Quản Trị Viên Gốc',
                         role: 'admin'
                     });
                 }
             }

             // Lấy dữ liệu user từ Firestore
             const userSnap = await getDoc(doc(db, 'users', id));
             if (userSnap.exists()) {
                 const data = userSnap.data() as UserAccount;
                 if (data.passwordHash === pass) {
                     set({ currentUser: data });
                     return true;
                 }
             }
             return false;
         } catch (error) {
             console.error("Login lỗi:", error);
             return false;
         }
      },
      
      logout: () => set({ currentUser: null }),
      
      updateProfile: async (displayName, newPass) => {
         const curr = get().currentUser;
         if (!curr) return;
         
         const updatedFields: Partial<UserAccount> = { displayName };
         if (newPass) updatedFields.passwordHash = newPass;

         const updatedUser = { ...curr, ...updatedFields };
         
         try {
            await setDoc(doc(db, 'users', curr.id), updatedUser, { merge: true });
            set({ currentUser: updatedUser });
         } catch (e) {
            console.error("Lỗi update Profile:", e);
         }
      }
    }),
    {
      name: 'auth-storage-cloud', // Đổi tên để xóa cache cũ
    }
  )
);
