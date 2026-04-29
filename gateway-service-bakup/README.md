# Gateway Service

A gateway service that discovers and proxies requests to other microservices through the registry service.

## Features

- Service discovery through registry service
- Random port assignment
- Automatic service registration and health checks
- User information endpoints that proxy to user-service

## Endpoints

- `GET /user-list` - Get full user list from user-service
- `GET /user-list-short` - Get short user list from user-service  
- `GET /user-names` - Get user names from user-service
- `GET /user/:shortname` - Get specific user by shortname
- `GET /health` - Health check endpoint

## Usage

1. Start the registry service first:
   ```bash
   cd registry
   npm start
   ```

2. Start the user service:
   ```bash
   cd users-service
   npm start
   ```

3. Start the gateway service:
   ```bash
   cd gateway-service
   npm start
   ```

The gateway will automatically discover the user-service through the registry and proxy requests to it.

## Example Requests

```bash
# Get all users
curl http://localhost:<gateway-port>/user-list

# Get user names only
curl http://localhost:<gateway-port>/user-names

# Get specific user
curl http://localhost:<gateway-port>/user/john

# Health check
curl http://localhost:<gateway-port>/health
```