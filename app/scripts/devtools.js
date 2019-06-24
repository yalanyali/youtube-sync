/* global browser */
const handleShown = () => {
  console.log('panel is being shown')
}

const handleHidden = () => {
  console.log('panel is being hidden')
}

/**
  Create a panel, and add listeners for panel show/hide events.
  */
browser.devtools.panels.create(
  'Youtube Sync',
  '../images/icon-128.png',
  '../pages/devtools-panel.html'
).then((newPanel) => {
  newPanel.onShown.addListener(handleShown)
  newPanel.onHidden.addListener(handleHidden)
})

console.log('Hi from devtools.js')
