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