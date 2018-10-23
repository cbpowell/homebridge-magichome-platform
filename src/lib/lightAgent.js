//
//  lightAgent.js
//  Sahil Chaddha
//
//  Created by Sahil Chaddha on 22/10/2018.
//  Copyright © 2018 sahilchaddha.com. All rights reserved.
//

const cp = require('child_process')
const path = require('path')

const cacheKey = 'magicHome_cache'
const spawn = cp.spawn

const LightAgent = class {

  constructor() {
    this.cachedAddress = {}
    this.pollingInterval = 15 * 1000
    this.logger = null
    this.storage = null
    this.hasDiscoveryStarted = false
    this.isVerbose = false
  }

  getCachedAddress() {
    if (!this.storage) {
      return {}
    }
    this.log('Getting Bulbs from Cache')
    return this.storage.getItem(cacheKey)
      .then((data) => {
        const devices = this.parseDevices(data)
        this.log(devices)
        return devices
      })
  }

  saveAddress(res) {
    if (this.storage) {
      this.log('Saving Lights')
      this.log(res)

      this.storage.setItem(cacheKey, res)
        .then(() => {
          this.log('Lights Saved.')
        })
    }
  }

  startDiscovery() {
    if (!this.hasDiscoveryStarted) {
      this.hasDiscoveryStarted = true
      this.getDevices()
    }
  }

  setLogger(logger) {
    this.logger = logger
  }

  setVerbose() {
    this.isVerbose = true
  }

  setPersistPath(persistPath) {
    if (!this.storage) {
      this.storage = require('node-persist')
      const self = this
      this.storage.init({ dir: persistPath })
        .then(() => {
          return self.getCachedAddress()
        })
        .then((devices) => {
          self.cachedAddress = devices
        })
    }
  }

  log(message) {
    if (this.logger && this.isVerbose) {
      this.logger(message)
    }
  }

  parseDevices(res) {
    if (!res) {
      return this.cachedAddress
    }
    if (res.length > 0) {
      const lines = res.split('\n')
      if (lines.length < 3) {
        return this.cachedAddress
      }
      // Format Response
      var devices = {}
      lines.splice(0, 1)
      lines.splice(-1, 1)
      lines.forEach((element) => {
        const mappedAddr = element.split('=')
        devices[mappedAddr[0]] = mappedAddr[1]
        devices[mappedAddr[1]] = mappedAddr[1]
      })
      var newDevices = this.cachedAddress
      Object.keys(devices).forEach((element) => {
        newDevices[element] = devices[element]
      })
      this.saveAddress(res)
      return newDevices
    }
    return this.cachedAddress
  }

  getCachedDevice(addr) {
    var address = ''
    if (this.cachedAddress[addr]) {
      address = this.cachedAddress[addr]
    } else {
      address = addr
    }
    return address + ' '
  }

  getDevices() {
    const self = this
    const cmd = path.join(__dirname, '../flux_led.py')
    self.log('Discovering Devices')
    this.proc = spawn(cmd, ['-s'])
    this.proc.stdout.on('data', (data) => {
      const newData = '' + data
      self.log(newData)
      self.cachedAddress = self.parseDevices(newData)
    })

    this.proc.stderr.on('data', (data) => {
      self.log('Error : ' + data)
    })

    this.proc.on('close', () => {
      self.log('Discovery Finished');
      self.rediscoverLights()
    })
  }

  rediscoverLights() {
    this.proc = null
    this.log(this.cachedAddress)
    setTimeout(this.getDevices.bind(this), this.pollingInterval)
  }

  getAddress(address) {
    var ips = ''
    if (typeof address === 'string') {
      ips = this.getCachedDevice(address)
    } else if (address.length > 0) {
      address.forEach((addr) => {
        ips += this.getCachedDevice(addr)
      })
    }
    return ips
  }
}

const agent = new LightAgent()

module.exports = agent