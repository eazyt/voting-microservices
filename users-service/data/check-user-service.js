const axios = require("axios");

async function checkRunningServices() {
  console.log("🔍 Checking What Services Are Actually Running...\n");

  const services = [
    {
      name: "Registry",
      url: "http://localhost:4000",
      endpoints: ["/", "/health"],
    },
    {
      name: "Gateway",
      url: "http://localhost:8080",
      endpoints: ["/health", "/"],
    },
    {
      name: "Frontend",
      url: "http://localhost:3000",
      endpoints: ["/", "/api/stats"],
    },
  ];

  for (const service of services) {
    console.log(`Testing ${service.name} service (${service.url}):`);

    let working = false;
    for (const endpoint of service.endpoints) {
      try {
        const response = await axios.get(`${service.url}${endpoint}`, {
          timeout: 2000,
          validateStatus: () => true, // Accept any status code
        });

        console.log(`  ✅ ${endpoint} - Status: ${response.status}`);
        if (response.data) {
          console.log(
            `     Response: ${JSON.stringify(response.data).substring(
              0,
              100
            )}...`
          );
        }
        working = true;
        break; // If one endpoint works, service is running
      } catch (error) {
        console.log(`  ❌ ${endpoint} - Error: ${error.code || error.message}`);
      }
    }

    if (!working) {
      console.log(`  ❌ ${service.name} service is not responding`);
    }
    console.log("");
  }

  // Try to find what's actually running on these ports
  console.log("💡 To check what's running on these ports:");
  console.log('   Windows: netstat -ano | findstr ":4000\\|:8080\\|:3000"');
  console.log('   Linux/Mac: netstat -tulpn | grep -E ":4000|:8080|:3000"');
  console.log("");

  // Check if we can reach any registry endpoints
  console.log("🔍 Trying to find registry service endpoints...");
  const registryEndpoints = [
    "/find/user-service/*",
    "/find/product-service/*",
    "/find/gateway-service/*",
  ];

  for (const endpoint of registryEndpoints) {
    try {
      const response = await axios.get(`http://localhost:4000${endpoint}`, {
        timeout: 1000,
        validateStatus: () => true,
      });
      if (response.status === 404) {
        console.log(
          `  ✅ Registry ${endpoint} - Working (404 = no service registered)`
        );
      } else {
        console.log(`  ✅ Registry ${endpoint} - Status: ${response.status}`);
        if (response.data) {
          console.log(`     Found: ${JSON.stringify(response.data)}`);
        }
      }
    } catch (error) {
      console.log(`  ❌ Registry ${endpoint} - ${error.code || error.message}`);
    }
  }
}

if (require.main === module) {
  checkRunningServices().catch(console.error);
}

module.exports = { checkRunningServices };
