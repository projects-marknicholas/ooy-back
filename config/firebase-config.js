import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA6BgBhM5VeujOSUKB26rViEP4saXqWtWo",
  authDomain: "rantonme-5875c.firebaseapp.com",
  projectId: "rantonme-5875c",
  storageBucket: "rantonme-5875c.firebasestorage.app",
  messagingSenderId: "39169697448",
  appId: "1:39169697448:web:adb482ff51f6909c85049d",
  measurementId: "6GEGT5GH1K"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };