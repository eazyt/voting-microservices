const axios = require("axios");

// Configuration for local services
const GATEWAY_URL = "http://localhost:8080"; // Gateway service (actual port from registry)
const FRONTEND_URL = "http://localhost:3000"; // Frontend service (default port)
const REGISTRY_URL = "http://localhost:4000"; // Registry service (fixed port)
const ADMIN_CREDENTIALS = {
  identifier: "admin", // Default admin shortname
};

async function testAdminUser() {
  console.log("🔍 Testing Admin User Setup...\n");

  try {
    // Test 1: Check if registry service is running
    console.log("1. Testing registry service connection...");
    try {
      // Try to find a service (this will test if registry is working)
      const testResponse = await axios.get(`${REGISTRY_URL}/find/user-service/*`, {
        timeout: 3000,
      });
      console.log("✅ Registry service is running (port 4000)");
      console.log("   Found user-service in registry");
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.log("✅ Registry service is running (port 4000)");
        console.log("   Registry is working but no user-service registered yet");
      } else {
        console.log("❌ Registry service not accessible on port 4000");
        console.log("   Make sure registry service is running");
        console.log("   Error:", error.message);
        return;
      }
    }

    // Test 2: Check if gateway service is running
    console.log("\n2. Testing gateway service connection...");
    try {
      const healthResponse = await axios.get(`${GATEWAY_URL}/health`, {
        timeout: 5000,
      });
      console.log("✅ Gateway service is running (port 8080)");
      console.log(
        `   Service: ${healthResponse.data.service || "gateway-service"}`
      );
    } catch (error) {
      console.log("❌ Gateway service not accessible on port 8080");
      console.log("   Make sure gateway service is running");
      return;
    }

    // Test 3: Check if frontend service is running
    console.log("\n3. Testing frontend service connection...");
    try {
      const frontendResponse = await axios.get(`${FRONTEND_URL}`, {
        timeout: 5000,
      });
      console.log("✅ Frontend service is running (port 3000)");
    } catch (error) {
      console.log("❌ Frontend service not accessible on port 3000");
      console.log("   Make sure frontend service is running");
      return;
    }

    // Test 4: Check if user service is registered
    console.log("\n4. Checking user service registration...");
    try {
      const userServiceResponse = await axios.get(
        `${REGISTRY_URL}/find/user-service/*`
      );
      console.log("✅ User service found in registry");
      console.log(`   IP: ${userServiceResponse.data.ip}`);
      console.log(`   Port: ${userServiceResponse.data.port}`);
      console.log(`   Version: ${userServiceResponse.data.version}`);
    } catch (error) {
      console.log("❌ User service not found in registry");
      console.log("   Make sure user service is running and registered");
      console.log("   Error:", error.response?.data || error.message);
      return;
    }

    // Test 5: Check if admin user exists by trying to validate through gateway
    console.log("\n5. Testing admin user validation through gateway...");
    try {
      const validateResponse = await axios.post(`${GATEWAY_URL}/admin/login`, {
        identifier: "admin",
      });

      console.log("Gateway response:", validateResponse.data);

      if (validateResponse.data.valid) {
        console.log("✅ Admin user found and validated through gateway");
        console.log(`   Admin: ${validateResponse.data.admin.name}`);
        console.log(`   Shortname: ${validateResponse.data.admin.shortname}`);
        console.log(
          `   Permissions: ${validateResponse.data.admin.permissions.join(
            ", "
          )}`
        );
      } else {
        console.log("❌ Admin user not found or not valid");
        console.log("   This means the admin user was not created properly");
        console.log("   Run: node reset-admin-user.js");
      }
    } catch (error) {
      console.log(
        "❌ Error validating admin user through gateway:",
        error.response?.data || error.message
      );
      console.log(
        "   This could mean the user service is not responding or admin user doesn't exist"
      );
    }

    // Test 6: Test frontend admin login
    console.log("\n6. Testing frontend admin login...");
    try {
      const frontendResponse = await axios.post(`${FRONTEND_URL}/admin/login`, {
        identifier: "admin",
      });

      console.log("Frontend response:", frontendResponse.data);

      if (frontendResponse.data.success) {
        console.log("✅ Frontend admin login successful");
        console.log(`   Admin: ${frontendResponse.data.admin.name}`);
      } else {
        console.log("❌ Frontend admin login failed");
        console.log(`   Error: ${frontendResponse.data.error}`);
      }
    } catch (error) {
      console.log(
        "❌ Frontend admin login error:",
        error.response?.data || error.message
      );
    }

    // Test 7: Test permission checking
    console.log("\n7. Testing admin permission checking...");
    try {
      const permissionResponse = await axios.post(
        `${GATEWAY_URL}/admin/check-permission`,
        {
          identifier: "admin",
          permission: "product_create",
        }
      );

      console.log("Permission response:", permissionResponse.data);

      if (permissionResponse.data.hasPermission) {
        console.log("✅ Admin has product creation permission");
      } else {
        console.log("❌ Admin does not have product creation permission");
      }
    } catch (error) {
      console.log(
        "❌ Permission check error:",
        error.response?.data || error.message
      );
    }
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

// Run the test
if (require.main === module) {
  testAdminUser().catch(console.error);
}

module.exports = { testAdminUser };
