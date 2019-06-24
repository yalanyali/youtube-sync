/* global browser */
const saveOptions = () => {
  const roomName = document.getElementById('room').value
  const userName = document.getElementById('user').value
  browser.storage.sync.set({
    roomName: roomName,
    userName: userName
  })
    .then(() => {
      let status = document.getElementById('status')
      status.textContent = 'Options saved!'
      setTimeout(() => {
        status.textContent = ''
        window.close()
      }, 1000)
    })
}

const renderOptions = () => {
  browser.storage.sync.get({
    roomName: '',
    userName: ''
  })
    .then(items => {
      const roomName = items.roomName
      const userName = items.userName
      document.getElementById('room').value = roomName
      document.getElementById('user').value = userName
    })
}

document.addEventListener('DOMContentLoaded', renderOptions)
document.getElementById('save').addEventListener('click', saveOptions)
