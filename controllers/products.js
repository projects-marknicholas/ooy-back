import { db } from "../config/firebase-config.js";
import { collection, query, where, getDocs } from "firebase/firestore";

export const getProducts = async (options = {}) => {
  const searchQuery = (options.search || "").toLowerCase();
  const limit = parseInt(options.limit) || 100;

  try {
    const snapshot = await getDocs(
      query(collection(db, "products"), where("status", "==", "public"))
    );

    const products = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        product: data.product || "Unnamed Product",
        description: data.description || "",
        price: data.price || "Price not available",
        price_extension: data.price_extension || "",
        category: data.category || "Uncategorized",
        status: data.status || "public",
        imageUrl: data.imageUrl || null,
        createdAt: data.createdAt?.toDate() || null,
        updatedAt: data.updatedAt?.toDate() || null
      };
    });

    const filteredProducts = products.filter(product => 
      searchQuery ? product.product.toLowerCase().includes(searchQuery) : true
    );

    return filteredProducts.slice(0, limit);

  } catch (error) {
    console.error("Error fetching products:", error);
    throw new Error("Failed to fetch products. Please try again later.");
  }
};

// Express handler version
export const getProductsHandler = async (req, res) => {
  try {
    const data = await getProducts(req.query);
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