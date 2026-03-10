// auth-guard.js — robust multi-scenario auth guard
// Scenarios handled:
//  1. User is logged in              → show page normally
//  2. User is not logged in          → redirect to /login.html
//  3. Firebase slow to init          → wait up to 6s, then redirect
//  4. Firebase SDK failed to load    → show page (graceful degradation)
//  5. FIREBASE_CONFIG missing        → show page (graceful degradation)
//  6. Network offline                → show page with cached session if any
(function () {
  // Hide immediately — prevents flash of protected content
  document.documentElement.style.visibility = 'hidden';

  var _timer = null;

  function show() {
    clearTimeout(_timer);
    document.documentElement.style.visibility = '';
  }

  function goLogin() {
    clearTimeout(_timer);
    window.location.replace('/login.html');
  }

  function init() {
    // Scenario 4 & 5: graceful degradation if Firebase didn't load
    if (typeof firebase === 'undefined' || typeof FIREBASE_CONFIG === 'undefined') {
      console.warn('[auth-guard] Firebase not available — showing page');
      show();
      return;
    }

    // Init Firebase once
    if (!firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }

    // Scenario 3: if Firebase takes > 6s, send to login
    _timer = setTimeout(goLogin, 6000);

    firebase.auth().onAuthStateChanged(function (user) {
      if (user) {
        // Scenario 1: authenticated
        window.currentUser = {
          uid:   user.uid,
          email: user.email || '',
          name:  user.displayName || (user.email ? user.email.split('@')[0] : 'User'),
          photo: user.photoURL || null
        };
        show();
      } else {
        // Scenario 2: not logged in
        goLogin();
      }
    });
  }

  // Wait for DOM if scripts haven't loaded yet
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
