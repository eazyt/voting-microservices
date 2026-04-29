const axios = require("axios");

async function testGatewayDiscovery() {
  console.log("🔍 Testing Gateway Service Discovery...\n");

  try {
    // Test what the registry returns for user-service
    console.log("1. Testing registry response for user-service...");
    for (let i = 0; i < 5; i++) {
      const response = await axios.get("http://localhost:4000/find/user-service/*");
      console.log(`   Attempt ${i + 1}: Port ${response.data.port}`);
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Test gateway admin login to see what error we get
    console.log("\n2. Testing gateway admin login with detailed error...");
    try {
      const gatewayResponse = await axios.post("http://localhost:8080/admin/login", {
        identifier: "admin"
      });
      console.log("✅ Gateway admin login successful:", gatewayResponse.data);
    } catch (error) {
      console.log("❌ Gateway admin login failed:");
      console.log("   Status:", error.response?.status);
      console.log("   Data:", error.response?.data);
      console.log("   Message:", error.message);
    }

    // Wait 6 seconds for gateway cache to expire, then try again
    console.log("\n3. Waiting 6 seconds for gateway cache to expire...");
    await new Promise(resolve => setTimeout(resolve, 6000));
    
    console.log("4. Testing gateway admin login after cache expiry...");
    try {
      const gatewayResponse = await axios.post("http://localhost:8080/admin/login", {
        identifier: "admin"
      });
      console.log("✅ Gateway admin login successful:", gatewayResponse.data);
    } catch (error) {
      console.log("❌ Gateway admin login still failed:");
      console.log("   Status:", error.response?.status);
      console.log("   Data:", error.response?.data);
      console.log("   Message:", error.message);
    }

  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

testGatewayDiscovery().catch(console.error);