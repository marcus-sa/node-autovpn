import url from 'url'
import request from 'request'
import csv from 'csvtojson'
import through2 from 'through2'
import Promise from 'bluebird'
import Agent from 'socks5-http-client/lib/Agent'

import VPN from './vpn'

const VPNGATE_API_URL = 'http://www.vpngate.net/api/iphone'
const DEFAULT_ENCODE = 'utf8'

class ListVPNs {

  data: Promise

  static get(proxy) {
    if (this.data) return this.data

    return this.data = this.getData(proxy)
      .then(list => Promise.resolve(
        list.map(vpn => new VPN(vpn)))
      )
  }

  static networkError(err) {
    return `API request failed with code: ${err.statusCode || err.code} Error message: ${err.message}`
  }

  static filter(chunk, enc, cb) {
    const lines = chunk.toString()
      .split('\r\n')
      .filter(line => (line !== '*vpn_servers' && line !== '*'))
      .map((line) => {
        if (line.startsWith('#HostName')) {
          return line.replace('#HostName', 'HostName')
        }
        return line
      })
      .join('\r\n')


    this.push(new Buffer(lines, DEFAULT_ENCODE))
    cb()
  }

  static resolveProxy(proxy, options) {
    try {
      proxy = url.parse(proxy)
    } catch(e) {
      throw new Error('Invalid proxy url')
    }

    if (proxy.protocol.startsWith('socks')) {
      const authParts = (proxy.auth || '')
        .split(':')
        .filter(part => part.length)

      const auth = {
        username: authParts[0],
        password: authParts[1]
      }

      options.agentClass = Agent
      options.agentOptions = {
        socksHost: proxy.hostname,
        socksPort: proxy.port,
        socksUsername: auth.username,
        socksPassword: auth.password,
      }
      return
    }
    options.proxy = proxy.href
  }

  static getData(proxy) {
    return new Promise((resolve, reject) => {
      const options = { url: VPNGATE_API_URL }
      if (proxy) this.resolveProxy(proxy, options)

      request(options)
        .on('response', (response) => {
          if (response.statusCode !== 200) reject(new Error(`Request failed with code ${response.statusCode}`))
        })
        .on('error', (err) => reject(this.networkError(err)))
        .pipe(through2(this.filter))
        .pipe(csv())
        .on('error', (err) => reject(err))
        .on('end_parsed', resolve)
    })
  }

}

export default (proxy) => ListVPNs.get(proxy)
