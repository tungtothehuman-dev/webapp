const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs, deleteDoc, doc } = require("firebase/firestore");

const firebaseConfig = {
  apiKey: "AIzaSyAsGdzCjWTdaAnyB5kJohu_xLGBjwtCEuk",
  authDomain: "the-hub-ae1b5.firebaseapp.com",
  projectId: "the-hub-ae1b5",
  storageBucket: "the-hub-ae1b5.firebasestorage.app",
  messagingSenderId: "794984923709",
  appId: "1:794984923709:web:d6157f083f875e89b52054",
  measurementId: "G-NYVJ26M8CV"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function clean() {
  console.log("Fetching orders to clean...");
  const querySnapshot = await getDocs(collection(db, "orders"));
  let deleted = 0;
  for (const dbDoc of querySnapshot.docs) {
    const data = dbDoc.data();
    // File Ananbay bị lỗi up nhầm sẽ không có 'Sender Name' chuẩn (ví dụ)
    // Hoặc không có Description. Xóa tất cả các file rác này.
    if (!data.Description || data.Description.toString().trim() === "" || data.Description === "Tên hàng hóa") {
      await deleteDoc(doc(db, "orders", dbDoc.id));
      deleted++;
    }
  }
  console.log("Deleted " + deleted + " garbage orders!");
}
clean().catch(console.error);
