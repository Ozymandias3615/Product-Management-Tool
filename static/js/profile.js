const firebaseAuth = firebase.auth();

document.addEventListener('DOMContentLoaded', () => {
  firebaseAuth.onAuthStateChanged(user => {
    const nameEl = document.getElementById('profileName');
    const emailEl = document.getElementById('profileEmail');
    if (user) {
      nameEl.textContent = user.displayName || 'N/A';
      emailEl.textContent = user.email;
    } else {
      nameEl.textContent = 'Guest';
      emailEl.textContent = '';
    }
  });

  document.getElementById('logoutBtn').addEventListener('click', () => {
    firebaseAuth.signOut().then(() => window.location.href = '/');
  });
}); 