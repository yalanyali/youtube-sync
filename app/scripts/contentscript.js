/* global browser */
var s = document.createElement('script')
// TODO: add "script.js" to web_accessible_resources in manifest.json
s.src = browser.runtime.getURL('scripts/injected.js')
s.id = 'injected'
s.onload = function () {
  this.remove()
};
(document.head || document.documentElement).appendChild(s)

; (function YoutubeSync (window) {
  const document = window.document
  let player = null
  let canSendCommands = true

  // FROM BACKGROUND
  browser.runtime.onMessage.addListener((message) => {
    console.log('FROM BACKGROUND', message)
    if (message.type === 'playerCommand') {
      handlePlayerCommand(message.command, message.payload)
    } else if (message.type === 'navigation' && message.command === 'navigate') {
      forceNavigate(message.payload)
    } else if (message.type === 'status' && message.command === 'get') {
      let baseUrl = 'https://youtu.be/'
      let currentUrl = window.location.href
      let ytId = currentUrl.match(/^(?:https?:)?\/\/[^/]*(?:youtube(?:-nocookie)?.com|youtu.be).*[=/]([-\w]{11})(?:\?|=|&|$)/)[1]
      let builtUrl = `${baseUrl}${ytId}?t=${Math.floor(player.currentTime)}`
      return Promise.resolve({
        response: {
          currentUrl: builtUrl,
          currentTime: player.currentTime,
          paused: !player.playing
        }
      })
    }
  })

  // FROM INJECTED
  window.addEventListener('message', function (event) {
    let message = event.data
    // console.log('FROM INJECTED:', message)
    if (message.action === 'NAVIGATE') {
      sendMessage({
        type: 'navigation',
        command: 'navigate',
        payload: message.payload
      })
    }
  })

  const avoidFeedback = (ms = 500) => {
    canSendCommands = false
    setTimeout(() => {
      canSendCommands = true
    }, ms)
  }

  const handlePlayerCommand = (command, payload) => {
    // console.log('Incoming:', command, payload)
    let shouldAvoidFeedback = false
    switch (command) {
      case 'seek':
        player.currentTime = payload
        shouldAvoidFeedback = true
        break
      case 'pause':
        player.pause()
        player.currentTime = payload
        shouldAvoidFeedback = true
        break
      case 'play':
        player.play()
        shouldAvoidFeedback = true
        break
      default:
        break
    }
    if (shouldAvoidFeedback) {
      avoidFeedback()
    }
  }

  const forceNavigate = (navObj) => {
    window.postMessage({
      action: 'NAVIGATE',
      payload: navObj
    })
    avoidFeedback(500)
    waitForPlayer()
  }

  //   const emitCanPlay = () => {
  //     sendMessage({
  //       type: 'playerCommand',
  //       command: 'state',
  //       payload: 'canplay'
  //     })
  //   }

  const sendMessage = (message) => {
    if (canSendCommands) {
      // console.log('Sent message:', message)
      browser.runtime.sendMessage({ ...message, currentUrl: window.location.href })
      avoidFeedback(1000)
    }
    // else {
    // console.log('Did not send:', message)
    // }
  }

  let playerSeeking = false
  const addEventListeners = (player, debug = false) => {
    // Seeking event fires pause->seeking events
    // Seeked event fires pause->play->seeked events
    // So we have to block pause event to check for seek/seeked events
    player.addEventListener('seeking', function () {
      playerSeeking = true
      // console.log('Player Event: seeking')
      sendMessage({
        type: 'playerCommand',
        command: 'seek',
        payload: player.currentTime
      })
      // Reset playerSeeking
      setTimeout(() => { playerSeeking = false }, 250)
    })

    player.addEventListener('pause', function () {
      let timeoutForSeekingCheck = 100 // ms

      // This approach creates a max delay of 'timeout' ms
      let waitToCheckIfSeeking = setInterval(() => {
        if (timeoutForSeekingCheck < 10) {
          // Timeout: Pause event
          // console.log('Player Event: pause')
          sendMessage({
            type: 'playerCommand',
            command: 'pause',
            payload: player.currentTime
          })
          clearInterval(waitToCheckIfSeeking)
        }
        if (playerSeeking) {
          // Seeking event came in: Not a pause event
          clearInterval(waitToCheckIfSeeking)
        }
        timeoutForSeekingCheck -= 10
      }, 10)

      // This approach creates a 'timeout' ms delay for seeking event
      // setTimeout(() => {
      //   if (!playerSeeking) {
      //     console.log('pause: playerSeeking', player.seeking)
      //     sendMessage({
      //       type: 'playerCommand',
      //       command: 'pause',
      //       payload: player.currentTime
      //     })
      //   }
      // }, timeoutForSeekingCheck)
      // But maybe it's better?
    })
    player.addEventListener('play', function () {
      // console.log(player.readyState, player.networkState)
      // console.log('Player Event: play')
      sendMessage({
        type: 'playerCommand',
        command: 'play'
      })
    })
    if (debug) {
      player.addEventListener('canplay', function () {
        console.log('Player Event: canplay')
      // emitCanPlay()
      })
      player.addEventListener('timeupdate', function () {
        console.log('Player Event: timeupdate', player.currentTime)
      })
      window.addEventListener('focus', function () {
        console.info('Player Event: focus')
      })
      document.addEventListener('visibilitychange', function () {
        console.info('Player Event: visibilitychange')
      })
    }
  }

  const bindPlayer = (playerEl) => {
    if (player) return
    player = document.getElementsByTagName('video')[0] || playerEl
    // player.id = 'htmlPlayer'
    console.info('Player found:', player)
    console.info('Adding event listeners to player.', addEventListeners(player))
  }

  const waitForPlayer = () => {
    if (player) {
      // player element is already bound
      return
    }
    // Look for player element
    // If exists, bind
    // Else keep looking (100 ms interval)
    let videoEl = null
    videoEl = document.getElementsByTagName('video')
    if (videoEl.length !== 0) {
      bindPlayer(videoEl[0])
      videoEl = null
    } else {
      let playerWaitInterval = setInterval(() => {
        videoEl = document.getElementsByTagName('video')
        if (videoEl.length !== 0) {
          clearInterval(playerWaitInterval)
          bindPlayer(videoEl[0])
          videoEl = null
        }
      }, 100)
    }
  }

  waitForPlayer()
  // Say hi!
  // ...to maybe let know of the tab id.
  sendMessage({
    type: 'hi',
    command: 'hi'
  })

  console.info('Youtube Sync started.')
})(window)
