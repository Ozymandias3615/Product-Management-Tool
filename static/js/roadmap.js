// Timeline View Management
class RoadmapManager {
    constructor() {
        this.currentView = 'month';
        this.features = [];
        this.selectedFeature = null;
        this.editingFeatureId = null;
        this.initializeEventListeners();
        this.fetchFeatures();
    }

    initializeEventListeners() {
        // View toggle buttons
        document.querySelectorAll('[data-view]').forEach(button => {
            button.addEventListener('click', (e) => {
                this.setView(e.target.dataset.view);
            });
        });

        // Save feature button
        document.getElementById('saveFeature').addEventListener('click', () => {
            this.saveFeature();
        });

        // Delete and edit buttons in detail modal
        document.getElementById('deleteFeatureBtn').addEventListener('click', () => this.deleteFeature());
        document.getElementById('editFeatureBtn').addEventListener('click', () => this.startEditFeature());

        // Initialize drag and drop
        this.initializeDragAndDrop();
    }

    initializeTimeline() {
        this.updateTimelineHeader();
        this.renderFeatures();
    }

    setView(view) {
        this.currentView = view;
        document.querySelectorAll('[data-view]').forEach(button => {
            button.classList.toggle('active', button.dataset.view === view);
        });
        const timelineEl = document.querySelector('.timeline-view');
        const kanbanEl = document.getElementById('kanban-board');
        const ganttEl = document.getElementById('ganttChart');
        if (view === 'kanban') {
            timelineEl.classList.add('d-none');
            ganttEl.classList.add('d-none');
            kanbanEl.classList.remove('d-none');
            this.renderKanban();
        } else if (view === 'gantt') {
            timelineEl.classList.add('d-none');
            kanbanEl.classList.add('d-none');
            ganttEl.classList.remove('d-none');
            this.renderGantt();
        } else {
            ganttEl.classList.add('d-none');
            timelineEl.classList.remove('d-none');
            kanbanEl.classList.add('d-none');
            this.updateTimelineHeader();
            this.renderFeatures();
        }
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
        let count;

        switch (this.currentView) {
            case 'month':
                count = 6;
                break;
            case 'quarter':
                count = 4;
                break;
            case 'sprint':
                count = 8;
                break;
            default:
                count = 6;
        }

        for (let i = 0; i < count; i++) {
            const date = new Date(today.getFullYear(), today.getMonth() + i, 1);
            months.push(date.toLocaleString('default', { month: 'long', year: 'numeric' }));
        }

        return months;
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
                this.renderFeatures();
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
                this.renderFeatures();
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
            <small>Release Date: ${new Date(feature.date).toLocaleDateString()}</small>
        `;
        // Show detail modal on click with pop-out animation
        element.addEventListener('click', (e) => {
            // Set currently selected feature
            this.selectedFeature = feature;
            document.getElementById('detailTitle').textContent = feature.title;
            document.getElementById('detailDescription').textContent = feature.description;
            document.getElementById('detailPriority').textContent = feature.priority;
            document.getElementById('detailStatus').textContent = feature.status;
            document.getElementById('detailDate').textContent = new Date(feature.date).toLocaleDateString();
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
        const controlsEl = document.getElementById('timelineControls');
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
                // Show initial view
                if (this.currentView === 'kanban') {
                    kanbanEl.classList.remove('d-none');
                } else {
                    timelineEl.classList.remove('d-none');
                }
                // Initialize the appropriate view
                if (this.currentView === 'kanban') {
                    this.renderKanban();
                } else {
                    this.initializeTimeline();
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
        document.getElementById('featureDate').value = f.date;
        this.editingFeatureId = f.id;
        // Hide detail modal
        bootstrap.Modal.getInstance(document.getElementById('featureDetailModal')).hide();
        // Show add/edit modal
        bootstrap.Modal.getOrCreateInstance(document.getElementById('addFeatureModal')).show();
    }

    renderKanban() {
        const board = document.getElementById('kanban-board');
        board.innerHTML = '';
        const statuses = ['planned', 'in-progress', 'completed'];
        statuses.forEach(status => {
            const col = document.createElement('div');
            col.className = 'kanban-column';
            col.dataset.status = status;
            const header = document.createElement('h5');
            header.textContent = status.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            col.appendChild(header);
            const list = document.createElement('div');
            list.className = 'kanban-list';
            col.appendChild(list);
            board.appendChild(col);
        });
        this.features.forEach(feature => {
            const item = this.createFeatureElement(feature);
            const list = board.querySelector(`.kanban-column[data-status="${feature.status}"] .kanban-list`);
            if (list) list.appendChild(item);
        });
        // Initialize drag-and-drop for Kanban
        board.querySelectorAll('.kanban-list').forEach(list => {
            new Sortable(list, {
                group: 'kanban',
                animation: 150,
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
                    }).catch(e => console.error('Error updating status:', e));
                }
            });
        });
    }

    renderGantt() {
        const ganttEl = document.getElementById('ganttChart');
        console.log('renderGantt called. Features count:', this.features.length, 'Container visible:', !ganttEl.classList.contains('d-none'));
        // Clear any existing chart elements
        ganttEl.innerHTML = '';
        // Build tasks array for Gantt
        const tasks = this.features.map(f => {
            const start = f.date;
            const endDate = new Date(new Date(f.date).getTime() + 7 * 24 * 60 * 60 * 1000);
            return {
                id: f.id.toString(),
                name: f.title,
                start: start,
                end: endDate.toISOString().split('T')[0],
                progress: f.status === 'completed' ? 100 : f.status === 'in-progress' ? 50 : 0,
                custom_class: f.priority
            };
        });
        // Render the Gantt chart using the appropriate constructor
        console.log('window.Gantt:', window.Gantt, 'window.frappe:', window.frappe);
        const GanttClass = window.Gantt || (window.frappe && window.frappe.Gantt);
        if (!GanttClass) {
            console.error('Gantt class not found on window.Gantt or window.frappe.Gantt');
            return;
        }
        // Configure chart for weekly view, tighter layout, and appropriate height
        new GanttClass(ganttEl, tasks, {
            view_mode: 'Week',              // weekly columns
            view_mode_select: true,         // allow switching
            date_format: 'YYYY-MM-DD',
            column_width: 80,               // improved readability
            bar_height: 24,                 // slightly taller bars
            padding: 8,                     // comfortable padding around bars
            infinite_padding: false,        // limit time range to tasks
            container_height: this.features.length * 34 + 60 // row height * count + header
        });
    }
}

// Initialize the roadmap manager when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.roadmapManager = new RoadmapManager();
}); 