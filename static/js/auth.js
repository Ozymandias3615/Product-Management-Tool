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
        // Show profile info with notifications
        const avatar = (user.avatar_url && user.avatar_url.trim() !== '') 
            ? user.avatar_url 
            : '/static/img/default-profile.svg';
        
        loginBtn.innerHTML = `
            <div class="d-flex align-items-center gap-2">
                <!-- Notifications Bell -->
                <div class="dropdown notifications-dropdown">
                    <a class="nav-link modern-nav-link position-relative p-2" href="#" role="button" data-bs-toggle="dropdown" 
                       id="notificationsDropdown" onclick="loadNotifications()">
                        <i class="bi bi-bell" style="font-size: 1.2rem;"></i>
                        <span class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" 
                              id="notificationsBadge" style="display: none; font-size: 0.7rem;">
                            0
                        </span>
                    </a>
                    <div class="dropdown-menu dropdown-menu-end modern-dropdown notifications-menu shadow-lg" 
                         style="width: 350px; max-height: 400px; overflow-y: auto;" 
                         aria-labelledby="notificationsDropdown">
                        <div class="dropdown-header d-flex justify-content-between align-items-center p-3 border-bottom">
                            <h6 class="mb-0 fw-bold">Notifications</h6>
                            <small class="text-muted" id="notificationsCount">Loading...</small>
                        </div>
                        <div id="notificationsList" class="p-2">
                            <div class="text-center py-3 text-muted">
                                <div class="spinner-border spinner-border-sm me-2" role="status"></div>
                                Loading notifications...
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Profile Dropdown -->
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
            </div>
        `;
        loginBtn.removeAttribute('href');
        loginBtn.onclick = null;
        
        // Start polling for notifications
        startNotificationPolling();
        
        // Add event listener for dropdown show event with better timing
        setTimeout(() => {
            const notificationsDropdown = document.getElementById('notificationsDropdown');
            if (notificationsDropdown) {
                const dropdownElement = notificationsDropdown.closest('.dropdown');
                if (dropdownElement) {
                    dropdownElement.addEventListener('show.bs.dropdown', function () {
                        // Mark notifications as viewed and hide badge immediately for better UX
                        const badge = document.getElementById('notificationsBadge');
                        if (badge && badge.style.display !== 'none') {
                            badge.style.display = 'none';
                            markNotificationsAsViewed();
                        }
                        
                        // Stop bell shake animation when dropdown opens
                        if (notificationsDropdown) {
                            notificationsDropdown.classList.remove('has-notifications');
                        }
                    });
                }
            }
        }, 100);
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

// Notifications functionality
let notificationPollingInterval;

async function loadNotifications() {
    try {
        const response = await fetch('/api/users/me/notifications');
        if (response.ok) {
            const data = await response.json();
            updateNotificationsUI(data);
        } else {
            console.error('Failed to load notifications');
        }
    } catch (error) {
        console.error('Error loading notifications:', error);
    }
}

async function markNotificationsAsViewed() {
    try {
        await fetch('/api/users/me/notifications/mark-viewed', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });
    } catch (error) {
        console.error('Error marking notifications as viewed:', error);
    }
}

function updateNotificationsUI(data) {
    const notificationsCount = document.getElementById('notificationsCount');
    const notificationsList = document.getElementById('notificationsList');
    const notificationsBadge = document.getElementById('notificationsBadge');
    
    if (!notificationsCount || !notificationsList) return;
    
    // Update count
    notificationsCount.textContent = data.count === 0 ? 'No new notifications' : `${data.count} recent notifications`;
    
    // Update badge - only show if there are truly unread notifications
    if (notificationsBadge) {
        const notificationsDropdown = document.getElementById('notificationsDropdown');
        
        if (data.unread_count > 0) {
            notificationsBadge.textContent = data.unread_count > 99 ? '99+' : data.unread_count;
            notificationsBadge.style.display = 'block';
            
            // Add shake animation class to bell
            if (notificationsDropdown) {
                notificationsDropdown.classList.add('has-notifications');
            }
        } else {
            notificationsBadge.style.display = 'none';
            
            // Remove shake animation class from bell
            if (notificationsDropdown) {
                notificationsDropdown.classList.remove('has-notifications');
            }
        }
    }
    
    // Update notifications list
    if (data.notifications.length === 0) {
        notificationsList.innerHTML = `
            <div class="text-center py-4 text-muted">
                <i class="bi bi-bell-slash" style="font-size: 2rem; opacity: 0.5;"></i>
                <p class="mb-0 mt-2">No recent notifications</p>
                <small>You'll see activity updates here</small>
            </div>
        `;
    } else {
        notificationsList.innerHTML = data.notifications.map((notification, index) => `
            <div class="notification-item ${notification.is_new ? 'notification-new' : ''}" 
                 onclick="${notification.url ? `window.location.href='${notification.url}'` : 'void(0)'}"
                 style="cursor: ${notification.url ? 'pointer' : 'default'}; --item-index: ${index};">
                <div class="d-flex align-items-start p-2 rounded hover-bg-light position-relative">
                    <div class="flex-shrink-0 me-3">
                        <div class="notification-icon ${notification.type_class}">
                            <i class="${notification.icon}"></i>
                        </div>
                    </div>
                    <div class="flex-grow-1 min-w-0">
                        <div class="d-flex justify-content-between align-items-start">
                            <h6 class="notification-title fw-semibold mb-1">${escapeHtml(notification.title)}</h6>
                            <small class="text-muted flex-shrink-0 ms-2">${notification.time_ago}</small>
                        </div>
                        <p class="notification-desc text-muted mb-0 small">${escapeHtml(notification.description)}</p>
                        ${notification.is_new ? '<div class="notification-dot"></div>' : ''}
                    </div>
                </div>
            </div>
        `).join('');
    }
}

function startNotificationPolling() {
    // Clear any existing interval
    if (notificationPollingInterval) {
        clearInterval(notificationPollingInterval);
    }
    
    // Load notifications immediately
    loadNotifications();
    
    // Poll every 30 seconds
    notificationPollingInterval = setInterval(loadNotifications, 30000);
}

function stopNotificationPolling() {
    if (notificationPollingInterval) {
        clearInterval(notificationPollingInterval);
        notificationPollingInterval = null;
    }
}



// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Make functions globally available
window.loadNotifications = loadNotifications;
window.logout = logout;

// Check auth status when page loads
document.addEventListener('DOMContentLoaded', checkAuthStatus);

// Stop polling when page unloads
window.addEventListener('beforeunload', stopNotificationPolling);

// Legacy Google Sign-in function (for compatibility)
function signInWithGoogle() {
    // Redirect to login page for Google sign-in
    window.location.href = '/login';
} 