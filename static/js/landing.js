document.addEventListener('DOMContentLoaded', function() {
  console.log('Landing.js loaded and DOM ready');
  
  // Add CSS styles for expandable functionality
  const style = document.createElement('style');
  style.textContent = `
    .expandable-card {
      transition: all 0.3s ease;
    }
    
    .expandable-card.expanded {
      transform: scale(1.02);
      z-index: 10;
      position: relative;
    }
    
    .learn-more-btn {
      position: relative;
      transition: all 0.3s ease;
    }
    
    .learn-more-btn:hover {
      transform: translateY(-2px);
    }
    
    .expand-icon {
      transition: transform 0.3s ease;
      margin-left: 0.5rem;
      font-size: 0.8rem;
    }
    
    .expanded .expand-icon {
      transform: rotate(180deg);
    }
    
    .expanded-content {
      max-height: 0;
      overflow: hidden;
      transition: max-height 0.4s ease-out, opacity 0.3s ease-out;
      opacity: 0;
    }
    
    .expanded-content.show {
      max-height: 400px;
      opacity: 1;
      transition: max-height 0.4s ease-in, opacity 0.3s ease-in;
    }
    
    .expanded-details {
      animation: fadeInUp 0.5s ease-out;
      background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
      border: 1px solid #dee2e6;
    }
    
    .expanded-details * {
      pointer-events: auto !important;
      user-select: text !important;
    }
    
    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `;
  document.head.appendChild(style);
  
  // Debug: Check what's actually in the page
  console.log('Document body HTML length:', document.body.innerHTML.length);
  console.log('Page title:', document.title);
  console.log('Current URL:', window.location.href);
  
  // Check if specific sections exist
  const heroSection = document.querySelector('#hero');
  const whoSection = document.querySelector('#who');
  const featuresSection = document.querySelector('#features');
  
  console.log('Hero section exists:', !!heroSection);
  console.log('Who section exists:', !!whoSection);
  console.log('Features section exists:', !!featuresSection);
  
  // Check for any cards at all
  const allCards = document.querySelectorAll('.card');
  console.log('Total cards found:', allCards.length);
  
  // Check for specific classes  
  const debugWhoCards = document.querySelectorAll('.who-card');
  const interactiveCards = document.querySelectorAll('.interactive-card');
  
  console.log('Who cards found:', debugWhoCards.length);
  console.log('Interactive cards found:', interactiveCards.length);
  
  var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  tooltipTriggerList.forEach(function (tooltipTriggerEl) {
    new bootstrap.Tooltip(tooltipTriggerEl);
  });
  
  // Test if expandable cards exist
  const expandableCards = document.querySelectorAll('.expandable-card');
  console.log('Found', expandableCards.length, 'expandable cards');
  
  // Work with existing who-cards instead
  const whoCards = document.querySelectorAll('.who-card');
  console.log('Working with', whoCards.length, 'who-cards');
  
  // Look for buttons in who-cards
  const learnMoreButtons = document.querySelectorAll('.who-card .btn');
  console.log('Found', learnMoreButtons.length, 'buttons in who-cards');
  
  // Add the expandable functionality to existing cards
  whoCards.forEach((card, index) => {
    console.log('Processing card', index + 1, 'of', whoCards.length);
    console.log('Card HTML structure:', card.innerHTML.substring(0, 200) + '...');
    
    // Add necessary attributes and classes
    card.classList.add('expandable-card');
    
    // Set data-card attribute based on card titles
    const cardTitle = card.querySelector('.card-title');
    if (cardTitle) {
      const title = cardTitle.textContent.toLowerCase().replace(/\s+/g, '-');
      card.setAttribute('data-card', title);
      console.log('Added data-card attribute:', title);
    }
    
    // Find and modify the button
    const button = card.querySelector('.btn');
    console.log('Button found:', !!button);
    if (button) {
      console.log('Original button element:', button.tagName, button.outerHTML.substring(0, 100));
      
      // Remove any existing href if it's an anchor tag
      if (button.tagName === 'A') {
        button.removeAttribute('href');
        button.setAttribute('role', 'button');
        console.log('Removed href from anchor tag');
      }
      
      button.classList.add('learn-more-btn');
      button.innerHTML = '<span class="btn-text">Learn More</span> <i class="bi bi-chevron-down expand-icon"></i>';
      
      // Add expandable content after the button
      const expandableContent = document.createElement('div');
      expandableContent.className = 'expanded-content';
      expandableContent.id = `content-${card.getAttribute('data-card')}`;
      
      // Content based on card type - use DOM methods for proper rendering
      const cardType = cardTitle ? cardTitle.textContent : '';
      
      // Create the expandable details using DOM methods
      const detailsDiv = document.createElement('div');
      detailsDiv.className = 'expanded-details mt-3 p-3 bg-light rounded';
      
      const heading = document.createElement('h6');
      heading.className = 'fw-bold mb-3';
      
      const list = document.createElement('ul');
      list.className = 'list-unstyled text-start small';
      

      
      let features = [];
      
              if (cardType.includes('Product Managers')) {
          heading.textContent = 'Perfect for Product Managers who need to:';
          features = [
            'Create comprehensive product roadmaps',
            'Align stakeholders on priorities',
            'Track feature development progress',
            'Manage release planning',
            'Communicate strategy effectively'
          ];
          features.forEach(feature => {
            const li = document.createElement('li');
            li.className = 'mb-2';
            li.innerHTML = `<i class="bi bi-check-circle-fill text-primary me-2"></i>${feature}`;
            list.appendChild(li);
          });
        } else if (cardType.includes('Startup')) {
          heading.textContent = 'Essential for Startup Founders who want to:';
          features = [
            'Launch products faster',
            'Validate ideas with clear timelines',
            'Coordinate small but mighty teams',
            'Pitch with professional roadmaps',
            'Scale planning as they grow'
          ];
          features.forEach(feature => {
            const li = document.createElement('li');
            li.className = 'mb-2';
            li.innerHTML = `<i class="bi bi-check-circle-fill text-success me-2"></i>${feature}`;
            list.appendChild(li);
          });
        } else if (cardType.includes('Agile')) {
          heading.textContent = 'Built for Agile Teams that need to:';
          features = [
            'Sprint planning and tracking',
            'Kanban workflow management',
            'Real-time collaboration',
            'Backlog prioritization',
            'Retrospective insights'
          ];
          features.forEach(feature => {
            const li = document.createElement('li');
            li.className = 'mb-2';
            li.innerHTML = `<i class="bi bi-check-circle-fill text-warning me-2"></i>${feature}`;
            list.appendChild(li);
          });
        } else if (cardType.includes('Project')) {
          heading.textContent = 'Designed for Project Leads who must:';
          features = [
            'Coordinate cross-functional teams',
            'Report progress to executives',
            'Manage multiple project timelines',
            'Share updates with stakeholders',
            'Export professional reports'
          ];
          features.forEach(feature => {
            const li = document.createElement('li');
            li.className = 'mb-2';
            li.innerHTML = `<i class="bi bi-check-circle-fill text-info me-2"></i>${feature}`;
            list.appendChild(li);
          });
        }
        
        detailsDiv.appendChild(heading);
        detailsDiv.appendChild(list);
      
      expandableContent.appendChild(detailsDiv);
      button.parentNode.appendChild(expandableContent);
      
      // Add multiple event listeners to catch all scenarios
      const clickHandler = function(e) {
        console.log('CLICK DETECTED on button for card:', card.getAttribute('data-card'));
        console.log('Event type:', e.type);
        console.log('Target:', e.target.tagName, e.target.className);
        
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        const cardId = card.getAttribute('data-card');
        console.log('Button clicked for card:', cardId);
        console.log('About to call toggleCard...');
        
        // Call toggleCard with a slight delay to ensure DOM is ready
        setTimeout(() => {
          toggleCard(cardId, e);
          console.log('toggleCard call completed');
        }, 10);
        
        return false;
      };
      
      button.addEventListener('click', clickHandler, true);
      
      // Also add click handler to the card body to catch delegated events
      const cardBody = card.querySelector('.card-body');
      if (cardBody) {
        cardBody.addEventListener('click', function(e) {
          if (e.target.closest('.btn')) {
            console.log('Card body click detected, delegating to button handler');
            clickHandler(e);
          }
        }, true);
      }
      
      console.log('Added click listener to button for:', card.getAttribute('data-card'));
    }
  });
  
  // EMERGENCY: Global click interceptor for the entire "Who It's For" section
  const whoSectionForClicks = document.querySelector('#who');
  if (whoSectionForClicks) {
    console.log('Adding global click interceptor to who section');
    whoSectionForClicks.addEventListener('click', function(e) {
      console.log('GLOBAL CLICK INTERCEPTOR - Element clicked:', e.target.tagName, e.target.className);
      console.log('Click target outerHTML:', e.target.outerHTML.substring(0, 100));
      
      // Check if this is a button, link, or stretched-link click
      const clickedElement = e.target.closest('a, button');
      console.log('Clicked element:', clickedElement);
      console.log('Clicked element classes:', clickedElement ? clickedElement.className : 'none');
      
      const isButton = clickedElement && clickedElement.classList.contains('btn');
      const isStretchedLink = clickedElement && clickedElement.classList.contains('stretched-link');
      const isInWhoCard = e.target.closest('.who-card, .card');
      
      console.log('Button type detection:', {
        isButton,
        isStretchedLink,
        isInWhoCard: !!isInWhoCard
      });
      
      if ((isButton || isStretchedLink || isInWhoCard) && isInWhoCard) {
        console.log('INTERCEPTED click - Button:', isButton, 'StretchedLink:', isStretchedLink, 'InCard:', !!isInWhoCard);
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        const card = e.target.closest('.who-card, .card');
        if (card) {
          const cardTitle = card.querySelector('.card-title');
          if (cardTitle) {
            const title = cardTitle.textContent.toLowerCase().replace(/\s+/g, '-');
            console.log('EMERGENCY TOGGLE for card:', title);
            
            // If no data-card attribute, add it
            if (!card.getAttribute('data-card')) {
              card.setAttribute('data-card', title);
              card.classList.add('expandable-card');
              
              // Remove the stretched link since we're making it expandable
              const stretchedLink = card.querySelector('.stretched-link');
              if (stretchedLink) {
                stretchedLink.remove();
                console.log('Removed stretched-link to prevent conflicts');
              }
              
              // Create expandable content if it doesn't exist
              let expandableContent = card.querySelector('.expanded-content');
              if (!expandableContent) {
                expandableContent = document.createElement('div');
                expandableContent.className = 'expanded-content';
                expandableContent.id = `content-${title}`;
                
                // Generate content based on card type
                const cardType = cardTitle.textContent;
                let contentHTML = '';
                
                if (cardType.includes('Product Managers')) {
                  // Create content using DOM methods instead of innerHTML for better reliability
                  expandableContent.innerHTML = '';
                  
                  const detailsDiv = document.createElement('div');
                  detailsDiv.className = 'expanded-details mt-3 p-3 bg-light rounded';
                  
                  const heading = document.createElement('h6');
                  heading.className = 'fw-bold mb-3';
                  heading.textContent = 'Perfect for Product Managers who need to:';
                  detailsDiv.appendChild(heading);
                  
                  const list = document.createElement('ul');
                  list.className = 'list-unstyled text-start small';
                  
                  const features = [
                    'Create comprehensive product roadmaps',
                    'Align stakeholders on priorities', 
                    'Track feature development progress',
                    'Manage release planning',
                    'Communicate strategy effectively'
                  ];
                  
                  features.forEach(feature => {
                    const li = document.createElement('li');
                    li.className = 'mb-2';
                    li.innerHTML = `<i class="bi bi-check-circle-fill text-primary me-2"></i>${feature}`;
                    list.appendChild(li);
                  });
                  
                  detailsDiv.appendChild(list);
                  

                  
                  expandableContent.appendChild(detailsDiv);
                  console.log('Created Product Manager content using DOM methods');
                } else if (cardType.includes('Startup')) {
                  expandableContent.innerHTML = '';
                  
                  const detailsDiv = document.createElement('div');
                  detailsDiv.className = 'expanded-details mt-3 p-3 bg-light rounded';
                  
                  const heading = document.createElement('h6');
                  heading.className = 'fw-bold mb-3';
                  heading.textContent = 'Essential for Startup Founders who want to:';
                  detailsDiv.appendChild(heading);
                  
                  const list = document.createElement('ul');
                  list.className = 'list-unstyled text-start small';
                  
                  const features = [
                    'Launch products faster',
                    'Validate ideas with clear timelines',
                    'Coordinate small but mighty teams',
                    'Pitch with professional roadmaps',
                    'Scale planning as they grow'
                  ];
                  
                  features.forEach(feature => {
                    const li = document.createElement('li');
                    li.className = 'mb-2';
                    li.innerHTML = `<i class="bi bi-check-circle-fill text-success me-2"></i>${feature}`;
                    list.appendChild(li);
                  });
                  
                  detailsDiv.appendChild(list);
                  

                  
                  expandableContent.appendChild(detailsDiv);
                  console.log('Created Startup content using DOM methods');
                } else if (cardType.includes('Agile')) {
                  expandableContent.innerHTML = '';
                  
                  const detailsDiv = document.createElement('div');
                  detailsDiv.className = 'expanded-details mt-3 p-3 bg-light rounded';
                  
                  const heading = document.createElement('h6');
                  heading.className = 'fw-bold mb-3';
                  heading.textContent = 'Built for Agile Teams that need to:';
                  detailsDiv.appendChild(heading);
                  
                  const list = document.createElement('ul');
                  list.className = 'list-unstyled text-start small';
                  
                  const features = [
                    'Sprint planning and tracking',
                    'Kanban workflow management',
                    'Real-time collaboration',
                    'Backlog prioritization',
                    'Retrospective insights'
                  ];
                  
                  features.forEach(feature => {
                    const li = document.createElement('li');
                    li.className = 'mb-2';
                    li.innerHTML = `<i class="bi bi-check-circle-fill text-warning me-2"></i>${feature}`;
                    list.appendChild(li);
                  });
                  
                  detailsDiv.appendChild(list);
                  

                  
                  expandableContent.appendChild(detailsDiv);
                  console.log('Created Agile content using DOM methods');
                } else if (cardType.includes('Project')) {
                  expandableContent.innerHTML = '';
                  
                  const detailsDiv = document.createElement('div');
                  detailsDiv.className = 'expanded-details mt-3 p-3 bg-light rounded';
                  
                  const heading = document.createElement('h6');
                  heading.className = 'fw-bold mb-3';
                  heading.textContent = 'Designed for Project Leads who must:';
                  detailsDiv.appendChild(heading);
                  
                  const list = document.createElement('ul');
                  list.className = 'list-unstyled text-start small';
                  
                  const features = [
                    'Coordinate cross-functional teams',
                    'Report progress to executives',
                    'Manage multiple project timelines',
                    'Share updates with stakeholders',
                    'Export professional reports'
                  ];
                  
                  features.forEach(feature => {
                    const li = document.createElement('li');
                    li.className = 'mb-2';
                    li.innerHTML = `<i class="bi bi-check-circle-fill text-info me-2"></i>${feature}`;
                    list.appendChild(li);
                  });
                  
                  detailsDiv.appendChild(list);
                  

                  
                  expandableContent.appendChild(detailsDiv);
                  console.log('Created Project content using DOM methods');
                }
                
                card.querySelector('.card-body').appendChild(expandableContent);
                console.log('Created expandable content dynamically using DOM methods');
                

              }
            }
            
            toggleCard(title, e);
          }
        }
        
        return false;
      }
    }, true);
  }
});

