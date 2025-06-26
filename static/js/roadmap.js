// Timeline View Management
class RoadmapManager {
    constructor(isDemoMode = false) {
        this.currentView = 'month';
        this.features = [];
        this.selectedFeature = null;
        this.editingFeatureId = null;
        this.isDemoMode = isDemoMode || (typeof isDemo !== 'undefined' && isDemo);
        // Navigation state for different views
        this.monthOffset = 0;  // Offset from current month
        this.quarterOffset = 0; // Offset from current quarter  
        this.sprintOffset = 0;  // Offset from current sprint
        this.initializeEventListeners();
        this.setupKeyboardNavigation();
        this.fetchFeatures();
    }

    initializeEventListeners() {
        // View toggle buttons
        document.querySelectorAll('[data-view]').forEach(button => {
            button.addEventListener('click', (e) => {
                // Update active state for sidebar buttons
                document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
                e.target.closest('.view-btn').classList.add('active');
                this.setView(e.target.closest('[data-view]').dataset.view);
            });
        });

        // Save feature button (only if it exists - not in demo mode)
        const saveFeatureBtn = document.getElementById('saveFeature');
        if (saveFeatureBtn) {
            saveFeatureBtn.addEventListener('click', () => {
            this.saveFeature();
        });
        }

        // Delete and edit buttons in detail modal (only if they exist - not in demo mode)
        const deleteFeatureBtn = document.getElementById('deleteFeatureBtn');
        if (deleteFeatureBtn) {
            deleteFeatureBtn.addEventListener('click', () => this.deleteFeature());
        }
        
        const editFeatureBtn = document.getElementById('editFeatureBtn');
        if (editFeatureBtn) {
            editFeatureBtn.addEventListener('click', () => this.startEditFeature());
        }

        // Add Feature Modal event listeners (only if modal exists - not in demo mode)
        const addFeatureModal = document.getElementById('addFeatureModal');
        if (addFeatureModal) {
            addFeatureModal.addEventListener('show.bs.modal', (e) => {
                // Only reset if we're not editing (editingFeatureId is null)
                if (!this.editingFeatureId) {
                    document.querySelector('#addFeatureModal .modal-title').innerHTML = '<i class="bi bi-plus-circle me-2"></i>Add New Feature';
                }
            });

            // Reset form and editing state when modal is hidden
            addFeatureModal.addEventListener('hidden.bs.modal', () => {
                const featureForm = document.getElementById('featureForm');
                if (featureForm) {
                    featureForm.reset();
                }
                this.editingFeatureId = null;
            });
        }

        // Initialize drag and drop
        this.initializeDragAndDrop();
    }

    initializeTimeline() {
        this.updateTimelineHeader();
        this.renderFeatures();
    }

    setView(view) {
        this.currentView = view;
        // Update active state is handled in the event listener now
        const timelineEl = document.querySelector('.timeline-view');
        const kanbanEl = document.getElementById('kanban-board');
        const ganttEl = document.getElementById('ganttChart');
        
        // All views except gantt use the kanban board styling now
        if (view === 'gantt') {
            timelineEl.classList.add('d-none');
            kanbanEl.classList.add('d-none');
            ganttEl.classList.remove('d-none');
            this.renderGantt();
        } else {
            ganttEl.classList.add('d-none');
            timelineEl.classList.add('d-none');
            kanbanEl.classList.remove('d-none');
            
            // Route to appropriate kanban-style renderer
            switch(view) {
                case 'kanban':
                    this.renderKanban();
                    break;
                case 'month':
                    this.renderMonthAsKanban();
                    break;
                case 'quarter':
                    this.renderQuarterAsKanban();
                    break;
                case 'sprint':
                    this.renderSprintAsKanban();
                    break;
                case 'release':
                    this.renderReleaseAsKanban();
                    break;
                default:
                    this.renderMonthAsKanban(); // Default fallback
            }
        }
    }

    setupKeyboardNavigation() {
        document.addEventListener('keydown', (e) => {
            // Only handle navigation if we're in a kanban-style view
            if (['month', 'quarter', 'sprint'].includes(this.currentView)) {
                switch(e.key) {
                    case 'ArrowLeft':
                        e.preventDefault();
                        this.navigateTimeline(this.currentView, -1);
                        break;
                    case 'ArrowRight':
                        e.preventDefault();
                        this.navigateTimeline(this.currentView, 1);
                        break;
                    case 'Home':
                        e.preventDefault();
                        this.resetToCurrentPeriod();
                        break;
                }
            }
        });
    }

    resetToCurrentPeriod() {
        this.monthOffset = 0;
        this.quarterOffset = 0;
        this.sprintOffset = 0;
        this.setView(this.currentView);
    }

    getReleasesForView() {
        // Distinct releases, include 'Unassigned' if empty
        const releases = this.features.map(f => f.release || 'Unassigned');
        return Array.from(new Set(releases));
    }

    updateTimelineHeader() {
        const monthsContainer = document.querySelector('.timeline-months');
        monthsContainer.innerHTML = '';

        const headers = this.currentView === 'release' ? this.getReleasesForView() : this.getMonthsForView();
        headers.forEach(hdr => {
            const monthElement = document.createElement('div');
            monthElement.className = 'timeline-month';
            monthElement.textContent = hdr;
            monthsContainer.appendChild(monthElement);
        });
    }

    getMonthsForView() {
        const months = [];
        const today = new Date();
        let count = this.getOptimalColumnCount(); // Dynamic count based on screen size
        
        // Apply month offset for navigation
        const startMonth = this.monthOffset;

        for (let i = 0; i < count; i++) {
            const date = new Date(today.getFullYear(), today.getMonth() + startMonth + i, 1);
            months.push(date.toLocaleString('default', { month: 'long', year: 'numeric' }));
        }

        return months;
    }

    getOptimalColumnCount() {
        const screenWidth = window.innerWidth;
        const sidebarWidth = 200;
        const availableWidth = screenWidth - sidebarWidth - 100; // Account for padding
        const minColumnWidth = 220;
        
        const maxColumns = Math.floor(availableWidth / minColumnWidth);
        
        // Set reasonable limits for different views
        switch(this.currentView) {
            case 'month':
                return Math.min(Math.max(maxColumns, 3), 5); // 3-5 months
            case 'quarter':
                return Math.min(Math.max(maxColumns, 2), 4); // 2-4 quarters
            case 'sprint':
                return Math.min(Math.max(maxColumns, 3), 6); // 3-6 sprints
            default:
                return Math.min(Math.max(maxColumns, 3), 5);
        }
    }

    getQuartersForView() {
        const quarters = [];
        const today = new Date();
        const currentQuarter = Math.floor(today.getMonth() / 3);
        
        const count = this.getOptimalColumnCount();
        for (let i = 0; i < count; i++) {
            const quarterOffset = this.quarterOffset + i;
            const year = today.getFullYear() + Math.floor((currentQuarter + quarterOffset) / 4);
            const quarter = ((currentQuarter + quarterOffset) % 4 + 4) % 4 + 1;
            quarters.push(`Q${quarter} ${year}`);
        }
        
        return quarters;
    }

    getSprintsForView() {
        const sprints = [];
        const count = this.getOptimalColumnCount();
        for (let i = 0; i < count; i++) {
            const sprintNumber = this.sprintOffset + i + 1;
            sprints.push(`Sprint ${sprintNumber}`);
        }
        return sprints;
    }

    getQuarterForDate(date) {
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        return `Q${quarter} ${date.getFullYear()}`;
    }

