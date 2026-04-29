const { MongoClient } = require("mongodb");

class UserService {
  constructor(config) {
    this.mongoUrl = config.mongoUrl || "mongodb://root:example@localhost:27017";
    this.dbName = config.dbName || "userservice";
    this.collectionName = "users";
    this.client = null;
    this.db = null;
  }

  async connect() {
    if (!this.client) {
      try {
        console.log(`Attempting to connect to MongoDB at: ${this.mongoUrl}`);
        console.log(`Target database: ${this.dbName}`);

        // MongoDB 4.17.2 compatible connection options (no deprecated options)
        const options = {
          serverSelectionTimeoutMS: 5000,
          connectTimeoutMS: 10000,
          maxPoolSize: 10,
          socketTimeoutMS: 45000,
        };

        this.client = new MongoClient(this.mongoUrl, options);
        await this.client.connect();

        // Test the connection with a simple ping
        console.log("Testing MongoDB connection...");
        await this.client.db("admin").command({ ping: 1 });
        console.log("MongoDB ping successful");

        this.db = this.client.db(this.dbName);
        console.log("Connected to MongoDB for Users Service");
      } catch (error) {
        console.error("MongoDB connection failed:", error.message);
        console.error("Error details:", {
          url: this.mongoUrl,
          database: this.dbName,
          errorType: error.constructor.name,
          errorCode: error.code,
        });

        // Provide specific troubleshooting for common issues
        if (error.message.includes("Authentication failed")) {
          console.error(
            "💡 Authentication issue - check username/password in connection string"
          );
        } else if (error.message.includes("ECONNREFUSED")) {
          console.error("💡 MongoDB container not running or not accessible");
        } else if (error.message.includes("MongoDBResponse")) {
          console.error(
            "💡 MongoDB driver compatibility issue - try reinstalling dependencies"
          );
          console.error(
            "   Run: rm -rf node_modules package-lock.json && npm install"
          );
        }

        throw error;
      }
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
    }
  }

