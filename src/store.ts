import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface OrderRow {
  id: string; // Firebase Document ID
  "Sender Name"?: string;
  "Receiver Name"?: string;
  "Receiver Address 1"?: string;
  "Receiver City"?: string;
  "Receiver State"?: string;
  "Receiver Zip"?: string | number;
  "Description"?: string;
  Weight?: number;
  TrackingNumber?: string;
  pdfUrl?: string; // Đổi từ pdfBase64 sang pdfUrl
  UploadDate?: string;
  Status?: string;
  ActionHistory?: { action: string; user: string; timestamp: string }[];
  HUB?: string;
  Hub?: string;
  [key: string]: any;
}

interface OrderStore {
  orders: OrderRow[];
  setOrders: (orders: OrderRow[]) => void;
  updateOrder: (id: string, updates: Partial<OrderRow>) => void;
  clearOrders: () => void;
}

export const useOrderStore = create<OrderStore>()(
  (set) => ({
    orders: [],
    setOrders: (orders) => set({ orders }),
    updateOrder: (id, updates) => set((state) => {
        const newOrders = [...state.orders];
        const index = newOrders.findIndex(o => o.id === id);
        if (index > -1) {
            newOrders[index] = { ...newOrders[index], ...updates };
        }
        return { orders: newOrders };
    }),
    clearOrders: () => set({ orders: [] }),
  })
);

export interface PackageRow {
  id: string; 
  destination: string;
  labelType: string;
  description: string;
  createdAt: string;
  status: string;
  orderDescriptions: string[];
  masterTracking?: string;
  closedAt?: string;
}

interface PackageStore {
  packages: PackageRow[];
  addPackage: (pkg: PackageRow) => void;
  deletePackage: (id: string) => void;
  clearPackages: () => void;
}

export const usePackageStore = create<PackageStore>()(
  persist(
    (set) => ({
      packages: [],
      addPackage: (pkg) => set((state) => ({ packages: [pkg, ...state.packages] })),
      deletePackage: (id) => set((state) => ({ packages: state.packages.filter(p => p.id !== id) })),
      clearPackages: () => set({ packages: [] })
    }),
    {
      name: 'package-storage',
    }
  )
);

export interface WarehouseItem {
  id: string;
  name: string;
  address: string;
  receiverName?: string;
}

interface WarehouseStore {
  warehouses: WarehouseItem[];
  setWarehouses: (whs: WarehouseItem[]) => void;
  addWarehouse: (wh: WarehouseItem) => void;
  updateWarehouse: (id: string, updates: Partial<WarehouseItem>) => void;
  deleteWarehouse: (id: string) => void;
}

export const useWarehouseStore = create<WarehouseStore>()(
  persist(
    (set) => ({
      warehouses: [
          { id: "HUB NY", name: "HUB NY", address: "", receiverName: "" },
          { id: "HUB CA", name: "HUB CA", address: "", receiverName: "" },
          { id: "HUB TX", name: "HUB TX", address: "", receiverName: "" },
          { id: "HUB OR", name: "HUB OR", address: "", receiverName: "" }
      ],
      setWarehouses: (whs) => set({ warehouses: whs }),
      addWarehouse: (wh) => set((state) => {
          return { warehouses: [...state.warehouses, wh] };
      }),
      updateWarehouse: (id, updates) => set((state) => ({
          warehouses: state.warehouses.map(w => {
              if (typeof w === 'string') {
                  const baseW = { id: w as string, name: w as string, address: "", receiverName: "" };
                  return w === id ? { ...baseW, ...updates } : baseW;
              }
              return w.id === id ? { ...w, ...updates } : w;
          })
      })),
      deleteWarehouse: (id) => set((state) => ({ 
          warehouses: state.warehouses.filter(w => (typeof w === 'string' ? w : w.id) !== id) 
      })),
    }),
    {
      name: 'warehouse-storage',
    }
  )
);
