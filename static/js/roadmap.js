// Timeline View Management
class RoadmapManager {
    constructor() {
        this.currentView = 'month';
        this.features = [];
        this.selectedFeature = null;
        this.editingFeatureId = null;
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

        // Save feature button
        document.getElementById('saveFeature').addEventListener('click', () => {
            this.saveFeature();
        });

        // Delete and edit buttons in detail modal
        document.getElementById('deleteFeatureBtn').addEventListener('click', () => this.deleteFeature());
        document.getElementById('editFeatureBtn').addEventListener('click', () => this.startEditFeature());

        // Add Feature Modal event listener to reset title when opening for adding
        document.getElementById('addFeatureModal').addEventListener('show.bs.modal', (e) => {
            // Only reset if we're not editing (editingFeatureId is null)
            if (!this.editingFeatureId) {
                document.querySelector('#addFeatureModal .modal-title').innerHTML = '<i class="bi bi-plus-circle me-2"></i>Add New Feature';
            }
        });

        // Reset form and editing state when modal is hidden
        document.getElementById('addFeatureModal').addEventListener('hidden.bs.modal', () => {
            document.getElementById('featureForm').reset();
            this.editingFeatureId = null;
        });

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
        console.log('Debug: saving feature for roadmap', ROADMAP_ID);
        const featureData = {
            title: document.getElementById('featureTitle').value,
            description: document.getElementById('featureDescription').value,
            release: document.getElementById('featureRelease').value,
            priority: document.getElementById('featurePriority').value,
            status: document.getElementById('featureStatus').value,
            date: document.getElementById('featureDate').value
        };
        if (this.editingFeatureId) {
            // Update existing feature
            fetch(`/api/features/${this.editingFeatureId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(featureData)
            })
            .then(res => res.json())
            .then(updated => {
                // Update local
                const idx = this.features.findIndex(f => f.id === this.editingFeatureId);
                this.features[idx] = updated;
                this.setView(this.currentView); // Re-render current view
                this.editingFeatureId = null;
                // Close modal & reset form
                const modal = bootstrap.Modal.getInstance(document.getElementById('addFeatureModal'));
                modal.hide();
                document.getElementById('featureForm').reset();
            }).catch(e => console.error('Error updating:', e));
        } else {
            // Create new feature
            fetch(`/api/roadmaps/${ROADMAP_ID}/features`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(featureData)
            })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(err => { throw new Error(err.error || 'Failed to save feature'); });
                }
                return response.json();
            })
            .then((newFeature) => {
                this.features.push(newFeature);
                this.setView(this.currentView); // Re-render current view
                // Close modal and reset form
                const modal = bootstrap.Modal.getInstance(document.getElementById('addFeatureModal'));
                modal.hide();
                document.getElementById('featureForm').reset();
            })
            .catch((error) => console.error('Error saving feature:', error));
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
        const loadingEl = document.getElementById('loadingState');
        const errorEl = document.getElementById('errorState');
        const emptyEl = document.getElementById('emptyState');
        const controlsEl = document.getElementById('mainContentArea');
        const timelineEl = document.getElementById('timelineView');
        const kanbanEl = document.getElementById('kanban-board');

        try {
            const response = await fetch(`/api/roadmaps/${ROADMAP_ID}/features`);
            if (!response.ok) {
                throw new Error('Failed to fetch features');
            }
            this.features = await response.json();

            // Hide loading spinner
            loadingEl.classList.add('d-none');

            if (this.features.length === 0) {
                // Show empty state if no features
                emptyEl.classList.remove('d-none');
            } else {
                // Show controls
                controlsEl.classList.remove('d-none');
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
            // Simple blue styling for task bars only - minimal and safe
            const styles = `
                /* Very specific task bar targeting to avoid affecting background */
                .gantt-wrapper g.bar rect { 
                    fill: #0056D2 !important; 
                    stroke: #003d99 !important; 
                    stroke-width: 2px !important; 
                }
                
                /* Target by our custom task classes if they exist */
                .gantt-wrapper .task-high-planned rect,
                .gantt-wrapper .task-high-in-progress rect { 
                    fill: #0056D2 !important; 
                    stroke: #003d99 !important; 
                    stroke-width: 2px !important; 
                }
                
                .gantt-wrapper .task-medium-planned rect,
                .gantt-wrapper .task-medium-in-progress rect { 
                    fill: #0056D2 !important; 
                    stroke: #003d99 !important; 
                    stroke-width: 2px !important; 
                    opacity: 0.8 !important;
                }
                
                .gantt-wrapper .task-low-planned rect,
                .gantt-wrapper .task-low-in-progress rect { 
                    fill: #0056D2 !important; 
                    stroke: #003d99 !important; 
                    stroke-width: 2px !important; 
                    opacity: 0.6 !important;
                }
                
                /* Completed tasks */
                .gantt-wrapper .task-high-completed rect,
                .gantt-wrapper .task-medium-completed rect,
                .gantt-wrapper .task-low-completed rect { 
                    fill: #003d99 !important; 
                    stroke: #002266 !important; 
                    stroke-width: 2px !important;
                }
                
                /* Progress bars */
                .gantt-wrapper .bar .bar-progress { 
                    fill: rgba(255,255,255,0.4) !important; 
                    stroke: rgba(255,255,255,0.6) !important; 
                    stroke-width: 1px !important; 
                }
                
                /* Grid styling */
                .gantt-wrapper .grid .grid-header rect { 
                    fill: var(--color-primary) !important; 
                }
                .gantt-wrapper .grid .grid-header text { 
                    fill: white !important; 
                    font-weight: 600 !important; 
                    text-shadow: 0 1px 2px rgba(0,0,0,0.2) !important; 
                }
                
                /* Row styling */
                .gantt-wrapper .grid .grid-row rect { 
                    stroke: #E4F0FF !important; 
                    stroke-width: 1px !important; 
                }
                .gantt-wrapper .grid .grid-row:nth-child(odd) rect { 
                    fill: #ffffff !important; 
                }
                .gantt-wrapper .grid .grid-row:nth-child(even) rect { 
                    fill: #f8fcff !important; 
                }
                
                /* Hover effects */
                .gantt-wrapper .bar:hover .bar-inner { 
                    filter: brightness(1.1) saturate(1.2) !important; 
                    transition: all 0.2s ease !important; 
                }
                
                /* Today line */
                .gantt-wrapper .today-highlight { 
                    stroke: #FF6B35 !important; 
                    stroke-width: 3px !important; 
                    stroke-dasharray: 5,5 !important; 
                }
            `;
            
            // Inject styles
            let styleSheet = document.getElementById('gantt-custom-styles');
            if (!styleSheet) {
                styleSheet = document.createElement('style');
                styleSheet.id = 'gantt-custom-styles';
                document.head.appendChild(styleSheet);
            }
            styleSheet.textContent = styles;
            
        } catch (error) {
            console.warn('Could not apply custom styling:', error);
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
    window.roadmapManager = new RoadmapManager();
}); 