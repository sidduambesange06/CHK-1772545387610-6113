// Settings Dropdown Toggle
function toggleSettingsMenu() {
  const dropdown = document.getElementById('settingsDropdown');
  dropdown.classList.toggle('hidden');
}

// Close dropdown when clicking outside
document.addEventListener('click', function(event) {
  const dropdown = document.getElementById('settingsDropdown');
  const settingsBtn = event.target.closest('button[onclick*="toggleSettingsMenu"]');
  
  if (!settingsBtn && dropdown && !dropdown.contains(event.target)) {
    dropdown.classList.add('hidden');
  }
});

// Handle logout
function handleLogout(event) {
  event.preventDefault();
  if (confirm('Are you sure you want to log out?')) {
    // Clear any session data
    localStorage.removeItem('userSession');
    sessionStorage.clear();
    
    // Redirect to login page
    window.location.href = 'login.html';
  }
}
