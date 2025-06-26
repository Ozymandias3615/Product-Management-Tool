// Backend Authentication
const loginBtn = document.getElementById('loginBtn');
const navProject = document.getElementById('navProject');

// Check authentication status on page load
async function checkAuthStatus() {
    try {
        const response = await fetch('/api/users/me');
        if (response.ok) {
            const user = await response.json();
            updateAuthUI(user);
        } else {
            updateAuthUI(null);
        }
    } catch (error) {
        console.log('Not authenticated');
        updateAuthUI(null);
    }
}

// Update UI based on authentication status
function updateAuthUI(user) {
    if (!loginBtn) return;
    
    if (navProject) {
        if (user) {
            navProject.classList.remove('d-none');
        } else {
            navProject.classList.add('d-none');
        }
    }
    
    if (user) {
        // Show profile info
        const avatar = (user.avatar_url && user.avatar_url.trim() !== '') 
            ? user.avatar_url 
            : '/static/img/default-profile.svg';
        
        loginBtn.innerHTML = `
            <div class="dropdown">
                <a class="nav-link dropdown-toggle modern-nav-link p-1" href="#" role="button" data-bs-toggle="dropdown">
                    <img src="${avatar}" class="rounded-circle" width="36" height="36" alt="Profile" 
                         style="border: 2px solid rgba(255,255,255,0.3);"
                         onerror="this.src='/static/img/default-profile.svg';">
                </a>
                <ul class="dropdown-menu dropdown-menu-end modern-dropdown">
                    <li><a class="dropdown-item modern-dropdown-item" href="/profile">
                        <i class="bi bi-person me-2"></i>Profile
                    </a></li>
                    <li><hr class="dropdown-divider my-2"></li>
                    <li><a class="dropdown-item modern-dropdown-item" href="#" onclick="logout()">
                        <i class="bi bi-box-arrow-right me-2"></i>Logout
                    </a></li>
                </ul>
            </div>
        `;
        loginBtn.removeAttribute('href');
        loginBtn.onclick = null;
    } else {
        // Show login link
        loginBtn.textContent = 'Login';
        loginBtn.setAttribute('href', '/login');
        loginBtn.onclick = null;
    }
}

// Logout function
async function logout() {
    try {
        await fetch('/api/users/logout', { method: 'POST' });
        window.location.href = '/';
    } catch (error) {
        console.error('Logout error:', error);
        // Force redirect even if logout fails
        window.location.href = '/';
    }
}

// Make logout function globally available
window.logout = logout;

// Check auth status when page loads
document.addEventListener('DOMContentLoaded', checkAuthStatus);

// Legacy Google Sign-in function (for compatibility)
function signInWithGoogle() {
    // Redirect to login page for Google sign-in
    window.location.href = '/login';
} 