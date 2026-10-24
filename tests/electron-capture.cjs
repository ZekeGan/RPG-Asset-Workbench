// Offscreen windows expose rendered pixels through paint, without a desktop surface.
module.exports = async function captureWindow(win) {
  if (!win.webContents.isOffscreen()) return win.webContents.capturePage();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      win.webContents.removeListener('paint', paint);
      reject(Error('Offscreen paint timeout'));
    }, 5000);
    function paint(_event, _rect, image) {
      clearTimeout(timer);
      win.webContents.removeListener('paint', paint);
      if (image.isEmpty()) reject(Error('Empty offscreen frame'));
      else resolve(image);
    }
    win.webContents.on('paint', paint);
    win.webContents.invalidate();
  });
};