    getSprintForDate(date) {
        const today = new Date();
        const diffTime = date.getTime() - today.getTime();
        const diffWeeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7));
        const sprintNumber = Math.max(1, Math.min(8, Math.ceil(diffWeeks / 2))); // 2 weeks per sprint
        return `Sprint ${sprintNumber}`;
    }

    initializeKanbanDragDrop(board, dataAttribute, updateFunction) {
        // Only enable drag and drop for members and above
        // In demo mode, disable drag and drop
        if (this.isDemoMode) {
            return; // Disable drag and drop in demo mode
        }
        if (typeof hasPermission === 'function' && !hasPermission('member')) {
            return;
        }
        
        board.querySelectorAll('.kanban-list').forEach(list => {
            new Sortable(list, {
                group: `${dataAttribute}-kanban`,
                animation: 200,
                ghostClass: 'kanban-ghost',
                chosenClass: 'kanban-chosen',
                dragClass: 'kanban-drag',
                onStart: (evt) => {
                    // Add visual feedback when dragging starts
                    board.querySelectorAll('.kanban-list').forEach(l => {
                        l.style.borderColor = '#6366f1';
                        l.style.borderStyle = 'dashed';
                        l.style.backgroundColor = 'rgba(99,102,241,0.05)';
                    });
                },
                onEnd: (evt) => {
                    // Remove visual feedback when dragging ends
                    board.querySelectorAll('.kanban-list').forEach(l => {
                        l.style.borderColor = 'transparent';
                        l.style.backgroundColor = 'rgba(255,255,255,0.3)';
                    });
                },
                onAdd: (evt) => {
                    const itemEl = evt.item;
                    const newValue = itemEl.closest('.kanban-column').dataset[dataAttribute];
                    const id = parseInt(itemEl.dataset.id);
                    
                    const feature = this.features.find(f => f.id === id);
                    const updateData = updateFunction(newValue, feature);
                    
                    fetch(`/api/features/${id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(updateData)
                    })
                    .then(res => res.json())
                    .then(updated => {
                        const idx = this.features.findIndex(f => f.id === updated.id);
                        Object.assign(this.features[idx], updated);
                        
                        // Re-render current view to update counts
                        this.setView(this.currentView);
                    }).catch(e => console.error('Error updating feature:', e));
                }
            });
        });
    }

    saveFeature() {
        // In demo mode, show demo message instead of saving
        if (this.isDemoMode) {
            if (typeof showDemoMessage === 'function') {
                showDemoMessage();
            } else {
                alert('This is a demo. Sign up to create and edit features!');
            }
            return;
        }

        const title = document.getElementById('featureTitle').value;
        const description = document.getElementById('featureDescription').value;
        const priority = document.getElementById('featurePriority').value;
        const status = document.getElementById('featureStatus').value;
        const release = document.getElementById('featureRelease').value;
        const date = document.getElementById('featureDate').value;

        if (!title || !date) {
            alert('Please fill in the required fields');
            return;
        }

        const featureData = { title, description, priority, status, release, date };

        if (this.editingFeatureId) {
            // Update existing feature
            fetch(`/api/features/${this.editingFeatureId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(featureData)
            })
                .then(response => {
                    if (response.ok) return response.json();
                    throw new Error('Failed to update feature');
                })
                .then(updatedFeature => {
                    // Update locally
                    const index = this.features.findIndex(f => f.id === this.editingFeatureId);
                    if (index !== -1) {
                        this.features[index] = updatedFeature;
                        this.setView(this.currentView); // Re-render current view
                    }
                    // Hide modal
                    bootstrap.Modal.getInstance(document.getElementById('addFeatureModal')).hide();
                })
                .catch(e => {
                    console.error('Error updating feature:', e);
                    alert('Failed to update feature');
                });
        } else {
            // Create new feature
            fetch(`/api/roadmaps/${ROADMAP_ID}/features`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(featureData)
            })
            .then(response => {
                    if (response.ok) return response.json();
                    throw new Error('Failed to create feature');
                })
                .then(newFeature => {
                    // Add to local array
                this.features.push(newFeature);
                    this.setView(this.currentView); // Re-render current view
                    // Hide modal
                    bootstrap.Modal.getInstance(document.getElementById('addFeatureModal')).hide();
                })
                .catch(e => {
                    console.error('Error creating feature:', e);
                    alert('Failed to create feature');
                });
        }
    }

    renderFeatures() {
        const contentContainer = document.querySelector('.timeline-content');
        contentContainer.innerHTML = '';
        // Create a column for each period based on current view
        const headers = this.currentView === 'release' ? this.getReleasesForView() : this.getMonthsForView();
        headers.forEach(() => {
            const col = document.createElement('div');
            col.className = 'timeline-column';
            contentContainer.appendChild(col);
        });
        // Compute reference dates or releases
        let refs;
        if (this.currentView === 'release') {
            refs = this.getReleasesForView();
        } else {
            refs = this.getMonthsForView().map(m => {
                const [name, year] = m.split(' ');
                const monthIdx = new Date(Date.parse(name + ' 1, 2000')).getMonth();
                return new Date(parseInt(year), monthIdx, 1);
            });
        }
        // Place each feature in the appropriate column
        const columns = Array.from(contentContainer.children);
        this.features.forEach(feature => {
            let index;
            if (this.currentView === 'release') {
                const key = feature.release || 'Unassigned';
                index = refs.indexOf(key);
                if (index === -1) index = refs.length - 1;
            } else {
                const featureDate = new Date(feature.date);
                index = refs.findIndex(d => d.getFullYear() === featureDate.getFullYear() && d.getMonth() === featureDate.getMonth());
                if (index === -1) index = featureDate < refs[0] ? 0 : refs.length -1;
            }
            const featureElement = this.createFeatureElement(feature);
            columns[index].appendChild(featureElement);
        });
        // Enable drag-and-drop within and across columns
        this.initializeDragAndDrop();
    }

    createFeatureElement(feature) {
        const element = document.createElement('div');
        element.className = `feature-card ${feature.status}`;
        element.dataset.id = feature.id;
        element.innerHTML = `
            <div class="priority ${feature.priority}">${feature.priority}</div>
            <h5>${feature.title}</h5>
            <p>${feature.description}</p>
            <small>Release Date: ${this.formatDateForDisplay(feature.date)}</small>
        `;
        // Show detail modal on click with pop-out animation
        element.addEventListener('click', (e) => {
            // Set currently selected feature
            this.selectedFeature = feature;
            document.getElementById('detailTitle').textContent = feature.title;
            document.getElementById('detailDescription').textContent = feature.description;
            
            // Set priority with proper class
            const priorityEl = document.getElementById('detailPriority');
            priorityEl.textContent = feature.priority;
            priorityEl.className = `detail-value priority-badge ${feature.priority}`;
            
            // Set status with proper class  
            const statusEl = document.getElementById('detailStatus');
            statusEl.textContent = feature.status;
            statusEl.className = `detail-value status-badge ${feature.status}`;
            
            // Set release and date
            document.getElementById('detailRelease').textContent = feature.release || 'Not assigned';
            document.getElementById('detailDate').textContent = this.formatDateForDisplay(feature.date);
            
            // Set transform origin to clicked point
            const modalEl = document.getElementById('featureDetailModal');
            const modalDialog = modalEl.querySelector('.modal-dialog');
            modalDialog.style.transformOrigin = `${e.clientX}px ${e.clientY}px`;
            // Show modal
            const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
            modal.show();
        });
        return element;
    }

    initializeDragAndDrop() {
        // Only enable drag and drop for members and above
        // In demo mode, disable drag and drop
        if (this.isDemoMode) {
            return; // Disable drag and drop in demo mode
        }
        if (typeof hasPermission === 'function' && !hasPermission('member')) {
            return;
        }
        
        const contentContainer = document.querySelector('.timeline-content');
        new Sortable(contentContainer, {
            animation: 150,
            ghostClass: 'feature-card-ghost',
            onEnd: (evt) => {
                // Update feature order in the array
                const itemEl = evt.item;
                const newIndex = evt.newIndex;
                const featureId = parseInt(itemEl.dataset.id);
                
                const featureIndex = this.features.findIndex(f => f.id === featureId);
                const feature = this.features.splice(featureIndex, 1)[0];
                this.features.splice(newIndex, 0, feature);
            }
        });
    }

    async fetchFeatures() {
        console.log('fetchFeatures called, isDemoMode:', this.isDemoMode);
        const loadingEl = document.getElementById('loadingState');
        const errorEl = document.getElementById('errorState');
        const emptyEl = document.getElementById('emptyState');
        const controlsEl = document.getElementById('mainContentArea');
        const timelineEl = document.getElementById('timelineView');
        const kanbanEl = document.getElementById('kanban-board');

        console.log('Elements found:', { loadingEl, errorEl, emptyEl, controlsEl, timelineEl, kanbanEl });

        try {
            let response;
            if (this.isDemoMode) {
                console.log('Using demo API endpoint');
                // Use demo API endpoint for demo mode
                response = await fetch('/api/demo/roadmap');
            } else {
                console.log('Using regular API endpoint with ROADMAP_ID:', typeof ROADMAP_ID !== 'undefined' ? ROADMAP_ID : 'undefined');
                // Use regular API endpoint for authenticated users
                response = await fetch(`/api/roadmaps/${ROADMAP_ID}/features`);
            }
            
            console.log('API response status:', response.status, response.ok);
            
            if (!response.ok) {
                throw new Error('Failed to fetch features');
            }
            
            const data = await response.json();
            console.log('API data received:', data);
            
            if (this.isDemoMode) {
                // Demo API returns { roadmap, features }
                this.features = data.features;
            } else {
                // Regular API returns features array directly
                this.features = data;
            }

            console.log('Features loaded:', this.features.length);

            // Hide loading spinner
            loadingEl.classList.add('d-none');

            if (this.features.length === 0) {
                // Show empty state if no features
                emptyEl.classList.remove('d-none');
                console.log('Showing empty state');
            } else {
                // Show controls
                controlsEl.classList.remove('d-none');
                console.log('Showing main content area');
                // Show initial view - all views except gantt use kanban board now
                if (this.currentView === 'gantt') {
                    timelineEl.classList.add('d-none');
                    kanbanEl.classList.add('d-none');
                    // Gantt will show itself when rendered
                } else {
                    timelineEl.classList.add('d-none');
                    kanbanEl.classList.remove('d-none');
                }
                // Initialize the appropriate view
                console.log('Initializing view:', this.currentView);
                switch(this.currentView) {
                    case 'kanban':
                    this.renderKanban();
                        break;
                    case 'month':
                        this.renderMonthAsKanban();
                        break;
                    case 'quarter':
                        this.renderQuarterAsKanban();
                        break;
                    case 'sprint':
                        this.renderSprintAsKanban();
                        break;
                    case 'release':
                        this.renderReleaseAsKanban();
                        break;
                    default:
                        this.renderMonthAsKanban(); // Default to month view
                }
            }
        } catch (e) {
            console.error('Error fetching features:', e);
            loadingEl.classList.add('d-none');
            errorEl.classList.remove('d-none');
            document.getElementById('errorMessage').textContent = e.message;
        }
    }

    deleteFeature() {
        // In demo mode, show demo message instead of deleting
        if (this.isDemoMode) {
            if (typeof showDemoMessage === 'function') {
                showDemoMessage();
            } else {
                alert('This is a demo. Sign up to create and edit features!');
            }
            return;
        }

        const id = this.selectedFeature.id;
        fetch(`/api/features/${id}`, { method: 'DELETE' })
            .then(response => {
                if (response.ok) {
                    // Remove locally
                    this.features = this.features.filter(f => f.id !== id);
                    this.renderFeatures();
                    // Hide detail modal
                    const modal = bootstrap.Modal.getInstance(document.getElementById('featureDetailModal'));
                    modal.hide();
                } else {
                    console.error('Failed to delete');
                }
            }).catch(e => console.error('Error deleting feature:', e));
    }

    startEditFeature() {
        // Prefill add feature form with selectedFeature data
        const f = this.selectedFeature;
        document.getElementById('featureTitle').value = f.title;
        document.getElementById('featureDescription').value = f.description;
        document.getElementById('featurePriority').value = f.priority;
        document.getElementById('featureStatus').value = f.status;
        document.getElementById('featureDate').value = this.formatDateForInput(f.date);
        this.editingFeatureId = f.id;
        
        // Update modal title and icon for editing
        document.querySelector('#addFeatureModal .modal-title i').className = 'bi bi-pencil me-2';
        document.querySelector('#addFeatureModal .modal-title').innerHTML = '<i class="bi bi-pencil me-2"></i>Edit Feature';
        
        // Hide detail modal
        bootstrap.Modal.getInstance(document.getElementById('featureDetailModal')).hide();
        // Show add/edit modal
        bootstrap.Modal.getOrCreateInstance(document.getElementById('addFeatureModal')).show();
    }

    renderKanban() {
        const board = document.getElementById('kanban-board');
        board.innerHTML = '';
        
        // Apply beautiful Kanban styling
        this.applyKanbanStyling();
        
        // Create columns container
        const columnsContainer = document.createElement('div');
        columnsContainer.className = 'kanban-columns-container';
        board.appendChild(columnsContainer);
        
        const statuses = [
            { key: 'planned', title: 'Planned', color: '#6c757d', bgColor: '#f8f9fa', icon: '📋' },
            { key: 'in-progress', title: 'In Progress', color: '#0056D2', bgColor: '#e7f3ff', icon: '⚡' },
            { key: 'completed', title: 'Completed', color: '#198754', bgColor: '#d1e7dd', icon: '✅' }
        ];
        
        statuses.forEach(status => {
            const col = document.createElement('div');
            col.className = 'kanban-column enhanced-kanban-column';
            col.dataset.status = status.key;
            col.style.cssText = `
                background: ${status.bgColor};
                border-top: 4px solid ${status.color};
                border-radius: 12px;
                padding: 16px;
                margin: 8px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                transition: transform 0.2s ease, box-shadow 0.2s ease;
                min-height: 500px;
            `;
            
            // Create beautiful header
            const header = document.createElement('div');
            header.className = 'kanban-header';
            header.style.cssText = `
                background: ${status.color};
                color: white;
                padding: 12px 16px;
                border-radius: 8px;
                margin-bottom: 16px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                font-weight: 600;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            `;
            
            const headerContent = document.createElement('div');
            headerContent.style.cssText = 'display: flex; align-items: center; gap: 8px;';
            
            const icon = document.createElement('span');
            icon.textContent = status.icon;
            icon.style.cssText = 'font-size: 20px;';
            
            const title = document.createElement('span');
            title.textContent = status.title;
            title.style.cssText = 'font-size: 16px; font-weight: 600;';
            
            const count = document.createElement('span');
            count.className = 'kanban-count';
            count.style.cssText = `
                background: rgba(255,255,255,0.2);
                padding: 4px 8px;
                border-radius: 12px;
                font-size: 12px;
                font-weight: 600;
                min-width: 20px;
                text-align: center;
            `;
            count.textContent = '0';
            
            headerContent.appendChild(icon);
            headerContent.appendChild(title);
            header.appendChild(headerContent);
            header.appendChild(count);
            col.appendChild(header);
            
            // Create list container
            const list = document.createElement('div');
            list.className = 'kanban-list enhanced-kanban-list';
            list.style.cssText = `
                min-height: 400px;
                padding: 8px;
                border-radius: 8px;
                background: rgba(255,255,255,0.3);
                border: 2px dashed transparent;
                transition: all 0.3s ease;
            `;
            
            col.appendChild(list);
            columnsContainer.appendChild(col);
        });
        
        // Add features to columns and update counts
        this.features.forEach(feature => {
            const item = this.createEnhancedFeatureElement(feature);
            const list = board.querySelector(`.kanban-column[data-status="${feature.status}"] .kanban-list`);
            if (list) list.appendChild(item);
        });
        
        // Update counts for each column
        statuses.forEach(status => {
            const count = this.features.filter(f => f.status === status.key).length;
            const countEl = board.querySelector(`.kanban-column[data-status="${status.key}"] .kanban-count`);
            if (countEl) countEl.textContent = count;
        });
        
        // Initialize enhanced drag-and-drop for Kanban
        if (!this.isDemoMode && typeof hasPermission === 'function' && hasPermission('member')) {
        board.querySelectorAll('.kanban-list').forEach(list => {
            new Sortable(list, {
                group: 'kanban',
                    animation: 200,
                    ghostClass: 'kanban-ghost',
                    chosenClass: 'kanban-chosen',
                    dragClass: 'kanban-drag',
                    onStart: (evt) => {
                        // Add visual feedback when dragging starts
                        board.querySelectorAll('.kanban-list').forEach(l => {
                            l.style.borderColor = '#0056D2';
                            l.style.borderStyle = 'dashed';
                            l.style.backgroundColor = 'rgba(0,86,210,0.05)';
                        });
                    },
                    onEnd: (evt) => {
                        // Remove visual feedback when dragging ends
                        board.querySelectorAll('.kanban-list').forEach(l => {
                            l.style.borderColor = 'transparent';
                            l.style.backgroundColor = 'rgba(255,255,255,0.3)';
                        });
                    },
                onAdd: (evt) => {
                    const itemEl = evt.item;
                    const newStatus = itemEl.closest('.kanban-column').dataset.status;
                    const id = parseInt(itemEl.dataset.id);
                        
                    fetch(`/api/features/${id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: newStatus })
                    })
                    .then(res => res.json())
                    .then(updated => {
                        const idx = this.features.findIndex(f => f.id === updated.id);
                        this.features[idx].status = updated.status;
                            
                            // Update counts
                            statuses.forEach(status => {
                                const count = this.features.filter(f => f.status === status.key).length;
                                const countEl = board.querySelector(`.kanban-column[data-status="${status.key}"] .kanban-count`);
                                if (countEl) countEl.textContent = count;
                            });
                    }).catch(e => console.error('Error updating status:', e));
                }
            });
        });
        }
    }

    renderMonthAsKanban() {
        const board = document.getElementById('kanban-board');
        board.innerHTML = '';
        
        // Apply beautiful Kanban styling
        this.applyKanbanStyling();
        
        // Add navigation controls
        this.addNavigationControls(board, 'month');
        
        // Create columns container
        const columnsContainer = document.createElement('div');
        columnsContainer.className = 'kanban-columns-container';
        board.appendChild(columnsContainer);
        
        // Get months for the current view
        const months = this.getMonthsForView();
        const monthColors = [
            { color: '#6366f1', bgColor: '#eef2ff' }, // Indigo
            { color: '#8b5cf6', bgColor: '#f3e8ff' }, // Purple  
            { color: '#06b6d4', bgColor: '#e0f7fa' }, // Cyan
            { color: '#10b981', bgColor: '#d1fae5' }, // Green
            { color: '#f59e0b', bgColor: '#fef3c7' }, // Amber
            { color: '#ef4444', bgColor: '#fee2e2' }  // Red
        ];
        
        months.forEach((month, index) => {
            const colorIndex = index % monthColors.length;
            const colorScheme = monthColors[colorIndex];
            
            const col = document.createElement('div');
            col.className = 'kanban-column enhanced-kanban-column';
            col.dataset.month = month;
            col.style.cssText = `
                background: ${colorScheme.bgColor};
                border-top: 4px solid ${colorScheme.color};
                border-radius: 10px;
                padding: 12px;
                margin: 4px;
                box-shadow: 0 2px 6px rgba(0,0,0,0.08);
                transition: transform 0.2s ease, box-shadow 0.2s ease;
                min-height: 500px;
                flex: 1;
                display: flex;
                flex-direction: column;
            `;
            
            // Create beautiful header
            const header = document.createElement('div');
            header.className = 'kanban-header';
            header.style.cssText = `
                background: ${colorScheme.color};
                color: white;
                padding: 12px 16px;
                border-radius: 8px;
                margin-bottom: 16px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                font-weight: 600;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            `;
            
            const headerContent = document.createElement('div');
            headerContent.style.cssText = 'display: flex; align-items: center; gap: 8px;';
            
            const icon = document.createElement('span');
            icon.textContent = '📅';
            icon.style.cssText = 'font-size: 20px;';
            
            const title = document.createElement('span');
            title.textContent = month;
            title.style.cssText = 'font-size: 16px; font-weight: 600;';
            
            const count = document.createElement('span');
            count.className = 'kanban-count';
            count.style.cssText = `
                background: rgba(255,255,255,0.2);
                padding: 4px 8px;
                border-radius: 12px;
                font-size: 12px;
                font-weight: 600;
                min-width: 20px;
                text-align: center;
            `;
            count.textContent = '0';
            
            headerContent.appendChild(icon);
            headerContent.appendChild(title);
            header.appendChild(headerContent);
            header.appendChild(count);
            col.appendChild(header);
            
            // Create list container
            const list = document.createElement('div');
            list.className = 'kanban-list enhanced-kanban-list';
            list.style.cssText = `
                min-height: 400px;
                padding: 8px;
                border-radius: 8px;
                background: rgba(255,255,255,0.3);
                border: 2px dashed transparent;
                transition: all 0.3s ease;
            `;
            
            col.appendChild(list);
            columnsContainer.appendChild(col);
        });
        
        // Add features to appropriate month columns
        const monthRefs = months.map(m => {
            const [name, year] = m.split(' ');
            const monthIdx = new Date(Date.parse(name + ' 1, 2000')).getMonth();
            return { month: m, date: new Date(parseInt(year), monthIdx, 1) };
        });
        
        this.features.forEach(feature => {
            const featureDate = this.parseDate(feature.date);
            
            const matchingMonth = monthRefs.find(ref => 
                ref.date.getFullYear() === featureDate.getFullYear() && 
                ref.date.getMonth() === featureDate.getMonth()
            );
            
            // Only show features that match visible months exactly
            if (matchingMonth) {
                const item = this.createEnhancedFeatureElement(feature);
                const list = board.querySelector(`.kanban-column[data-month="${matchingMonth.month}"] .kanban-list`);
                if (list) list.appendChild(item);
            }
        });
        
        // Update counts for each month column
        months.forEach(month => {
            const monthRef = monthRefs.find(ref => ref.month === month);
            const count = monthRef ? this.features.filter(f => {
                const featureDate = this.parseDate(f.date);
                return featureDate.getFullYear() === monthRef.date.getFullYear() && 
                       featureDate.getMonth() === monthRef.date.getMonth();
            }).length : 0;
            const countEl = board.querySelector(`.kanban-column[data-month="${month}"] .kanban-count`);
            if (countEl) countEl.textContent = count;
        });
        
        // Initialize enhanced drag-and-drop for Month Kanban
        if (!this.isDemoMode && typeof hasPermission === 'function' && hasPermission('member')) {
            board.querySelectorAll('.kanban-list').forEach(list => {
                new Sortable(list, {
                    group: 'month-kanban',
                    animation: 200,
                    ghostClass: 'kanban-ghost',
                    chosenClass: 'kanban-chosen',
                    dragClass: 'kanban-drag',
                    onStart: (evt) => {
                        // Add visual feedback when dragging starts
                        board.querySelectorAll('.kanban-list').forEach(l => {
                            l.style.borderColor = '#6366f1';
                            l.style.borderStyle = 'dashed';
                            l.style.backgroundColor = 'rgba(99,102,241,0.05)';
                        });
                    },
                    onEnd: (evt) => {
                        // Remove visual feedback when dragging ends
                        board.querySelectorAll('.kanban-list').forEach(l => {
                            l.style.borderColor = 'transparent';
                            l.style.backgroundColor = 'rgba(255,255,255,0.3)';
                        });
                    },
                    onAdd: (evt) => {
                        const itemEl = evt.item;
                        const newMonth = itemEl.closest('.kanban-column').dataset.month;
                        const id = parseInt(itemEl.dataset.id);
                        
                        // Calculate new date based on the target month
                        const [monthName, year] = newMonth.split(' ');
                        const monthIdx = new Date(Date.parse(monthName + ' 1, 2000')).getMonth();
                        const newDate = new Date(parseInt(year), monthIdx, 15); // 15th of the month
                        
                        fetch(`/api/features/${id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ date: newDate.toISOString().split('T')[0] })
                        })
                        .then(res => res.json())
                        .then(updated => {
                            const idx = this.features.findIndex(f => f.id === updated.id);
                            this.features[idx].date = updated.date;
                            
                            // Update counts for all months
                            months.forEach(month => {
                                const monthRef = monthRefs.find(ref => ref.month === month);
                                const count = monthRef ? this.features.filter(f => {
                                    const featureDate = this.parseDate(f.date);
                                    return featureDate.getFullYear() === monthRef.date.getFullYear() && 
                                           featureDate.getMonth() === monthRef.date.getMonth();
                                }).length : 0;
                                const countEl = board.querySelector(`.kanban-column[data-month="${month}"] .kanban-count`);
                                if (countEl) countEl.textContent = count;
                            });
                        }).catch(e => console.error('Error updating feature date:', e));
                    }
                });
            });
        }
    }

    addNavigationControls(board, viewType) {
        const navContainer = document.createElement('div');
        navContainer.className = 'kanban-navigation';
        navContainer.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding: 16px 20px;
            background: linear-gradient(135deg, #0056D2 0%, #4A90E2 100%);
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;

        // Left arrow
        const leftArrow = document.createElement('button');
        leftArrow.className = 'nav-arrow nav-left';
        leftArrow.innerHTML = '&#8249;';
        leftArrow.style.cssText = `
            background: rgba(255,255,255,0.2);
            border: none;
            color: white;
            font-size: 28px;
            font-weight: bold;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            cursor: pointer;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        
        leftArrow.addEventListener('mouseenter', () => {
            leftArrow.style.background = 'rgba(255,255,255,0.3)';
            leftArrow.style.transform = 'scale(1.1)';
        });
        
        leftArrow.addEventListener('mouseleave', () => {
            leftArrow.style.background = 'rgba(255,255,255,0.2)';
            leftArrow.style.transform = 'scale(1)';
        });

        leftArrow.addEventListener('click', () => {
            this.navigateTimeline(viewType, -1);
        });

        // Center title
        const title = document.createElement('div');
        title.className = 'nav-title';
        title.style.cssText = `
            color: white;
            font-size: 20px;
            font-weight: 600;
            text-shadow: 0 2px 4px rgba(0,0,0,0.3);
        `;
        
        let titleText = '';
        switch(viewType) {
            case 'month':
                const months = this.getMonthsForView();
                titleText = `${months[0]} - ${months[months.length - 1]}`;
                break;
            case 'quarter':
                const quarters = this.getQuartersForView();
                titleText = `${quarters[0]} - ${quarters[quarters.length - 1]}`;
                break;
            case 'sprint':
                const sprints = this.getSprintsForView();
                titleText = `${sprints[0]} - ${sprints[sprints.length - 1]}`;
                break;
            case 'release':
                titleText = 'All Releases';
                break;
        }
        title.textContent = titleText;

        // Right arrow
        const rightArrow = document.createElement('button');
        rightArrow.className = 'nav-arrow nav-right';
        rightArrow.innerHTML = '&#8250;';
        rightArrow.style.cssText = leftArrow.style.cssText;
        
        rightArrow.addEventListener('mouseenter', () => {
            rightArrow.style.background = 'rgba(255,255,255,0.3)';
            rightArrow.style.transform = 'scale(1.1)';
        });
        
        rightArrow.addEventListener('mouseleave', () => {
            rightArrow.style.background = 'rgba(255,255,255,0.2)';
            rightArrow.style.transform = 'scale(1)';
        });

        rightArrow.addEventListener('click', () => {
            this.navigateTimeline(viewType, 1);
        });

        // Add "Today" button for quick reset
        const todayBtn = document.createElement('button');
        todayBtn.className = 'nav-today-btn';
        todayBtn.textContent = 'Today';
        todayBtn.style.cssText = `
            background: rgba(255,255,255,0.9);
            border: none;
            color: #0056D2;
            font-size: 14px;
            font-weight: 600;
            padding: 8px 16px;
            border-radius: 20px;
            cursor: pointer;
            transition: all 0.3s ease;
            margin-left: 16px;
        `;
        
        todayBtn.addEventListener('mouseenter', () => {
            todayBtn.style.background = 'white';
            todayBtn.style.transform = 'scale(1.05)';
        });
        
        todayBtn.addEventListener('mouseleave', () => {
            todayBtn.style.background = 'rgba(255,255,255,0.9)';
            todayBtn.style.transform = 'scale(1)';
        });

        todayBtn.addEventListener('click', () => {
            this.resetToCurrentPeriod();
        });

        // Create a container for title and today button
        const centerContainer = document.createElement('div');
        centerContainer.style.cssText = 'display: flex; align-items: center;';
        centerContainer.appendChild(title);
        if (viewType !== 'release') {
            centerContainer.appendChild(todayBtn);
        }

        navContainer.appendChild(leftArrow);
        navContainer.appendChild(centerContainer);
        navContainer.appendChild(rightArrow);
        board.appendChild(navContainer);
    }

    navigateTimeline(viewType, direction) {
        const columnCount = this.getOptimalColumnCount();
        switch(viewType) {
            case 'month':
                this.monthOffset += direction * columnCount;
                this.renderMonthAsKanban();
                break;
            case 'quarter':
                this.quarterOffset += direction * columnCount;
                this.renderQuarterAsKanban();
                break;
            case 'sprint':
                this.sprintOffset += direction * columnCount;
                this.renderSprintAsKanban();
                break;
        }
    }

    renderQuarterAsKanban() {
        const board = document.getElementById('kanban-board');
        board.innerHTML = '';
        
        // Apply beautiful Kanban styling
        this.applyKanbanStyling();
        
        // Add navigation controls
        this.addNavigationControls(board, 'quarter');
        
        // Create columns container
        const columnsContainer = document.createElement('div');
        columnsContainer.className = 'kanban-columns-container';
        board.appendChild(columnsContainer);
        
        // Generate quarters (4 quarters)
        const quarters = this.getQuartersForView();
        const quarterColors = [
            { color: '#dc2626', bgColor: '#fee2e2' }, // Red
            { color: '#ea580c', bgColor: '#fed7aa' }, // Orange
            { color: '#ca8a04', bgColor: '#fef3c7' }, // Yellow
            { color: '#16a34a', bgColor: '#dcfce7' }  // Green
        ];
        
        quarters.forEach((quarter, index) => {
            const colorIndex = index % quarterColors.length;
            const colorScheme = quarterColors[colorIndex];
            
            const col = document.createElement('div');
            col.className = 'kanban-column enhanced-kanban-column';
            col.dataset.quarter = quarter;
            col.style.cssText = `
                background: ${colorScheme.bgColor};
                border-top: 4px solid ${colorScheme.color};
                border-radius: 12px;
                padding: 16px;
                margin: 8px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                transition: transform 0.2s ease, box-shadow 0.2s ease;
                min-height: 500px;
            `;
            
            // Create beautiful header
            const header = document.createElement('div');
            header.className = 'kanban-header';
            header.style.cssText = `
                background: ${colorScheme.color};
                color: white;
                padding: 12px 16px;
                border-radius: 8px;
                margin-bottom: 16px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                font-weight: 600;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            `;
            
            const headerContent = document.createElement('div');
            headerContent.style.cssText = 'display: flex; align-items: center; gap: 8px;';
            
            const icon = document.createElement('span');
            icon.textContent = '📊';
            icon.style.cssText = 'font-size: 20px;';
            
            const title = document.createElement('span');
            title.textContent = quarter;
            title.style.cssText = 'font-size: 16px; font-weight: 600;';
            
            const count = document.createElement('span');
            count.className = 'kanban-count';
            count.style.cssText = `
                background: rgba(255,255,255,0.2);
                padding: 4px 8px;
                border-radius: 12px;
                font-size: 12px;
                font-weight: 600;
                min-width: 20px;
                text-align: center;
            `;
            count.textContent = '0';
            
            headerContent.appendChild(icon);
            headerContent.appendChild(title);
            header.appendChild(headerContent);
            header.appendChild(count);
            col.appendChild(header);
            
            // Create list container
            const list = document.createElement('div');
            list.className = 'kanban-list enhanced-kanban-list';
            list.style.cssText = `
                min-height: 400px;
                padding: 8px;
                border-radius: 8px;
                background: rgba(255,255,255,0.3);
                border: 2px dashed transparent;
                transition: all 0.3s ease;
            `;
            
            col.appendChild(list);
            columnsContainer.appendChild(col);
        });
        
        // Add features to appropriate quarter columns
        this.features.forEach(feature => {
            const featureDate = new Date(feature.date);
            const targetQuarter = this.getQuarterForDate(featureDate);
            const item = this.createEnhancedFeatureElement(feature);
            const list = board.querySelector(`.kanban-column[data-quarter="${targetQuarter}"] .kanban-list`);
            if (list) list.appendChild(item);
        });
        
        // Update counts for each quarter column
        quarters.forEach(quarter => {
            const count = this.features.filter(f => this.getQuarterForDate(new Date(f.date)) === quarter).length;
            const countEl = board.querySelector(`.kanban-column[data-quarter="${quarter}"] .kanban-count`);
            if (countEl) countEl.textContent = count;
        });
        
        // Initialize enhanced drag-and-drop for Quarter Kanban
        this.initializeKanbanDragDrop(board, 'quarter', (newValue, feature) => {
            // Calculate new date based on the target quarter
            const [qNum, year] = newValue.match(/Q(\d) (\d{4})/).slice(1);
            const quarterMonth = (parseInt(qNum) - 1) * 3; // Q1=0, Q2=3, Q3=6, Q4=9
            const newDate = new Date(parseInt(year), quarterMonth + 1, 15); // Middle of quarter
            return { date: newDate.toISOString().split('T')[0] };
        });
    }

    renderSprintAsKanban() {
        const board = document.getElementById('kanban-board');
        board.innerHTML = '';
        
        // Apply beautiful Kanban styling
        this.applyKanbanStyling();
        
        // Add navigation controls
        this.addNavigationControls(board, 'sprint');
        
        // Create columns container
        const columnsContainer = document.createElement('div');
        columnsContainer.className = 'kanban-columns-container';
        board.appendChild(columnsContainer);
        
        // Generate sprints (8 sprints)
        const sprints = this.getSprintsForView();
        const sprintColors = [
            { color: '#7c3aed', bgColor: '#f3e8ff' }, // Purple
            { color: '#2563eb', bgColor: '#dbeafe' }, // Blue
            { color: '#059669', bgColor: '#d1fae5' }, // Emerald
            { color: '#dc2626', bgColor: '#fee2e2' }, // Red
            { color: '#ea580c', bgColor: '#fed7aa' }, // Orange
            { color: '#ca8a04', bgColor: '#fef3c7' }, // Yellow
            { color: '#7c2d12', bgColor: '#fef2f2' }, // Brown
            { color: '#1f2937', bgColor: '#f3f4f6' }  // Gray
        ];
        
        sprints.forEach((sprint, index) => {
            const colorIndex = index % sprintColors.length;
            const colorScheme = sprintColors[colorIndex];
            
            const col = document.createElement('div');
            col.className = 'kanban-column enhanced-kanban-column';
            col.dataset.sprint = sprint;
            col.style.cssText = `
                background: ${colorScheme.bgColor};
                border-top: 4px solid ${colorScheme.color};
                border-radius: 12px;
                padding: 16px;
                margin: 8px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                transition: transform 0.2s ease, box-shadow 0.2s ease;
                min-height: 500px;
            `;
            
            // Create beautiful header
            const header = document.createElement('div');
            header.className = 'kanban-header';
            header.style.cssText = `
                background: ${colorScheme.color};
                color: white;
                padding: 12px 16px;
                border-radius: 8px;
                margin-bottom: 16px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                font-weight: 600;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            `;
            
            const headerContent = document.createElement('div');
            headerContent.style.cssText = 'display: flex; align-items: center; gap: 8px;';
            
            const icon = document.createElement('span');
            icon.textContent = '🏃';
            icon.style.cssText = 'font-size: 20px;';
            
            const title = document.createElement('span');
            title.textContent = sprint;
            title.style.cssText = 'font-size: 16px; font-weight: 600;';
            
            const count = document.createElement('span');
            count.className = 'kanban-count';
            count.style.cssText = `
                background: rgba(255,255,255,0.2);
                padding: 4px 8px;
                border-radius: 12px;
                font-size: 12px;
                font-weight: 600;
                min-width: 20px;
                text-align: center;
            `;
            count.textContent = '0';
            
            headerContent.appendChild(icon);
            headerContent.appendChild(title);
            header.appendChild(headerContent);
            header.appendChild(count);
            col.appendChild(header);
            
            // Create list container
            const list = document.createElement('div');
            list.className = 'kanban-list enhanced-kanban-list';
            list.style.cssText = `
                min-height: 400px;
                padding: 8px;
                border-radius: 8px;
                background: rgba(255,255,255,0.3);
                border: 2px dashed transparent;
                transition: all 0.3s ease;
            `;
            
            col.appendChild(list);
            columnsContainer.appendChild(col);
        });
        
        // Add features to appropriate sprint columns
        this.features.forEach(feature => {
            const featureDate = new Date(feature.date);
            const targetSprint = this.getSprintForDate(featureDate);
            const item = this.createEnhancedFeatureElement(feature);
            const list = board.querySelector(`.kanban-column[data-sprint="${targetSprint}"] .kanban-list`);
            if (list) list.appendChild(item);
        });
        
        // Update counts for each sprint column
        sprints.forEach(sprint => {
            const count = this.features.filter(f => this.getSprintForDate(new Date(f.date)) === sprint).length;
            const countEl = board.querySelector(`.kanban-column[data-sprint="${sprint}"] .kanban-count`);
            if (countEl) countEl.textContent = count;
        });
        
        // Initialize enhanced drag-and-drop for Sprint Kanban
        this.initializeKanbanDragDrop(board, 'sprint', (newValue, feature) => {
            // Calculate new date based on the target sprint
            const sprintIndex = parseInt(newValue.replace('Sprint ', '')) - 1;
            const today = new Date();
            const sprintStartDate = new Date(today.getTime() + (sprintIndex * 14 * 24 * 60 * 60 * 1000)); // 2 weeks per sprint
            return { date: sprintStartDate.toISOString().split('T')[0] };
        });
    }

    renderReleaseAsKanban() {
        const board = document.getElementById('kanban-board');
        board.innerHTML = '';
        
        // Apply beautiful Kanban styling
        this.applyKanbanStyling();
        
        // Add navigation controls (release view doesn't need navigation)
        if (this.getReleasesForView().length > 6) {
            this.addNavigationControls(board, 'release');
        }
        
        // Create columns container
        const columnsContainer = document.createElement('div');
        columnsContainer.className = 'kanban-columns-container';
        board.appendChild(columnsContainer);
        
        // Get unique releases
        const releases = this.getReleasesForView();
        const releaseColors = [
            { color: '#0056D2', bgColor: '#e7f3ff' }, // Primary Blue
            { color: '#7c3aed', bgColor: '#f3e8ff' }, // Purple
            { color: '#059669', bgColor: '#d1fae5' }, // Emerald
            { color: '#dc2626', bgColor: '#fee2e2' }, // Red
            { color: '#ea580c', bgColor: '#fed7aa' }, // Orange
            { color: '#ca8a04', bgColor: '#fef3c7' }  // Yellow
        ];
        
        releases.forEach((release, index) => {
            const colorIndex = index % releaseColors.length;
            const colorScheme = releaseColors[colorIndex];
            
            const col = document.createElement('div');
            col.className = 'kanban-column enhanced-kanban-column';
            col.dataset.release = release;
            col.style.cssText = `
                background: ${colorScheme.bgColor};
                border-top: 4px solid ${colorScheme.color};
                border-radius: 12px;
                padding: 16px;
                margin: 8px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                transition: transform 0.2s ease, box-shadow 0.2s ease;
                min-height: 500px;
            `;
            
            // Create beautiful header
            const header = document.createElement('div');
            header.className = 'kanban-header';
            header.style.cssText = `
                background: ${colorScheme.color};
                color: white;
                padding: 12px 16px;
                border-radius: 8px;
                margin-bottom: 16px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                font-weight: 600;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            `;
            
            const headerContent = document.createElement('div');
            headerContent.style.cssText = 'display: flex; align-items: center; gap: 8px;';
            
            const icon = document.createElement('span');
            icon.textContent = release === 'Unassigned' ? '📦' : '🚀';
            icon.style.cssText = 'font-size: 20px;';
            
            const title = document.createElement('span');
            title.textContent = release;
            title.style.cssText = 'font-size: 16px; font-weight: 600;';
            
            const count = document.createElement('span');
            count.className = 'kanban-count';
            count.style.cssText = `
                background: rgba(255,255,255,0.2);
                padding: 4px 8px;
                border-radius: 12px;
                font-size: 12px;
                font-weight: 600;
                min-width: 20px;
                text-align: center;
            `;
            count.textContent = '0';
            
            headerContent.appendChild(icon);
            headerContent.appendChild(title);
            header.appendChild(headerContent);
            header.appendChild(count);
            col.appendChild(header);
            
            // Create list container
            const list = document.createElement('div');
            list.className = 'kanban-list enhanced-kanban-list';
            list.style.cssText = `
                min-height: 400px;
                padding: 8px;
                border-radius: 8px;
                background: rgba(255,255,255,0.3);
                border: 2px dashed transparent;
                transition: all 0.3s ease;
            `;
            
            col.appendChild(list);
            columnsContainer.appendChild(col);
        });
        
        // Add features to appropriate release columns
        this.features.forEach(feature => {
            const targetRelease = feature.release || 'Unassigned';
            const item = this.createEnhancedFeatureElement(feature);
            const list = board.querySelector(`.kanban-column[data-release="${targetRelease}"] .kanban-list`);
            if (list) list.appendChild(item);
        });
        
        // Update counts for each release column
        releases.forEach(release => {
            const count = this.features.filter(f => (f.release || 'Unassigned') === release).length;
            const countEl = board.querySelector(`.kanban-column[data-release="${release}"] .kanban-count`);
            if (countEl) countEl.textContent = count;
        });
        
        // Initialize enhanced drag-and-drop for Release Kanban
        this.initializeKanbanDragDrop(board, 'release', (newValue, feature) => {
            return { release: newValue === 'Unassigned' ? '' : newValue };
        });
    }

    createEnhancedFeatureElement(feature) {
        const item = document.createElement('div');
        item.className = 'feature-item enhanced-kanban-item';
        item.dataset.id = feature.id;
        item.draggable = true;
        
        // Priority color mapping
        const priorityColors = {
            'high': { bg: '#fee2e2', border: '#dc2626', text: '#7f1d1d' },
            'medium': { bg: '#fef3c7', border: '#d97706', text: '#92400e' },
            'low': { bg: '#d1fae5', border: '#10b981', text: '#065f46' }
        };
        
        const colors = priorityColors[feature.priority] || priorityColors['medium'];
        
        item.style.cssText = `
            background: white;
            border: 1px solid #e5e7eb;
            border-left: 4px solid ${colors.border};
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 12px;
            cursor: grab;
            transition: all 0.2s ease;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        `;
        
        // Add hover effect
        item.addEventListener('mouseenter', () => {
            item.style.transform = 'translateY(-2px)';
            item.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        });
        
        item.addEventListener('mouseleave', () => {
            item.style.transform = 'translateY(0)';
            item.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
        });
        
        // Feature title
        const title = document.createElement('div');
        title.style.cssText = `
            font-weight: 600;
            font-size: 14px;
            color: #1f2937;
            margin-bottom: 8px;
            line-height: 1.4;
        `;
        title.textContent = feature.title;
        
        // Feature description (truncated)
        const description = document.createElement('div');
        description.style.cssText = `
            font-size: 12px;
            color: #6b7280;
            margin-bottom: 12px;
            line-height: 1.4;
        `;
        description.textContent = this.truncateText(feature.description || '', 80);
        
        // Metadata row
        const metadata = document.createElement('div');
        metadata.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 8px;
        `;
        
        // Priority badge
        const priority = document.createElement('span');
        priority.style.cssText = `
            background: ${colors.bg};
            color: ${colors.text};
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            border: 1px solid ${colors.border};
        `;
        priority.textContent = feature.priority;
        
        // Date
        const date = document.createElement('span');
        date.style.cssText = `
            font-size: 11px;
            color: #9ca3af;
            font-weight: 500;
        `;
        date.textContent = this.formatDateForDisplay(feature.date);
        
        metadata.appendChild(priority);
        metadata.appendChild(date);
        
        item.appendChild(title);
        if (feature.description) {
            item.appendChild(description);
        }
        item.appendChild(metadata);
        
        // Click handler to show details
        item.addEventListener('click', (e) => {
            if (e.target === item || e.target === title || e.target === description) {
                this.showFeatureDetail(feature);
            }
        });
        
        return item;
    }
    
    applyKanbanStyling() {
        // Apply global Kanban styles
        const styles = `
            .enhanced-kanban-column:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 16px rgba(0,0,0,0.15) !important;
            }
            
            .kanban-ghost {
                opacity: 0.4;
                background: #f3f4f6 !important;
                border: 2px dashed #9ca3af !important;
            }
            
            .kanban-chosen {
                cursor: grabbing !important;
                transform: rotate(5deg);
                box-shadow: 0 8px 25px rgba(0,0,0,0.25) !important;
            }
            
            .kanban-drag {
                opacity: 0.8;
                transform: rotate(5deg);
            }
            
            .enhanced-kanban-item:active {
                cursor: grabbing;
            }
            
            #kanban-board {
                display: flex;
                flex-direction: column;
                padding: 16px;
                background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
                border-radius: 12px;
                min-height: 600px;
                overflow: hidden;
            }
            
            .kanban-columns-container {
                display: flex;
                gap: 12px;
                overflow-x: auto;
                overflow-y: hidden;
                padding: 0 8px 16px 8px;
                scrollbar-width: thin;
                scrollbar-color: #cbd5e0 #f7fafc;
            }
            
            .kanban-columns-container::-webkit-scrollbar {
                height: 8px;
            }
            
            .kanban-columns-container::-webkit-scrollbar-track {
                background: #f7fafc;
                border-radius: 4px;
            }
            
            .kanban-columns-container::-webkit-scrollbar-thumb {
                background: #cbd5e0;
                border-radius: 4px;
            }
            
            .kanban-columns-container::-webkit-scrollbar-thumb:hover {
                background: #a0aec0;
            }
            
            .enhanced-kanban-column {
                flex: 1;
                min-width: 250px;
                max-width: calc((100vw - 280px) / 6);
                display: flex;
                flex-direction: column;
                min-height: 500px;
            }
            
            .enhanced-kanban-list {
                flex: 1 !important;
                min-height: 400px !important;
                max-height: 500px;
                overflow-y: auto;
                display: flex !important;
                flex-direction: column !important;
                padding: 8px !important;
                border-radius: 8px !important;
                background: rgba(255,255,255,0.3) !important;
                border: 2px dashed transparent !important;
                transition: all 0.3s ease !important;
            }
            
            .enhanced-kanban-list:empty::before {
                content: 'Drop items here';
                display: flex;
                align-items: center;
                justify-content: center;
                text-align: center;
                color: #9ca3af;
                font-style: italic;
                padding: 20px;
                border: 2px dashed #d1d5db;
                border-radius: 8px;
                background: rgba(255,255,255,0.5);
                min-height: 350px;
                flex: 1;
            }
            
            /* Sidebar Styles */
            .view-sidebar {
                width: 200px;
                background: linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%);
                border-radius: 12px 0 0 12px;
                border-right: 1px solid #e2e8f0;
                padding: 20px 0;
                min-height: 600px;
                box-shadow: 2px 0 8px rgba(0,0,0,0.05);
            }
            
            .sidebar-header {
                padding: 0 20px 15px 20px;
                border-bottom: 1px solid #e2e8f0;
                margin-bottom: 15px;
            }
            
            .sidebar-title {
                font-weight: 600;
                color: #374151;
                margin: 0;
                font-size: 14px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            
            .view-buttons {
                display: flex;
                flex-direction: column;
                gap: 8px;
                padding: 0 15px;
            }
            
            .view-btn {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px 15px;
                background: transparent;
                border: none;
                border-radius: 8px;
                color: #6b7280;
                text-align: left;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
                width: 100%;
            }
            
            .view-btn:hover {
                background: rgba(0, 86, 210, 0.1);
                color: #0056D2;
                transform: translateX(4px);
            }
            
            .view-btn.active {
                background: linear-gradient(135deg, #0056D2 0%, #4A90E2 100%);
                color: white;
                box-shadow: 0 2px 8px rgba(0, 86, 210, 0.3);
            }
            
            .view-btn.active:hover {
                transform: translateX(4px);
                box-shadow: 0 4px 12px rgba(0, 86, 210, 0.4);
            }
            
            .view-btn i {
                font-size: 16px;
                width: 16px;
                text-align: center;
            }
            
            .content-area {
                background: white;
                border-radius: 0 12px 12px 0;
                min-height: 600px;
                overflow: hidden;
            }
            
            /* Responsive adjustments */
            @media (max-width: 1400px) {
                .enhanced-kanban-column {
                    min-width: 220px;
                    max-width: calc((100vw - 280px) / 4);
                }
            }
            
            @media (max-width: 1200px) {
                .enhanced-kanban-column {
                    min-width: 200px;
                    max-width: calc((100vw - 280px) / 3);
                }
            }
            
            @media (max-width: 900px) {
                .view-sidebar {
                    width: 180px;
                }
                .enhanced-kanban-column {
                    min-width: 180px;
                    max-width: calc((100vw - 260px) / 2);
                }
            }
        `;
        
        // Inject styles
        let styleSheet = document.getElementById('kanban-custom-styles');
        if (!styleSheet) {
            styleSheet = document.createElement('style');
            styleSheet.id = 'kanban-custom-styles';
            document.head.appendChild(styleSheet);
        }
        styleSheet.textContent = styles;
    }

    async renderGantt() {
        const ganttEl = document.getElementById('ganttChart');
        console.log('🎯 renderGantt called. Features count:', this.features.length);
        
        // In demo mode, create actual Gantt chart with demo data
        if (this.isDemoMode) {
            console.log('🎯 Demo mode: Creating real Gantt chart with demo data');
            // Continue with normal Gantt creation but with demo data
        }
        
        // Clean up any existing instance
        if (this.ganttInstance) {
            try {
                this.ganttInstance = null;
            } catch (e) {
                console.warn('Cleanup warning:', e);
            }
        }
        
        // Show loading state
        ganttEl.innerHTML = '<div class="p-4 text-center"><div class="spinner-border text-primary" role="status"></div><p class="mt-2">Loading Gantt chart...</p></div>';
        
        // Wait a moment for DOM to update
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Validate features data
        if (!this.features || this.features.length === 0) {
            ganttEl.innerHTML = `
                <div class="p-4 text-center text-muted">
                    <i class="bi bi-calendar-x display-4 mb-3"></i>
                    <h5>No Features Available</h5>
                    <p>Add some features to your roadmap to see the Gantt chart.</p>
                    <button class="btn btn-primary mt-2" data-bs-toggle="modal" data-bs-target="#addFeatureModal">
                        Add First Feature
                    </button>
                </div>
            `;
            return;
        }
        
        // Ensure Frappe Gantt library is loaded
        const isLibraryReady = await this.ensureGanttLibrary();
        if (!isLibraryReady) {
            ganttEl.innerHTML = `
                <div class="p-4 text-center text-warning">
                    <i class="bi bi-exclamation-triangle display-4 mb-3"></i>
                    <h5>Gantt Library Not Available</h5>
                    <p>The Gantt chart library failed to load.</p>
                    <button class="btn btn-outline-primary" onclick="location.reload()">Refresh Page</button>
                </div>
            `;
            return;
        }
        
        // Process and validate task data
        const tasks = this.buildTasksArray();
        if (tasks.length === 0) {
            ganttEl.innerHTML = `
                <div class="p-4 text-center text-muted">
                    <i class="bi bi-exclamation-circle display-4 mb-3"></i>
                    <h5>Invalid Feature Data</h5>
                    <p>No valid tasks could be created from your features. Please check that your features have valid titles and dates.</p>
                </div>
            `;
            return;
        }
        
        console.log('📊 Creating Gantt with', tasks.length, 'tasks:', tasks);
        
        // Create the Gantt chart
        await this.createGanttChart(ganttEl, tasks);
    }
    
    async ensureGanttLibrary() {
        // Check if library is already loaded
        if (window.Gantt) {
            console.log('✅ Gantt library found at window.Gantt');
            return true;
        }
        
        if (window.frappe && window.frappe.Gantt) {
            console.log('✅ Gantt library found at window.frappe.Gantt');
            return true;
        }
        
        // Wait for library to load (up to 3 seconds)
        console.log('⏳ Waiting for Gantt library to load...');
        for (let i = 0; i < 30; i++) {
            await new Promise(resolve => setTimeout(resolve, 100));
            if (window.Gantt || (window.frappe && window.frappe.Gantt)) {
                console.log('✅ Gantt library loaded after waiting');
                return true;
            }
        }
        
        console.error('❌ Gantt library not found after waiting');
        return false;
    }
    
    buildTasksArray() {
        const tasks = [];
        const today = new Date();
        
        this.features.forEach((feature, index) => {
            try {
                // Validate required fields
                if (!feature.title || !feature.date) {
                    console.warn(`⚠️ Skipping feature ${index}: missing title or date`, feature);
                    return;
                }
                
                // Parse and validate start date
                const startDate = new Date(feature.date);
                if (isNaN(startDate.getTime())) {
                    console.warn(`⚠️ Skipping feature ${index}: invalid date`, feature.date);
                    return;
                }
                
                // Calculate duration based on priority
                const durations = {
                    'high': 7,      // 1 week for high priority
                    'medium': 14,   // 2 weeks for medium priority
                    'low': 21       // 3 weeks for low priority
                };
                
                const durationDays = durations[feature.priority] || durations['medium'];
                const endDate = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
                
                // Calculate progress percentage
                let progress = 0;
                switch (feature.status) {
                    case 'completed': progress = 100; break;
                    case 'in-progress': progress = 50; break;
                    case 'planned': progress = 0; break;
                    default: progress = 0;
                }
                
                // Format task for Frappe Gantt
                const task = {
                    id: `task_${feature.id || index}`,
                    name: this.truncateText(feature.title, 40),
                    start: this.formatDate(startDate),
                    end: this.formatDate(endDate),
                    progress: progress,
                    custom_class: `task-${feature.priority || 'medium'}-${feature.status || 'planned'}`
                };
                
                tasks.push(task);
                console.log(`✅ Task created:`, task);
                
            } catch (error) {
                console.error(`❌ Error processing feature ${index}:`, error, feature);
            }
        });
        
        return tasks;
    }
    
        async createGanttChart(ganttEl, tasks) {
        try {
            // Clear container
        ganttEl.innerHTML = '';
            
            // Get Gantt constructor
            const GanttClass = window.Gantt || window.frappe.Gantt;
            
            // Calculate optimal height for Week view (larger sizing)
            const headerHeight = 80;
            const taskHeight = 50;  // Increased from 40
            const bottomPadding = 30;
            const optimalHeight = headerHeight + (tasks.length * taskHeight) + bottomPadding;
            
            // Create wrapper div with proper sizing
            const wrapper = document.createElement('div');
            wrapper.className = 'gantt-wrapper';
            wrapper.style.cssText = `
                width: 100%;
                height: ${optimalHeight}px;
                max-height: none;
                overflow-x: auto;
                overflow-y: auto;
                position: relative;
            `;
            ganttEl.appendChild(wrapper);
            
            // Force container sizing on parent
            ganttEl.style.height = `${optimalHeight + 20}px`;
            ganttEl.style.maxHeight = 'none';
            ganttEl.style.minHeight = `${optimalHeight}px`;
            
            // Gantt configuration optimized for Week/Month only
            const config = {
                view_mode: 'Week',
                date_format: 'YYYY-MM-DD',
                column_width: 150,     // Increased width for Week view
                bar_height: 35,        // Increased bar height
                padding: 18,           // More padding
                infinite_padding: false,
                custom_popup_html: null,
                language: 'en',
                
                // Event handlers
                on_click: (task) => {
                    console.log('Task clicked:', task);
                    const featureId = parseInt(task.id.replace('task_', ''));
                    const feature = this.features.find(f => f.id === featureId);
                    if (feature) {
                        this.showFeatureDetail(feature);
                    }
                },
                
                on_view_change: (mode) => {
                    console.log('View mode changed to:', mode, '| Target:', this.targetGanttMode, '| Changing:', this.isChangingView);
                    
                    // If we're actively changing views, don't interfere
                    if (this.isChangingView && this.targetGanttMode) {
                        console.log('🔄 View change in progress, allowing transition to:', this.targetGanttMode);
                        this.currentGanttMode = mode;
                        return;
                    }
                    
                    // Store the current mode
                    this.currentGanttMode = mode;
                    
                    // Only allow Week/Month, force back if other mode selected
                    if (mode !== 'Week' && mode !== 'Month') {
                        console.log('⚠️ Blocking unsupported mode:', mode);
                        setTimeout(() => {
                            if (this.ganttInstance && this.ganttInstance.change_view_mode && !this.isChangingView) {
                                this.ganttInstance.change_view_mode('Week');
                            }
                        }, 10);
                        return;
                    }
                    
                    console.log('✅ Accepting view mode:', mode);
                    // Just adjust sizing and update buttons, don't interfere with the change
                    setTimeout(() => {
                        if (!this.isChangingView) { // Only update if we're not actively changing
                            this.adjustForViewMode(wrapper, tasks.length, mode);
                            this.eliminateHorizontalWhiteSpace(wrapper);
                            this.updateSelectorButtons(wrapper, mode);
                        }
                    }, 150);
                }
            };
            
            console.log('🎨 Creating larger Gantt:', optimalHeight + 'px height for', tasks.length, 'tasks');
            
            // Create Gantt instance
            this.ganttInstance = new GanttClass(wrapper, tasks, config);
            
            // Apply customizations after creation
            setTimeout(() => {
                this.replaceViewModeSelector(wrapper);
                this.adjustForViewMode(wrapper, tasks.length, 'Week');
                this.eliminateHorizontalWhiteSpace(wrapper);
                this.applyGanttStyling(wrapper);
            }, 200);
            
            console.log('🎉 Large Gantt chart created!');
            
        } catch (error) {
            console.error('❌ Error creating Gantt chart:', error);
            ganttEl.innerHTML = `
                <div class="p-4 text-center text-danger">
                    <i class="bi bi-exclamation-triangle display-4 mb-3"></i>
                    <h5>Chart Creation Failed</h5>
                    <p class="mb-3">${error.message}</p>
                    <button class="btn btn-outline-primary" onclick="window.roadmapManager.renderGantt()">
                        Try Again
                    </button>
                </div>
            `;
        }
    }
    
    adjustForViewMode(wrapper, taskCount, mode) {
        try {
            const svg = wrapper.querySelector('svg');
            if (!svg) {
                console.warn('No SVG found to adjust');
                return;
            }
            
            // Calculate proper sizing based on view mode
            let headerHeight, taskHeight, bottomPadding, columnWidth;
            
            if (mode === 'Month') {
                headerHeight = 80;
                taskHeight = 45;
                bottomPadding = 25;
                columnWidth = 120;
            } else { // Week view (default)
                headerHeight = 80;
                taskHeight = 50;
                bottomPadding = 30;
                columnWidth = 150;
            }
            
            const actualContentHeight = headerHeight + (taskCount * taskHeight) + bottomPadding;
            
            console.log(`🔧 Adjusting for ${mode} view. Tasks: ${taskCount}, Height: ${actualContentHeight}px`);
            
            // Update wrapper dimensions
            wrapper.style.height = `${actualContentHeight}px`;
            wrapper.style.minHeight = `${actualContentHeight}px`;
            
            // Update parent container
            const ganttContainer = document.getElementById('ganttChart');
            if (ganttContainer) {
                ganttContainer.style.height = `${actualContentHeight + 20}px`;
                ganttContainer.style.minHeight = `${actualContentHeight}px`;
            }
            
            // Let SVG size itself naturally for better responsiveness
            svg.style.minHeight = `${actualContentHeight}px`;
            svg.removeAttribute('viewBox'); // Remove viewBox for natural sizing
            
            console.log(`✅ Adjusted for ${mode} view! Height: ${actualContentHeight}px`);
            
        } catch (error) {
            console.error('Error adjusting view mode:', error);
        }
    }
    

    
    replaceViewModeSelector(wrapper) {
        try {
            // Remove any existing custom selector
            const existingCustom = wrapper.querySelector('.week-month-selector');
            if (existingCustom) {
                existingCustom.remove();
            }
            
            // Find and hide the original view mode selector completely
            const originalViewMode = wrapper.querySelector('.view-mode');
            if (originalViewMode) {
                originalViewMode.style.display = 'none';
                originalViewMode.style.visibility = 'hidden';
            }
            
            // Create our custom Week/Month only selector
            const customSelector = document.createElement('div');
            customSelector.className = 'week-month-selector';
            customSelector.style.cssText = `
                position: absolute;
                top: 15px;
                right: 15px;
                z-index: 1000;
                background: white;
                border: 2px solid #0056D2;
                border-radius: 8px;
                padding: 4px;
                box-shadow: 0 2px 8px rgba(0,86,210,0.15);
            `;
            
            const weekBtn = document.createElement('button');
            weekBtn.textContent = 'Week';
            weekBtn.className = 'btn btn-sm btn-primary';
            weekBtn.style.cssText = `
                margin-right: 4px; 
                font-size: 13px; 
                font-weight: 600;
                min-width: 60px;
                border: none;
                background: #0056D2;
                color: white;
            `;
            
            const monthBtn = document.createElement('button');
            monthBtn.textContent = 'Month';
            monthBtn.className = 'btn btn-sm btn-outline-primary';
            monthBtn.style.cssText = `
                font-size: 13px; 
                font-weight: 600;
                min-width: 60px;
                border: 2px solid #0056D2;
                color: #0056D2;
                background: white;
            `;
            
            // Add click handlers with proper styling updates
            weekBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('📅 Week button clicked!');
                
                // Prevent rapid clicking
                if (this.isChangingView) {
                    console.log('⏳ View change already in progress, ignoring click');
                    return;
                }
                
                this.isChangingView = true;
                this.targetGanttMode = 'Week'; // Set target mode
                
                if (!this.ganttInstance) {
                    console.error('❌ Gantt instance not available');
                    this.isChangingView = false;
                    return;
                }
                
                try {
                    // Immediately update button styles
                    this.forceButtonUpdate(weekBtn, monthBtn, 'Week');
                    
                    // Check if change_view_mode method exists
                    if (typeof this.ganttInstance.change_view_mode === 'function') {
                        console.log('📅 Attempting to change to Week view...');
                        this.ganttInstance.change_view_mode('Week');
                        console.log('📅 Week view change requested');
                        
                        // Wait a bit to ensure the change takes effect
                        setTimeout(() => {
                            this.isChangingView = false;
                            console.log('✅ Week view change completed');
                        }, 300);
                        
                    } else {
                        console.warn('⚠️ change_view_mode method not found, trying alternative approach');
                        // Try alternative approach - recreate chart in Week mode
                        await this.recreateGanttInMode('Week');
                        this.isChangingView = false;
                    }
                    
                } catch (error) {
                    console.error('❌ Error switching to Week view:', error);
                    // Try fallback approach
                    console.log('🔄 Trying fallback: recreating chart in Week mode...');
                    await this.recreateGanttInMode('Week');
                    this.forceButtonUpdate(weekBtn, monthBtn, 'Week');
                    this.isChangingView = false;
                }
            });
            
            monthBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('🔵 Month button clicked!');
                
                // Prevent rapid clicking
                if (this.isChangingView) {
                    console.log('⏳ View change already in progress, ignoring click');
                    return;
                }
                
                this.isChangingView = true;
                this.targetGanttMode = 'Month'; // Set target mode
                
                if (!this.ganttInstance) {
                    console.error('❌ Gantt instance not available');
                    this.isChangingView = false;
                    return;
                }
                
                try {
                    // Immediately update button styles
                    this.forceButtonUpdate(monthBtn, weekBtn, 'Month');
                    
                    // Check if change_view_mode method exists
                    if (typeof this.ganttInstance.change_view_mode === 'function') {
                        console.log('🔵 Attempting to change to Month view...');
                        this.ganttInstance.change_view_mode('Month');
                        console.log('🔵 Month view change requested');
                        
                        // Wait a bit to ensure the change takes effect
                        setTimeout(() => {
                            this.isChangingView = false;
                            console.log('✅ Month view change completed');
                        }, 300);
                        
                    } else {
                        console.warn('⚠️ change_view_mode method not found, trying alternative approach');
                        // Try alternative approach - recreate chart in Month mode
                        await this.recreateGanttInMode('Month');
                        this.isChangingView = false;
                    }
                    
                } catch (error) {
                    console.error('❌ Error switching to Month view:', error);
                    // Try fallback approach
                    console.log('🔄 Trying fallback: recreating chart in Month mode...');
                    await this.recreateGanttInMode('Month');
                    this.forceButtonUpdate(monthBtn, weekBtn, 'Month');
                    this.isChangingView = false;
                }
            });
            
            customSelector.appendChild(weekBtn);
            customSelector.appendChild(monthBtn);
            
            // Make wrapper relative and add our selector
            wrapper.style.position = 'relative';
            wrapper.appendChild(customSelector);
            
            console.log('✅ Custom Week/Month-only selector created and original hidden');
            
        } catch (error) {
            console.warn('Could not replace view mode selector:', error);
        }
    }
    
    updateSelectorButtons(wrapper, currentMode) {
        try {
            const weekBtn = wrapper.querySelector('.week-month-selector button:first-child');
            const monthBtn = wrapper.querySelector('.week-month-selector button:last-child');
            
            if (!weekBtn || !monthBtn) {
                console.warn('Selector buttons not found');
                return;
            }
            
            if (currentMode === 'Week') {
                // Week button active
                weekBtn.className = 'btn btn-sm btn-primary';
                weekBtn.style.cssText = `
                    margin-right: 4px; 
                    font-size: 13px; 
                    font-weight: 600;
                    min-width: 60px;
                    border: none;
                    background: #0056D2;
                    color: white;
                `;
                
                monthBtn.className = 'btn btn-sm btn-outline-primary';
                monthBtn.style.cssText = `
                    font-size: 13px; 
                    font-weight: 600;
                    min-width: 60px;
                    border: 2px solid #0056D2;
                    color: #0056D2;
                    background: white;
                `;
            } else if (currentMode === 'Month') {
                // Month button active
                monthBtn.className = 'btn btn-sm btn-primary';
                monthBtn.style.cssText = `
                    font-size: 13px; 
                    font-weight: 600;
                    min-width: 60px;
                    border: none;
                    background: #0056D2;
                    color: white;
                `;
                
                weekBtn.className = 'btn btn-sm btn-outline-primary';
                weekBtn.style.cssText = `
                    margin-right: 4px; 
                    font-size: 13px; 
                    font-weight: 600;
                    min-width: 60px;
                    border: 2px solid #0056D2;
                    color: #0056D2;
                    background: white;
                `;
            }
            
            console.log(`✅ Updated selector buttons for ${currentMode} mode`);
            
        } catch (error) {
            console.warn('Could not update selector buttons:', error);
        }
    }
    
    async recreateGanttInMode(mode) {
        try {
            console.log(`🔄 Recreating Gantt chart in ${mode} mode...`);
            
            // Store current mode
            this.currentGanttMode = mode;
            
            // Get the gantt container
            const ganttEl = document.getElementById('ganttChart');
            if (!ganttEl) {
                console.error('❌ Gantt container not found');
                return;
            }
            
            // Clean up existing instance
            if (this.ganttInstance) {
                this.ganttInstance = null;
            }
            
            // Show loading
            ganttEl.innerHTML = '<div class="p-3 text-center"><div class="spinner-border text-primary" role="status"></div><p class="mt-2">Switching view...</p></div>';
            
            // Wait briefly for cleanup
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Get Gantt constructor
            const GanttClass = window.Gantt || window.frappe.Gantt;
        if (!GanttClass) {
                console.error('❌ Gantt library not available');
            return;
        }
            
            // Build tasks array
            const tasks = this.buildTasksArray();
            if (tasks.length === 0) {
                console.warn('⚠️ No tasks available for chart recreation');
                return;
            }
            
            // Clear and create wrapper
            ganttEl.innerHTML = '';
            const wrapper = document.createElement('div');
            wrapper.className = 'gantt-wrapper';
            
            // Calculate sizing based on mode
            let headerHeight, taskHeight, bottomPadding, columnWidth, barHeight;
            if (mode === 'Month') {
                headerHeight = 80;
                taskHeight = 45;
                bottomPadding = 25;
                columnWidth = 100;
                barHeight = 30;
            } else {
                headerHeight = 80;
                taskHeight = 50;
                bottomPadding = 30;
                columnWidth = 150;
                barHeight = 35;
            }
            
            const optimalHeight = headerHeight + (tasks.length * taskHeight) + bottomPadding;
            
            wrapper.style.cssText = `
                width: 100%;
                height: ${optimalHeight}px;
                max-height: none;
                overflow-x: auto;
                overflow-y: auto;
                position: relative;
            `;
            ganttEl.appendChild(wrapper);
            
            // Update container sizing
            ganttEl.style.height = `${optimalHeight + 20}px`;
            ganttEl.style.maxHeight = 'none';
            ganttEl.style.minHeight = `${optimalHeight}px`;
            
            // Create configuration for the specific mode
            const config = {
                view_mode: mode,
            date_format: 'YYYY-MM-DD',
                column_width: columnWidth,
                bar_height: barHeight,
                padding: 18,
                infinite_padding: false,
                custom_popup_html: null,
                language: 'en',
                
                on_click: (task) => {
                    const featureId = parseInt(task.id.replace('task_', ''));
                    const feature = this.features.find(f => f.id === featureId);
                    if (feature) {
                        this.showFeatureDetail(feature);
                    }
                },
                
                on_view_change: (newMode) => {
                    console.log('📊 Internal view change to:', newMode);
                    if (newMode !== 'Week' && newMode !== 'Month') {
                        setTimeout(() => {
                            if (this.ganttInstance && this.ganttInstance.change_view_mode) {
                                this.ganttInstance.change_view_mode(mode);
                            }
                        }, 10);
                    }
                }
            };
            
            // Create new instance
            this.ganttInstance = new GanttClass(wrapper, tasks, config);
            
            // Apply customizations
            setTimeout(() => {
                this.replaceViewModeSelector(wrapper);
                this.adjustForViewMode(wrapper, tasks.length, mode);
                this.eliminateHorizontalWhiteSpace(wrapper);
                this.applyGanttStyling(wrapper);
                console.log(`✅ Gantt chart recreated in ${mode} mode`);
            }, 200);
            
        } catch (error) {
            console.error('❌ Error recreating Gantt chart:', error);
        }
    }
    
    forceButtonUpdate(activeBtn, inactiveBtn, mode) {
        try {
            console.log(`🎨 Forcing button update for ${mode} mode`);
            
            // Style active button
            activeBtn.className = 'btn btn-sm btn-primary';
            activeBtn.style.cssText = `
                font-size: 13px; 
                font-weight: 600;
                min-width: 60px;
                border: none;
                background: #0056D2;
                color: white;
                ${mode === 'Week' ? 'margin-right: 4px;' : ''}
            `;
            
            // Style inactive button
            inactiveBtn.className = 'btn btn-sm btn-outline-primary';
            inactiveBtn.style.cssText = `
                font-size: 13px; 
                font-weight: 600;
                min-width: 60px;
                border: 2px solid #0056D2;
                color: #0056D2;
                background: white;
                ${mode === 'Month' ? 'margin-right: 4px;' : ''}
            `;
            
            console.log(`✅ Button styles updated for ${mode} mode`);
            
        } catch (error) {
            console.warn('Could not force button update:', error);
        }
    }
    
    eliminateHorizontalWhiteSpace(wrapper) {
        try {
            console.log('🔧 Preventing horizontal white space...');
            
            // Don't manipulate SVG size - just ensure proper overflow handling
            const svg = wrapper.querySelector('svg');
            if (svg) {
                // Remove any restrictive width constraints we may have set
                svg.style.removeProperty('max-width');
                svg.removeAttribute('viewBox'); // Let it size naturally
                
                // Ensure the SVG can be as wide as it needs to be
                svg.style.width = 'auto';
                svg.style.minWidth = 'fit-content';
            }
            
            // Set up proper overflow handling on containers
            wrapper.style.width = '100%';
            wrapper.style.overflowX = 'auto';
            wrapper.style.overflowY = 'hidden';
            
            // Ensure parent container handles overflow properly
            const ganttContainer = document.getElementById('ganttChart');
            if (ganttContainer) {
                ganttContainer.style.width = '100%';
                ganttContainer.style.overflowX = 'auto';
                ganttContainer.style.overflowY = 'hidden';
            }
            
            console.log('✅ Horizontal overflow properly configured');
            
        } catch (error) {
            console.error('Error configuring horizontal overflow:', error);
        }
    }
    


    
    applyGanttStyling(wrapper) {
        try {
            // Enhanced blue styling with gradients and professional polish
            const styles = `
                /* SVG Gradient Definitions */
                .gantt-wrapper svg defs {
                    position: absolute;
                    width: 0;
                    height: 0;
                }
                
                /* Professional task bar targeting with gradients */
                .gantt-wrapper g.bar rect { 
                    fill: #0056D2 !important; 
                    stroke: #003d99 !important; 
                    stroke-width: 2px !important;
                    rx: 8 !important;
                    ry: 8 !important;
                    filter: drop-shadow(0 3px 8px rgba(0, 86, 210, 0.2)) !important;
                }
                
                /* Enhanced custom task classes with professional gradients */
                .gantt-wrapper .task-high-planned rect,
                .gantt-wrapper .task-high-in-progress rect { 
                    fill: #0056D2 !important; 
                    stroke: #003d99 !important; 
                    stroke-width: 2px !important;
                    filter: drop-shadow(0 3px 8px rgba(0, 86, 210, 0.25)) !important;
                }
                
                .gantt-wrapper .task-medium-planned rect,
                .gantt-wrapper .task-medium-in-progress rect { 
                    fill: #0056D2 !important; 
                    stroke: #003d99 !important; 
                    stroke-width: 2px !important; 
                    opacity: 0.9 !important;
                    filter: drop-shadow(0 2px 6px rgba(0, 86, 210, 0.2)) !important;
                }
                
                .gantt-wrapper .task-low-planned rect,
                .gantt-wrapper .task-low-in-progress rect { 
                    fill: #B3D7FF !important; 
                    stroke: #0056D2 !important; 
                    stroke-width: 2px !important; 
                    opacity: 0.85 !important;
                    filter: drop-shadow(0 2px 6px rgba(0, 86, 210, 0.15)) !important;
                }
                
                /* Completed tasks with sophisticated styling */
                .gantt-wrapper .task-high-completed rect,
                .gantt-wrapper .task-medium-completed rect,
                .gantt-wrapper .task-low-completed rect { 
                    fill: #003d99 !important; 
                    stroke: #002266 !important; 
                    stroke-width: 2px !important;
                    filter: drop-shadow(0 3px 8px rgba(0, 61, 153, 0.3)) !important;
                }
                
                /* Refined progress bars */
                .gantt-wrapper .bar .bar-progress { 
                    fill: rgba(255,255,255,0.5) !important; 
                    stroke: rgba(255,255,255,0.7) !important; 
                    stroke-width: 1px !important;
                    rx: 6 !important;
                    ry: 6 !important;
                }
                
                /* Professional grid styling */
                .gantt-wrapper .grid .grid-header rect { 
                    fill: var(--color-primary) !important;
                    stroke: #0041a8 !important;
                    stroke-width: 2px !important;
                }
                .gantt-wrapper .grid .grid-header text { 
                    fill: white !important; 
                    font-weight: 700 !important; 
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
                    text-shadow: 0 1px 3px rgba(0,0,0,0.3) !important; 
                }
                
                /* Enhanced row styling with better contrast */
                .gantt-wrapper .grid .grid-row rect { 
                    stroke: #E8F2FF !important; 
                    stroke-width: 1px !important; 
                }
                .gantt-wrapper .grid .grid-row:nth-child(odd) rect { 
                    fill: #ffffff !important; 
                }
                .gantt-wrapper .grid .grid-row:nth-child(even) rect { 
                    fill: #fafcff !important; 
                }
                
                /* Professional row labels */
                .gantt-wrapper .grid .grid-row text {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
                    font-weight: 600 !important;
                    fill: #2c3e50 !important;
                    font-size: 14px !important;
                }
                
                /* Enhanced hover effects with smooth transitions */
                .gantt-wrapper .bar:hover .bar-inner { 
                    filter: brightness(1.15) saturate(1.3) drop-shadow(0 4px 12px rgba(0, 86, 210, 0.3)) !important; 
                    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
                    transform: scale(1.03) !important;
                }
                
                .gantt-wrapper .bar:hover rect {
                    stroke-width: 3px !important;
                    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
                }
                
                /* Professional today line */
                .gantt-wrapper .today-highlight { 
                    stroke: #FF6B35 !important; 
                    stroke-width: 3px !important; 
                    stroke-dasharray: 8,4 !important;
                    opacity: 0.85 !important;
                    filter: drop-shadow(0 1px 3px rgba(255, 107, 53, 0.3)) !important;
                }
                
                /* Enhanced text readability */
                .gantt-wrapper text {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
                }
                
                .gantt-wrapper .bar-label {
                    font-size: 12px !important;
                    font-weight: 600 !important;
                    fill: #2c3e50 !important;
                    text-shadow: 0 1px 2px rgba(255,255,255,0.8) !important;
                }
                
                /* Grid line refinements */
                .gantt-wrapper .grid .grid-line {
                    stroke: #E8F2FF !important;
                    stroke-width: 1px !important;
                    opacity: 0.7 !important;
                }
                
                /* SVG background cleanup */
                .gantt-wrapper svg {
                    background: transparent !important;
                    border-radius: 8px;
                }
                
                /* Custom selector button styling */
                .gantt-wrapper .custom-view-selector {
                    position: absolute;
                    top: 15px;
                    right: 15px;
                    z-index: 10;
                    display: flex;
                    gap: 8px;
                    background: rgba(255,255,255,0.95);
                    backdrop-filter: blur(10px);
                    border-radius: 12px;
                    padding: 8px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                }
                
                .gantt-wrapper .custom-view-selector button {
                    border-radius: 8px !important;
                    font-weight: 600 !important;
                    font-size: 13px !important;
                    padding: 8px 16px !important;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
                    border: 2px solid #0056D2 !important;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
                }
                
                .gantt-wrapper .custom-view-selector button:hover {
                    transform: translateY(-1px) !important;
                    box-shadow: 0 4px 8px rgba(0, 86, 210, 0.2) !important;
                }
                
                .gantt-wrapper .custom-view-selector button.active {
                    background: linear-gradient(135deg, #0056D2 0%, #4A90E2 100%) !important;
                    color: white !important;
                    box-shadow: 0 3px 8px rgba(0, 86, 210, 0.3) !important;
                }
            `;
            
            // Inject enhanced styles
            let styleSheet = document.getElementById('gantt-custom-styles');
            if (!styleSheet) {
                styleSheet = document.createElement('style');
                styleSheet.id = 'gantt-custom-styles';
                document.head.appendChild(styleSheet);
            }
            styleSheet.textContent = styles;
            
            // Add SVG gradient definitions for enhanced visual effects
            this.addGradientDefinitions(wrapper);
            
        } catch (error) {
            console.warn('Could not apply custom styling:', error);
        }
    }
    
    addGradientDefinitions(wrapper) {
        try {
            const svg = wrapper.querySelector('svg');
            if (!svg) return;
            
            // Check if defs already exists
            let defs = svg.querySelector('defs');
            if (!defs) {
                defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
                svg.insertBefore(defs, svg.firstChild);
            }
            
            // Clear existing gradients
            defs.innerHTML = '';
            
            // Create gradient definitions
            const gradients = [
                {
                    id: 'gradient-planned',
                    stops: [
                        { offset: '0%', color: '#E3F2FD' },
                        { offset: '100%', color: '#B3D7FF' }
                    ]
                },
                {
                    id: 'gradient-progress',
                    stops: [
                        { offset: '0%', color: '#1976D2' },
                        { offset: '100%', color: '#0056D2' }
                    ]
                },
                {
                    id: 'gradient-completed',
                    stops: [
                        { offset: '0%', color: '#0D47A1' },
                        { offset: '100%', color: '#003d99' }
                    ]
                }
            ];
            
            gradients.forEach(grad => {
                const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
                gradient.setAttribute('id', grad.id);
                gradient.setAttribute('x1', '0%');
                gradient.setAttribute('y1', '0%');
                gradient.setAttribute('x2', '0%');
                gradient.setAttribute('y2', '100%');
                
                grad.stops.forEach(stop => {
                    const stopElement = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
                    stopElement.setAttribute('offset', stop.offset);
                    stopElement.setAttribute('stop-color', stop.color);
                    gradient.appendChild(stopElement);
                });
                
                defs.appendChild(gradient);
            });
            
        } catch (error) {
            console.warn('Could not add gradient definitions:', error);
        }
    }
    
    showFeatureDetail(feature) {
        this.selectedFeature = feature;
        document.getElementById('detailTitle').textContent = feature.title;
        document.getElementById('detailDescription').textContent = feature.description;
        
        // Set priority with proper class
        const priorityEl = document.getElementById('detailPriority');
        priorityEl.textContent = feature.priority;
        priorityEl.className = `detail-value priority-badge ${feature.priority}`;
        
        // Set status with proper class  
        const statusEl = document.getElementById('detailStatus');
        statusEl.textContent = feature.status;
        statusEl.className = `detail-value status-badge ${feature.status}`;
        
        // Set release and date
        document.getElementById('detailRelease').textContent = feature.release || 'Not assigned';
        document.getElementById('detailDate').textContent = this.formatDateForDisplay(feature.date);
        
        const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('featureDetailModal'));
        modal.show();
    }
    
    truncateText(text, maxLength) {
        if (!text) return '';
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }
    
    formatDate(date) {
        return date.toISOString().split('T')[0];
    }

    // Helper function to safely parse date strings without timezone issues
    parseDate(dateString) {
        if (!dateString) return new Date();
        const [year, month, day] = dateString.split('-');
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }

    // Helper function to format date for input fields (YYYY-MM-DD)
    formatDateForInput(dateString) {
        if (!dateString) return '';
        // If it's already in YYYY-MM-DD format, return as is
        if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
            return dateString;
        }
        // Otherwise convert to proper format
        const date = new Date(dateString);
        return this.formatDate(date);
    }

    // Helper function to format date for display (locale string)
    formatDateForDisplay(dateString) {
        if (!dateString) return '';
        // Create date using local timezone to avoid offset issues
        const [year, month, day] = dateString.split('-');
        const date = new Date(year, month - 1, day);
        return date.toLocaleDateString();
    }
}

