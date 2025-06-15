// Persona Manager for Customer Persona Builder
class PersonaManager {
    constructor() {
        this.form = document.getElementById('personaForm');
        this.listContainer = document.getElementById('personaList');
        this.editingId = null;
        this.initialize();
    }

    initialize() {
        this.form.addEventListener('submit', e => {
            e.preventDefault();
            this.savePersona();
        });
        this.fetchPersonas();
    }

    async fetchPersonas() {
        try {
            const res = await fetch('/api/personas');
            const data = await res.json();
            this.personas = data;
            this.renderPersonas();
        } catch (e) {
            console.error('Error loading personas', e);
        }
    }

    renderPersonas() {
        this.listContainer.innerHTML = '';
        this.personas.forEach(p => {
            const col = document.createElement('div');
            col.className = 'col-md-6';
            col.innerHTML = `
                <div class="card">
                  <div class="card-body">
                    <h5 class="card-title">${p.name}</h5>
                    <h6 class="card-subtitle mb-2 text-muted">${p.job_title || ''}, Age ${p.age || ''}</h6>
                    <p><strong>Demographics:</strong> ${p.demographics || ''}</p>
                    <p><strong>Behaviors:</strong> ${p.behaviors || ''}</p>
                    <p><strong>Goals:</strong> ${p.goals || ''}</p>
                    <p><strong>Pain Points:</strong> ${p.pains || ''}</p>
                    <button class="btn btn-sm btn-outline-primary me-2" data-action="edit" data-id="${p.id}">Edit</button>
                    <button class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${p.id}">Delete</button>
                  </div>
                </div>
            `;
            this.listContainer.appendChild(col);
        });
        // attach handlers
        this.listContainer.querySelectorAll('button[data-action]').forEach(btn => {
            const action = btn.dataset.action;
            const id = btn.dataset.id;
            btn.addEventListener('click', () => {
                if (action === 'edit') this.loadForEdit(id);
                if (action === 'delete') this.deletePersona(id);
            });
        });
    }

    async savePersona() {
        const form = this.form;
        const payload = {
            name: form.personaName.value,
            age: parseInt(form.personaAge.value) || null,
            job_title: form.personaJob.value,
            demographics: form.personaDemographics.value,
            behaviors: form.personaBehaviors.value,
            goals: form.personaGoals.value,
            pains: form.personaPains.value
        };
        try {
            let res;
            if (this.editingId) {
                res = await fetch(`/api/personas/${this.editingId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            } else {
                res = await fetch('/api/personas', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            }
            if (!res.ok) throw new Error('Save failed');
            this.resetForm();
            this.fetchPersonas();
        } catch (e) {
            console.error('Error saving persona', e);
        }
    }

    loadForEdit(id) {
        const p = this.personas.find(x => x.id === parseInt(id));
        if (!p) return;
        this.editingId = p.id;
        this.form.personaId.value = p.id;
        this.form.personaName.value = p.name;
        this.form.personaAge.value = p.age || '';
        this.form.personaJob.value = p.job_title || '';
        this.form.personaDemographics.value = p.demographics || '';
        this.form.personaBehaviors.value = p.behaviors || '';
        this.form.personaGoals.value = p.goals || '';
        this.form.personaPains.value = p.pains || '';
        this.form.savePersona.textContent = 'Update Persona';
    }

    async deletePersona(id) {
        if (!confirm('Delete this persona?')) return;
        try {
            const res = await fetch(`/api/personas/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Delete failed');
            this.fetchPersonas();
        } catch (e) {
            console.error('Error deleting persona', e);
        }
    }

    resetForm() {
        this.editingId = null;
        this.form.reset();
        this.form.personaId.value = '';
        this.form.savePersona.textContent = 'Save Persona';
    }
}

document.addEventListener('DOMContentLoaded', () => new PersonaManager()); 