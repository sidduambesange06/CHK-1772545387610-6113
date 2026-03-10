// auth-guard.js — include on every protected page (after config.js + Firebase SDK)
// Hides the page instantly, shows it only after Firebase confirms authentication.
(function () {
  // Instantly hide to prevent flash of unauthenticated content
  document.documentElement.style.visibility = 'hidden';

  function redirectToLogin() {
    window.location.replace('/login.html');
  }

  function runGuard() {
    if (typeof firebase === 'undefined' || typeof FIREBASE_CONFIG === 'undefined') {
      redirectToLogin();
      return;
    }
    if (!firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
    firebase.auth().onAuthStateChanged(function (user) {
      if (user) {
        // Expose globally so pages can show user info
        window.currentUser = {
          uid: user.uid,
          email: user.email,
          name: user.displayName || user.email.split('@')[0]
        };
        document.documentElement.style.visibility = '';
      } else {
        redirectToLogin();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runGuard);
  } else {
    runGuard();
  }
})();
