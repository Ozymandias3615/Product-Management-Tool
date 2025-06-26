// Breadcrumb Navigation Handler
document.addEventListener('DOMContentLoaded', function() {
    const breadcrumbContainer = document.getElementById('dynamicBreadcrumb');
    if (!breadcrumbContainer) return;

    // Define breadcrumb mappings
    const breadcrumbMappings = {
        '/': {
            title: 'Home',
            icon: 'bi-house'
        },
        '/about': {
            title: 'About',
            icon: 'bi-info-circle'
        },
        '/features': {
            title: 'Features',
            icon: 'bi-star'
        },
        '/contact': {
            title: 'Contact',
            icon: 'bi-envelope'
        },
        '/team': {
            title: 'Team',
            icon: 'bi-people'
        },
        '/login': {
            title: 'Login',
            icon: 'bi-box-arrow-in-right'
        },
        '/profile': {
            title: 'Profile',
            icon: 'bi-person'
        },
        '/roadmaps': {
            title: 'My Roadmaps',
            icon: 'bi-map'
        },
        '/personas': {
            title: 'Personas',
            icon: 'bi-people'
        },
        '/demo': {
            title: 'Demo',
            icon: 'bi-play-circle'
        }
    };

    // Special handling for dynamic routes
    const specialRoutes = {
        roadmap: {
            title: 'Roadmap',
            icon: 'bi-diagram-3',
            parent: '/roadmaps'
        },
        join: {
            title: 'Join Team',
            icon: 'bi-person-plus',
            parent: '/roadmaps'
        },
        share: {
            title: 'Shared Roadmap',
            icon: 'bi-share',
            parent: '/'
        },
        embed: {
            title: 'Embedded View',
            icon: 'bi-code-square',
            parent: '/'
        }
    };

    function generateBreadcrumb() {
        const currentPath = window.location.pathname;
        const pathSegments = currentPath.split('/').filter(segment => segment !== '');
        const breadcrumbItems = [];

        // Handle root path
        if (currentPath === '/') {
            breadcrumbItems.push({
                title: 'Home',
                icon: 'bi-house',
                url: '/',
                isActive: true
            });
        }
        // Handle direct mapped routes (like /team, /about, etc.)
        else if (breadcrumbMappings[currentPath]) {
            // Add Home first (unless we're on home page)
            breadcrumbItems.push({
                title: 'Home',
                icon: 'bi-house',
                url: '/',
                isActive: false
            });
            
            // Add the current page
            const mapping = breadcrumbMappings[currentPath];
            breadcrumbItems.push({
                title: mapping.title,
                icon: mapping.icon,
                url: currentPath,
                isActive: true
            });
        }
        // Handle dynamic routes (like /roadmap/123, /join/token, etc.)
        else if (pathSegments.length > 0) {
            const firstSegment = pathSegments[0];
            
            if (specialRoutes[firstSegment]) {
                const route = specialRoutes[firstSegment];
                
                // Always add Home first
                breadcrumbItems.push({
                    title: 'Home',
                    icon: 'bi-house',
                    url: '/',
                    isActive: false
                });
                
                // Add parent if exists and is not home
                if (route.parent && route.parent !== '/') {
                    const parentMapping = breadcrumbMappings[route.parent];
                    if (parentMapping) {
                        breadcrumbItems.push({
                            title: parentMapping.title,
                            icon: parentMapping.icon,
                            url: route.parent,
                            isActive: false
                        });
                    }
                }
                
                // Add current page
                let title = route.title;
                
                // Special handling for roadmap with name
                if (firstSegment === 'roadmap' && window.roadmapName) {
                    title = window.roadmapName;
                }
                
                breadcrumbItems.push({
                    title: title,
                    icon: route.icon,
                    url: currentPath,
                    isActive: true
                });
            }
            // Handle unknown routes - build from segments but more carefully
            else {
                // Always add Home first
                breadcrumbItems.push({
                    title: 'Home',
                    icon: 'bi-house',
                    url: '/',
                    isActive: false
                });
                
                // Build path from segments
                let currentUrl = '';
                pathSegments.forEach((segment, index) => {
                    currentUrl += '/' + segment;
                    const isLast = index === pathSegments.length - 1;
                    
                    // Check if we have a mapping for this exact path
                    const mapping = breadcrumbMappings[currentUrl];
                    if (mapping) {
                        breadcrumbItems.push({
                            title: mapping.title,
                            icon: mapping.icon,
                            url: currentUrl,
                            isActive: isLast
                        });
                    } else {
                        // Generate title from segment only if it's not already mapped
                        const title = segment.charAt(0).toUpperCase() + segment.slice(1).replace(/[-_]/g, ' ');
                        breadcrumbItems.push({
                            title: title,
                            icon: isLast ? 'bi-file-text' : 'bi-folder',
                            url: currentUrl,
                            isActive: isLast
                        });
                    }
                });
            }
        }

        return breadcrumbItems;
    }

    function renderBreadcrumb(items) {
        breadcrumbContainer.innerHTML = '';
        
        items.forEach((item, index) => {
            const li = document.createElement('li');
            li.className = `breadcrumb-item${item.isActive ? ' active' : ''}`;
            
            if (item.isActive) {
                li.setAttribute('aria-current', 'page');
                li.innerHTML = `
                    <i class="${item.icon}"></i>
                    ${item.title}
                `;
            } else {
                li.innerHTML = `
                    <a href="${item.url}">
                        <i class="${item.icon}"></i>
                        ${item.title}
                    </a>
                `;
            }
            
            breadcrumbContainer.appendChild(li);
        });
    }

    // Generate and render breadcrumb
    const breadcrumbItems = generateBreadcrumb();
    renderBreadcrumb(breadcrumbItems);

    // Listen for page changes (for SPA-like navigation)
    window.addEventListener('popstate', function() {
        const breadcrumbItems = generateBreadcrumb();
        renderBreadcrumb(breadcrumbItems);
    });

    // Optional: Update breadcrumb when roadmap name is loaded
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList' && window.roadmapName) {
                const breadcrumbItems = generateBreadcrumb();
                renderBreadcrumb(breadcrumbItems);
                observer.disconnect(); // Stop observing once updated
            }
        });
    });

    // Start observing if we're on a roadmap page
    if (window.location.pathname.startsWith('/roadmap/')) {
        observer.observe(document.body, { childList: true, subtree: true });
    }
});

// Utility function to update breadcrumb title (can be called from other scripts)
window.updateBreadcrumbTitle = function(newTitle) {
    const activeItem = document.querySelector('.breadcrumb-item.active');
    if (activeItem) {
        const icon = activeItem.querySelector('i');
        const iconClass = icon ? icon.className : 'bi-file-text';
        activeItem.innerHTML = `<i class="${iconClass}"></i> ${newTitle}`;
    }
}; 