// Toggle card expansion functionality
function toggleCard(cardId, event) {
  console.log('toggleCard called with cardId:', cardId);
  
  // Prevent any default behavior
  if (event) {
    console.log('Preventing default event behavior');
    event.preventDefault();
    event.stopPropagation();
  }
  
  const card = document.querySelector(`[data-card="${cardId}"]`);
  const content = document.getElementById(`content-${cardId}`);
  const button = card ? card.querySelector('.learn-more-btn') : null;
  const buttonText = button ? button.querySelector('.btn-text') : null;
  const expandIcon = button ? button.querySelector('.expand-icon') : null;
  
  console.log('Elements found:', {
    card: !!card,
    content: !!content,
    button: !!button,
    buttonText: !!buttonText,
    expandIcon: !!expandIcon
  });
  
  // Safety check
  if (!card || !content || !button || !buttonText || !expandIcon) {
    console.error('Could not find required elements for card:', cardId);
    console.error('Missing elements:', {
      card: !card,
      content: !content,
      button: !button,
      buttonText: !buttonText,
      expandIcon: !expandIcon
    });
    return false;
  }
  
  // Close any other expanded cards first
  const allCards = document.querySelectorAll('.expandable-card');
  allCards.forEach(otherCard => {
    if (otherCard !== card && otherCard.classList.contains('expanded')) {
      const otherCardId = otherCard.getAttribute('data-card');
      const otherContent = document.getElementById(`content-${otherCardId}`);
      const otherButton = otherCard.querySelector('.learn-more-btn');
      const otherButtonText = otherButton.querySelector('.btn-text');
      const otherExpandIcon = otherButton.querySelector('.expand-icon');
      
      otherCard.classList.remove('expanded');
      otherContent.classList.remove('show');
      otherButtonText.textContent = 'Learn More';
      otherExpandIcon.style.transform = 'rotate(0deg)';
    }
  });
  
  // Toggle current card
  if (card.classList.contains('expanded')) {
    // Collapse
    card.classList.remove('expanded');
    content.classList.remove('show');
    buttonText.textContent = 'Learn More';
    expandIcon.style.transform = 'rotate(0deg)';
  } else {
    // Expand
    card.classList.add('expanded');
    content.classList.add('show');
    buttonText.textContent = 'Show Less';
    expandIcon.style.transform = 'rotate(180deg)';
    
    // Smooth scroll to card if it's not fully visible
    setTimeout(() => {
      const cardRect = card.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      
      if (cardRect.bottom > windowHeight || cardRect.top < 100) {
        card.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
      }
    }, 200);
  }
  
  return false;
}

// Close expanded cards when clicking outside
document.addEventListener('click', function(event) {
  const clickedCard = event.target.closest('.expandable-card');
  const clickedButton = event.target.closest('.learn-more-btn');
  
  // If click is outside any card or not on a learn more button
  if (!clickedCard && !clickedButton) {
    const allCards = document.querySelectorAll('.expandable-card.expanded');
    allCards.forEach(card => {
      const cardId = card.getAttribute('data-card');
      const content = document.getElementById(`content-${cardId}`);
      const button = card.querySelector('.learn-more-btn');
      const buttonText = button.querySelector('.btn-text');
      const expandIcon = button.querySelector('.expand-icon');
      
      card.classList.remove('expanded');
      content.classList.remove('show');
      buttonText.textContent = 'Learn More';
      expandIcon.style.transform = 'rotate(0deg)';
    });
  }
}); 