// Initialize the roadmap manager when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const isDemoMode = typeof isDemo !== 'undefined' && isDemo;
    window.roadmapManager = new RoadmapManager(isDemoMode);
});

// Global initialization function for demo mode
function initializeRoadmap(demoMode = false) {
    console.log('initializeRoadmap called with demoMode:', demoMode);
    if (window.roadmapManager) {
        console.log('RoadmapManager already exists, skipping initialization');
        return; // Already initialized
    }
    console.log('Creating new RoadmapManager');
    window.roadmapManager = new RoadmapManager(demoMode);
} 

// ============ SHARING & EXPORT FUNCTIONALITY ============

// Global sharing functions
let shareLinks = [];

// Initialize sharing functionality
document.addEventListener('DOMContentLoaded', function() {
    // Load existing share links
    loadShareLinks();
    
    // Setup share form event listeners
    setupShareFormListeners();
    
    // Load analytics when modal opens
    document.getElementById('analyticsModal').addEventListener('show.bs.modal', loadAnalytics);
});

function setupShareFormListeners() {
    // Password protection toggle
    document.getElementById('sharePasswordProtected').addEventListener('change', function() {
        const passwordInput = document.getElementById('sharePassword');
        if (this.checked) {
            passwordInput.classList.remove('d-none');
            passwordInput.required = true;
        } else {
            passwordInput.classList.add('d-none');
            passwordInput.required = false;
            passwordInput.value = '';
        }
    });
    
    // Expiration toggle
    document.getElementById('shareExpires').addEventListener('change', function() {
        const expiresInput = document.getElementById('shareExpiresAt');
        if (this.checked) {
            expiresInput.classList.remove('d-none');
            expiresInput.required = true;
            // Set default to 30 days from now
            const defaultDate = new Date();
            defaultDate.setDate(defaultDate.getDate() + 30);
            expiresInput.value = defaultDate.toISOString().slice(0, 16);
        } else {
            expiresInput.classList.add('d-none');
            expiresInput.required = false;
            expiresInput.value = '';
        }
    });
}

