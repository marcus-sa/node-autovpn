import AutoVPN from '../src'

AutoVPN.getVPNs()
  .then(vpns => {
    //const vpn = AutoVPN.random(vpns)
    //console.log(vpn)
    const OpenVPN = new AutoVPN({
      country: 'Germany'
    })

    OpenVPN.on('authentication', () => {
      OpenVPN.emit('authorize', process.env.PASSWORD)
    })

    OpenVPN.once('ready', () => {
      console.log('isReady')
    })

    OpenVPN.on('process', console.log)
    OpenVPN.on('error', console.error)
  })
  .catch(console.log)
