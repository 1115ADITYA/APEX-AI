// ==========================================
// SUPABASE CONFIGURATION
// ==========================================

let supabaseClient = null;
let supabaseReady = null; // Promise that resolves when Supabase is initialized

function initSupabase() {
    supabaseReady = new Promise(async (resolve) => {
        // Option 1: Use local config.js (for Live Server / local dev)
        if (window.APEX_CONFIG && window.APEX_CONFIG.SUPABASE_URL && window.APEX_CONFIG.SUPABASE_URL !== 'https://your-project.supabase.co') {
            try {
                supabaseClient = window.supabase.createClient(window.APEX_CONFIG.SUPABASE_URL, window.APEX_CONFIG.SUPABASE_ANON_KEY);
                console.log("Supabase initialized from config.js");
                resolve(true);
                return;
            } catch (e) {
                console.warn("Failed to init Supabase from config.js", e);
            }
        }

        // Option 2: Fetch from /api/env (Vercel deployment)
        try {
            const response = await fetch('/api/env');
            if (response.ok) {
                const config = await response.json();
                if (config.SUPABASE_URL && config.SUPABASE_ANON_KEY) {
                    supabaseClient = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
                    console.log("Supabase initialized from /api/env");
                    resolve(true);
                    return;
                }
            }
        } catch (e) {
            console.warn("Could not reach /api/env, trying direct init...", e);
        }

        // Option 3: Direct initialization (anon key is public by design)
        try {
            const url = 'https://mhxmxqfpotvjkfmmjjkr.supabase.co';
            const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oeG14cWZwb3R2amtmbW1qamtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1NzczNzYsImV4cCI6MjA5NzE1MzM3Nn0.IEwHWc5gpgf3wDG3e-1gju-bibkJFQvGQbDgXmbka_s';
            supabaseClient = window.supabase.createClient(url, key);
            console.log("Supabase initialized directly");
            resolve(true);
            return;
        } catch (e) {
            console.error("All Supabase init methods failed", e);
        }

        resolve(false);
    });
}

// Helper: wait for Supabase to be ready before any auth action
async function getSupabase() {
    await supabaseReady;
    if (!supabaseClient) {
        throw new Error('Supabase could not be initialized. Check your credentials.');
    }
    return supabaseClient;
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
            const sb = await getSupabase();

            // Send OTP to email using Supabase magic link / OTP
            const { data, error } = await sb.auth.signInWithOtp({
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
            const sb = await getSupabase();

            const { data, error } = await sb.auth.verifyOtp({
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
            const sb = await getSupabase();

            // Update the user's password (user is already logged in after OTP verify)
            const { data, error } = await sb.auth.updateUser({
                password: password
            });

            if (error) throw error;

            // Get the session for JWT
            const { data: sessionData } = await sb.auth.getSession();
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
            const sb = await getSupabase();

            const { data, error } = await sb.auth.signInWithPassword({
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

// Initialize Supabase immediately
initSupabase();
