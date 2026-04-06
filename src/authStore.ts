import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { db } from '@/firebase';
import { doc, getDoc, setDoc, getDocs, collection } from 'firebase/firestore';

export type Role = 'admin' | 'warehouse' | 'support' | 'pending_approval';

export interface UserAccount {
  id: string; // username
  passwordHash: string; // Thực tế là plain text cho nhanh
  displayName: string;
  role: Role;
  email?: string;
  phone?: string;
  createdAt?: number;
}

interface AuthState {
  currentUser: UserAccount | null;
  login: (id: string, pass: string) => Promise<boolean | string>;
  register: (id: string, pass: string, displayName: string, email?: string, phone?: string) => Promise<boolean | string>;
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
                     if (data.role === 'pending_approval') {
                         return 'PENDING';
                     }
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

      register: async (id, pass, displayName, email, phone) => {
          try {
              const snapshot = await getDocs(collection(db, 'users'));
              const users = snapshot.docs.map((d: any) => d.data() as UserAccount);
              
              const exists = users.some((u: any) => u.id.toLowerCase() === id.trim().toLowerCase());
              if (exists) {
                  return 'EXISTS';
              }

              await setDoc(doc(db, 'users', id.trim()), {
                  id,
                  passwordHash: pass,
                  displayName,
                  role: 'pending_approval',
                  email: email || '',
                  phone: phone || '',
                  createdAt: Date.now()
              });
              return true;
          } catch (e) {
              return 'ERROR';
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