async function createShareLink() {
    const formData = {
        title: document.getElementById('shareTitle').value,
        description: document.getElementById('shareDescription').value,
        access_level: document.getElementById('shareAccessLevel').value,
        password_protected: document.getElementById('sharePasswordProtected').checked,
        allow_embed: document.getElementById('shareAllowEmbed').checked,
        created_by: 'current_user' // Would be dynamic in real app
    };
    
    if (formData.password_protected) {
        formData.password = document.getElementById('sharePassword').value;
    }
    
    if (document.getElementById('shareExpires').checked) {
        formData.expires_at = document.getElementById('shareExpiresAt').value;
    }
    
    try {
        const response = await fetch(`/api/roadmaps/${ROADMAP_ID}/share`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        if (response.ok) {
            const shareLink = await response.json();
            showSuccessMessage('Share link created successfully!');
            
            // Reset form
            document.getElementById('shareForm').reset();
            document.getElementById('sharePassword').classList.add('d-none');
            document.getElementById('shareExpiresAt').classList.add('d-none');
            
            // Reload share links
            loadShareLinks();
        } else {
            throw new Error('Failed to create share link');
        }
    } catch (error) {
        console.error('Error creating share link:', error);
        showErrorMessage('Failed to create share link. Please try again.');
    }
}

async function loadShareLinks() {
    try {
        const response = await fetch(`/api/roadmaps/${ROADMAP_ID}/shares`);
        if (response.ok) {
            shareLinks = await response.json();
            renderShareLinks();
        }
    } catch (error) {
        console.error('Error loading share links:', error);
    }
}

function renderShareLinks() {
    const container = document.getElementById('shareLinksContainer');
    
    if (shareLinks.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted py-3">
                <i class="bi bi-link-45deg display-4"></i>
                <p>No share links created yet</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = shareLinks.map(link => `
        <div class="card mb-3" data-link-id="${link.id}">
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-start">
                    <div class="flex-grow-1">
                        <h6 class="card-title mb-1">${link.title}</h6>
                        <p class="card-text text-muted small mb-2">${link.description || 'No description'}</p>
                        <div class="d-flex gap-2 mb-2">
                            <span class="badge bg-primary">${link.access_level}</span>
                            ${link.password_protected ? '<span class="badge bg-warning">Password Protected</span>' : ''}
                            ${link.expires_at ? '<span class="badge bg-info">Expires</span>' : ''}
                            <span class="badge bg-success">${link.view_count} views</span>
                        </div>
                    </div>
                    <div class="dropdown">
                        <button class="btn btn-sm btn-outline-secondary dropdown-toggle" data-bs-toggle="dropdown">
                            Actions
                        </button>
                        <ul class="dropdown-menu">
                            <li><a class="dropdown-item" href="#" onclick="copyShareUrl('${link.share_url}')">
                                <i class="bi bi-clipboard me-2"></i>Copy Link
                            </a></li>
                            <li><a class="dropdown-item" href="#" onclick="copyEmbedCode('${link.embed_url}')">
                                <i class="bi bi-code me-2"></i>Copy Embed Code
                            </a></li>
                            <li><a class="dropdown-item" href="${link.share_url}" target="_blank">
                                <i class="bi bi-box-arrow-up-right me-2"></i>Open Link
                            </a></li>
                            <li><hr class="dropdown-divider"></li>
                            <li><a class="dropdown-item" href="#" onclick="viewLinkAnalytics(${link.id})">
                                <i class="bi bi-graph-up me-2"></i>View Analytics
                            </a></li>
                            <li><a class="dropdown-item text-danger" href="#" onclick="deleteShareLink(${link.id})">
                                <i class="bi bi-trash me-2"></i>Delete Link
                            </a></li>
                        </ul>
                    </div>
                </div>
                <div class="input-group input-group-sm">
                    <input type="text" class="form-control" value="${link.share_url}" readonly>
                    <button class="btn btn-outline-secondary" onclick="copyShareUrl('${link.share_url}')">
                        <i class="bi bi-clipboard"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

function copyShareUrl(url) {
    navigator.clipboard.writeText(url).then(() => {
        showSuccessMessage('Share URL copied to clipboard!');
    });
}

function copyEmbedCode(embedUrl) {
    const embedCode = `<iframe src="${embedUrl}" width="100%" height="600" frameborder="0"></iframe>`;
    navigator.clipboard.writeText(embedCode).then(() => {
        showSuccessMessage('Embed code copied to clipboard!');
    });
}

async function deleteShareLink(linkId) {
    if (!confirm('Are you sure you want to delete this share link? This action cannot be undone.')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/shares/${linkId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showSuccessMessage('Share link deleted successfully!');
            loadShareLinks();
        } else {
            throw new Error('Failed to delete share link');
        }
    } catch (error) {
        console.error('Error deleting share link:', error);
        showErrorMessage('Failed to delete share link. Please try again.');
    }
}

async function viewLinkAnalytics(linkId) {
    try {
        const response = await fetch(`/api/shares/${linkId}/analytics`);
        if (response.ok) {
            const analytics = await response.json();
            displayLinkAnalytics(analytics);
        }
    } catch (error) {
        console.error('Error loading link analytics:', error);
    }
}

function displayLinkAnalytics(analytics) {
    const modal = new bootstrap.Modal(document.getElementById('analyticsModal'));
    const container = document.getElementById('shareAnalytics');
    
    container.innerHTML = `
        <div class="row text-center mb-3">
            <div class="col-4">
                <div class="h4 text-primary">${analytics.total_views}</div>
                <div class="small text-muted">Total Views</div>
            </div>
            <div class="col-4">
                <div class="h4 text-success">${analytics.unique_visitors}</div>
                <div class="small text-muted">Unique Visitors</div>
            </div>
            <div class="col-4">
                <div class="h4 text-info">${Object.keys(analytics.countries).length}</div>
                <div class="small text-muted">Countries</div>
            </div>
        </div>
        
        <div class="mb-3">
            <h6>Top Countries</h6>
            ${Object.entries(analytics.countries)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 5)
                .map(([country, count]) => `
                    <div class="d-flex justify-content-between">
                        <span>${country}</span>
                        <span class="badge bg-secondary">${count}</span>
                    </div>
                `).join('')}
        </div>
        
        <div class="mb-3">
            <h6>Recent Visits</h6>
            <div class="small">
                ${analytics.recent_visits.slice(0, 10).map(visit => `
                    <div class="d-flex justify-content-between py-1 border-bottom">
                        <span>${new Date(visit.visited_at).toLocaleDateString()}</span>
                        <span>${visit.country || 'Unknown'}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    modal.show();
}

async function loadAnalytics() {
    try {
        const [shareResponse, exportResponse] = await Promise.all([
            fetch(`/api/roadmaps/${ROADMAP_ID}/shares`),
            fetch(`/api/roadmaps/${ROADMAP_ID}/exports`)
        ]);
        
        if (shareResponse.ok && exportResponse.ok) {
            const shares = await shareResponse.json();
            const exports = await exportResponse.json();
            
            renderAnalyticsSummary(shares, exports);
        }
    } catch (error) {
        console.error('Error loading analytics:', error);
    }
}

function renderAnalyticsSummary(shares, exports) {
    const shareContainer = document.getElementById('shareAnalytics');
    const exportContainer = document.getElementById('exportHistory');
    
    if (shares.length > 0) {
        const totalViews = shares.reduce((sum, link) => sum + (link.view_count || 0), 0);
        shareContainer.innerHTML = `
            <div class="row text-center mb-3">
                <div class="col-6">
                    <div class="h4 text-primary">${shares.length}</div>
                    <div class="small text-muted">Active Links</div>
                </div>
                <div class="col-6">
                    <div class="h4 text-success">${totalViews}</div>
                    <div class="small text-muted">Total Views</div>
                </div>
            </div>
            ${shares.map(link => `
                <div class="d-flex justify-content-between py-2 border-bottom">
                    <div>
                        <div class="fw-bold">${link.title}</div>
                        <div class="small text-muted">${link.view_count} views</div>
                    </div>
                    <button class="btn btn-sm btn-outline-primary" onclick="viewLinkAnalytics(${link.id})">
                        Details
                    </button>
                </div>
            `).join('')}
        `;
    }
    
    if (exports.length > 0) {
        exportContainer.innerHTML = exports.map(exp => `
            <div class="d-flex justify-content-between py-2 border-bottom">
                <div>
                    <div class="fw-bold">${exp.export_type.toUpperCase()}</div>
                    <div class="small text-muted">${new Date(exp.created_at).toLocaleDateString()}</div>
                </div>
                <span class="badge bg-secondary">${exp.download_count} downloads</span>
            </div>
        `).join('');
    }
}

// Export functions
function exportCSV() {
    const url = `/api/roadmaps/${ROADMAP_ID}/export/csv`;
    window.open(url, '_blank');
}



// Utility functions for notifications
function showSuccessMessage(message) {
    // Create a simple toast notification
    const toast = document.createElement('div');
    toast.className = 'position-fixed top-0 end-0 p-3';
    toast.style.zIndex = '9999';
    toast.innerHTML = `
        <div class="toast show" role="alert">
            <div class="toast-header">
                <i class="bi bi-check-circle-fill text-success me-2"></i>
                <strong class="me-auto">Success</strong>
                <button type="button" class="btn-close" data-bs-dismiss="toast"></button>
            </div>
            <div class="toast-body">${message}</div>
        </div>
    `;
    
    document.body.appendChild(toast);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

function showErrorMessage(message) {
    const toast = document.createElement('div');
    toast.className = 'position-fixed top-0 end-0 p-3';
    toast.style.zIndex = '9999';
    toast.innerHTML = `
        <div class="toast show" role="alert">
            <div class="toast-header">
                <i class="bi bi-exclamation-triangle-fill text-danger me-2"></i>
                <strong class="me-auto">Error</strong>
                <button type="button" class="btn-close" data-bs-dismiss="toast"></button>
            </div>
            <div class="toast-body">${message}</div>
        </div>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 5000);
}

// ============ TEAM MANAGEMENT FUNCTIONS ============

// Initialize team management when modal opens
document.addEventListener('DOMContentLoaded', function() {
    const teamModal = document.getElementById('teamModal');
    if (teamModal) {
        teamModal.addEventListener('shown.bs.modal', function() {
            loadTeamMembers();
            loadInvitationLinks();
            setupUserSearch();
        });
    }
});

// Setup user search functionality
function setupUserSearch() {
    const searchInput = document.getElementById('userSearch');
    const resultsContainer = document.getElementById('userSearchResults');
    let searchTimeout;
    
    if (!searchInput || !resultsContainer) return;
    
    searchInput.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        const query = this.value.trim();
        
        if (query.length < 2) {
            resultsContainer.classList.remove('show');
            return;
        }
        
        searchTimeout = setTimeout(() => {
            searchUsers(query);
        }, 300);
    });
    
    // Hide results when clicking outside
    document.addEventListener('click', function(e) {
        if (!searchInput.contains(e.target) && !resultsContainer.contains(e.target)) {
            resultsContainer.classList.remove('show');
        }
    });
}

// Search for users
async function searchUsers(query) {
    try {
        const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
        const users = await response.json();
        
        const resultsContainer = document.getElementById('userSearchResults');
        
        if (users.length === 0) {
            resultsContainer.innerHTML = `
                <div class="dropdown-item-text text-muted">
                    <i class="bi bi-person-x me-2"></i>No users found
                    <div class="mt-2">
                        <button class="btn btn-sm btn-outline-primary" onclick="showRegisterModal()">
                            Create New User
                        </button>
                    </div>
                </div>
            `;
        } else {
            resultsContainer.innerHTML = users.map(user => `
                <button type="button" class="dropdown-item" onclick="selectUser(${user.id}, '${user.username}', '${user.full_name || ''}', '${user.email}')">
                    <div class="d-flex align-items-center">
                        <div class="bg-primary rounded-circle d-flex align-items-center justify-content-center me-3" 
                             style="width: 32px; height: 32px; color: white; font-size: 12px;">
                            ${(user.full_name || user.username).charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div class="fw-semibold">${user.full_name || user.username}</div>
                            <div class="text-muted small">${user.email}</div>
                        </div>
                    </div>
                </button>
            `).join('');
        }
        
        resultsContainer.classList.add('show');
    } catch (error) {
        console.error('Error searching users:', error);
        showErrorMessage('Failed to search users');
    }
}

// Select a user from search results
function selectUser(userId, username, fullName, email) {
    document.getElementById('selectedUserId').value = userId;
    document.getElementById('userSearch').value = fullName || username;
    document.getElementById('userSearchResults').classList.remove('show');
}

// Show register modal
function showRegisterModal() {
    const teamModal = bootstrap.Modal.getInstance(document.getElementById('teamModal'));
    teamModal.hide();
    
    const registerModal = new bootstrap.Modal(document.getElementById('registerModal'));
    registerModal.show();
}

// Register new user
async function registerUser() {
    const username = document.getElementById('registerUsername').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const fullName = document.getElementById('registerFullName').value.trim();
    const password = document.getElementById('registerPassword').value;
    
    if (!username || !email || !password) {
        showErrorMessage('Please fill in all required fields');
        return;
    }
    
    try {
        const response = await fetch('/api/users/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, full_name: fullName, password })
        });
        
        if (response.ok) {
            const user = await response.json();
            showSuccessMessage('User registered successfully!');
            
            // Close register modal and return to team modal
            const registerModal = bootstrap.Modal.getInstance(document.getElementById('registerModal'));
            registerModal.hide();
            
            const teamModal = new bootstrap.Modal(document.getElementById('teamModal'));
            teamModal.show();
            
            // Pre-select the new user
            selectUser(user.id, user.username, user.full_name, user.email);
            
            // Clear form
            document.getElementById('registerForm').reset();
        } else {
            const error = await response.json();
            showErrorMessage(error.error || 'Failed to register user');
        }
    } catch (error) {
        console.error('Error registering user:', error);
        showErrorMessage('Failed to register user');
    }
}

