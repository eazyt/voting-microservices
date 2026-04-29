const axios = require('axios');

// Configuration - Updated to use correct ports
const GATEWAY_URL = 'http://localhost:3000';  // Gateway service port
const FRONTEND_URL = 'http://localhost:8080'; // Frontend service port
const ADMIN_CREDENTIALS = {
  identifier: 'admin' // Default admin shortname
};

async function testAdminSetup() {
  console.log('🔧 Testing Admin Setup and Product Management Permissions...\n');

  try {
    // Test 1: Check if services are running
    console.log('1. Checking if services are running...');
    
    try {
      const gatewayHealth = await axios.get(`${GATEWAY_URL}/health`, { timeout: 3000 });
      console.log('✅ Gateway service is running (port 3000)');
    } catch (error) {
      console.log('❌ Gateway service not running on port 3000');
      console.log('   Make sure to run: start-all-services.bat');
      return;
    }

    try {
      const frontendTest = await axios.get(`${FRONTEND_URL}`, { timeout: 3000 });
      console.log('✅ Frontend service is running (port 8080)');
    } catch (error) {
      console.log('❌ Frontend service not running on port 8080');
      return;
    }

    // Test 2: Admin Login via Frontend
    console.log('\n2. Testing admin login via frontend...');
    const loginResponse = await axios.post(`${FRONTEND_URL}/admin/login`, ADMIN_CREDENTIALS);
    
    if (loginResponse.data.success && loginResponse.data.admin) {
      console.log('✅ Admin login successful');
      console.log(`   Admin: ${loginResponse.data.admin.name} (${loginResponse.data.admin.shortname})`);
      console.log(`   Permissions: ${loginResponse.data.admin.permissions.join(', ')}`);
      
      const adminId = loginResponse.data.admin.shortname;
      
      // Test 3: Check Product Creation Permission via Gateway
      console.log('\n3. Testing product creation permission...');
      const createPermissionResponse = await axios.post(`${GATEWAY_URL}/admin/check-permission`, {
        identifier: adminId,
        permission: 'product_create'
      });
      
      if (createPermissionResponse.data.hasPermission) {
        console.log('✅ Admin has product creation permission');
      } else {
        console.log('❌ Admin does not have product creation permission');
        return;
      }
      
      // Test 4: Check Product Edit Permission
      console.log('\n4. Testing product edit permission...');
      const editPermissionResponse = await axios.post(`${GATEWAY_URL}/admin/check-permission`, {
        identifier: adminId,
        permission: 'product_edit'
      });
      
      if (editPermissionResponse.data.hasPermission) {
        console.log('✅ Admin has product edit permission');
      } else {
        console.log('❌ Admin does not have product edit permission');
      }
      
      // Test 5: Check Product Delete Permission
      console.log('\n5. Testing product delete permission...');
      const deletePermissionResponse = await axios.post(`${GATEWAY_URL}/admin/check-permission`, {
        identifier: adminId,
        permission: 'product_delete'
      });
      
      if (deletePermissionResponse.data.hasPermission) {
        console.log('✅ Admin has product delete permission');
      } else {
        console.log('❌ Admin does not have product delete permission');
      }
      
      // Test 6: Test Creating a Product via Frontend
      console.log('\n6. Testing product creation via frontend...');
      const testProduct = {
        name: 'Test Admin Product',
        description: 'A test product created by the admin user',
        price: 29.99,
        category: 'Test'
      };
      
      try {
        const createProductResponse = await axios.post(`${FRONTEND_URL}/admin/products`, testProduct);
        
        if (createProductResponse.data.success) {
          console.log('✅ Product creation successful');
          console.log(`   Product: ${createProductResponse.data.data.name}`);
          console.log(`   ID: ${createProductResponse.data.data.id}`);
          
          const productId = createProductResponse.data.data.id;
          
          // Test 7: Test Updating the Product
          console.log('\n7. Testing product update...');
          const updateData = {
            description: 'Updated test product description',
            price: 39.99
          };
          
          const updateProductResponse = await axios.put(`${FRONTEND_URL}/admin/products/${productId}`, updateData);
          
          if (updateProductResponse.data.success) {
            console.log('✅ Product update successful');
            console.log(`   Updated price: $${updateProductResponse.data.data.price}`);
          } else {
            console.log('❌ Product update failed');
          }
          
          // Test 8: Test Deleting the Product
          console.log('\n8. Testing product deletion...');
          const deleteProductResponse = await axios.delete(`${FRONTEND_URL}/admin/products/${productId}`);
          
          if (deleteProductResponse.data.success) {
            console.log('✅ Product deletion successful');
            console.log(`   ${deleteProductResponse.data.message}`);
          } else {
            console.log('❌ Product deletion failed');
          }
          
        } else {
          console.log('❌ Product creation failed:', createProductResponse.data.error);
        }
      } catch (productError) {
        console.log('❌ Product creation failed:', productError.response?.data?.error || productError.message);
      }
      
    } else {
      console.log('❌ Admin login failed');
      console.log('   Response:', loginResponse.data);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    console.error('   Make sure all services are running:');
    console.error('   - Gateway Service (port 3000)');
    console.error('   - Frontend Service (port 8080)');
    console.error('   - User Service');
    console.error('   - Product Service');
    console.error('   - MongoDB');
  }
}

// Test regular user cannot manage products
async function testRegularUserRestrictions() {
  console.log('\n\n🔒 Testing Regular User Restrictions...\n');
  
  try {
    // Test with a regular user (should fail)
    console.log('1. Testing product creation with regular user...');
    const testProduct = {
      name: 'Unauthorized Product',
      description: 'This should fail',
      price: 19.99,
      category: 'Test'
    };
    
    const createResponse = await axios.post(`${GATEWAY_URL}/admin/products`, testProduct, {
      headers: {
        'x-admin-id': 'test_user' // Regular user, not admin
      }
    });
    
    console.log('❌ Regular user was able to create product (this should not happen)');
    
  } catch (error) {
    if (error.response && error.response.status === 403) {
      console.log('✅ Regular user correctly blocked from creating products');
      console.log(`   Error: ${error.response.data.error}`);
    } else if (error.response && error.response.status === 401) {
      console.log('✅ Regular user correctly blocked - authentication required');
      console.log(`   Error: ${error.response.data.error}`);
    } else {
      console.log('❌ Unexpected error:', error.response?.data || error.message);
    }
  }
}

// Run the tests
async function runAllTests() {
  await testAdminSetup();
  await testRegularUserRestrictions();
  
  console.log('\n\n📋 Summary:');
  console.log('- Default admin user: admin@votingsystem.com (shortname: admin)');
  console.log('- Admin has exclusive product management permissions:');
  console.log('  • product_create');
  console.log('  • product_edit'); 
  console.log('  • product_delete');
  console.log('- Regular users can only vote, not manage products');
  console.log('- Admin authentication is required for all product management operations');
  console.log('\n💡 To test manually:');
  console.log('1. Go to http://localhost:8080');
  console.log('2. Click "Admin" in navigation');
  console.log('3. Login with shortname: admin');
  console.log('4. Access admin panel to manage products');
}

if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { testAdminSetup, testRegularUserRestrictions };