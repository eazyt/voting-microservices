const axios = require('axios');

// Configuration
const GATEWAY_URL = 'http://localhost:8080';
const ADMIN_CREDENTIALS = {
  identifier: 'admin' // Default admin shortname
};

async function testAdminSetup() {
  console.log('🔧 Testing Admin Setup and Product Management Permissions...\n');

  try {
    // Test 1: Admin Login
    console.log('1. Testing admin login...');
    const loginResponse = await axios.post(`${GATEWAY_URL}/admin/login`, ADMIN_CREDENTIALS);
    
    if (loginResponse.data.valid && loginResponse.data.admin) {
      console.log('✅ Admin login successful');
      console.log(`   Admin: ${loginResponse.data.admin.name} (${loginResponse.data.admin.shortname})`);
      console.log(`   Permissions: ${loginResponse.data.admin.permissions.join(', ')}`);
      
      const adminId = loginResponse.data.admin.shortname;
      
      // Test 2: Check Product Creation Permission
      console.log('\n2. Testing product creation permission...');
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
      
      // Test 3: Check Product Edit Permission
      console.log('\n3. Testing product edit permission...');
      const editPermissionResponse = await axios.post(`${GATEWAY_URL}/admin/check-permission`, {
        identifier: adminId,
        permission: 'product_edit'
      });
      
      if (editPermissionResponse.data.hasPermission) {
        console.log('✅ Admin has product edit permission');
      } else {
        console.log('❌ Admin does not have product edit permission');
      }
      
      // Test 4: Check Product Delete Permission
      console.log('\n4. Testing product delete permission...');
      const deletePermissionResponse = await axios.post(`${GATEWAY_URL}/admin/check-permission`, {
        identifier: adminId,
        permission: 'product_delete'
      });
      
      if (deletePermissionResponse.data.hasPermission) {
        console.log('✅ Admin has product delete permission');
      } else {
        console.log('❌ Admin does not have product delete permission');
      }
      
      // Test 5: Test Creating a Product
      console.log('\n5. Testing product creation...');
      const testProduct = {
        name: 'Test Admin Product',
        description: 'A test product created by the admin user',
        price: 29.99,
        category: 'Test'
      };
      
      try {
        const createProductResponse = await axios.post(`${GATEWAY_URL}/admin/products`, testProduct, {
          headers: {
            'x-admin-id': adminId
          }
        });
        
        if (createProductResponse.data.success) {
          console.log('✅ Product creation successful');
          console.log(`   Product: ${createProductResponse.data.data.name}`);
          console.log(`   ID: ${createProductResponse.data.data.id}`);
          
          const productId = createProductResponse.data.data.id;
          
          // Test 6: Test Updating the Product
          console.log('\n6. Testing product update...');
          const updateData = {
            description: 'Updated test product description',
            price: 39.99
          };
          
          const updateProductResponse = await axios.put(`${GATEWAY_URL}/admin/products/${productId}`, updateData, {
            headers: {
              'x-admin-id': adminId
            }
          });
          
          if (updateProductResponse.data.success) {
            console.log('✅ Product update successful');
            console.log(`   Updated price: $${updateProductResponse.data.data.price}`);
          } else {
            console.log('❌ Product update failed');
          }
          
          // Test 7: Test Deleting the Product
          console.log('\n7. Testing product deletion...');
          const deleteProductResponse = await axios.delete(`${GATEWAY_URL}/admin/products/${productId}`, {
            headers: {
              'x-admin-id': adminId
            }
          });
          
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
    console.error('   - Gateway Service (port 8080)');
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
}

if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { testAdminSetup, testRegularUserRestrictions };