const axios = require("axios");

async function testUserServiceDirect() {
  console.log("🔍 Testing User Service Directly...\n");

  try {
    // First get the user service details from registry
    console.log("1. Getting user service details from registry...");
    const registryResponse = await axios.get("http://localhost:4000/find/user-service/*");
    const userService = registryResponse.data;
    
    // Check if we got instances or direct service data
    if (userService.instances && userService.instances.length > 0) {
      userService = userService.instances[0];
    }
    
    console.log(`✅ User service found:`);
    console.log(`   IP: ${userService.ip}`);
    console.log(`   Port: ${userService.port}`);
    console.log(`   Version: ${userService.version}`);
    
    const userServiceUrl = `http://${userService.ip}:${userService.port}`;
    
    // Test health endpoint
    console.log("\n2. Testing user service health...");
    try {
      const healthResponse = await axios.get(`${userServiceUrl}/health`);
      console.log("✅ User service health check passed");
      console.log(`   Service: ${healthResponse.data.service}`);
    } catch (error) {
      console.log("❌ User service health check failed:", error.message);
      return;
    }
    
    // Test validate-admin endpoint directly
    console.log("\n3. Testing validate-admin endpoint directly...");
    try {
      const adminResponse = await axios.post(`${userServiceUrl}/validate-admin`, {
        identifier: "admin"
      });
      
      console.log("✅ Admin validation response:", adminResponse.data);
      
      if (adminResponse.data.valid) {
        console.log(`   Admin found: ${adminResponse.data.admin.name}`);
        console.log(`   Permissions: ${adminResponse.data.admin.permissions.join(", ")}`);
      } else {
        console.log("   Admin not found or invalid");
      }
    } catch (error) {
      console.log("❌ Admin validation failed:", error.response?.data || error.message);
    }
    
    // Test check-permission endpoint
    console.log("\n4. Testing check-permission endpoint...");
    try {
      const permissionResponse = await axios.post(`${userServiceUrl}/check-permission`, {
        identifier: "admin",
        permission: "product_create"
      });
      
      console.log("✅ Permission check response:", permissionResponse.data);
    } catch (error) {
      console.log("❌ Permission check failed:", error.response?.data || error.message);
    }
    
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

testUserServiceDirect().catch(console.error);