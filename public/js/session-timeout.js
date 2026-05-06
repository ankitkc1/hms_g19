const INACTIVITY_LIMIT = 30 * 60 * 1000;

let inactivityTimer;

function resetInactivityTimer() {
  clearTimeout(inactivityTimer);

  inactivityTimer = setTimeout(async () => {
    try {
      await fetch('/logout', {
        method: 'POST'
      });
    } catch (error) {
      // Ignore network error and redirect anyway.
    }

    window.location.href = '/login?timeout=1';
  }, INACTIVITY_LIMIT);
}

['click', 'mousemove', 'keydown', 'scroll', 'touchstart'].forEach((eventName) => {
  window.addEventListener(eventName, resetInactivityTimer);
});

resetInactivityTimer();