  async initializeData() {
    try {
      console.log("Starting MongoDB initialization for Users Service...");
      await this.connect();

      const collection = this.db.collection(this.collectionName);
      console.log("Connected to users collection");

      // Check if data already exists
      const count = await collection.countDocuments();
      console.log(`Found ${count} existing users in database`);

      if (count > 0) {
        console.log("User data already exists in MongoDB");
        return;
      }

      console.log("Initializing user data from file...");

      // Load user data from dedicated user data file
      const fs = require("fs");
      const path = require("path");

      // Try multiple possible data file locations
      const possiblePaths = [
        path.join(__dirname, "../../data/sample-users.json"), // New dedicated user file
        path.join(__dirname, "../../data/users.json"), // Original file
        path.join(__dirname, "../../data/user-data.json"), // Alternative name
      ];

      let userData = null;
      let usedPath = null;

      for (const dataPath of possiblePaths) {
        try {
          if (fs.existsSync(dataPath)) {
            console.log(`Loading user data from: ${path.basename(dataPath)}`);
            const jsonData = JSON.parse(fs.readFileSync(dataPath, "utf8"));

            if (jsonData.users && Array.isArray(jsonData.users)) {
              userData = jsonData.users.map((user) => ({
                ...user,
                createdAt: user.createdAt
                  ? new Date(user.createdAt)
                  : new Date(),
                updatedAt: new Date(),
              }));
              usedPath = dataPath;
              console.log(
                `Successfully loaded ${
                  userData.length
                } users from ${path.basename(dataPath)}`
              );
              break;
            } else {
              console.log(
                `File ${path.basename(
                  dataPath
                )} does not have expected users array structure`
              );
            }
          }
        } catch (fileError) {
          console.log(
            `Error reading ${path.basename(dataPath)}:`,
            fileError.message
          );
        }
      }

      // If no valid data from files, create minimal default users including admin
      if (!userData) {
        console.log(
          "No valid user data files found, creating default users with admin..."
        );
        userData = [
          {
            id: "admin_001",
            name: "System Administrator",
            email: "admin@votingsystem.com",
            shortname: "admin",
            title: "System Administrator",
            summary: "Default system administrator with full product management access",
            description:
              "This is the default administrator account with capabilities to add, edit, and delete products in the voting system.",
            department: "Administration",
            location: "System",
            joinDate: new Date().toISOString().split("T")[0],
            createdAt: new Date(),
            updatedAt: new Date(),
            isActive: true,
            role: "admin",
            permissions: ["product_create", "product_edit", "product_delete", "user_management", "system_admin"],
            isDefaultAdmin: true
          },
          {
            id: "user_002",
            name: "Test User",
            email: "test@example.com",
            shortname: "test_user",
            title: "Test Account",
            summary: "Default test user account",
            description:
              "This is a test user account for development and testing.",
            department: "Testing",
            location: "Development",
            joinDate: new Date().toISOString().split("T")[0],
            createdAt: new Date(),
            updatedAt: new Date(),
            isActive: true,
            role: "user",
            permissions: ["vote"]
          },
        ];
      } else {
        // Ensure admin user exists in loaded data, if not add it
        const hasAdmin = userData.some(user => user.role === 'admin');
        if (!hasAdmin) {
          console.log("No admin user found in loaded data, adding default admin...");
          userData.unshift({
            id: "admin_001",
            name: "System Administrator",
            email: "admin@votingsystem.com",
            shortname: "admin",
            title: "System Administrator",
            summary: "Default system administrator with full product management access",
            description:
              "This is the default administrator account with capabilities to add, edit, and delete products in the voting system.",
            department: "Administration",
            location: "System",
            joinDate: new Date().toISOString().split("T")[0],
            createdAt: new Date(),
            updatedAt: new Date(),
            isActive: true,
            role: "admin",
            permissions: ["product_create", "product_edit", "product_delete", "user_management", "system_admin"],
            isDefaultAdmin: true
          });
        }
      }

      // Add MongoDB-specific fields and ensure data consistency
      const processedUserData = userData.map((user) => ({
        ...user,
        _id: undefined, // Let MongoDB generate the _id
        createdAt: user.createdAt || new Date(),
        updatedAt: new Date(),
        isActive: user.isActive !== undefined ? user.isActive : true,
      }));

      const result = await collection.insertMany(processedUserData);
      console.log(
        `User data loaded into MongoDB. Inserted ${result.insertedCount} users.`
      );

      if (usedPath) {
        console.log(`Data source: ${path.basename(usedPath)}`);
      }

      // Create indexes for better performance
      try {
        await collection.createIndex({ email: 1 }, { unique: true });
        await collection.createIndex({ shortname: 1 }, { unique: true });
        await collection.createIndex({ id: 1 }, { unique: true });
        await collection.createIndex({ isActive: 1 });
        await collection.createIndex({ department: 1 });
        console.log("Created database indexes for users collection");
      } catch (indexError) {
        console.log(
          "Note: Some indexes may already exist:",
          indexError.message
        );
      }
    } catch (error) {
      console.error("Detailed error in initializeData:", error);
      console.error("Error stack:", error.stack);
      console.error("MongoDB URL:", this.mongoUrl);
      console.error("Database name:", this.dbName);
      throw error; // Re-throw to be caught by the calling code
    }
  }
  async getNames() {
    await this.connect();
    const collection = this.db.collection(this.collectionName);

    const users = await collection
      .find(
        {},
        {
          projection: { name: 1, shortname: 1, _id: 0 },
        }
      )
      .toArray();

    return users;
  }

  async getListShort() {
    await this.connect();
    const collection = this.db.collection(this.collectionName);

    const users = await collection
      .find(
        {},
        {
          projection: { name: 1, shortname: 1, title: 1, _id: 0 },
        }
      )
      .toArray();

    return users;
  }

