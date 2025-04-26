import { db } from "../config/firebase-config.js";
import { collection, query, where, getDocs } from "firebase/firestore";

export const getServices = async (options = {}) => {
  const searchQuery = (options.search || "").toLowerCase();
  const limit = parseInt(options.limit) || 100;

  try {
    const snapshot = await getDocs(
      query(collection(db, "services"), where("status", "==", "public"))
    );

    const services = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        service: data.service || "Unnamed Service",
        service_description: data.service_description || "",
        price: data.price || "Price not available",
        price_extension: data.price_extension || "",
        duration: data.duration || "Duration not specified",
        category: data.category || "General",
        status: data.status || "public",
        imageUrl: data.imageUrl || null,
        createdAt: data.createdAt?.toDate() || null,
        updatedAt: data.updatedAt?.toDate() || null
      };
    });

    const filteredServices = services.filter(service => 
      searchQuery ? service.service.toLowerCase().includes(searchQuery) : true
    );

    return filteredServices.slice(0, limit);

  } catch (error) {
    console.error("Error fetching services:", error);
    throw new Error("Failed to fetch services. Please try again later.");
  }
};

// Express handler version
export const getServicesHandler = async (req, res) => {
  try {
    const data = await getServices(req.query);
    res.status(200).json({
      success: true,
      data: data,
      count: data.length
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};