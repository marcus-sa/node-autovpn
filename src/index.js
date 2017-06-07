import path from 'path'
import os from 'os'
import fs from 'fs'
//import sudo from 'sudo-prompt'
//import sudo from 'electron-sudo'
import sudo from 'sudo'
import Promise from 'bluebird'
import which from 'which'
import prompt from 'prompt'
import split from 'split'
import EventEmitter from 'event-emitter-es6'

import ListVPNs from './api'

export default class AutoVPN extends EventEmitter {

  filePath: String
  spawnOptions: Object
  sequenceComplete: String = 'Initialization Sequence Completed'

  constructor(args: Object = {}) {
    super()

    this.filePath = path.join(os.tmpdir(), 'autovpn.config')
    this.process(`Getting config file from ${this.filePath}...`)
    this.spawnOptions = args

    this.process('Querying VPNs...')
    ListVPNs(args.proxy)
      .then(vpns => this.filter(vpns, args.country))
      .then(vpns => this.save(vpns))
      .then(() => this.authorize())
      .catch(err => this.error(err))
  }

  static random(arr) {
    return arr[Math.floor(Math.random() * arr.length)]
  }

  static getVPNs() {
    return ListVPNs()
  }

  /*startOpenVPN(password) {
    this.process('Starting OpenVPN...')

    const {filePath, spawnOptions} = this
    const bin = which.sync('openvpn')

    const options = {
      name: 'OpenVPN'
    }

    sudo.exec(`openvpn --config ${filePath}`, options, (err, openvpn, stderr) => {
      openvpn.pipe(
        split().on('data', (message) => this.process(message))
      )
      openvpn.on('data', (data) => this.process(data.toString()))

      //process.on('exit', () => openvpn.kill())
      //process.on('SIGINT', () => openvpn.kill())
      //this.on('disconnect', () => openvpn.kill())
    })
  }*/

  startOpenVPN(password) {
    this.process('Starting OpenVPN...')

    const {filePath, spawnOptions} = this
    const bin = which.sync('openvpn')

    const openvpn = sudo([bin, '--config', filePath], {
      password,
      cachePassword: true,
      spawnOptions
    })

    openvpn.stdout.pipe(
      split().on('data', (message) => this.process(message))
    )
    openvpn.stdout.on('data', (data) => this.process(data.toString()))

    process.on('exit', () => openvpn.kill())
    //process.on('SIGINT', () => openvpn.kill())
    this.on('disconnect', () => openvpn.kill())
  }

  filter(vpns, country) {
    if (!country) return vpns
    return vpns.filter(
      vpn => vpn.countryNames.includes(country.toLowerCase())
    )
  }

  save(vpns) {
    return new Promise((resolve, reject) => {
      const config = fs.createWriteStream(this.filePath, { overwrite: true })

      config.on('open', () => {
        const sortedVPNs = vpns.sort((a, b) => (b.score - a.score))
        const chain = sortedVPNs.slice(0, 2).map(vpn => {
          return new Promise(resolve => config.write(vpn.config, resolve))
        })

        Promise.all(chain)
          .then(() => config.close())
      })
      config.on('error', reject)
      config.once('close', resolve)
    })
  }

  authorize() {
    const password = this.spawnOptions.password

    this.process('Authorizing...')

    if (password) {
      return this.startOpenVPN(password)
    } else {
      this.emit('authentication')
      this.on('authorize', (password) => {
        console.log('authorize')
        this.startOpenVPN(password)
      })
    }
  }

  process(message) {
    if (message.toLowerCase().includes(this.sequenceComplete.toLowerCase())) {
      this.emit('ready')
    } else {
      this.emit('process', message)
    }
  }

  error(error) {
    this.emit('error', error)
  }

}