// Add team member
async function addTeamMember() {
    const userId = document.getElementById('selectedUserId').value;
    const role = document.getElementById('memberRole').value;
    
    if (!userId) {
        showErrorMessage('Please select a user first');
        return;
    }
    
    try {
        const response = await fetch(`/api/roadmaps/${ROADMAP_ID}/members`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: parseInt(userId), role })
        });
        
        if (response.ok) {
            showSuccessMessage('Team member added successfully!');
            
            // Clear form
            document.getElementById('userSearch').value = '';
            document.getElementById('selectedUserId').value = '';
            document.getElementById('memberRole').value = 'member';
            
            // Reload team members
            loadTeamMembers();
        } else {
            const error = await response.json();
            showErrorMessage(error.error || 'Failed to add team member');
        }
    } catch (error) {
        console.error('Error adding team member:', error);
        showErrorMessage('Failed to add team member');
    }
}

// Load team members
async function loadTeamMembers() {
    try {
        const response = await fetch(`/api/roadmaps/${ROADMAP_ID}/members`);
        const members = await response.json();
        
        renderTeamMembers(members);
    } catch (error) {
        console.error('Error loading team members:', error);
        document.getElementById('teamMembersContainer').innerHTML = `
            <div class="text-center text-danger py-3">
                <i class="bi bi-exclamation-triangle display-4"></i>
                <p>Failed to load team members</p>
            </div>
        `;
    }
}

