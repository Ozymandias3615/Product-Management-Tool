// Profile page functionality using backend authentication
let isEditMode = false;
let originalProfileData = {};

// Initialize profile page
document.addEventListener('DOMContentLoaded', async function() {
    await loadUserProfile();
    await loadUserStats();
    await loadRecentActivity();
    setupEventListeners();
});

// Load user profile data
async function loadUserProfile() {
    try {
        const response = await fetch('/api/users/me');
        if (response.ok) {
            const user = await response.json();
            populateProfileData(user);
        } else if (response.status === 401) {
            // User not authenticated, redirect to login
            console.log('User not authenticated, redirecting to login');
            showErrorMessage('Please log in to view your profile');
            setTimeout(() => {
                window.location.href = '/login';
            }, 2000);
        } else {
            // Other error
            const errorData = await response.json().catch(() => ({}));
            console.error('Error loading profile:', errorData);
            showErrorMessage(errorData.error || 'Failed to load profile data');
        }
    } catch (error) {
        console.error('Error loading profile:', error);
        showErrorMessage('Failed to load profile data. Please check your connection.');
    }
}

// Populate profile data in the UI
function populateProfileData(user) {
    // Profile header and avatar
    document.getElementById('profileDisplayName').textContent = user.full_name || user.username || 'User';
    document.getElementById('profileEmail').textContent = user.email || '';
    
    // Profile avatar
    const avatar = (user.avatar_url && user.avatar_url.trim() !== '') 
        ? user.avatar_url 
        : '/static/img/default-profile.svg';
    
    document.getElementById('profileAvatar').src = avatar;
    document.getElementById('profileAvatar').onerror = function() {
        this.src = '/static/img/default-profile.svg';
    };
    
    // Account information form
    document.getElementById('fullName').value = user.full_name || '';
    document.getElementById('username').value = user.username || '';
    document.getElementById('emailAddress').value = user.email || '';
    
    // Format dates
    if (user.created_at) {
        const memberSince = new Date(user.created_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        document.getElementById('memberSince').value = memberSince;
    }
    
    if (user.last_login) {
        const lastLogin = new Date(user.last_login).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        document.getElementById('lastLogin').value = lastLogin;
    } else {
        document.getElementById('lastLogin').value = 'Never';
    }
    
    // Store original data for edit mode
    originalProfileData = {
        full_name: user.full_name || '',
        username: user.username || ''
    };
}

// Load user statistics
async function loadUserStats() {
    // Show loading state
    document.getElementById('roadmapCount').innerHTML = '<i class="bi bi-three-dots"></i>';
    document.getElementById('teamCount').innerHTML = '<i class="bi bi-three-dots"></i>';
    document.getElementById('featureCount').innerHTML = '<i class="bi bi-three-dots"></i>';
    
    try {
        const response = await fetch('/api/users/me/stats');
        if (response.ok) {
            const stats = await response.json();
            
            // Animate the numbers counting up
            animateNumber('roadmapCount', stats.roadmaps);
            animateNumber('teamCount', stats.teams);
            animateNumber('featureCount', stats.features);
        } else {
            throw new Error('Failed to load stats');
        }
        
    } catch (error) {
        console.error('Error loading stats:', error);
        // Set default values on error
        document.getElementById('roadmapCount').textContent = '0';
        document.getElementById('teamCount').textContent = '0';
        document.getElementById('featureCount').textContent = '0';
    }
}

// Animate number counting up
function animateNumber(elementId, targetValue) {
    const element = document.getElementById(elementId);
    const startValue = 0;
    const duration = 800; // 0.8 seconds
    const startTime = Date.now();
    
    function updateNumber() {
        const currentTime = Date.now();
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function for smooth animation
        const easeOutCubic = 1 - Math.pow(1 - progress, 3);
        const currentValue = Math.round(startValue + (targetValue - startValue) * easeOutCubic);
        
        element.textContent = currentValue;
        
        if (progress < 1) {
            requestAnimationFrame(updateNumber);
        }
    }
    
    updateNumber();
}

// Global variable to store all activities
let allActivities = [];
let showingAllActivities = false;

// Load recent activity
async function loadRecentActivity() {
    try {
        const response = await fetch('/api/users/me/activity?limit=50'); // Load more to have a good pool
        const activityContainer = document.getElementById('recentActivity');
        
        if (response.ok) {
            allActivities = await response.json();
            
            if (allActivities.length === 0) {
                activityContainer.innerHTML = `
                    <div class="text-center text-muted py-4">
                        <i class="bi bi-clock-history display-4 mb-2"></i>
                        <p>No recent activity yet</p>
                        <small>Start creating roadmaps and features to see your activity here!</small>
                    </div>
                `;
                return;
            }
            
            // Show only the first 3 activities initially
            showRecentActivities();
            
        } else {
            throw new Error('Failed to load activities');
        }
        
    } catch (error) {
        console.error('Error loading activity:', error);
        document.getElementById('recentActivity').innerHTML = `
            <div class="text-center text-muted py-3">
                <i class="bi bi-exclamation-triangle display-4 mb-2"></i>
                <p>Failed to load recent activity</p>
            </div>
        `;
    }
}

// Show only recent activities (first 3)
function showRecentActivities() {
    const activityContainer = document.getElementById('recentActivity');
    const viewAllBtn = document.getElementById('viewAllActivitiesBtn');
    const viewLessContainer = document.getElementById('viewLessContainer');
    
    if (allActivities.length === 0) return;
    
    // Show first 3 activities
    const recentActivities = allActivities.slice(0, 3);
    renderActivities(recentActivities);
    
    // Show "View All" button if there are more than 3 activities
    if (allActivities.length > 3) {
        viewAllBtn.classList.remove('d-none');
        viewAllBtn.innerHTML = `<i class="bi bi-list-ul me-1"></i>View All (${allActivities.length})`;
    } else {
        viewAllBtn.classList.add('d-none');
    }
    
    // Hide "Show Less" button
    viewLessContainer.classList.add('d-none');
    showingAllActivities = false;
}

// Toggle between showing all activities and recent activities
function toggleAllActivities() {
    if (showingAllActivities) {
        showRecentActivities();
    } else {
        showAllActivities();
    }
}

// Show all activities
function showAllActivities() {
    const activityContainer = document.getElementById('recentActivity');
    const viewAllBtn = document.getElementById('viewAllActivitiesBtn');
    const viewLessContainer = document.getElementById('viewLessContainer');
    
    // Render all activities
    renderActivities(allActivities);
    
    // Update button to show "Show Less"
    viewAllBtn.innerHTML = '<i class="bi bi-chevron-up me-1"></i>Show Less';
    
    // Show "Show Less" button at the bottom
    viewLessContainer.classList.remove('d-none');
    showingAllActivities = true;
}

// Helper function to render activities
function renderActivities(activities) {
    const activityContainer = document.getElementById('recentActivity');
    
    activityContainer.innerHTML = activities.map((activity, index) => `
        <div class="activity-item" style="animation-delay: ${index * 0.1}s">
            <div class="d-flex align-items-center">
                <div class="me-3">
                    <i class="bi ${activity.icon} text-${activity.color}"></i>
                </div>
                <div class="flex-grow-1">
                    <div class="fw-semibold">${activity.description}</div>
                    ${activity.target_name ? `<div class="text-muted small">${activity.target_name}</div>` : ''}
                </div>
                <div class="text-muted small">
                    ${activity.time_ago}
                </div>
            </div>
        </div>
    `).join('');
}

// Setup event listeners
function setupEventListeners() {
    // Settings toggles
    document.getElementById('emailNotifications').addEventListener('change', saveSettings);
    document.getElementById('weeklyDigest').addEventListener('change', saveSettings);
    
    // Delete account modal listeners
    const deleteConfirmation = document.getElementById('deleteConfirmation');
    const confirmUnderstand = document.getElementById('confirmUnderstand');
    const finalDeleteBtn = document.getElementById('finalDeleteBtn');
    
    // Enable/disable delete button based on confirmation
    function checkDeleteConfirmation() {
        const isTextCorrect = deleteConfirmation.value.trim() === 'DELETE';
        const isCheckboxChecked = confirmUnderstand.checked;
        finalDeleteBtn.disabled = !(isTextCorrect && isCheckboxChecked);
    }
    
    deleteConfirmation.addEventListener('input', checkDeleteConfirmation);
    confirmUnderstand.addEventListener('change', checkDeleteConfirmation);
    
    // Reset modal when it's hidden
    document.getElementById('deleteAccountModal').addEventListener('hidden.bs.modal', function() {
        deleteConfirmation.value = '';
        confirmUnderstand.checked = false;
        finalDeleteBtn.disabled = true;
    });
}

// Toggle edit mode
function toggleEditMode() {
    isEditMode = !isEditMode;
    
    const inputs = ['fullName', 'username'];
    const editButton = document.querySelector('button[onclick="toggleEditMode()"]');
    const editActions = document.getElementById('editActions');
    
    if (isEditMode) {
        // Enable editing
        inputs.forEach(id => {
            const input = document.getElementById(id);
            input.removeAttribute('readonly');
            input.classList.add('border-primary');
        });
        
        editButton.innerHTML = '<i class="bi bi-x-lg me-1"></i>Cancel';
        editButton.className = 'btn btn-sm btn-outline-secondary';
        editActions.classList.remove('d-none');
    } else {
        // Disable editing and restore original values
        inputs.forEach(id => {
            const input = document.getElementById(id);
            input.setAttribute('readonly', true);
            input.classList.remove('border-primary');
        });
        
        // Restore original values
        document.getElementById('fullName').value = originalProfileData.full_name;
        document.getElementById('username').value = originalProfileData.username;
        
        editButton.innerHTML = '<i class="bi bi-pencil me-1"></i>Edit';
        editButton.className = 'btn btn-sm btn-outline-primary';
        editActions.classList.add('d-none');
    }
}

// Cancel edit mode
function cancelEdit() {
    toggleEditMode();
}

// Save profile changes
async function saveProfile() {
    const fullName = document.getElementById('fullName').value.trim();
    const username = document.getElementById('username').value.trim();
    
    if (!fullName || !username) {
        showErrorMessage('Please fill in all required fields');
        return;
    }
    
    try {
        const response = await fetch('/api/users/me', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                full_name: fullName,
                username: username
            })
        });
        
        if (response.ok) {
            const updatedUser = await response.json();
            showSuccessMessage('Profile updated successfully!');
            
            // Update original data
            originalProfileData.full_name = fullName;
            originalProfileData.username = username;
            
            // Update display name
            document.getElementById('profileDisplayName').textContent = fullName;
            
            // Exit edit mode
            toggleEditMode();
        } else {
            const error = await response.json();
            showErrorMessage(error.error || 'Failed to save profile changes');
        }
        
    } catch (error) {
        console.error('Error saving profile:', error);
        showErrorMessage('Failed to save profile changes');
    }
}

