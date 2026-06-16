// ==========================================
// SUPABASE CONFIGURATION
// ==========================================

let supabase = null;

function initSupabase() {
    // Option 1: Use local config.js (for Live Server / local dev)
    if (window.APEX_CONFIG && window.APEX_CONFIG.SUPABASE_URL && window.APEX_CONFIG.SUPABASE_URL !== 'https://your-project.supabase.co') {
        try {
            supabase = window.supabase.createClient(window.APEX_CONFIG.SUPABASE_URL, window.APEX_CONFIG.SUPABASE_ANON_KEY);
            console.log("Supabase initialized from config.js");
            return;
        } catch (e) {
            console.warn("Failed to init Supabase from config.js", e);
        }
    }

    // Option 2: Use /api/env route (for Vercel deployment)
    fetch('/api/env')
        .then(response => response.json())
        .then(config => {
            if (config.SUPABASE_URL && config.SUPABASE_ANON_KEY) {
                supabase = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
                console.log("Supabase initialized from /api/env");
            } else {
                console.warn("Supabase credentials missing from /api/env");
            }
        })
        .catch(e => {
            console.warn("Could not reach /api/env. Add your keys to config.js for local dev.", e);
        });
}

// ==========================================
// DOM ELEMENTS
// ==========================================

// Views
const loginView = document.getElementById('login-view');
const signupView = document.getElementById('signup-view');
const verifyView = document.getElementById('verify-view');
const passwordView = document.getElementById('password-view');
const successView = document.getElementById('success-view');

// Forms
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const verifyForm = document.getElementById('verify-form');
const passwordForm = document.getElementById('password-form');

// Navigation
const goToSignup = document.getElementById('go-to-signup');
const goToLogin = document.getElementById('go-to-login');

// Error Box
const authError = document.getElementById('auth-error');

// State
let currentEmail = '';

// ==========================================
// VIEW SWITCHING LOGIC
// ==========================================
function switchView(viewElement) {
    [loginView, signupView, verifyView, passwordView, successView].forEach(v => {
        if (v) v.classList.remove('active');
    });
    if (viewElement) viewElement.classList.add('active');
    if (authError) authError.textContent = '';
}

if (goToSignup) {
    goToSignup.addEventListener('click', (e) => {
        e.preventDefault();
        switchView(signupView);
    });
}

if (goToLogin) {
    goToLogin.addEventListener('click', (e) => {
        e.preventDefault();
        switchView(loginView);
    });
}

function showError(msg) {
    if (authError) authError.textContent = msg;
}

if (window.location.hash === '#signup') {
    switchView(signupView);
}

// ==========================================
// FLOW: Email → OTP → Password → Done
// ==========================================

// Step 1: User enters email only → Supabase sends OTP
if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('signup-email').value;
        const btn = document.getElementById('signup-btn');

        btn.textContent = 'Sending...';
        btn.disabled = true;

        try {
            if (!supabase) throw new Error('Supabase not connected. Please run via Vercel.');

            // Send OTP to email using Supabase magic link / OTP
            const { data, error } = await supabase.auth.signInWithOtp({
                email: email,
            });

            if (error) throw error;

            // Move to OTP verification screen
            currentEmail = email;
            document.getElementById('verify-subtitle').textContent = `We sent a 6-digit code to ${email}.`;
            switchView(verifyView);

        } catch (error) {
            showError(error.message);
        } finally {
            btn.textContent = 'Verify Email';
            btn.disabled = false;
        }
    });
}

// Step 2: User enters OTP → Supabase verifies email
if (verifyForm) {
    verifyForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const code = document.getElementById('verify-code').value;
        const btn = document.getElementById('verify-btn');

        btn.textContent = 'Verifying...';
        btn.disabled = true;

        try {
            if (!supabase) throw new Error('Supabase not connected.');

            const { data, error } = await supabase.auth.verifyOtp({
                email: currentEmail,
                token: code,
                type: 'email'
            });

            if (error) throw error;

            // Email verified! Now let user set their password.
            switchView(passwordView);

        } catch (error) {
            showError(error.message);
        } finally {
            btn.textContent = 'Verify Account';
            btn.disabled = false;
        }
    });
}

// Step 3: User sets password → Supabase updates user
if (passwordForm) {
    passwordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = document.getElementById('set-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        const btn = document.getElementById('password-btn');

        // Check passwords match
        if (password !== confirmPassword) {
            showError('Passwords do not match.');
            return;
        }

        if (password.length < 6) {
            showError('Password must be at least 6 characters.');
            return;
        }

        btn.textContent = 'Creating...';
        btn.disabled = true;

        try {
            if (!supabase) throw new Error('Supabase not connected.');

            // Update the user's password (user is already logged in after OTP verify)
            const { data, error } = await supabase.auth.updateUser({
                password: password
            });

            if (error) throw error;

            // Get the session for JWT
            const { data: sessionData } = await supabase.auth.getSession();
            if (sessionData.session) {
                localStorage.setItem('apex_jwt_token', sessionData.session.access_token);
            }

            // Account fully created!
            switchView(successView);

            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);

        } catch (error) {
            showError(error.message);
        } finally {
            btn.textContent = 'Create Account';
            btn.disabled = false;
        }
    });
}

// ==========================================
// LOGIN (Returning Users)
// ==========================================
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const btn = document.getElementById('login-btn');

        btn.textContent = 'Signing In...';
        btn.disabled = true;

        try {
            if (!supabase) throw new Error('Supabase not connected. Please run via Vercel.');

            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password,
            });

            if (error) throw error;

            localStorage.setItem('apex_jwt_token', data.session.access_token);
            switchView(successView);

            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);

        } catch (error) {
            showError(error.message);
        } finally {
            btn.textContent = 'Sign In';
            btn.disabled = false;
        }
    });
}

// Initialize Supabase in the background
initSupabase();
