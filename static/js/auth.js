// Firebase Authentication
const auth = firebase.auth();
const loginBtn = document.getElementById('loginBtn');
const navProject = document.getElementById('navProject');

// Listen for auth state changes
auth.onAuthStateChanged((user) => {
    if (!loginBtn) return;
    if (navProject) {
        if (user) {
            navProject.classList.remove('d-none');
        } else {
            navProject.classList.add('d-none');
        }
    }
    if (user) {
        // Show generic profile icon linking to profile page
        loginBtn.innerHTML = '<img src="/static/img/default-profile.svg" class="rounded-circle" width="32" height="32" alt="Profile">';
        loginBtn.setAttribute('href', '/profile');
        loginBtn.onclick = null;
    } else {
        // Show login link
        loginBtn.textContent = 'Login';
        loginBtn.setAttribute('href', '/login');
        loginBtn.onclick = null;
    }
});

// Google Sign-in
function signInWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
        .then((result) => result.user.getIdToken())
        .then((token) => fetch('/api/verify-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
        }))
        .then((response) => response.json())
        .then((data) => {
            if (data.error) {
                console.error('Error:', data.error);
            }
        })
        .catch((error) => console.error('Error:', error));
} 