// Save settings
async function saveSettings() {
    try {
        const emailNotifications = document.getElementById('emailNotifications').checked;
        const weeklyDigest = document.getElementById('weeklyDigest').checked;
        
        // This would need a backend endpoint to save settings
        console.log('Saving settings:', { emailNotifications, weeklyDigest });
        
        showSuccessMessage('Settings saved successfully!');
    } catch (error) {
        console.error('Error saving settings:', error);
        showErrorMessage('Failed to save settings');
    }
}

// Create new roadmap
async function createRoadmap() {
    const name = document.getElementById('roadmapName').value.trim();
    const description = document.getElementById('roadmapDescription').value.trim();
    
    if (!name) {
        showErrorMessage('Please enter a roadmap name');
        return;
    }
    
    try {
        const response = await fetch('/api/roadmaps', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, description })
        });
        
        if (response.ok) {
            const roadmap = await response.json();
            showSuccessMessage('Roadmap created successfully!');
            
            // Close modal and reset form
            const modal = bootstrap.Modal.getInstance(document.getElementById('createRoadmapModal'));
            modal.hide();
            document.getElementById('newRoadmapForm').reset();
            
            // Redirect to new roadmap
            window.location.href = `/roadmap/${roadmap.id}`;
        } else {
            const error = await response.json();
            showErrorMessage(error.error || 'Failed to create roadmap');
        }
    } catch (error) {
        console.error('Error creating roadmap:', error);
        showErrorMessage('Failed to create roadmap');
    }
}

