const axios = require("axios");

async function testUserDetails() {
  console.log("🔍 Testing User Details Functionality...\n");

  try {
    // Test 1: Get user list to see available users
    console.log("1. Getting available users...");
    try {
      const usersResponse = await axios.get("http://localhost:3000/api/users");
      console.log("✅ Users list successful");
      console.log("   Full response:", usersResponse.data);
      console.log(`   Found ${usersResponse.data.data?.length || 0} users`);

      if (usersResponse.data.data && usersResponse.data.data.length > 0) {
        const sampleUser = usersResponse.data.data[0];
        console.log(
          `   Sample user: ${sampleUser.name} (${sampleUser.shortname})`
        );
      }
    } catch (error) {
      console.log(
        "❌ Users list failed:",
        error.response?.data || error.message
      );
    }

    // Test 2: Test gateway user endpoint directly
    console.log("\n2. Testing gateway user endpoint...");
    try {
      const gatewayResponse = await axios.get(
        "http://localhost:8080/user/admin"
      );
      console.log("✅ Gateway user endpoint successful");
      console.log("   User data:", gatewayResponse.data);
    } catch (error) {
      console.log("❌ Gateway user endpoint failed:");
      console.log("   Status:", error.response?.status);
      console.log("   Data:", error.response?.data);
    }

    // Test 3: Test frontend user details endpoint
    console.log("\n3. Testing frontend user details endpoint...");
    try {
      const userDetailsResponse = await axios.get(
        "http://localhost:3000/api/users/admin"
      );
      console.log("✅ Frontend user details successful");
      console.log(
        "   Response structure:",
        Object.keys(userDetailsResponse.data)
      );
      if (userDetailsResponse.data.success) {
        console.log("   User:", userDetailsResponse.data.data.user?.name);
        console.log(
          "   Total votes:",
          userDetailsResponse.data.data.totalVotes
        );
      }
    } catch (error) {
      console.log("❌ Frontend user details failed:");
      console.log("   Status:", error.response?.status);
      console.log("   Data:", error.response?.data);
      console.log("   Message:", error.message);
    }

    // Test 4: Test with a regular user
    console.log("\n4. Testing with regular user 'test_user'...");
    try {
      const testUserResponse = await axios.get(
        "http://localhost:3000/api/users/test_user"
      );
      console.log("✅ Test user details successful");
      console.log("   User:", testUserResponse.data.data?.user?.name);
    } catch (error) {
      console.log("❌ Test user details failed:");
      console.log("   Status:", error.response?.status);
      console.log("   Data:", error.response?.data);
    }
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

testUserDetails().catch(console.error);
