//1. Service Registry (Custom Class)

const express = require('express');
const app = express();
app.use(express.json());

class ServiceRegistry {
  constructor() {
    this.services = {}; // { serviceName: { instances: [] } }
  }

  register(name, address, port) {
    if (!this.services[name]) {
      this.services[name] = { instances: [] };
    }
    const instance = { address, port, timestamp: Date.now() };
    this.services[name].instances.push(instance);
    console.log(`Registered service: ${name} at ${address}:${port}`);
  }

  get(name) {
    const service = this.services[name];
    if (!service || service.instances.length === 0) return null;
    // Simple round-robin or first instance
    return service.instances[0];
  }
}

const registry = new ServiceRegistry();



app.listen(4000, () => console.log('Custom Service Registry running on port 4000'));