  async getList() {
    await this.connect();
    const collection = this.db.collection(this.collectionName);

    const users = await collection
      .find(
        {},
        {
          projection: { name: 1, shortname: 1, title: 1, summary: 1, _id: 0 },
        }
      )
      .toArray();

    return users;
  }

  async getAllArtwork() {
    await this.connect();
    const collection = this.db.collection(this.collectionName);

    const users = await collection
      .find(
        {},
        {
          projection: { artwork: 1, _id: 0 },
        }
      )
      .toArray();

    const artwork = users.reduce((acc, user) => {
      if (user.artwork) {
        acc = [...acc, ...user.artwork];
      }
      return acc;
    }, []);

    return artwork;
  }

  async getUser(shortname) {
    await this.connect();
    const collection = this.db.collection(this.collectionName);

    const user = await collection.findOne(
      { shortname: shortname },
      {
        projection: { 
          _id: 0,
          name: 1, 
          shortname: 1, 
          title: 1, 
          description: 1,
          email: 1,
          department: 1,
          location: 1,
          isActive: 1,
          role: 1,
          joinDate: 1,
          createdAt: 1,
          summary: 1
        },
      }
    );

    return user;
  }

  async getArtworkForUser(shortname) {
    await this.connect();
    const collection = this.db.collection(this.collectionName);

    const user = await collection.findOne(
      { shortname: shortname },
      { projection: { artwork: 1, _id: 0 } }
    );

    return user ? user.artwork : null;
  }

  async getData() {
    await this.connect();
    const collection = this.db.collection(this.collectionName);
    return await collection.find({}).toArray();
  }

  // User Registration Methods
  async registerUser(userData) {
    await this.connect();
    const collection = this.db.collection(this.collectionName);

    // Validate required fields
    if (!userData.email || !userData.name || !userData.shortname) {
      throw new Error(
        "Missing required fields: email, name, and shortname are required"
      );
    }

    // Check if user already exists (by email or shortname)
    const existingUser = await collection.findOne({
      $or: [{ email: userData.email }, { shortname: userData.shortname }],
    });

    if (existingUser) {
      if (existingUser.email === userData.email) {
        throw new Error("User with this email already exists");
      }
      if (existingUser.shortname === userData.shortname) {
        throw new Error("User with this shortname already exists");
      }
    }

    // Create new user document
    const newUser = {
      id: userData.shortname, // Use shortname as ID for consistency
      name: userData.name,
      email: userData.email,
      shortname: userData.shortname,
      title: userData.title || "User",
      summary: userData.summary || `${userData.name} - System User`,
      description: userData.description || `User account for ${userData.name}`,
      department: userData.department || "General",
      location: userData.location || "Unknown",
      joinDate: new Date().toISOString().split("T")[0],
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
      role: userData.role || "user",
      registrationSource: "self-registration",
    };

    // Insert the new user
    const result = await collection.insertOne(newUser);

    // Return the created user (without MongoDB _id)
    const createdUser = await collection.findOne(
      { _id: result.insertedId },
      { projection: { _id: 0 } }
    );

    console.log(`New user registered: ${newUser.name} (${newUser.shortname})`);
    return createdUser;
  }

  async validateUser(identifier) {
    await this.connect();
    const collection = this.db.collection(this.collectionName);

    // Find user by shortname, email, or id
    const user = await collection.findOne(
      {
        $or: [
          { shortname: identifier },
          { email: identifier },
          { id: identifier },
        ],
        isActive: true, // Only active users can vote
      },
      {
        projection: {
          _id: 0,
          name: 1,
          shortname: 1,
          email: 1,
          isActive: 1,
          role: 1,
        },
      }
    );

    return user;
  }

