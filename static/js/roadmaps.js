document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const loadingState = document.getElementById('loadingState');
    const emptyState = document.getElementById('emptyState');
    const roadmapGrid = document.getElementById('roadmapGrid');
    const roadmapList = document.getElementById('roadmapList');
    const roadmapTableBody = document.getElementById('roadmapTableBody');
    
    // Check if essential elements exist
    if (!loadingState || !emptyState || !roadmapGrid) {
        console.error('Missing essential DOM elements:', {
            loadingState: !!loadingState,
            emptyState: !!emptyState,
            roadmapGrid: !!roadmapGrid
        });
        return;
    }
    
    // Form elements
    const nameInput = document.getElementById('roadmapName');
    const descriptionInput = document.getElementById('roadmapDescription');
    const templateSelect = document.getElementById('roadmapTemplate');
    const visibilitySelect = document.getElementById('roadmapVisibility');
    const saveBtn = document.getElementById('saveRoadmap');
    
    // Filter and search elements
    const searchInput = document.getElementById('searchInput');
    const filterSelect = document.getElementById('filterSelect');
    const sortSelect = document.getElementById('sortSelect');
    const viewToggle = document.getElementById('viewToggle');
    
    // Statistics elements
    const totalRoadmapsEl = document.getElementById('totalRoadmaps');
    const activeRoadmapsEl = document.getElementById('activeRoadmaps');
    const teamRoadmapsEl = document.getElementById('teamRoadmaps');
    const ownedRoadmapsEl = document.getElementById('ownedRoadmaps');
    
    // State
    let allRoadmaps = [];
    let filteredRoadmaps = [];
    let currentView = 'grid'; // 'grid' or 'list'
    let currentUser = null;
    
    // Initialize
    init();
    
    async function init() {
        try {
            showLoading();
            await loadCurrentUser();
            await loadRoadmaps();
            await loadStatistics();
            setupEventListeners();
            hideLoading();
        } catch (error) {
            console.error('Error initializing roadmaps page:', error);
            hideLoading();
            showError('Failed to load roadmaps. Please refresh the page.');
        }
    }
    
    async function loadCurrentUser() {
        try {
            const response = await fetch('/api/users/me');
            if (response.ok) {
                currentUser = await response.json();
            }
        } catch (error) {
            console.error('Error loading current user:', error);
        }
    }
    
    async function loadRoadmaps() {
        try {
            const response = await fetch('/api/roadmaps');
            
            if (!response.ok) {
                if (response.status === 401) {
                    // User not logged in, redirect to login
                    window.location.href = '/login';
                    return;
                }
                throw new Error(`Failed to fetch roadmaps: ${response.status}`);
            }
            
            allRoadmaps = await response.json();
            
            // Add additional metadata for each roadmap
            allRoadmaps = allRoadmaps.map(roadmap => ({
                ...roadmap,
                role: getRoadmapRole(roadmap),
                featureCount: roadmap.feature_count || 0, // Use feature_count from API
                lastUpdated: roadmap.updated_at || roadmap.created_at,
                isActive: true // You can implement logic to determine if roadmap is active
            }));
            
            filteredRoadmaps = [...allRoadmaps];
            renderRoadmaps();
        } catch (error) {
            console.error('Error loading roadmaps:', error);
            showError('Failed to load roadmaps: ' + error.message);
        }
    }
    
    async function loadStatistics() {
        try {
            // Calculate statistics from loaded roadmaps
            const stats = calculateStatistics();
            
            // Animate numbers
            animateNumber('totalRoadmaps', stats.total);
            animateNumber('activeRoadmaps', stats.active);
            animateNumber('teamRoadmaps', stats.team);
            animateNumber('ownedRoadmaps', stats.owned);
        } catch (error) {
            console.error('Error loading statistics:', error);
        }
    }
    
    function calculateStatistics() {
        const stats = {
            total: allRoadmaps.length,
            active: allRoadmaps.filter(r => r.isActive).length,
            team: allRoadmaps.filter(r => r.role === 'Member').length,
            owned: allRoadmaps.filter(r => r.role === 'Owner').length
        };
        return stats;
    }
    
    function getRoadmapRole(roadmap) {
        if (!currentUser) return 'Unknown';
        return roadmap.owner_id === currentUser.id ? 'Owner' : 'Member';
    }
    
    function setupEventListeners() {
        // Save roadmap
        saveBtn.addEventListener('click', handleSaveRoadmap);
        
        // Search functionality
        searchInput.addEventListener('input', debounce(handleSearch, 300));
        
        // Filter and sort
        filterSelect.addEventListener('change', handleFilter);
        sortSelect.addEventListener('change', handleSort);
        
        // View toggle
        viewToggle.addEventListener('click', toggleView);
        
        // Form validation
        nameInput.addEventListener('input', validateForm);
        
        // Enter key support for search
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleSearch();
            }
        });
    }
    
    async function handleSaveRoadmap() {
        const name = nameInput.value.trim();
        const description = descriptionInput.value.trim();
        const template = templateSelect.value;
        const visibility = visibilitySelect.value;
        
        if (!name) {
            showError('Please enter a roadmap name.');
            nameInput.focus();
            return;
        }
        
        try {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>Creating...';
            
            const response = await fetch('/api/roadmaps', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    name, 
                    description,
                    template,
                    visibility
                })
            });
            
            if (!response.ok) throw new Error('Failed to create roadmap');
            
            const newRoadmap = await response.json();
            
            // Reset form
            document.getElementById('roadmapForm').reset();
            
            // Close modal
            const modalEl = document.getElementById('addRoadmapModal');
            bootstrap.Modal.getInstance(modalEl).hide();
            
            // Reload roadmaps
            await loadRoadmaps();
            await loadStatistics();
            
            showSuccess('Roadmap created successfully!');
            
        } catch (error) {
            console.error('Error saving roadmap:', error);
            showError('Failed to create roadmap. Please try again.');
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="bi bi-check-lg me-1"></i>Create Roadmap';
        }
    }
    
    function handleSearch() {
        const query = searchInput.value.toLowerCase().trim();
        
        if (!query) {
            filteredRoadmaps = [...allRoadmaps];
        } else {
            filteredRoadmaps = allRoadmaps.filter(roadmap => 
                roadmap.name.toLowerCase().includes(query) ||
                (roadmap.description && roadmap.description.toLowerCase().includes(query))
            );
        }
        
        renderRoadmaps();
    }
    
    function handleFilter() {
        const filter = filterSelect.value;
        
        switch (filter) {
            case 'owned':
                filteredRoadmaps = allRoadmaps.filter(r => r.role === 'Owner');
                break;
            case 'member':
                filteredRoadmaps = allRoadmaps.filter(r => r.role === 'Member');
                break;
            case 'recent':
                filteredRoadmaps = [...allRoadmaps].sort((a, b) => 
                    new Date(b.lastUpdated) - new Date(a.lastUpdated)
                ).slice(0, 10);
                break;
            default:
                filteredRoadmaps = [...allRoadmaps];
        }
        
        // Reapply search if there's a query
        if (searchInput.value.trim()) {
            handleSearch();
        } else {
            renderRoadmaps();
        }
    }
    
    function handleSort() {
        const sort = sortSelect.value;
        
        filteredRoadmaps.sort((a, b) => {
            switch (sort) {
                case 'name':
                    return a.name.localeCompare(b.name);
                case 'created':
                    return new Date(b.created_at) - new Date(a.created_at);
                case 'updated':
                    return new Date(b.lastUpdated) - new Date(a.lastUpdated);
                default:
                    return 0;
            }
        });
        
        renderRoadmaps();
    }
    
    function toggleView() {
        currentView = currentView === 'grid' ? 'list' : 'grid';
        
        if (currentView === 'grid') {
            roadmapGrid.classList.remove('d-none');
            roadmapList.classList.add('d-none');
            viewToggle.innerHTML = '<i class="bi bi-list-ul"></i>';
            viewToggle.title = 'Switch to List View';
        } else {
            roadmapGrid.classList.add('d-none');
            roadmapList.classList.remove('d-none');
            viewToggle.innerHTML = '<i class="bi bi-grid-3x3-gap"></i>';
            viewToggle.title = 'Switch to Grid View';
        }
        
        renderRoadmaps();
    }
    
    function renderRoadmaps() {
        if (filteredRoadmaps.length === 0) {
            showEmptyState();
            return;
        }
        
        hideEmptyState();
        
        if (currentView === 'grid') {
            renderGridView();
        } else {
            renderListView();
        }
    }
    
    function renderGridView() {
        roadmapGrid.innerHTML = filteredRoadmaps.map(roadmap => `
            <div class="roadmap-card" data-roadmap-id="${roadmap.id}">
                <div class="roadmap-header">
                    <div class="roadmap-role-badge">${roadmap.role}</div>
                    <h5 class="mb-1">${escapeHtml(roadmap.name)}</h5>
                    <p class="mb-0 opacity-75">${roadmap.description ? escapeHtml(roadmap.description) : 'No description'}</p>
                </div>
                <div class="roadmap-body">
                    <div class="roadmap-meta">
                        <span><i class="bi bi-calendar3 me-1"></i>${formatDate(roadmap.lastUpdated)}</span>
                        <span><i class="bi bi-kanban me-1"></i>${roadmap.featureCount} features</span>
                    </div>
                    <div class="roadmap-actions">
                        <a href="/roadmap/${roadmap.id}" class="btn btn-primary btn-sm flex-fill">
                            <i class="bi bi-arrow-right me-1"></i>Open
                        </a>
                        <button class="btn btn-outline-secondary btn-sm" onclick="shareRoadmap(${roadmap.id})" title="Share">
                            <i class="bi bi-share"></i>
                        </button>
                        <div class="dropdown">
                            <button class="btn btn-outline-secondary btn-sm" data-bs-toggle="dropdown" title="More options">
                                <i class="bi bi-three-dots"></i>
                            </button>
                            <ul class="dropdown-menu">
                                <li><a class="dropdown-item" href="#" onclick="editRoadmap(${roadmap.id})">
                                    <i class="bi bi-pencil me-2"></i>Edit
                                </a></li>
                                <li><a class="dropdown-item" href="#" onclick="duplicateRoadmap(${roadmap.id})">
                                    <i class="bi bi-files me-2"></i>Duplicate
                                </a></li>
                                <li><hr class="dropdown-divider"></li>
                                <li><a class="dropdown-item text-danger" href="#" onclick="deleteRoadmap(${roadmap.id})">
                                    <i class="bi bi-trash me-2"></i>Delete
                                </a></li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    }
    
    function renderListView() {
        roadmapTableBody.innerHTML = filteredRoadmaps.map(roadmap => `
            <tr data-roadmap-id="${roadmap.id}">
                <td>
                    <div class="d-flex align-items-center">
                        <div class="roadmap-icon me-3">
                            <i class="bi bi-map text-primary"></i>
                        </div>
                        <div>
                            <h6 class="mb-0">${escapeHtml(roadmap.name)}</h6>
                            <small class="text-muted">Created ${formatDate(roadmap.created_at)}</small>
                        </div>
                    </div>
                </td>
                <td>
                    <span class="text-muted">${roadmap.description ? escapeHtml(roadmap.description) : 'No description'}</span>
                </td>
                <td>
                    <span class="badge ${roadmap.role === 'Owner' ? 'bg-primary' : 'bg-info'}">${roadmap.role}</span>
                </td>
                <td>
                    <span class="text-muted">${formatDate(roadmap.lastUpdated)}</span>
                </td>
                <td>
                    <span class="badge bg-light text-dark">${roadmap.featureCount}</span>
                </td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <a href="/roadmap/${roadmap.id}" class="btn btn-primary btn-sm">
                            <i class="bi bi-arrow-right"></i>
                        </a>
                        <button class="btn btn-outline-secondary btn-sm" onclick="shareRoadmap(${roadmap.id})" title="Share">
                            <i class="bi bi-share"></i>
                        </button>
                        <div class="dropdown">
                            <button class="btn btn-outline-secondary btn-sm" data-bs-toggle="dropdown">
                                <i class="bi bi-three-dots"></i>
                            </button>
                            <ul class="dropdown-menu">
                                <li><a class="dropdown-item" href="#" onclick="editRoadmap(${roadmap.id})">
                                    <i class="bi bi-pencil me-2"></i>Edit
                                </a></li>
                                <li><a class="dropdown-item" href="#" onclick="duplicateRoadmap(${roadmap.id})">
                                    <i class="bi bi-files me-2"></i>Duplicate
                                </a></li>
                                <li><hr class="dropdown-divider"></li>
                                <li><a class="dropdown-item text-danger" href="#" onclick="deleteRoadmap(${roadmap.id})">
                                    <i class="bi bi-trash me-2"></i>Delete
                                </a></li>
                            </ul>
                        </div>
                    </div>
                </td>
            </tr>
        `).join('');
    }
    
    function showLoading() {
        loadingState.classList.remove('d-none');
        roadmapGrid.classList.add('d-none');
        roadmapList.classList.add('d-none');
        emptyState.classList.add('d-none');
    }
    
    function hideLoading() {
        loadingState.classList.add('d-none');
        if (currentView === 'grid') {
            roadmapGrid.classList.remove('d-none');
        } else {
            roadmapList.classList.remove('d-none');
        }
    }
    
    function showEmptyState() {
        emptyState.classList.remove('d-none');
        roadmapGrid.classList.add('d-none');
        roadmapList.classList.add('d-none');
    }
    
    function hideEmptyState() {
        emptyState.classList.add('d-none');
    }
    
    function validateForm() {
        const isValid = nameInput.value.trim().length > 0;
        saveBtn.disabled = !isValid;
        return isValid;
    }
    
    // Utility functions
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    function formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
        if (diffDays < 365) return `${Math.ceil(diffDays / 30)} months ago`;
        return date.toLocaleDateString();
    }
    
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
            
            if (progress < 1) {
                requestAnimationFrame(updateNumber);
            }
        }
        
        updateNumber();
    }
    
    function showSuccess(message) {
        // Create a toast notification
        const toast = document.createElement('div');
        toast.className = 'toast align-items-center text-white bg-success border-0';
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');
        toast.setAttribute('aria-atomic', 'true');
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">
                    <i class="bi bi-check-circle me-2"></i>${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        `;
        
        // Add toast container if it doesn't exist
        let toastContainer = document.querySelector('.toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
            document.body.appendChild(toastContainer);
        }
        
        toastContainer.appendChild(toast);
        const bsToast = new bootstrap.Toast(toast);
        bsToast.show();
        
        // Remove toast after it's hidden
        toast.addEventListener('hidden.bs.toast', () => {
            toast.remove();
        });
    }
    
    function showError(message) {
        // Create a toast notification
        const toast = document.createElement('div');
        toast.className = 'toast align-items-center text-white bg-danger border-0';
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');
        toast.setAttribute('aria-atomic', 'true');
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">
                    <i class="bi bi-exclamation-triangle me-2"></i>${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        `;
        
        // Add toast container if it doesn't exist
        let toastContainer = document.querySelector('.toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
            document.body.appendChild(toastContainer);
        }
        
        toastContainer.appendChild(toast);
        const bsToast = new bootstrap.Toast(toast);
        bsToast.show();
        
        // Remove toast after it's hidden
        toast.addEventListener('hidden.bs.toast', () => {
            toast.remove();
        });
    }
    
    // Global functions for dropdown actions
    window.shareRoadmap = function(roadmapId) {
        // Implement share functionality
        console.log('Share roadmap:', roadmapId);
        showSuccess('Share link copied to clipboard!');
    };
    
    window.editRoadmap = function(roadmapId) {
        // Find the roadmap data
        const roadmap = allRoadmaps.find(r => r.id === roadmapId);
        if (!roadmap) {
            showError('Roadmap not found');
            return;
        }
        
        // Show edit modal with pre-filled data
        showEditModal(roadmap);
    };
    
    window.duplicateRoadmap = function(roadmapId) {
        // Find the roadmap data
        const roadmap = allRoadmaps.find(r => r.id === roadmapId);
        if (!roadmap) {
            showError('Roadmap not found');
            return;
        }
        
        // Show duplicate modal with pre-filled data
        showDuplicateModal(roadmap);
    };
    
    window.deleteRoadmap = async function(roadmapId) {
        if (!confirm('Are you sure you want to delete this roadmap? This action cannot be undone.')) {
            return;
        }
        
        try {
            const response = await fetch(`/api/roadmaps/${roadmapId}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete roadmap');
            }
            
            // Reload roadmaps and statistics
            await loadRoadmaps();
            await loadStatistics();
            showSuccess('Roadmap deleted successfully!');
        } catch (error) {
            console.error('Error deleting roadmap:', error);
            showError('Failed to delete roadmap: ' + error.message);
        }
    };
    
    function showEditModal(roadmap) {
        // Create edit modal HTML
        const modalHtml = `
            <div class="modal fade" id="editRoadmapModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Edit Roadmap</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="editRoadmapForm">
                                <div class="mb-3">
                                    <label for="editRoadmapName" class="form-label">Name *</label>
                                    <input type="text" class="form-control" id="editRoadmapName" value="${escapeHtml(roadmap.name)}" required>
                                </div>
                                <div class="mb-3">
                                    <label for="editRoadmapDescription" class="form-label">Description</label>
                                    <textarea class="form-control" id="editRoadmapDescription" rows="3">${escapeHtml(roadmap.description || '')}</textarea>
                                </div>
                                <div class="mb-3">
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" id="editRoadmapPublic" ${roadmap.is_public ? 'checked' : ''}>
                                        <label class="form-check-label" for="editRoadmapPublic">
                                            Make this roadmap public
                                        </label>
                                    </div>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-primary" id="saveEditBtn">Save Changes</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Remove existing modal if any
        const existingModal = document.getElementById('editRoadmapModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('editRoadmapModal'));
        modal.show();
        
        // Handle save button
        document.getElementById('saveEditBtn').addEventListener('click', () => handleEditRoadmap(roadmap.id, modal));
        
        // Clean up when modal is hidden
        document.getElementById('editRoadmapModal').addEventListener('hidden.bs.modal', function() {
            this.remove();
        });
    }
    
    function showDuplicateModal(roadmap) {
        // Create duplicate modal HTML
        const modalHtml = `
            <div class="modal fade" id="duplicateRoadmapModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Duplicate Roadmap</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="duplicateRoadmapForm">
                                <div class="mb-3">
                                    <label for="duplicateRoadmapName" class="form-label">Name *</label>
                                    <input type="text" class="form-control" id="duplicateRoadmapName" value="${escapeHtml(roadmap.name)} (Copy)" required>
                                </div>
                                <div class="mb-3">
                                    <label for="duplicateRoadmapDescription" class="form-label">Description</label>
                                    <textarea class="form-control" id="duplicateRoadmapDescription" rows="3">${escapeHtml(roadmap.description || '')}</textarea>
                                </div>
                                <div class="mb-3">
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" id="duplicateRoadmapPublic">
                                        <label class="form-check-label" for="duplicateRoadmapPublic">
                                            Make this roadmap public
                                        </label>
                                    </div>
                                </div>
                                <div class="alert alert-info">
                                    <i class="bi bi-info-circle me-2"></i>
                                    This will create a copy of the roadmap including all features (${roadmap.feature_count || 0} features).
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-primary" id="saveDuplicateBtn">Create Copy</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Remove existing modal if any
        const existingModal = document.getElementById('duplicateRoadmapModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('duplicateRoadmapModal'));
        modal.show();
        
        // Handle save button
        document.getElementById('saveDuplicateBtn').addEventListener('click', () => handleDuplicateRoadmap(roadmap.id, modal));
        
        // Clean up when modal is hidden
        document.getElementById('duplicateRoadmapModal').addEventListener('hidden.bs.modal', function() {
            this.remove();
        });
    }
    
    async function handleEditRoadmap(roadmapId, modal) {
        const name = document.getElementById('editRoadmapName').value.trim();
        const description = document.getElementById('editRoadmapDescription').value.trim();
        const isPublic = document.getElementById('editRoadmapPublic').checked;
        
        if (!name) {
            showError('Please enter a roadmap name');
            return;
        }
        
        try {
            const response = await fetch(`/api/roadmaps/${roadmapId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: name,
                    description: description,
                    is_public: isPublic
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to update roadmap');
            }
            
            // Close modal and refresh data
            modal.hide();
            await loadRoadmaps();
            await loadStatistics();
            showSuccess('Roadmap updated successfully!');
            
        } catch (error) {
            console.error('Error updating roadmap:', error);
            showError(error.message || 'Failed to update roadmap');
        }
    }
    
    async function handleDuplicateRoadmap(roadmapId, modal) {
        const name = document.getElementById('duplicateRoadmapName').value.trim();
        const description = document.getElementById('duplicateRoadmapDescription').value.trim();
        const isPublic = document.getElementById('duplicateRoadmapPublic').checked;
        
        if (!name) {
            showError('Please enter a roadmap name');
            return;
        }
        
        try {
            const response = await fetch(`/api/roadmaps/${roadmapId}/duplicate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: name,
                    description: description,
                    is_public: isPublic
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to duplicate roadmap');
            }
            
            const result = await response.json();
            
            // Close modal and refresh data
            modal.hide();
            await loadRoadmaps();
            await loadStatistics();
            showSuccess(`Roadmap duplicated successfully! Created "${result.roadmap.name}" with ${result.roadmap.feature_count} features.`);
            
        } catch (error) {
            console.error('Error duplicating roadmap:', error);
            showError(error.message || 'Failed to duplicate roadmap');
        }
    }
});