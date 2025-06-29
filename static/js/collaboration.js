// Real-time Collaboration Features for Product Compass

class CollaborationManager {
    constructor() {
        this.currentUser = null;
        this.notifications = [];
        this.init();
    }

    async init() {
        try {
            const response = await fetch('/api/users/me');
            if (response.ok) {
                this.currentUser = await response.json();
                this.initializeUI();
                this.startNotificationPolling();
            }
        } catch (error) {
            console.error('Failed to initialize collaboration:', error);
        }
    }

    initializeUI() {
        this.addNotificationBell();
        this.initializeComments();
    }

    addNotificationBell() {
        const navbar = document.querySelector('.navbar-nav');
        if (!navbar || document.querySelector('#notification-bell')) return;

        const bellHTML = `
            <li class="nav-item dropdown" id="notification-bell">
                <a class="nav-link dropdown-toggle position-relative" href="#" role="button" data-bs-toggle="dropdown">
                    <i class="bi bi-bell"></i>
                    <span class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger notification-count" style="display: none;">0</span>
                </a>
                <ul class="dropdown-menu dropdown-menu-end" style="width: 300px;">
                    <li class="dropdown-header d-flex justify-content-between">
                        <span>Notifications</span>
                        <button class="btn btn-sm btn-outline-secondary mark-all-read">Mark all read</button>
                    </li>
                    <li><hr class="dropdown-divider"></li>
                    <li class="notification-list">
                        <div class="text-center p-3 text-muted">No notifications</div>
                    </li>
                </ul>
            </li>
        `;

        navbar.insertAdjacentHTML('beforeend', bellHTML);

        // Add event listener for mark all read
        document.querySelector('.mark-all-read').addEventListener('click', () => {
            this.markAllNotificationsRead();
        });
    }

    async loadNotifications() {
        try {
            const response = await fetch('/api/notifications?limit=10');
            if (response.ok) {
                const data = await response.json();
                this.updateNotificationUI(data.notifications, data.unread_count);
            }
        } catch (error) {
            console.error('Failed to load notifications:', error);
        }
    }

    updateNotificationUI(notifications, unreadCount) {
        const badge = document.querySelector('.notification-count');
        const list = document.querySelector('.notification-list');
        
        if (badge) {
            badge.textContent = unreadCount;
            badge.style.display = unreadCount > 0 ? 'block' : 'none';
        }

        if (list && notifications) {
            list.innerHTML = notifications.length === 0 ? 
                '<div class="text-center p-3 text-muted">No notifications</div>' :
                notifications.map(n => `
                    <li class="dropdown-item small ${n.is_read ? '' : 'bg-light'}">
                        <div class="d-flex">
                            <div class="flex-grow-1">
                                <strong>${n.title}</strong><br>
                                <span class="text-muted">${n.message}</span><br>
                                <small class="text-muted">${this.formatTime(n.created_at)}</small>
                            </div>
                        </div>
                    </li>
                `).join('');
        }
    }

