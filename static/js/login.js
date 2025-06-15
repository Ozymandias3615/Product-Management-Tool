// Email/password and Google login/signup with Firebase
const firebaseAuth = firebase.auth();
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

toggleMode.addEventListener('click', (e) => {
  e.preventDefault();
  isSignup = !isSignup;
  submitBtn.textContent = isSignup ? 'Sign Up' : 'Login';
  formTitle.textContent = isSignup ? 'Sign Up' : 'Login';
  toggleText.textContent = isSignup ? 'Already have an account?' : "Don't have an account?";
  toggleMode.textContent = isSignup ? 'Login' : 'Sign up';
  clearError();
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  clearError();
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  submitBtn.disabled = true;
  if (isSignup) {
    firebaseAuth.createUserWithEmailAndPassword(email, password)
      .then(() => window.location.href = '/roadmaps')
      .catch(err => showError(err.message))
      .finally(() => { submitBtn.disabled = false; });
  } else {
    firebaseAuth.signInWithEmailAndPassword(email, password)
      .then(() => window.location.href = '/roadmaps')
      .catch(err => showError(err.message))
      .finally(() => { submitBtn.disabled = false; });
  }
});

googleBtn.addEventListener('click', () => {
  clearError();
  const provider = new firebase.auth.GoogleAuthProvider();
  firebaseAuth.signInWithPopup(provider)
    .then(() => window.location.href = '/roadmaps')
    .catch(err => showError(err.message));
}); 