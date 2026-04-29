const axios = require("axios");

async function testAdminProductList() {
  console.log("🔍 Testing Admin Product List Loading...\n");

  try {
    // Test gateway products endpoint
    console.log("1. Testing gateway /products endpoint...");
    try {
      const gatewayResponse = await axios.get("http://localhost:8080/products");
      console.log("✅ Gateway /products successful");
      console.log(`   Found ${gatewayResponse.data.data?.length || 0} products`);
      console.log("   Full response:", JSON.stringify(gatewayResponse.data, null, 2));
    } catch (error) {
      console.log("❌ Gateway /products failed:");
      console.log("   Status:", error.response?.status);
      console.log("   Data:", error.response?.data);
      console.log("   Message:", error.message);
    }

    // Test direct product service endpoint
    console.log("\n2. Testing direct product service /products endpoint...");
    try {
      const registryResponse = await axios.get("http://localhost:4000/find/product-service/*");
      const productService = registryResponse.data;
      const productServiceUrl = `http://${productService.ip}:${productService.port}`;
      
      const directResponse = await axios.get(`${productServiceUrl}/products`);
      console.log("✅ Direct product service /products successful");
      console.log(`   Found ${directResponse.data.length} products`);
      if (directResponse.data.length > 0) {
        console.log("   Sample product:", directResponse.data[0]);
      }
    } catch (error) {
      console.log("❌ Direct product service /products failed:");
      console.log("   Status:", error.response?.status);
      console.log("   Data:", error.response?.data);
      console.log("   Message:", error.message);
    }

    // Test frontend products endpoint (what admin panel actually calls)
    console.log("\n3. Testing frontend /products endpoint...");
    try {
      const frontendResponse = await axios.get("http://localhost:3000/products");
      console.log("✅ Frontend /products successful");
      console.log(`   Found ${frontendResponse.data.data?.length || 0} products`);
      console.log("   Response structure:", Object.keys(frontendResponse.data));
    } catch (error) {
      console.log("❌ Frontend /products failed:");
      console.log("   Status:", error.response?.status);
      console.log("   Data:", error.response?.data);
      console.log("   Message:", error.message);
    }

    // Test frontend individual product endpoint
    console.log("\n4. Testing frontend /products/:productId endpoint...");
    try {
      const frontendResponse = await axios.get("http://localhost:3000/products/prod_001");
      console.log("✅ Frontend /products/:productId successful");
      console.log("   Product:", frontendResponse.data.data?.name);
    } catch (error) {
      console.log("❌ Frontend /products/:productId failed:");
      console.log("   Status:", error.response?.status);
      console.log("   Data:", error.response?.data);
      console.log("   Message:", error.message);
    }

    // Test if there's a specific admin products endpoint on gateway
    console.log("\n4. Testing gateway admin products endpoint...");
    try {
      const adminResponse = await axios.get("http://localhost:8080/admin/products", {
        headers: {
          'x-admin-id': 'admin'
        }
      });
      console.log("✅ Gateway /admin/products successful");
      console.log("   Response:", adminResponse.data);
    } catch (error) {
      console.log("❌ Gateway /admin/products failed:");
      console.log("   Status:", error.response?.status);
      console.log("   Data:", error.response?.data);
      console.log("   Message:", error.message);
    }

  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

testAdminProductList().catch(console.error);