// Show delete account confirmation modal
function confirmDeleteAccount() {
    const modal = new bootstrap.Modal(document.getElementById('deleteAccountModal'));
    modal.show();
}

// Execute account deletion after all confirmations
async function executeAccountDeletion() {
    const finalDeleteBtn = document.getElementById('finalDeleteBtn');
    const originalText = finalDeleteBtn.innerHTML;
    
    try {
        // Show loading state
        finalDeleteBtn.disabled = true;
        finalDeleteBtn.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>Deleting...';
        
        const response = await fetch('/api/users/me', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const result = await response.json();
            
            // Show success message
            showSuccessMessage('Account deleted successfully. You will be redirected shortly.');
            
            // Hide modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('deleteAccountModal'));
            modal.hide();
            
            // Redirect to home page after a short delay
            setTimeout(() => {
                window.location.href = '/';
            }, 2000);
            
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete account');
        }
        
    } catch (error) {
        console.error('Error deleting account:', error);
        showErrorMessage(error.message || 'Failed to delete account. Please try again.');
        
        // Restore button state
        finalDeleteBtn.disabled = false;
        finalDeleteBtn.innerHTML = originalText;
    }
}

// Utility functions
function showSuccessMessage(message) {
    // Create and show success toast
    const toast = document.createElement('div');
    toast.className = 'toast align-items-center text-white bg-success border-0 position-fixed top-0 end-0 m-3';
    toast.style.zIndex = '9999';
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                <i class="bi bi-check-circle me-2"></i>${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
    `;
    document.body.appendChild(toast);
    
    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();
    
    // Remove toast element after it's hidden
    toast.addEventListener('hidden.bs.toast', () => {
        document.body.removeChild(toast);
    });
}

function showErrorMessage(message) {
    // Create and show error toast
    const toast = document.createElement('div');
    toast.className = 'toast align-items-center text-white bg-danger border-0 position-fixed top-0 end-0 m-3';
    toast.style.zIndex = '9999';
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                <i class="bi bi-exclamation-triangle me-2"></i>${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
    `;
    document.body.appendChild(toast);
    
    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();
    
    // Remove toast element after it's hidden
    toast.addEventListener('hidden.bs.toast', () => {
        document.body.removeChild(toast);
    });
} 

// Animate number counting up
function animateNumber(elementId, targetValue) {
    const element = document.getElementById(elementId);
    const startValue = 0;
    const duration = 800;
    const startTime = Date.now();
    function updateNumber() {
        const currentTime = Date.now();
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOutCubic = 1 - Math.pow(1 - progress, 3);
        const currentValue = Math.round(startValue + (targetValue - startValue) * easeOutCubic);
        element.textContent = currentValue;
        if (progress < 1) { requestAnimationFrame(updateNumber); }
    }
    updateNumber();
}
