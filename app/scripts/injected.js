const ytNavigator = document.getElementById('nav')

// Catch yt-navigate-start and pass the endpoint to the content script
document.addEventListener('yt-navigate-start', function (event) {
  let endpoint = event.detail.endpoint
  window.postMessage({
    action: 'NAVIGATE',
    payload: endpoint
  }, '*')
})

// Navigate when navigation request from socket comes in
window.addEventListener('message', function (event) {
  if (event.data.action === 'NAVIGATE') {
    ytNavigator.navigate(event.data.payload)
  }
})
