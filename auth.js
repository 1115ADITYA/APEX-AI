// ==========================================
// SUPABASE CONFIGURATION
// ==========================================

let supabaseClient = null;
let supabaseReady = null;

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

// Helper: wait for Supabase to be ready
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

const loginView = document.getElementById('login-view');
const signupView = document.getElementById('signup-view');
const verifyView = document.getElementById('verify-view');
const successView = document.getElementById('success-view');

const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');

const goToSignup = document.getElementById('go-to-signup');
const goToLogin = document.getElementById('go-to-login');
const backToLoginBtn = document.getElementById('back-to-login-btn');

const authError = document.getElementById('auth-error');

let currentEmail = '';

// ==========================================
// VIEW SWITCHING
// ==========================================
function switchView(viewElement) {
    [loginView, signupView, verifyView, successView].forEach(v => {
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

if (backToLoginBtn) {
    backToLoginBtn.addEventListener('click', () => {
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
// CHECK FOR AUTH REDIRECT (from email confirmation link)
// ==========================================

async function checkOnboardingAndRedirect(session) {
    try {
        const sb = await getSupabase();
        const { data, error } = await sb
            .from('user_profiles')
            .select('onboardingCompleted')
            .eq('userId', session.user.id)
            .single();

        if (data && data.onboardingCompleted) {
            window.location.href = 'dashboard.html';
            return;
        }
    } catch (e) {
        console.error("Error checking onboarding status", e);
    }
    window.location.href = 'onboarding.html';
}

async function handleAuthRedirect() {
    try {
        const sb = await getSupabase();

        // Check if we have a session (user just confirmed email via link)
        const { data: { session } } = await sb.auth.getSession();

        if (session) {
            localStorage.setItem('apex_jwt_token', session.access_token);
            switchView(successView);
            setTimeout(() => {
                checkOnboardingAndRedirect(session);
            }, 2000);
            return true;
        }
    } catch (e) {
        console.error("No active session on load", e);
    }
    return false;
}

// ==========================================
// SIGNUP: Email + Password → Confirmation Email
// ==========================================
if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const confirmPassword = document.getElementById('signup-confirm-password').value;
        const btn = document.getElementById('signup-btn');

        // Validate passwords
        if (password !== confirmPassword) {
            showError('Passwords do not match.');
            return;
        }

        if (password.length < 6) {
            showError('Password must be at least 6 characters.');
            return;
        }

        btn.textContent = 'Creating Account...';
        btn.disabled = true;

        try {
            const sb = await getSupabase();

            const { data, error } = await sb.auth.signUp({
                email: email,
                password: password,
            });

            if (error) throw error;

            if (data.session) {
                // Email confirmation is turned OFF, logged in automatically!
                localStorage.setItem('apex_jwt_token', data.session.access_token);
                switchView(successView);
                setTimeout(() => {
                    checkOnboardingAndRedirect(data.session);
                }, 2000);
            } else {
                // Email confirmation is ON, show verify view
                currentEmail = email;
                document.getElementById('verify-subtitle').textContent =
                    `We sent a confirmation link to ${email}. Click it to verify your account.`;
                switchView(verifyView);
            }

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
                checkOnboardingAndRedirect(data.session);
            }, 2000);

        } catch (error) {
            showError(error.message);
        } finally {
            btn.textContent = 'Sign In';
            btn.disabled = false;
        }
    });
}

// ==========================================
// INIT
// ==========================================
initSupabase();

// Check if user just came back from email confirmation link
handleAuthRedirect();
