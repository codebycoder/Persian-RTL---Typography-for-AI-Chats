// Configure the native toolbar action every time the service worker starts.
// Chrome owns opening/closing the panel, including after install and reload.
void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error: unknown) => {
  console.error("[Rasta] Failed to configure the side panel.", error);
});
