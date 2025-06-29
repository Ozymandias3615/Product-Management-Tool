// Backend authentication with optional Google integration
const form = document.getElementById('authForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const errorMsg = document.getElementById('errorMsg');
const submitBtn = document.getElementById('submitBtn');
const toggleMode = document.getElementById('toggleMode');
const formTitle = document.getElementById('formTitle');
const toggleText = document.getElementById('toggleText');
const googleBtn = document.getElementById('googleBtn');

let isSignup = false;

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.classList.remove('d-none');
}
function clearError() {
  errorMsg.textContent = '';
  errorMsg.classList.add('d-none');
}

function showLoading(show) {
  submitBtn.disabled = show;
  submitBtn.innerHTML = show ? '<span class="spinner-border spinner-border-sm me-2"></span>Loading...' : (isSignup ? 'Sign Up' : 'Login');
}

toggleMode.addEventListener('click', (e) => {
  e.preventDefault();
  isSignup = !isSignup;
  submitBtn.textContent = isSignup ? 'Sign Up' : 'Login';
  formTitle.textContent = isSignup ? 'Sign Up' : 'Login';
  toggleText.textContent = isSignup ? 'Already have an account?' : "Don't have an account?";
  toggleMode.textContent = isSignup ? 'Login' : 'Sign up';
  clearError();
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError();
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  
  if (!email || !password) {
    showError('Please enter both email and password');
    return;
  }
  
  showLoading(true);
  
  try {
  if (isSignup) {
      // Register new user
      const registerResponse = await fetch('/api/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: email.split('@')[0], // Use email prefix as username
          email: email,
          password: password,
          full_name: email.split('@')[0]
        })
      });
      
      if (!registerResponse.ok) {
        let errorMessage = 'Registration failed';
        try {
          const error = await registerResponse.json();
          errorMessage = error.error || errorMessage;
        } catch (parseError) {
          errorMessage = `Server error (${registerResponse.status}): Unable to process registration`;
        }
        throw new Error(errorMessage);
      }
      
      // Auto-login after successful registration
      const loginResponse = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: email,
          password: password
        })
      });
      
      if (!loginResponse.ok) {
        let errorMessage = 'Login failed after registration';
        try {
          const error = await loginResponse.json();
          errorMessage = error.error || errorMessage;
        } catch (parseError) {
          errorMessage = `Server error (${loginResponse.status}): Unable to login after registration`;
        }
        throw new Error(errorMessage);
      }
      
      // Redirect to roadmaps
      window.location.href = '/roadmaps';
      
  } else {
      // Login existing user
      const loginResponse = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: email,
          password: password
        })
      });
      
      if (!loginResponse.ok) {
        let errorMessage = 'Login failed';
        try {
          const error = await loginResponse.json();
          errorMessage = error.error || errorMessage;
        } catch (parseError) {
          errorMessage = `Server error (${loginResponse.status}): Unable to process login`;
        }
        throw new Error(errorMessage);
      }
      
      // Redirect to roadmaps
      window.location.href = '/roadmaps';
    }
    
  } catch (error) {
    showError(error.message);
  } finally {
    showLoading(false);
  }
});

// Initialize Firebase status check
document.addEventListener('DOMContentLoaded', function() {
  // Check Firebase configuration status
  if (window.emailAuthOnly === true) {
    // Firebase not configured - show info message and disable Google button
    const googleBtn = document.getElementById('googleBtn');
    googleBtn.disabled = true;
    googleBtn.innerHTML = '<span class="text-muted">Google Sign-In (Setup Required)</span>';
    googleBtn.title = 'Firebase not configured. See FIREBASE_SETUP.md for setup instructions.';
    googleBtn.classList.add('disabled');
    
    // Show info message
    const infoDiv = document.createElement('div');
    infoDiv.className = 'alert alert-info mt-2';
    infoDiv.innerHTML = '<small><strong>Note:</strong> Google Sign-In is currently disabled. Email/password authentication is fully functional. <a href="/FIREBASE_SETUP.md" target="_blank">Setup Guide</a></small>';
    googleBtn.parentNode.insertBefore(infoDiv, googleBtn.nextSibling);
  }
});

// Google Sign-In (if Firebase is available)
googleBtn.addEventListener('click', async () => {
  clearError();
  
  // Check if button is disabled (Firebase not configured)
  if (window.emailAuthOnly === true) {
    showError('Google Sign-In requires Firebase configuration. Please use email/password login or see setup guide.');
    return;
  }
  
  try {
    // Check if Firebase is available and properly configured
    if (typeof firebase !== 'undefined' && firebase.auth && window.firebaseConfigured !== false) {
      const provider = new firebase.auth.GoogleAuthProvider();
      const result = await firebase.auth().signInWithPopup(provider);
      const user = result.user;
      
      // Send Google user data to backend
      const response = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          google_user: {
            email: user.email,
            full_name: user.displayName,
            google_id: user.uid,
            avatar_url: user.photoURL && user.photoURL.trim() !== '' ? user.photoURL : null
          }
        })
      });
      
      if (!response.ok) {
        let errorMessage = 'Google login failed';
        try {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } catch (parseError) {
          // If response is not JSON (e.g., HTML error page), get text instead
          try {
            const errorText = await response.text();
            console.error('Non-JSON error response:', errorText);
            errorMessage = `Server error (${response.status}): Unable to process Google login`;
          } catch (textError) {
            errorMessage = `Server error (${response.status}): Connection failed`;
          }
        }
        throw new Error(errorMessage);
      }
      
      // Redirect to roadmaps
      window.location.href = '/roadmaps';
      
    } else {
      showError('Google Sign-In is not available. Please use email/password login.');
    }
    
  } catch (error) {
    showError('Google Sign-In failed: ' + error.message);
  }
}); 