  async updateUser(shortname, updateData) {
    await this.connect();
    const collection = this.db.collection(this.collectionName);

    // Remove fields that shouldn't be updated directly
    const { _id, id, shortname: _, createdAt, ...allowedUpdates } = updateData;

    // Add updatedAt timestamp
    allowedUpdates.updatedAt = new Date();

    const result = await collection.updateOne(
      { shortname: shortname },
      { $set: allowedUpdates }
    );

    if (result.matchedCount === 0) {
      throw new Error("User not found");
    }

    // Return updated user
    return await collection.findOne(
      { shortname: shortname },
      { projection: { _id: 0 } }
    );
  }

  async deactivateUser(shortname) {
    await this.connect();
    const collection = this.db.collection(this.collectionName);

    const result = await collection.updateOne(
      { shortname: shortname },
      {
        $set: {
          isActive: false,
          updatedAt: new Date(),
          deactivatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      throw new Error("User not found");
    }

    return { success: true, message: "User deactivated successfully" };
  }

  async getUserStats(shortname) {
    await this.connect();
    const collection = this.db.collection(this.collectionName);

    const user = await collection.findOne(
      { shortname: shortname },
      { projection: { _id: 0 } }
    );

    if (!user) {
      throw new Error("User not found");
    }

    return {
      user,
      registrationDate: user.createdAt,
      isActive: user.isActive,
      role: user.role,
    };
  }

  // Admin-specific methods
  async validateAdmin(identifier) {
    await this.connect();
    const collection = this.db.collection(this.collectionName);

    // Find admin user by shortname, email, or id
    const user = await collection.findOne(
      {
        $or: [
          { shortname: identifier },
          { email: identifier },
          { id: identifier },
        ],
        isActive: true,
        role: "admin" // Must be admin role
      },
      {
        projection: {
          _id: 0,
          name: 1,
          shortname: 1,
          email: 1,
          isActive: 1,
          role: 1,
          permissions: 1,
          isDefaultAdmin: 1
        },
      }
    );

    return user;
  }

  async checkAdminPermission(identifier, permission) {
    const admin = await this.validateAdmin(identifier);
    
    if (!admin) {
      return { hasPermission: false, error: "User is not an admin" };
    }

    // Check if admin has the specific permission
    const hasPermission = admin.permissions && admin.permissions.includes(permission);
    
    return {
      hasPermission,
      admin,
      error: hasPermission ? null : `Admin does not have ${permission} permission`
    };
  }

  async getAllUsers() {
    await this.connect();
    const collection = this.db.collection(this.collectionName);

    const users = await collection.find({}, {
      projection: { 
        _id: 0,
        name: 1,
        shortname: 1,
        email: 1,
        title: 1,
        department: 1,
        location: 1,
        isActive: 1,
        role: 1,
        createdAt: 1,
        updatedAt: 1,
        joinDate: 1
      }
    }).toArray();

    return users;
  }

  async promoteToAdmin(shortname, promotedBy) {
    await this.connect();
    const collection = this.db.collection(this.collectionName);

    // Verify the promoter is an admin
    const promoter = await this.validateAdmin(promotedBy);
    if (!promoter) {
      throw new Error("Only admins can promote users to admin");
    }

    // Check if promoter has user_management permission
    const permissionCheck = await this.checkAdminPermission(promotedBy, "user_management");
    if (!permissionCheck.hasPermission) {
      throw new Error("Admin does not have user management permissions");
    }

    const result = await collection.updateOne(
      { shortname: shortname, isActive: true },
      {
        $set: {
          role: "admin",
          permissions: ["product_create", "product_edit", "product_delete", "user_management"],
          updatedAt: new Date(),
          promotedAt: new Date(),
          promotedBy: promotedBy
        }
      }
    );

    if (result.matchedCount === 0) {
      throw new Error("User not found or inactive");
    }

    console.log(`User ${shortname} promoted to admin by ${promotedBy}`);
    return { success: true, message: "User promoted to admin successfully" };
  }
}

module.exports = UserService;
