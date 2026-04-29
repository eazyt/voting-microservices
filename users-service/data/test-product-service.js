const axios = require("axios");

async function testProductService() {
  console.log("🔍 Testing Product Service Directly...\n");

  try {
    // Get product service details from registry
    console.log("1. Getting product service details from registry...");
    const registryResponse = await axios.get("http://localhost:4000/find/product-service/*");
    const productService = registryResponse.data;
    
    console.log(`✅ Product service found:`);
    console.log(`   IP: ${productService.ip}`);
    console.log(`   Port: ${productService.port}`);
    console.log(`   Version: ${productService.version}`);
    
    const productServiceUrl = `http://${productService.ip}:${productService.port}`;
    
    // Test health endpoint
    console.log("\n2. Testing product service health...");
    try {
      const healthResponse = await axios.get(`${productServiceUrl}/health`);
      console.log("✅ Product service health check passed");
      console.log(`   Service: ${healthResponse.data.service}`);
    } catch (error) {
      console.log("❌ Product service health check failed:", error.message);
      return;
    }
    
    // Test get products endpoint
    console.log("\n3. Testing get products endpoint...");
    try {
      const productsResponse = await axios.get(`${productServiceUrl}/products`);
      console.log("✅ Get products successful");
      console.log(`   Found ${productsResponse.data.length} products`);
    } catch (error) {
      console.log("❌ Get products failed:", error.response?.data || error.message);
    }
    
    // Test admin create product endpoint
    console.log("\n4. Testing admin create product endpoint...");
    try {
      const createResponse = await axios.post(`${productServiceUrl}/admin/create`, {
        name: "Test Product",
        description: "A test product for admin functionality",
        price: 29.99,
        category: "Test"
      }, {
        headers: {
          'x-admin-id': 'admin'
        }
      });
      
      console.log("✅ Admin create product successful:", createResponse.data);
    } catch (error) {
      console.log("❌ Admin create product failed:");
      console.log("   Status:", error.response?.status);
      console.log("   Data:", error.response?.data);
      console.log("   Message:", error.message);
    }
    
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

testProductService().catch(console.error);