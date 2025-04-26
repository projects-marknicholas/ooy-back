// notes.js
import { db } from "../config/firebase-config.js";
import { collection, query, where, getDocs } from "firebase/firestore";

export const getNotes = async (options = {}) => {
  const limit = parseInt(options.limit) || 100;

  try {
    const snapshot = await getDocs(
      query(collection(db, "notes"), where("status", "==", "public"))
    );

    return snapshot.docs
      .map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title || "Untitled Note",
          content: data.description || "",
          status: data.status || "public"
        };
      })
      .slice(0, limit);
  } catch (error) {
    console.error("Error fetching notes:", error);
    return [];
  }
};