    async markAllNotificationsRead() {
        try {
            const response = await fetch('/api/notifications/mark-read', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            
            if (response.ok) {
                this.loadNotifications();
            }
        } catch (error) {
            console.error('Failed to mark notifications as read:', error);
        }
    }

    initializeComments() {
        const commentSections = document.querySelectorAll('[data-comments-target]');
        commentSections.forEach(section => {
            const targetType = section.dataset.commentsTarget;
            const targetId = section.dataset.commentsId;
            this.createCommentsComponent(section, targetType, targetId);
        });
    }

    createCommentsComponent(container, targetType, targetId) {
        container.innerHTML = `
            <div class="card mt-3 comments-card">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h6 class="mb-0">
                        <i class="bi bi-chat-dots me-2"></i>
                        Comments (<span class="comment-count">0</span>)
                    </h6>
                    <button class="btn btn-sm btn-outline-primary toggle-comments">
                        <i class="bi bi-chevron-down"></i> Show
                    </button>
                </div>
                <div class="card-body comments-content" style="display: none;">
                    <div class="add-comment-form mb-3">
                        <div class="position-relative">
                            <textarea class="form-control comment-input" rows="3" 
                                placeholder="Add a comment... Use @username to mention someone"></textarea>
                            <div class="mention-suggestions" style="display: none;"></div>
                        </div>
                        <div class="d-flex justify-content-between align-items-center mt-2">
                            <small class="text-muted">Tip: Use @username to mention team members</small>
                            <button class="btn btn-primary btn-sm submit-comment" disabled>
                                <i class="bi bi-send me-1"></i>Post Comment
                            </button>
                        </div>
                    </div>
                    <div class="comments-list">
                        <div class="text-center text-muted p-3">Loading comments...</div>
                    </div>
                </div>
            </div>
        `;

        const toggleBtn = container.querySelector('.toggle-comments');
        const content = container.querySelector('.comments-content');
        const submitBtn = container.querySelector('.submit-comment');
        const input = container.querySelector('.comment-input');

        toggleBtn.addEventListener('click', () => {
            const isVisible = content.style.display !== 'none';
            content.style.display = isVisible ? 'none' : 'block';
            toggleBtn.innerHTML = isVisible ? 
                '<i class="bi bi-chevron-down"></i> Show' : 
                '<i class="bi bi-chevron-up"></i> Hide';
            
            if (!isVisible) {
                this.loadComments(targetType, targetId, container);
            }
        });

        input.addEventListener('input', (e) => {
            submitBtn.disabled = !e.target.value.trim();
            this.handleMentionTyping(e.target, container);
        });

        submitBtn.addEventListener('click', () => {
            if (input.value.trim()) {
                this.submitComment(targetType, targetId, input.value, container);
            }
        });

        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!submitBtn.disabled) {
                    this.submitComment(targetType, targetId, input.value, container);
                }
            }
        });
    }

    async loadComments(targetType, targetId, container) {
        try {
            const response = await fetch(`/api/${targetType}/${targetId}/comments`);
            if (response.ok) {
                const comments = await response.json();
                this.renderComments(comments, container);
            }
        } catch (error) {
            console.error('Failed to load comments:', error);
            const list = container.querySelector('.comments-list');
            list.innerHTML = '<div class="text-danger text-center p-3">Failed to load comments</div>';
        }
    }

    renderComments(comments, container) {
        const list = container.querySelector('.comments-list');
        const countSpan = container.querySelector('.comment-count');
        
        countSpan.textContent = comments.length;

        if (comments.length === 0) {
            list.innerHTML = '<div class="text-muted text-center p-3">No comments yet. Be the first to comment!</div>';
            return;
        }

        list.innerHTML = comments.map(comment => `
            <div class="comment-item border-bottom pb-3 mb-3" data-comment-id="${comment.id}">
                <div class="d-flex">
                    <div class="flex-shrink-0 me-3">
                        ${comment.author.avatar_url ? 
                            `<img src="${comment.author.avatar_url}" class="rounded-circle" width="40" height="40" alt="Avatar">` :
                            `<div class="bg-primary rounded-circle d-flex align-items-center justify-content-center" style="width: 40px; height: 40px;">
                                <i class="bi bi-person text-white"></i>
                            </div>`
                        }
                    </div>
                    <div class="flex-grow-1">
                        <div class="d-flex justify-content-between align-items-start mb-1">
                            <div>
                                <strong class="text-primary">${comment.author.name}</strong>
                                <small class="text-muted ms-2">${this.formatTime(comment.created_at)}</small>
                                ${comment.is_edited ? '<span class="badge bg-secondary ms-2">edited</span>' : ''}
                            </div>
                            ${comment.author.id === this.currentUser?.id ? `
                                <div class="dropdown">
                                    <button class="btn btn-sm btn-link text-muted p-0" data-bs-toggle="dropdown">
                                        <i class="bi bi-three-dots"></i>
                                    </button>
                                    <ul class="dropdown-menu dropdown-menu-end">
                                        <li><a class="dropdown-item edit-comment" href="#" data-comment-id="${comment.id}">
                                            <i class="bi bi-pencil me-2"></i>Edit
                                        </a></li>
                                        <li><a class="dropdown-item delete-comment text-danger" href="#" data-comment-id="${comment.id}">
                                            <i class="bi bi-trash me-2"></i>Delete
                                        </a></li>
                                    </ul>
                                </div>
                            ` : ''}
                        </div>
                        <div class="comment-content">${this.formatCommentContent(comment.content)}</div>
                    </div>
                </div>
            </div>
        `).join('');

        // Add event listeners for edit/delete
        container.querySelectorAll('.edit-comment').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.editComment(e.target.dataset.commentId, container);
            });
        });

        container.querySelectorAll('.delete-comment').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                if (confirm('Are you sure you want to delete this comment?')) {
                    this.deleteComment(e.target.dataset.commentId, container);
                }
            });
        });
    }

    async submitComment(targetType, targetId, content, container) {
        const submitBtn = container.querySelector('.submit-comment');
        const originalText = submitBtn.innerHTML;
        
        try {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Posting...';
            
            const response = await fetch(`/api/${targetType}/${targetId}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: content.trim() })
            });

            if (response.ok) {
                container.querySelector('.comment-input').value = '';
                submitBtn.disabled = true;
                this.loadComments(targetType, targetId, container);
                
                // Show success feedback
                this.showToast('Comment posted successfully!', 'success');
            } else {
                const error = await response.json();
                this.showToast('Failed to post comment: ' + error.error, 'error');
            }
        } catch (error) {
            console.error('Failed to submit comment:', error);
            this.showToast('Failed to post comment. Please try again.', 'error');
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }

    async deleteComment(commentId, container) {
        try {
            const response = await fetch(`/api/comments/${commentId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                const targetType = container.closest('[data-comments-target]').dataset.commentsTarget;
                const targetId = container.closest('[data-comments-target]').dataset.commentsId;
                this.loadComments(targetType, targetId, container);
                this.showToast('Comment deleted successfully!', 'success');
            } else {
                this.showToast('Failed to delete comment', 'error');
            }
        } catch (error) {
            console.error('Failed to delete comment:', error);
            this.showToast('Failed to delete comment', 'error');
        }
    }

    formatCommentContent(content) {
        return content
            .replace(/@(\w+)/g, '<span class="mention bg-primary bg-opacity-10 text-primary px-1 rounded">@$1</span>')
            .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener" class="text-decoration-none">$1 <i class="bi bi-box-arrow-up-right small"></i></a>')
            .replace(/\n/g, '<br>');
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) return 'just now';
        if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
        if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
        if (diff < 604800000) return Math.floor(diff / 86400000) + 'd ago';
        
        return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    }

    handleMentionTyping(input, container) {
        const value = input.value;
        const cursorPos = input.selectionStart;
        const textBeforeCursor = value.substring(0, cursorPos);
        const match = textBeforeCursor.match(/@(\w*)$/);
        
        if (match) {
            const query = match[1];
            if (query.length >= 1) {
                this.showMentionSuggestions(query, container, input);
            } else {
                this.hideMentionSuggestions(container);
            }
        } else {
            this.hideMentionSuggestions(container);
        }
    }

    async showMentionSuggestions(query, container, input) {
        try {
            const roadmapId = this.getCurrentRoadmapId();
            const url = `/api/users/search/mentions?q=${encodeURIComponent(query)}${roadmapId ? '&roadmap_id=' + roadmapId : ''}`;
            
            const response = await fetch(url);
            if (response.ok) {
                const users = await response.json();
                this.renderMentionSuggestions(users, container, input);
            }
        } catch (error) {
            console.error('Failed to search users for mentions:', error);
        }
    }

    renderMentionSuggestions(users, container, input) {
        const suggestions = container.querySelector('.mention-suggestions');
        
        if (users.length === 0) {
            this.hideMentionSuggestions(container);
            return;
        }

        suggestions.innerHTML = users.map(user => `
            <div class="mention-suggestion d-flex align-items-center p-2 border-bottom bg-white" data-username="${user.username}" style="cursor: pointer;">
                ${user.avatar_url ? 
                    `<img src="${user.avatar_url}" class="rounded-circle me-2" width="24" height="24" alt="Avatar">` :
                    `<div class="bg-secondary rounded-circle d-flex align-items-center justify-content-center me-2" style="width: 24px; height: 24px;">
                        <i class="bi bi-person text-white"></i>
                    </div>`
                }
                <div>
                    <div class="fw-bold small">${user.full_name || user.username}</div>
                    ${user.full_name ? `<div class="text-muted small">@${user.username}</div>` : ''}
                </div>
            </div>
        `).join('');

        suggestions.style.cssText = `
            display: block;
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: white;
            border: 1px solid #dee2e6;
            border-radius: 0.375rem;
            box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075);
            z-index: 1000;
            max-height: 200px;
            overflow-y: auto;
        `;

        suggestions.querySelectorAll('.mention-suggestion').forEach(item => {
            item.addEventListener('mouseenter', () => {
                item.style.backgroundColor = '#f8f9fa';
            });
            item.addEventListener('mouseleave', () => {
                item.style.backgroundColor = 'white';
            });
            item.addEventListener('click', () => {
                this.insertMention(item.dataset.username, input, container);
            });
        });
    }

    insertMention(username, input, container) {
        const value = input.value;
        const cursorPos = input.selectionStart;
        const textBeforeCursor = value.substring(0, cursorPos);
        const textAfterCursor = value.substring(cursorPos);
        
        const lastAtIndex = textBeforeCursor.lastIndexOf('@');
        const newValue = textBeforeCursor.substring(0, lastAtIndex) + `@${username} ` + textAfterCursor;
        
        input.value = newValue;
        input.focus();
        
        const newCursorPos = lastAtIndex + username.length + 2;
        input.setSelectionRange(newCursorPos, newCursorPos);
        
        this.hideMentionSuggestions(container);
        
        // Enable submit button
        container.querySelector('.submit-comment').disabled = false;
    }

    hideMentionSuggestions(container) {
        const suggestions = container.querySelector('.mention-suggestions');
        suggestions.style.display = 'none';
        suggestions.innerHTML = '';
    }

    getCurrentRoadmapId() {
        // Try to get roadmap ID from URL or page context
        const urlMatch = window.location.pathname.match(/\/roadmap\/(\d+)/);
        if (urlMatch) return urlMatch[1];
        
        const roadmapElement = document.querySelector('[data-roadmap-id]');
        if (roadmapElement) return roadmapElement.dataset.roadmapId;
        
        return null;
    }

    startNotificationPolling() {
        this.loadNotifications();
        setInterval(() => {
            this.loadNotifications();
        }, 30000);
    }

    showToast(message, type = 'info') {
        const toastId = 'toast-' + Date.now();
        const bgClass = type === 'success' ? 'bg-success' : type === 'error' ? 'bg-danger' : 'bg-info';
        
        const toastHTML = `
            <div class="toast ${bgClass} text-white" id="${toastId}" role="alert">
                <div class="toast-body d-flex justify-content-between align-items-center">
                    <span>${message}</span>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast"></button>
                </div>
            </div>
        `;

        let toastContainer = document.querySelector('.toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
            toastContainer.style.zIndex = '9999';
            document.body.appendChild(toastContainer);
        }

        toastContainer.insertAdjacentHTML('beforeend', toastHTML);
        
        const toastElement = document.getElementById(toastId);
        const toast = new bootstrap.Toast(toastElement, { delay: 3000 });
        toast.show();
        
        toastElement.addEventListener('hidden.bs.toast', () => {
            toastElement.remove();
        });
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.collaborationManager = new CollaborationManager();
});
