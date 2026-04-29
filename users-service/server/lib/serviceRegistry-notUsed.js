const semver = require('semver');


class ServiceRegistry {
  constructor(log) {
    this.log = log || console;
    this.services = {};
    this.timeout = 30;
  }



  register(servicename, serviceversion, serviceip, serviceport) {
    this.cleanup();
    // const key = `${servicename}:${serviceversion}:${serviceip}:${serviceport}`;
    const key = servicename + serviceversion + serviceip + serviceport;
    
    if (!this.services[key]) {
      this.services[key] = {
        instances: [],
        timestamp: Math.floor(Date.now() / 1000),
        serviceip: ip,
        serviceport: port,
        servicename: name,
        serviceversion: version
      };
      this.log.debug(`Added service ${servicename}, version ${serviceversion} at ${serviceip}:${serviceport}`);
    } else {
      this.services[key].timestamp = Math.floor(Date.now() / 1000);
      this.log.debug(`Updated service ${servicename}, version ${serviceversion} at ${serviceip}:${serviceport}`);
    }

    return key;
  }

  // get(name) {
  //   const service = this.services[name];
  //   if (!service || service.instances.length === 0) return null;
  //   return service.instances[0];
  // }

  get(servicename, serviceversion){
    this.cleanup();
    const candidates = Object.values(this.services).filter(service => service.name === servicename && semver.satisfies(service.version, serviceversion));

    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  unregister(servicename, serviceversion, serviceip, serviceport){
    const key = servicename + serviceversion + serviceip + serviceport;
    delete this.services[key];
    this.log.debug(`Unregistered service ${servicename}, version ${serviceversion} at ${serviceip}:${serviceport}`);
    return key;

  }

  cleanup () {
    const now = Math.floor(new Date() / 1000);
    Object.keys(this.services).forEach((key) => {
      if (this.services[key].timestamp + this.timeout < now){
        delete this.services[key];
        this.log.debug(`Removed service ${key}`);
      }
    })
  }
  
}

module.exports = ServiceRegistry;