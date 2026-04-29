const axios = require("axios");

async function checkRunningServices() {
  console.log("🔍 Checking What Services Are Actually Running...\n");

  const services = [
    { name: "Registry", url: "http://localhost:4000", endpoints: ["/", "/health"] },
    { name: "Gateway", url: "http://localhost:8080", endpoints: ["/health"] },
    { name: "Frontend", url: "http://localhost:3000", endpoints: ["/"] }
  ];

  for (const service of services) {
    console.log(`Testing ${service.name} service (${service.url}):`);
    
    for (const endpoint of service.endpoints) {
      try {
        const response = await axios.get(`${service.url}${endpoint}`, { timeout: 3000 });
        console.log(`✅ ${endpoint} - Status: ${response.status}`);
        
        // Show first 100 chars of response for debugging
        const responseText = typeof response.data === 'string' 
          ? response.data.substring(0, 100) + "..."
          : JSON.stringify(response.data).substring(0, 100) + "...";
        console.log(`   Response: ${responseText}`);
      } catch (error) {
        if (error.response) {
          console.log(`❌ ${endpoint} - Status: ${error.response.status}`);
          const responseText = typeof error.response.data === 'string' 
            ? error.response.data.substring(0, 100) + "..."
            : JSON.stringify(error.response.data).substring(0, 100) + "...";
          console.log(`   Response: ${responseText}`);
        } else {
          console.log(`❌ ${endpoint} - Error: ${error.message}`);
        }
      }
    }
    console.log("");
  }

  console.log("💡 To check what's running on these ports:");
  console.log('Windows: netstat -ano | findstr ":4000\\|:8080\\|:3000"');
  console.log('Linux/Mac: netstat -tulpn | grep -E ":4000|:8080|:3000"');

  // Try to find services through registry
  console.log("\n🔍 Trying to find registry service endpoints...");
  try {
    const userServiceResponse = await axios.get("http://localhost:4000/find/user-service/*");
    console.log("✅ Registry /find/user-service/* - Status: 200");
    console.log(`   Found: ${JSON.stringify(userServiceResponse.data)}`);
  } catch (error) {
    console.log("❌ Registry /find/user-service/* failed:", error.message);
  }

  try {
    const productServiceResponse = await axios.get("http://localhost:4000/find/product-service/*");
    console.log("✅ Registry /find/product-service/* - Status: 200");
    console.log(`   Found: ${JSON.stringify(productServiceResponse.data)}`);
  } catch (error) {
    console.log("❌ Registry /find/product-service/* failed:", error.message);
  }

  try {
    const gatewayServiceResponse = await axios.get("http://localhost:4000/find/gateway-service/*");
    console.log("✅ Registry /find/gateway-service/* - Status: 200");
    console.log(`   Found: ${JSON.stringify(gatewayServiceResponse.data)}`);
  } catch (error) {
    console.log("❌ Registry /find/gateway-service/* failed:", error.message);
  }
}

checkRunningServices().catch(console.error);