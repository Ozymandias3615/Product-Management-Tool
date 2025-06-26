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
        const error = await registerResponse.json();
        throw new Error(error.error || 'Registration failed');
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
        const error = await loginResponse.json();
        throw new Error(error.error || 'Login failed after registration');
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
        const error = await loginResponse.json();
        throw new Error(error.error || 'Login failed');
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

// Google Sign-In (if Firebase is available)
googleBtn.addEventListener('click', async () => {
  clearError();
  
  try {
    // Check if Firebase is available
    if (typeof firebase !== 'undefined' && firebase.auth) {
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
        const error = await response.json();
        throw new Error(error.error || 'Google login failed');
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