/* global browser, WebSocket */
let user
let socket
let sendMessage = {}
let scriptActive = false
let scriptInjected = false
let syncTabId
let currentUrl = null
let canSendCommands = true

// Get options and init socket
browser.storage.sync.get({ roomName: '', userName: '' })
  .then((items) => {
    let room = items.roomName || 31
    user = items.userName || 'Default'
    socket = new WebSocket(`wss://connect.websocket.in/youtube-sync?room_id=${room}`)
    socket.onmessage = (e) => { handleSocketMessage(JSON.parse(e.data)) }
    initMessageHelper()
  })

// Reload on option change
browser.storage.onChanged.addListener(items => {
  browser.runtime.reload()
})

// Show options on install
browser.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // FIX: THIS IS CHROME ONLY
    browser.tabs.create({ 'url': 'chrome://extensions/?options=' + browser.runtime.id })
  } else if (details.reason === 'update') {
    // User updated extension
  }
})

const initMessageHelper = () => {
  sendMessage = {
    toPage: async (message) => {
      console.log('TO PAGE:', message)
      let tabId
      if (syncTabId > 0) {
        tabId = syncTabId
      } else {
        let tabs = await browser.tabs.query({ active: true, currentWindow: true })
        let tab = tabs[0]
        tabId = tab.id
      }
      let res = await browser.tabs.sendMessage(tabId, message)
      if (res) {
        return res.response
      }
    },
    toSocket: (message) => {
      if (message.type === 'hi') { return }
      if (canSendCommands) {
        // console.log('TO SOCKET', message)
        socket.send(JSON.stringify({ ...message, user }))
      }
      avoidFeedback()
    }
  }
}

const avoidFeedback = (ms = 500) => {
  canSendCommands = false
  setTimeout(() => {
    canSendCommands = true
  }, ms)
}

// Handle incoming message from socket
const handleSocketMessage = async (message) => {
  if (!scriptActive || !canSendCommands) { return }
  // console.log(message)
  if (message.command === 'ping' && message.payload === 'ping') {
    let playerStatus = await sendMessage.toPage({
      type: 'status',
      command: 'get'
    })
    sendMessage.toSocket({
      command: 'ping',
      payload: 'pong',
      status: playerStatus
    })
  } else if (message.type === 'navigation' || message.type === 'playerCommand') {
    sendMessage.toPage(message)
    avoidFeedback()
  }
}

// Handle incoming message from page
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!scriptActive) { return }
  if (!syncTabId) { syncTabId = sender.tab.id }
  // console.log('FROM PAGE:', message)
  currentUrl = message.currentUrl
  delete message['currentUrl']
  sendMessage.toSocket({ ...message, user })
})

const pingSocket = () => {
  const timeout = 1000 // ms

  let timeoutPromise = new Promise((resolve, reject) => {
    let id = setTimeout(() => {
      clearTimeout(id)
      reject(new Error('timeout'))
    }, timeout)
  })

  let promise = new Promise((resolve, reject) => {
    sendMessage.toSocket({
      command: 'ping',
      payload: 'ping',
      user: user
    })
    let tempListener = socket.addEventListener('message', e => {
      const message = JSON.parse(e.data)
      if (message.command === 'ping' && message.payload === 'pong') {
        socket.removeEventListener('message', tempListener)
        resolve(message.status)
      }
    })
  })

  return Promise.race([
    promise,
    timeoutPromise
  ])
}

const setBadge = (text) => {
  browser.browserAction.setBadgeText({
    text: text
  })
}
setBadge('off')

const setScriptActive = (isActive) => {
  scriptActive = isActive
  if (scriptActive) {
    setBadge('on')
    canSendCommands = true
  } else {
    scriptInjected = false
    canSendCommands = false
    setBadge('off')
  }
}

const createTab = (url, playerStatus) => {
  if (playerStatus) {
    url = playerStatus.currentUrl
  }
  let create = browser.tabs.create({
    url: url
  })
  create.then((tab) => {
    syncTabId = tab.id
    injectScript()
    setScriptActive(true)
  }, (err) => console.log(err))
}

const injectScript = () => {
  if (scriptInjected) { return }
  scriptInjected = true
  browser.tabs.executeScript({
    file: '/scripts/contentscript.js'
  })
    .then(() => {
      injectScript()
      console.log('Script injected!' + ' Tab ID: ' + syncTabId)
    })
}

browser.browserAction.onClicked.addListener(async () => {
  if (scriptActive) {
    setScriptActive(false)
    // browser.runtime.reload()
  } else {
    setScriptActive(true)
    // If Youtube active, inject
    let tabs = await browser.tabs.query({ active: true, currentWindow: true })
    let tab = tabs[0]
    if (tab.url.includes('youtube.com')) {
      syncTabId = tab.id
      injectScript()
    } else {
      // Youtube not active, create a new tab
      try { // User not alone
        let playerStatus = await pingSocket()
        if (playerStatus && playerStatus.currentUrl !== null) {
          createTab(playerStatus.currentUrl, playerStatus)
        } else {
          throw new Error('url')
        }
      } catch (error) { // User alone
        createTab('https://www.youtube.com')
      }
    }
  }
})

browser.tabs.onUpdated.addListener(function (id, changeInfo, tab) {
  if (scriptActive && changeInfo.status === 'complete' && tab.id === syncTabId) {
    scriptInjected = false
    setTimeout(() => {
      injectScript()
    }, 500)
  }
})

browser.tabs.onRemoved.addListener(function (id, changeInfo, tab) {
  if (tab.id === syncTabId) {
    setScriptActive(false)
  }
})
