document.addEventListener('DOMContentLoaded', () => {
    const listEl = document.getElementById('roadmap-list');
    const nameInput = document.getElementById('roadmapName');
    const saveBtn = document.getElementById('saveRoadmap');

    // Load and render roadmaps
    function loadRoadmaps() {
        fetch('/api/roadmaps')
            .then(response => response.json())
            .then(data => {
                listEl.innerHTML = '';
                data.forEach(rm => {
                    const col = document.createElement('div');
                    col.className = 'col-12 col-md-6 col-lg-4';
                    col.innerHTML = `
                        <div class="card">
                            <div class="card-body">
                                <h5 class="card-title">${rm.name}</h5>
                                <a href="/roadmap/${rm.id}" class="btn btn-primary">Open</a>
                            </div>
                        </div>
                    `;
                    listEl.appendChild(col);
                });
            })
            .catch(err => console.error('Error loading roadmaps:', err));
    }

    // Save new roadmap
    saveBtn.addEventListener('click', () => {
        const name = nameInput.value.trim();
        if (!name) {
            alert('Please enter a roadmap name.');
            return;
        }
        fetch('/api/roadmaps', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        })
        .then(response => response.json())
        .then(() => {
            nameInput.value = '';
            const modalEl = document.getElementById('addRoadmapModal');
            bootstrap.Modal.getInstance(modalEl).hide();
            loadRoadmaps();
        })
        .catch(err => console.error('Error saving roadmap:', err));
    });

    loadRoadmaps();
}); 