import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyA6BgBhM5VeujOSUKB26rViEP4saXqWtWo",
  authDomain: "rantonme-5875c.firebaseapp.com",
  databaseURL: "https://rantonme-5875c-default-rtdb.firebaseio.com",
  projectId: "rantonme-5875c",
  storageBucket: "rantonme-5875c.appspot.com",
  messagingSenderId: "39169697448",
  appId: "1:39169697448:web:adb482ff51f6909c85049d"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

export { app, database };