// Render team members
function renderTeamMembers(members) {
    const container = document.getElementById('teamMembersContainer');
    
    if (members.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted py-3">
                <i class="bi bi-people display-4"></i>
                <p>No team members yet</p>
                <small>Add team members to collaborate on this roadmap</small>
            </div>
        `;
        return;
    }
    
    container.innerHTML = members.map(member => {
        const user = member.user;
        const roleColors = {
            'owner': 'primary',
            'admin': 'warning', 
            'member': 'info',
            'viewer': 'secondary'
        };
        
        return `
            <div class="member-item d-flex align-items-center justify-content-between p-3 border rounded mb-2">
                <div class="d-flex align-items-center">
                    <div class="bg-primary rounded-circle d-flex align-items-center justify-content-center me-3" 
                         style="width: 40px; height: 40px; color: white;">
                        ${(user.full_name || user.username).charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div class="fw-semibold">${user.full_name || user.username}</div>
                        <div class="text-muted small">${user.email}</div>
                        <div class="text-muted small">
                            Joined: ${new Date(member.joined_at).toLocaleDateString()}
                        </div>
                    </div>
                </div>
                <div class="d-flex align-items-center gap-2">
                    <span class="badge bg-${roleColors[member.role] || 'secondary'}">${member.role}</span>
                    ${hasPermission('admin') ? `
                        <div class="dropdown">
                            <button class="btn btn-outline-secondary btn-sm dropdown-toggle" data-bs-toggle="dropdown">
                                <i class="bi bi-three-dots"></i>
                            </button>
                            <ul class="dropdown-menu">
                                ${member.role !== 'owner' ? `
                                    <li><a class="dropdown-item" href="#" onclick="changeUserRole('${member.id}', 'admin')">
                                        <i class="bi bi-shield-check me-2"></i>Make Admin
                                    </a></li>
                                    <li><a class="dropdown-item" href="#" onclick="changeUserRole('${member.id}', 'member')">
                                        <i class="bi bi-person me-2"></i>Make Member
                                    </a></li>
                                    <li><a class="dropdown-item" href="#" onclick="changeUserRole('${member.id}', 'viewer')">
                                        <i class="bi bi-eye me-2"></i>Make Viewer
                                    </a></li>
                                    <li><hr class="dropdown-divider"></li>
                                    <li><a class="dropdown-item text-danger" href="#" onclick="removeMember('${member.id}')">
                                        <i class="bi bi-person-dash me-2"></i>Remove
                                    </a></li>
                                ` : `
                                    <li><span class="dropdown-item-text text-muted">
                                        <i class="bi bi-crown me-2"></i>Project Owner
                                    </span></li>
                                `}
                            </ul>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// Change user role
async function changeUserRole(memberId, newRole) {
    try {
        const response = await fetch(`/api/roadmaps/${ROADMAP_ID}/members/${memberId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: newRole })
        });
        
        if (response.ok) {
            showSuccessMessage(`Role updated to ${newRole}`);
            loadTeamMembers();
        } else {
            const error = await response.json();
            showErrorMessage(error.error || 'Failed to update role');
        }
    } catch (error) {
        console.error('Error updating role:', error);
        showErrorMessage('Failed to update role');
    }
}

// Remove member
async function removeMember(memberId) {
    if (!confirm('Are you sure you want to remove this team member?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/roadmaps/${ROADMAP_ID}/members/${memberId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showSuccessMessage('Team member removed successfully');
            loadTeamMembers();
        } else {
            const error = await response.json();
            showErrorMessage(error.error || 'Failed to remove member');
        }
    } catch (error) {
        console.error('Error removing member:', error);
        showErrorMessage('Failed to remove member');
    }
}

// Team Invitation Link Management

function showCreateInvitationForm() {
    document.getElementById('createInvitationForm').style.display = 'block';
}

function hideCreateInvitationForm() {
    document.getElementById('createInvitationForm').style.display = 'none';
    // Reset form
    document.getElementById('invitationForm').reset();
}

async function createInvitationLink() {
    const role = document.getElementById('invitationRole').value;
    const expiresHours = document.getElementById('invitationExpires').value;
    const maxUses = document.getElementById('invitationMaxUses').value;
    
    const data = {
        role: role,
        created_by: 1 // In real app, get from session
    };
    
    if (expiresHours) {
        data.expires_hours = parseInt(expiresHours);
    }
    
    if (maxUses) {
        data.max_uses = parseInt(maxUses);
    }
    
    try {
        const response = await fetch(`/api/roadmaps/${ROADMAP_ID}/invitations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create invitation link');
        }
        
        const invitation = await response.json();
        showSuccessMessage('Invitation link created successfully!');
        hideCreateInvitationForm();
        loadInvitationLinks();
        
    } catch (error) {
        showErrorMessage('Error creating invitation link: ' + error.message);
    }
}

async function loadInvitationLinks() {
    try {
        const response = await fetch(`/api/roadmaps/${ROADMAP_ID}/invitations`);
        
        if (!response.ok) {
            throw new Error('Failed to load invitation links');
        }
        
        const invitations = await response.json();
        renderInvitationLinks(invitations);
        
    } catch (error) {
        console.error('Error loading invitation links:', error);
    }
}

function renderInvitationLinks(invitations) {
    const container = document.getElementById('invitationLinksContainer');
    
    if (invitations.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted py-3">
                <i class="bi bi-link-45deg display-4"></i>
                <p>No invitation links created yet</p>
                <small>Create invitation links to let others join your team</small>
            </div>
        `;
        return;
    }
    
    const html = invitations.map(invitation => {
        const statusBadge = invitation.is_active ? 
            '<span class="badge bg-success">Active</span>' :
            invitation.is_expired ? 
            '<span class="badge bg-warning">Expired</span>' :
            '<span class="badge bg-secondary">Inactive</span>';
        
        const roleColor = invitation.role === 'admin' ? 'primary' : 
                         invitation.role === 'member' ? 'info' : 'secondary';
        
        return `
            <div class="border rounded p-3 mb-3">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <div>
                        <span class="badge bg-${roleColor}">${invitation.role.toUpperCase()}</span>
                        ${statusBadge}
                        ${invitation.max_uses ? `<span class="badge bg-light text-dark">${invitation.current_uses}/${invitation.max_uses} uses</span>` : ''}
                    </div>
                    <button class="btn btn-sm btn-outline-danger" onclick="deactivateInvitation(${invitation.id})">
                        <i class="bi bi-x-circle"></i>
                    </button>
                </div>
                
                <div class="input-group mb-2">
                    <input type="text" class="form-control font-monospace small" 
                           value="${invitation.invitation_url}" 
                           readonly id="inviteUrl${invitation.id}">
                    <button class="btn btn-outline-secondary" type="button" onclick="copyInvitationUrl(${invitation.id})">
                        <i class="bi bi-clipboard"></i>
                    </button>
                </div>
                
                <small class="text-muted">
                    Created ${new Date(invitation.created_at).toLocaleDateString()}
                    ${invitation.expires_at ? ` • Expires ${new Date(invitation.expires_at).toLocaleDateString()}` : ' • No expiration'}
                    ${invitation.creator ? ` • By ${invitation.creator.full_name || invitation.creator.username}` : ''}
                </small>
            </div>
        `;
    }).join('');
    
    container.innerHTML = html;
}

async function copyInvitationUrl(invitationId) {
    const input = document.getElementById(`inviteUrl${invitationId}`);
    
    try {
        await navigator.clipboard.writeText(input.value);
        showSuccessMessage('Invitation link copied to clipboard!');
    } catch (error) {
        // Fallback for older browsers
        input.select();
        document.execCommand('copy');
        showSuccessMessage('Invitation link copied to clipboard!');
    }
}

async function deactivateInvitation(invitationId) {
    if (!confirm('Are you sure you want to deactivate this invitation link?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/roadmaps/${ROADMAP_ID}/invitations/${invitationId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error('Failed to deactivate invitation link');
        }
        
        showSuccessMessage('Invitation link deactivated');
        loadInvitationLinks();
        
    } catch (error) {
        showErrorMessage('Error deactivating invitation link: ' + error.message);
    }
}

// Google User Management

async function addGoogleUser() {
    const email = document.getElementById('googleEmail').value.trim();
    const role = document.getElementById('googleUserRole').value;
    
    if (!email) {
        showErrorMessage('Please enter a Google email address');
        return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showErrorMessage('Please enter a valid email address');
        return;
    }
    
    try {
        // Create a placeholder user that will be activated when they sign in with Google
        const response = await fetch('/api/users/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: email.split('@')[0] + '_google',
                email: email,
                password: 'google_auth_placeholder', // Will be ignored for Google users
                full_name: email.split('@')[0],
                auth_provider: 'google'
            })
        });
        
        if (response.ok || response.status === 409) { // OK or user already exists
            let user;
            if (response.status === 409) {
                // User already exists, find them
                const searchResponse = await fetch(`/api/users/search?q=${encodeURIComponent(email)}`);
                const users = await searchResponse.json();
                user = users.find(u => u.email === email);
                
                if (!user) {
                    throw new Error('User exists but could not be found');
                }
            } else {
                user = await response.json();
            }
            
            // Add user to team
            const addResponse = await fetch(`/api/roadmaps/${ROADMAP_ID}/members`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.id, role })
            });
            
            if (addResponse.ok) {
                showSuccessMessage(`Google user ${email} added to team! They'll join when they sign in.`);
                
                // Clear form
                document.getElementById('googleEmail').value = '';
                document.getElementById('googleUserRole').value = 'member';
                
                // Reload team members
                loadTeamMembers();
            } else if (addResponse.status === 409) {
                showErrorMessage('User is already a member of this team');
            } else {
                const error = await addResponse.json();
                throw new Error(error.error || 'Failed to add user to team');
            }
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create Google user');
        }
    } catch (error) {
        console.error('Error adding Google user:', error);
        showErrorMessage('Error adding Google user: ' + error.message);
    }
}