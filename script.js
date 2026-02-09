// Test Firebase connection




let currentView = sessionStorage.getItem('currentView') || 'feed';

// Prevent ReferenceErrors by declaring these at top level
let isDashboard = null;
let isLanding = null;

const QUIZ_API_KEY = 'oYhKWwpXzJuK74ZHlXvZKVB9Enx6EJHKSW1mox2r';
let currentQuizData = [];
let userScore = 0;
let currentQIndex = 0;
let timerInterval;
let selectedValue = null;
let mockResultsLog = [];

// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyAK5s-C66ef0jjegHPNcADQDbB5UVL9s9E",
    authDomain: "earlyedge-f7ce1.firebaseapp.com",
    projectId: "earlyedge-f7ce1",
    storageBucket: "earlyedge-f7ce1.firebasestorage.app",
    messagingSenderId: "4402320255",
    appId: "1:4402320255:web:7af14f13ab5c0086c3404a"
};

const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// --- STATE MANAGEMENT ---
const State = {
    currentUser: null,
    liveJobs: [],
    liveSquads: [],
    myApplications: []
};

// REMOVED PREMATURE AUTH LISTENER
// The main listener is now consolidated inside DOMContentLoaded to ensure
// DOM elements (isDashboard context) are ready before execution.


// Update the Firebase initialization to include storage
const storage = firebase.storage();


// ========================
// RESUME UPLOAD FUNCTIONS
// ========================

let userResumeData = null;

// Load user's resume data
// Load user's resume data - FIXED TO ONLY LOAD CURRENT USER'S RESUME
function loadUserResume() {
    if (!State.currentUser || !State.currentUser.uid) return;

    // Correctly fetch from user_resumes collection
    db.collection("user_resumes").doc(State.currentUser.uid).onSnapshot((doc) => {
        if (doc.exists) {
            userResumeData = doc.data();
            console.log("Resume loaded for user:", State.currentUser.uid);
        } else {
            userResumeData = null;
        }
        updateResumeUI();
    }, (error) => {
        console.error("Error loading resume:", error);
    });
}

// Handle resume file upload
// Simplified version without actual file storage
/// Handle resume file upload - FIXED VERSION WITH USER CHECK
// Handle resume file upload
function handleResumeUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Check if user is logged in
    if (!State.currentUser || !State.currentUser.uid) {
        alert("Please login to upload resume");
        return;
    }

    // Validate file size (Max 500KB for Firestore limit safety)
    if (file.size > 500 * 1024) {
        alert("File size too large. Maximum size is 500KB for this demo.");
        document.getElementById('resume-upload').value = '';
        return;
    }

    // Validate file type
    const allowedTypes = ['application/pdf', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'];
    if (!allowedTypes.includes(file.type)) {
        alert("Please upload a PDF, DOC, DOCX, or TXT file.");
        document.getElementById('resume-upload').value = '';
        return;
    }

    // Show uploading status
    const messageEl = document.getElementById('resume-message');
    if (messageEl) {
        messageEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Uploading resume...';
    }

    // Read file as Data URL
    const reader = new FileReader();
    reader.onload = function (e) {
        const dataUrl = e.target.result;

        // Store metadata and DATA ONLY for current user
        userResumeData = {
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            uploadedAt: Date.now(),
            userId: State.currentUser.uid, // Store user ID
            userName: State.currentUser.name,
            userEmail: State.currentUser.email,
            resumeData: dataUrl // Store the actual file data
        };

        // Save to Firestore - ONLY in the current user's document
        db.collection("user_resumes").doc(State.currentUser.uid).set(userResumeData, { merge: true })
            .then(() => {
                updateResumeUI();

                if (messageEl) {
                    messageEl.textContent = "Resume uploaded successfully!";
                    setTimeout(() => {
                        messageEl.textContent = "Resume uploaded:";
                    }, 2000);
                }

                console.log("Resume saved for user:", State.currentUser.uid);
            })
            .catch((error) => {
                console.error("Upload error:", error);
                alert("Error saving resume: " + error.message);

                if (messageEl) {
                    messageEl.textContent = "Upload failed. Please try again.";
                }
            });
    };
    reader.onerror = function (error) {
        console.error("Error reading file:", error);
        alert("Error reading file");
    };
    reader.readAsDataURL(file);

    // Reset file input
    event.target.value = '';
}

function viewMyResume() {
    if (!userResumeData) {
        alert("No resume found");
        return;
    }

    // Since we're not actually storing files, show a preview of the metadata
    const resumeInfo = `
        Resume Details:
        -----------------
        File Name: ${userResumeData.fileName}
        File Size: ${Math.round(userResumeData.fileSize / 1024)} KB
        File Type: ${userResumeData.fileType}
        Uploaded: ${new Date(userResumeData.uploadedAt).toLocaleString()}
        
        Note: In a full implementation, this would open the actual file.
        Currently we're only storing metadata for demonstration.
    `;

    alert(resumeInfo);
}

// Upload resume to Firebase Storage
function uploadResumeToStorage(file) {
    if (!State.currentUser || !State.currentUser.uid) {
        alert("Please login to upload resume");
        return;
    }

    // Show uploading status
    const messageEl = document.getElementById('resume-message');
    if (messageEl) {
        messageEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Uploading resume...';
    }

    // Create a storage reference
    const storageRef = storage.ref();
    const resumeRef = storageRef.child(`resumes/${State.currentUser.uid}/${file.name}`);

    // Upload file
    resumeRef.put(file).then((snapshot) => {
        // Get download URL
        return snapshot.ref.getDownloadURL();
    }).then((downloadURL) => {
        // Save resume metadata to Firestore
        return db.collection("user_resumes").doc(State.currentUser.uid).set({
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            downloadURL: downloadURL,
            uploadedAt: Date.now(),
            userId: State.currentUser.uid,
            userName: State.currentUser.name,
            userEmail: State.currentUser.email
        }, { merge: true });
    }).then(() => {
        // Load updated resume data
        loadUserResume();
        alert("Resume uploaded successfully!");
    }).catch((error) => {
        console.error("Upload error:", error);
        alert("Error uploading resume: " + error.message);

        // Reset status
        const messageEl = document.getElementById('resume-message');
        if (messageEl) {
            messageEl.textContent = "Upload failed. Please try again.";
        }
    });

    // Reset file input
    event.target.value = '';
}

// Update resume UI
function updateResumeUI() {
    const statusEl = document.getElementById('resume-status');
    const messageEl = document.getElementById('resume-message');
    const fileNameEl = document.getElementById('resume-file-name');
    const uploadDateEl = document.getElementById('resume-upload-date');
    const viewBtn = document.getElementById('view-resume-btn');
    const deleteBtn = document.getElementById('delete-resume-btn');

    if (!userResumeData) {
        if (messageEl) messageEl.textContent = "No resume uploaded yet.";
        if (fileNameEl) fileNameEl.style.display = 'none';
        if (uploadDateEl) uploadDateEl.style.display = 'none';
        if (viewBtn) viewBtn.style.display = 'none';
        if (deleteBtn) deleteBtn.style.display = 'none';
        return;
    }

    // Update UI with resume data
    if (messageEl) messageEl.textContent = "Resume uploaded:";
    if (fileNameEl) {
        fileNameEl.textContent = userResumeData.fileName;
        fileNameEl.style.display = 'block';
    }
    if (uploadDateEl) {
        uploadDateEl.textContent = "Uploaded: " + new Date(userResumeData.uploadedAt).toLocaleDateString();
        uploadDateEl.style.display = 'block';
    }
    if (viewBtn) viewBtn.style.display = 'inline-flex';
    if (deleteBtn) deleteBtn.style.display = 'inline-flex';
}

// View own resume
function viewMyResume() {
    if (!userResumeData || !userResumeData.resumeData) {
        alert("No resume found or data missing.");
        return;
    }

    // Open Data URL
    const win = window.open();
    if (win) {
        win.document.write(
            '<iframe src="' + userResumeData.resumeData + '" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>'
        );
        win.document.title = "View Resume - " + userResumeData.fileName;
    } else {
        alert("Please allow popups to view the resume.");
    }
}

// Delete resume
// Delete resume - FIXED TO ONLY DELETE CURRENT USER'S RESUME
function deleteResume() {
    if (!confirm("Are you sure you want to delete your resume?")) return;

    if (!State.currentUser || !State.currentUser.uid) return;

    // Show deleting status
    const messageEl = document.getElementById('resume-message');
    if (messageEl) {
        messageEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Deleting resume...';
    }

    // ONLY delete the current user's resume
    db.collection("user_resumes").doc(State.currentUser.uid).delete()
        .then(() => {
            userResumeData = null;
            updateResumeUI();

            // Update the resume status message
            if (messageEl) {
                messageEl.textContent = "Resume deleted successfully.";
                setTimeout(() => {
                    messageEl.textContent = "No resume uploaded yet.";
                }, 2000);
            }

            console.log("Resume deleted for user:", State.currentUser.uid);
        })
        .catch((error) => {
            console.error("Delete error:", error);
            alert("Error deleting resume: " + error.message);

            // Reset status
            if (messageEl) {
                messageEl.textContent = "Error deleting resume. Please try again.";
            }
        });
}

// Function to increment job views when someone applies
// Function to increment job views when someone applies
function incrementJobViews(jobId) {
    // Delegate to the main tracking function which ensures uniqueness per account
    trackJobView(jobId);
}

// Update the applyForJob function to include resume in application
function applyForJob(jobId, jobTitle, jobCompany) {
    // FIRST CONFIRM: Apply for job?
    if (!confirm(`Apply for ${jobTitle} at ${jobCompany}?`)) {
        console.log("User cancelled job application");
        return; // User cancelled at first step
    }

    // Check if user has uploaded a resume
    if (!userResumeData) {
        // SECOND CONFIRM: Upload resume? with clearer options
        const resumeMessage = `You haven't uploaded a resume. 
        
Click OK to go upload a resume first.`;

        const userChoice = confirm(resumeMessage);

        if (userChoice === true) {
            // User wants to upload resume first
            console.log("User wants to upload resume first");

            // Switch to profile view
            switchView('profile');

            // Scroll to resume section
            setTimeout(() => {
                const resumeSection = document.getElementById('resume-section');
                if (resumeSection) {
                    resumeSection.scrollIntoView({ behavior: 'smooth' });
                    // Highlight the section
                    resumeSection.style.border = "2px solid var(--primary)";
                    resumeSection.style.boxShadow = "0 0 20px var(--primary-glow)";

                    // Show a message
                    const messageDiv = document.createElement('div');
                    messageDiv.innerHTML = `
                        <div style="background: var(--primary-glow); color: var(--primary); 
                             padding: 1rem; border-radius: 8px; margin-bottom: 1rem; font-weight: bold;">
                            <i class="fa-solid fa-arrow-up-from-bracket"></i> 
                            Upload your resume here, then apply again
                        </div>
                    `;
                    resumeSection.insertBefore(messageDiv, resumeSection.firstChild);

                    // Remove highlight after 5 seconds
                    setTimeout(() => {
                        resumeSection.style.border = "";
                        resumeSection.style.boxShadow = "";
                        if (messageDiv.parentNode) {
                            messageDiv.parentNode.removeChild(messageDiv);
                        }
                    }, 5000);
                }
            }, 500);

            alert("Switching to profile page. Upload your resume, then apply again.");
            return; // Stop the application process
        } else {
            // User clicked Cancel - they want to apply WITHOUT resume
            console.log("User chose to apply without resume");
            // Continue to application without resume
        }
    }

    // If we reach here, user either has a resume OR chose to apply without one
    const applicationData = {
        jobId: jobId,
        jobTitle: jobTitle,
        company: jobCompany,
        studentId: State.currentUser.uid,
        studentName: State.currentUser.name,
        studentEmail: State.currentUser.email,
        appliedAt: Date.now(),
        hasResume: !!userResumeData,
        // We don't store the full resume URL/Data here to keep the application document light.
        // The resume is fetched on-demand from user_resumes collection.
        resumeURL: null,
        resumeFileName: userResumeData ? userResumeData.fileName : null
    };

    db.collection("applications").add(applicationData)
        .then(() => {
            // INCREMENT JOB VIEWS WHEN SOMEONE APPLIES
            incrementJobViews(jobId);

            alert("✅ Application sent successfully!");
        }).catch(err => alert("Error applying: " + err.message));
}

// Update the viewApplicants function to show management options
function viewApplicants(jobId, jobTitle) {
    const modal = document.getElementById('applicants-modal');
    const list = document.getElementById('applicants-list');
    const title = document.getElementById('applicants-modal-title');

    modal.style.display = 'flex';
    title.innerText = `Applicants for "${jobTitle}"`;
    list.innerHTML = '<div style="text-align:center; padding:2rem;"><i class="fa-solid fa-spinner fa-spin"></i> Loading applicants...</div>';

    db.collection("applications").where("jobId", "==", jobId).get()
        .then((querySnapshot) => {
            list.innerHTML = '';

            if (querySnapshot.empty) {
                list.innerHTML = `
                    <div style="text-align:center; padding:3rem; color:var(--text-muted);">
                        <i class="fa-solid fa-users-slash" style="font-size:3rem; margin-bottom:1rem;"></i>
                        <p>No applicants yet.</p>
                    </div>`;
                return;
            }

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                const appId = doc.id;
                const status = data.status || 'pending';

                // Skip rejected applications if you want them hidden, 
                // but usually "Remove" implies moving them to a "Rejected" state that can be viewed later.
                // For now we will just show them with a rejected style or badge.

                const item = document.createElement('div');
                item.className = 'glass-card';
                item.style.marginBottom = '1rem';

                // Dim rejected items
                if (status === 'rejected') {
                    item.style.opacity = '0.6';
                    item.style.border = '1px solid var(--error)';
                } else if (status === 'shortlisted') {
                    item.style.border = '1px solid var(--success)';
                    item.style.background = 'rgba(16, 185, 129, 0.05)';
                }

                let statusBadge = '';
                if (status === 'shortlisted') {
                    statusBadge = `<span class="badge" style="background:var(--success); color:white; margin-left:0.5rem;"><i class="fa-solid fa-check"></i> Kept</span>`;
                } else if (status === 'rejected') {
                    statusBadge = `<span class="badge" style="background:var(--error); color:white; margin-left:0.5rem;"><i class="fa-solid fa-xmark"></i> Removed</span>`;
                }

                item.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:start;">
                        <div style="flex: 1;">
                            <h4 style="margin-bottom:0.5rem; color:var(--text-main);">
                                ${data.studentName}
                                ${statusBadge}
                            </h4>
                            <p style="color:var(--text-muted); margin-bottom:0.5rem;">
                                <i class="fa-solid fa-envelope"></i> ${data.studentEmail}
                            </p>
                            <p style="color:var(--text-muted); font-size:0.85rem;">
                                <i class="fa-solid fa-clock"></i> Applied ${timeAgoShort(data.appliedAt)}
                                ${data.resumeFileName ? `<br><i class="fa-solid fa-file"></i> ${data.resumeFileName}` : ''}
                            </p>
                            
                            <!-- Management Buttons -->
                            <div style="margin-top: 1rem; display: flex; gap: 0.5rem;">
                                ${status !== 'shortlisted' ? `
                                    <button class="btn btn-sm" onclick="updateApplicationStatus('${appId}', 'shortlisted', '${jobId}', '${jobTitle}')"
                                        style="background:rgba(16, 185, 129, 0.2); color:var(--success); border:1px solid var(--success); font-size:0.8rem; padding:0.4rem 0.8rem;">
                                        <i class="fa-solid fa-check"></i> Keep
                                    </button>
                                ` : ''}
                                
                                ${status !== 'rejected' ? `
                                    <button class="btn btn-sm" onclick="updateApplicationStatus('${appId}', 'rejected', '${jobId}', '${jobTitle}')"
                                        style="background:rgba(239, 68, 68, 0.2); color:var(--error); border:1px solid var(--error); font-size:0.8rem; padding:0.4rem 0.8rem;">
                                        <i class="fa-solid fa-trash"></i> Remove
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-left: 1rem;">
                            <button class="btn btn-glass" style="font-size:0.85rem;" 
                                onclick="viewStudentProfile('${data.studentId}')">
                                <i class="fa-solid fa-eye"></i> View Profile
                            </button>
                            <button class="btn btn-primary" style="font-size:0.85rem;" 
                                onclick="viewStudentResume('${data.studentId}')">
                                <i class="fa-solid fa-eye"></i> View Resume
                            </button>
                        </div>
                    </div>
                `;
                list.appendChild(item);
            });
        })
        .catch((error) => {
            list.innerHTML = `
                <div style="text-align:center; padding:2rem; color:var(--error);">
                    <i class="fa-solid fa-exclamation-circle"></i>
                    <p>Error loading applicants: ${error.message}</p>
                </div>`;
        });
}

function updateApplicationStatus(appId, status, jobId, jobTitle) {
    const action = status === 'shortlisted' ? 'Keep' : 'Remove';
    if (!confirm(`Are you sure you want to ${action} this applicant?`)) return;

    db.collection("applications").doc(appId).update({
        status: status,
        updatedAt: Date.now()
    }).then(() => {
        // Refresh the list to show changes
        viewApplicants(jobId, jobTitle);
    }).catch(error => {
        console.error("Error updating status:", error);
        alert("Error: " + error.message);
    });
}

function viewStudentResume(studentId) {
    if (!studentId) return;

    // Show loading mechanism (maybe a toast or just alert)
    const originalText = document.activeElement ? document.activeElement.innerHTML : '';
    if (document.activeElement && document.activeElement.tagName === 'BUTTON') {
        document.activeElement.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Opening...';
    }

    db.collection("user_resumes").doc(studentId).get()
        .then((doc) => {
            if (doc.exists) {
                const data = doc.data();
                if (data.resumeData) {
                    const win = window.open();
                    if (win) {
                        win.document.write(
                            '<iframe src="' + data.resumeData + '" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>'
                        );
                        win.document.title = "Verified Resume - " + data.fileName;
                    } else {
                        alert("Please allow popups to view the resume.");
                    }
                } else {
                    alert("Resume data not found.");
                }
            } else {
                alert("Resume not found for this user.");
            }
        })
        .catch((error) => {
            console.error("Error fetching resume:", error);
            alert("Error fetching resume: " + error.message);
        })
        .finally(() => {
            if (document.activeElement && document.activeElement.tagName === 'BUTTON' && originalText) {
                document.activeElement.innerHTML = originalText;
            }
        });
}

function initDashboard() {
    console.log("🚀 initDashboard called");

    const loader = document.getElementById('app-loading');
    if (loader) {
        console.log("Hiding loader");
        loader.style.display = 'none';
    } else {
        console.log("Loader element not found");
    }

    if (!State.currentUser) {
        console.error("❌ State.currentUser is null!");
        return;
    }

    console.log("User data:", State.currentUser);

    renderStorageResults();
    updateNavigation();
    updateHeader();

    // Load Data
    console.log("Loading jobs...");
    loadJobs();

    console.log("Loading squads...");
    loadSquads();

    console.log("Loading user results...");
    loadUserResults();

    // Update profile view based on role
    updateProfileView();

    // Load user's resume data
    loadUserResume();

    // Restore the previous view from sessionStorage
    const savedView = sessionStorage.getItem('currentView');
    console.log("Saved view from sessionStorage:", savedView);

    if (savedView) {
        const allowedViews = getAllowedViews();
        console.log("Allowed views:", allowedViews);

        if (allowedViews.includes(savedView)) {
            console.log("Switching to saved view:", savedView);
            switchView(savedView);
        } else {
            console.log("Saved view not allowed, defaulting to feed");
            switchView('feed');
        }
    } else {
        console.log("No saved view, using default");
        if (State.currentUser.role === 'student') {
            switchView('feed');
            document.getElementById('feed-heading').innerText = "Live Opportunities";
        } else if (State.currentUser.role === 'recruiter') {
            switchView('feed');
            document.getElementById('feed-heading').innerText = "Live Opportunities";
        }
    }

    console.log("✅ initDashboard completed");
}

// Helper function to get allowed views based on user role
function getAllowedViews() {
    const baseViews = ['feed', 'profile'];

    if (State.currentUser.role === 'student') {
        return [...baseViews, 'squad', 'tests', 'interviews', 'results'];
    } else if (State.currentUser.role === 'recruiter') {
        return [...baseViews, 'recruiter', 'analytics'];
    }

    return baseViews;
}

// --- AUTHENTICATION ---
function authGoogle(role) {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
        .then((result) => {
            const user = result.user;
            // Check if user exists in Firestore
            db.collection("users").doc(user.uid).get().then((doc) => {
                if (doc.exists) {
                    // User already exists
                    console.log("User exists, logging in...");
                    window.location.href = "dashboard.html";
                } else {
                    // New User - Create Profile
                    console.log("New user, creating profile...");
                    const userData = {
                        uid: user.uid,
                        email: user.email,
                        name: user.displayName,
                        role: role,
                        company: role === 'recruiter' ? 'Not Specified' : '',
                        university: role === 'student' ? 'Not Specified' : '',
                        stream: role === 'student' ? 'Not Specified' : '',
                        branch: role === 'student' ? 'Not Specified' : '',
                        isVerified: role === 'recruiter',
                        squadId: null,
                        createdAt: Date.now(),
                        photoURL: user.photoURL
                    };

                    db.collection("users").doc(user.uid).set(userData)
                        .then(() => {
                            alert("Account created! Redirecting...");
                            window.location.href = "dashboard.html";
                        });
                }
            });
        })
        .catch((error) => {
            console.error(error);
            alert("Google Sign-In Error: " + error.message);
        });
}

function authSignUp(email, password, role, name, company = '', extraDetails = {}) {
    auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            const user = userCredential.user;
            const userData = {
                uid: user.uid,
                email: email,
                name: name,
                role: role,
                company: company,
                isVerified: role === 'recruiter',
                squadId: null,
                createdAt: Date.now(),
                ...extraDetails
            };
            db.collection("users").doc(user.uid).set(userData)
                .then(() => {
                    alert("Account created! Redirecting...");
                    window.location.href = "dashboard.html";
                });
        })
        .catch((error) => alert("Error: " + error.message));
}

function authLogin(email, password) {
    auth.signInWithEmailAndPassword(email, password)
        .then(() => {
            window.location.href = "dashboard.html";
        })
        .catch((error) => alert("Login Failed: " + error.message));
}

// Update the logout function
function logout() {
    // Clear session storage on logout
    sessionStorage.removeItem('currentView');
    auth.signOut().then(() => window.location.href = "index.html");
}

function logoutFromLanding() {
    sessionStorage.removeItem('currentView');
    auth.signOut().then(() => {
        location.reload();
    }).catch((error) => {
        console.error("Logout error:", error);
        location.reload();
    });
}

// --- INITIALIZATION FLOW ---
// --- INITIALIZATION FLOW ---
document.addEventListener('DOMContentLoaded', () => {
    // THEME INITIALIZATION
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    // Define these variables at the top level
    // Initialize context variables
    window.isDashboard = document.getElementById('feed-container');
    window.isLanding = document.querySelector('.landing-nav');

    // Update the local variables as well for any other references
    isDashboard = window.isDashboard;
    isLanding = window.isLanding;

    auth.onAuthStateChanged((user) => {
        const loader = document.getElementById('app-loading');

        if (user) {
            console.log("Authenticated as:", user.email);
            // Add a timeout to catch hanging connections
            const dbTimeout = setTimeout(() => {
                if (loader) loader.innerHTML = '<p style="color:white;">Database connection timed out. Please refresh.</p>';
            }, 10000);

            db.collection("users").doc(user.uid).onSnapshot((doc) => {
                clearTimeout(dbTimeout); // Stop timeout
                if (doc.exists) {
                    State.currentUser = doc.data();
                    if (window.isDashboard) initDashboard();
                    if (window.isLanding) updateLandingPage(State.currentUser);
                } else {
                    console.error("No user profile found.");
                    if (window.isDashboard) {
                        // Allow minimal access or show error?
                        // For now, let initDashboard handle creating a dummy? 
                        // Or just show error
                        if (loader) loader.innerHTML = '<p style="color:white;">User profile missing.</p>';
                    }
                }
            }, (error) => {
                console.error("Firestore Error:", error);
                if (loader) loader.innerHTML = `<p style="color:white;">Firestore Error: ${error.message}</p>`;
            });
        } else {
            console.log("User not logged in");
            State.currentUser = null;
            if (window.isDashboard) window.location.href = "login.html";
            if (window.isLanding) resetLandingPage();
        }
    });
});


// --- DATA LISTENERS ---
function loadJobs() {
    let query = db.collection("jobs");

    // For recruiters, ONLY show their own jobs
    if (State.currentUser.role === 'recruiter') {
        query = query.where("recruiterId", "==", State.currentUser.uid);
        // NOTE: We CANNOT use orderBy along with where() unless an index exists.
        // Since we can't create indexes dynamically for the user, we skip server-side sorting
        // for this filtered query and rely on the client-side sort below.
    } else {
        // Always order by date, newest first for the general feed
        query = query.orderBy("createdAt", "desc");
    }

    query.onSnapshot((snapshot) => {
        State.liveJobs = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            // Ensure createdAt is a number
            const createdAt = data.createdAt ?
                (data.createdAt.toDate ? data.createdAt.toDate().getTime() : data.createdAt) :
                Date.now();

            State.liveJobs.push({
                id: doc.id,
                ...data,
                createdAt: createdAt
            });
        });

        // Extra safety: sort client-side as well
        State.liveJobs.sort((a, b) => b.createdAt - a.createdAt);

        renderFeed();
    });
}

function loadMyApplications() {
    db.collection("applications")
        .where("studentId", "==", State.currentUser.uid)
        .onSnapshot((snapshot) => {
            State.myApplications = [];
            const profileList = document.getElementById('profile-applications-list');
            if (profileList) profileList.innerHTML = '';

            if (snapshot.empty && profileList) {
                profileList.innerHTML = '<p style="color:var(--text-muted); text-align:center;">No applications yet.</p>';
            }

            snapshot.forEach(doc => {
                const data = doc.data();
                State.myApplications.push(data.jobId);

                // Add to Profile List
                if (profileList) {
                    const item = document.createElement('div');
                    item.className = 'history-item';
                    item.innerHTML = `
                        <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                            <div>
                                <div style="font-weight:bold;">${data.jobTitle}</div>
                                <div style="font-size:0.8rem; color:var(--text-muted);">${data.company}</div>
                                <div style="font-size:0.7rem; color:var(--text-muted); margin-top: 0.25rem;">
                                    <i class="fa-solid fa-clock"></i> Applied ${timeAgoShort(data.appliedAt)}
                                </div>
                            </div>
                            <span class="badge" style="background:var(--primary-glow); color:var(--primary); font-size:0.75rem;">Applied</span>
                        </div>
                    `;
                    profileList.appendChild(item);
                }
            });
            renderFeed();
        });
}

// Update the loadSquads function to use real-time listener
function loadSquads() {
    db.collection("squads").onSnapshot((snapshot) => {
        console.log("🔁 Real-time squad update received");

        State.liveSquads = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            State.liveSquads.push({
                id: doc.id,
                ...data
            });
        });

        console.log("Total squads loaded:", State.liveSquads.length);

        // Update UI if squad market is open
        if (document.getElementById('squad-container')) {
            renderSquads();
        }

        // Show real-time notifications
        showSquadRealTimeNotifications(snapshot);

    }, (error) => {
        console.error("Error loading squads:", error);
    });
}

// Show real-time notifications for squad updates
// Update showSquadRealTimeNotifications to use new system
function showSquadRealTimeNotifications(snapshot) {
    // Keep the function but don't show any UI notifications
    // Just log to console for debugging
    snapshot.docChanges().forEach((change) => {
        const squadData = change.doc.data();

        if (change.type === "added") {
            console.log("New squad created:", squadData.name);
        }
        else if (change.type === "modified") {
            console.log("Squad updated:", squadData.name);
        }
        else if (change.type === "removed") {
            console.log("Squad deleted:", squadData.name);
        }
    });
}

// Also update CSS for better notifications
const notificationStyles = document.createElement('style');
notificationStyles.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    
    .squad-toast-item {
        animation: slideInRight 0.3s ease;
    }
    
    .squad-toast-item.removing {
        animation: slideOutRight 0.3s ease;
    }
`;
document.head.appendChild(notificationStyles);

// Handle specific squad update notifications
function handleSquadUpdateNotification(change, newData) {
    const oldData = change.doc.data();

    // Check if members changed
    const oldMembers = oldData.members || [];
    const newMembers = newData.members || [];

    if (oldMembers.length !== newMembers.length) {
        // Someone joined or left
        if (newMembers.length > oldMembers.length) {
            // Someone joined
            const newMember = newMembers.find(m => !oldMembers.some(om => om.id === m.id));
            if (newMember && newMember.id !== State.currentUser.uid) {
                showSquadToast("👋 New Member Joined", `${newMember.name} joined ${newData.name}`);
            }
        } else {
            // Someone left
            const leftMember = oldMembers.find(m => !newMembers.some(nm => nm.id === m.id));
            if (leftMember && leftMember.id !== State.currentUser.uid) {
                showSquadToast("👋 Member Left", `${leftMember.name} left ${newData.name}`);
            }
        }
    }
}

function showNextNotification() {
    if (notificationQueue.length === 0) {
        isShowingNotification = false;
        return;
    }

    isShowingNotification = true;
    const notification = notificationQueue.shift();

    // Remove existing toast with same content
    const existingToasts = document.querySelectorAll('.squad-toast-item');
    existingToasts.forEach(toast => {
        if (toast.dataset.message === notification.message) {
            toast.remove();
        }
    });

    const colors = {
        info: { bg: 'var(--primary-glow)', border: 'var(--primary)', icon: 'fa-users' },
        success: { bg: 'rgba(16,185,129,0.1)', border: 'var(--success)', icon: 'fa-check-circle' },
        warning: { bg: 'rgba(245,158,11,0.1)', border: 'var(--warning)', icon: 'fa-exclamation-triangle' },
        error: { bg: 'rgba(239,68,68,0.1)', border: 'var(--error)', icon: 'fa-times-circle' }
    };

    const color = colors[notification.type] || colors.info;

    const toast = document.createElement('div');
    toast.className = 'squad-toast-item';
    toast.dataset.message = notification.message;
    toast.innerHTML = `
        <div style="position: fixed; bottom: 20px; right: 20px; z-index: 9999; animation: slideInRight 0.3s ease;">
            <div class="glass-card" style="padding: 1rem; max-width: 350px; border-left: 4px solid ${color.border}; 
                 background: ${color.bg}; margin-bottom: 10px;">
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <div style="width: 40px; height: 40px; background: ${color.border}20; border-radius: 50%; 
                         display: flex; align-items: center; justify-content: center;">
                        <i class="fa-solid ${color.icon}" style="color: ${color.border};"></i>
                    </div>
                    <div style="flex: 1;">
                        <div style="font-weight: bold; margin-bottom: 0.25rem; color: ${color.border};">${notification.title}</div>
                        <div style="font-size: 0.85rem; color: var(--text-muted);">${notification.message}</div>
                        <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 0.25rem;">
                            ${new Date(notification.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    </div>
                    <button onclick="this.parentElement.parentElement.parentElement.remove(); showNextNotification();" 
                        style="background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 0.5rem;">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(toast);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
        setTimeout(() => showNextNotification(), 300);
    }, 5000);
}

// --- VIEW LOGIC ---

// Helper function to format time relative to now
function formatJobTime(timestamp) {
    const now = new Date();
    const jobDate = new Date(timestamp);

    // Check if it's today
    const isToday = jobDate.toDateString() === now.toDateString();

    // Check if it's yesterday
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = jobDate.toDateString() === yesterday.toDateString();

    // Format time (e.g., "2:45 PM")
    const timeStr = jobDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    }).replace(':00', ''); // Remove :00 if no minutes

    if (isToday) {
        // Calculate minutes ago
        const diffMs = now - jobDate;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);

        if (diffMins < 1) {
            return 'Just now';
        } else if (diffMins < 60) {
            return `${diffMins}m ago`;
        } else if (diffHours < 24) {
            return `${diffHours}h ago`;
        }
        // Fallback to time if today but >24 hours ago (shouldn't happen)
        return `Today at ${timeStr}`;
    } else if (isYesterday) {
        return `Yesterday at ${timeStr}`;
    } else {
        // Show date in a clean format
        const day = jobDate.getDate();
        const month = jobDate.toLocaleDateString('en-US', { month: 'short' });
        const year = jobDate.getFullYear();

        // Check if it's current year
        if (jobDate.getFullYear() === now.getFullYear()) {
            return `${month} ${day} at ${timeStr}`;
        } else {
            return `${month} ${day}, ${year} at ${timeStr}`;
        }
    }
}

// Alternative: Time ago function (for feed)
function timeAgoShort(timestamp) {
    const now = new Date();
    const past = new Date(timestamp);
    const diffMs = now - past;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    const jobDate = new Date(timestamp);
    const timeStr = jobDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    }).replace(':00', '');

    // Check for yesterday (after midnight)
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = jobDate.toDateString() === yesterday.toDateString();

    if (isYesterday) {
        return `Yesterday at ${timeStr}`;
    }

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay === 1) return `Yesterday at ${timeStr}`;
    if (diffDay < 7) return `${diffDay}d ago`;

    // Return formatted date
    return jobDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: jobDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
}

function renderFeed() {
    const container = document.getElementById('feed-container');
    if (!container) return;

    const search = document.getElementById('job-search').value.toLowerCase();
    const locFilter = document.getElementById('job-filter').value;

    container.innerHTML = '';

    if (State.liveJobs.length === 0) {
        const emptyMsg = State.currentUser.role === 'recruiter'
            ? "You haven't posted any jobs yet."
            : "No jobs found.";

        container.innerHTML = `
            <div style="text-align:center; color:var(--text-muted); padding:2rem;">
                ${emptyMsg}
            </div>`;
        return;
    }

    State.liveJobs.forEach(job => {
        if (search && !job.title.toLowerCase().includes(search)) return;
        if (locFilter !== 'Any' && job.location && !job.location.includes(locFilter)) return;

        const lockDuration = job.lockDuration || 20;
        const unlockTime = job.createdAt + (lockDuration * 60000);
        const timeNow = Date.now();
        const remaining = Math.ceil((unlockTime - timeNow) / 60000);

        let isLocked = false;
        if (
            State.currentUser.role === 'student' &&
            !State.currentUser.isVerified &&
            timeNow < unlockTime
        ) {
            isLocked = true;
        }

        const card = document.createElement('div');
        card.className = `job-card ${isLocked ? 'locked' : ''}`;

        let lockHTML = '';
        if (isLocked) {
            lockHTML = `
                <div class="lock-overlay" onclick="openAssessment()">
                    <div class="timer-badge">
                        <i class="fa-solid fa-lock"></i> Exclusive: ${remaining}m
                    </div>
                </div>`;
        }

        // Check if current user is the job poster
        const isJobOwner = State.currentUser.role === 'recruiter' &&
            State.currentUser.uid === job.recruiterId;

        let actionButtons = '';

        if (State.currentUser.role === 'student') {
            // Student view - Show Apply button
            if (!isLocked) {
                if (State.myApplications.includes(job.id)) {
                    actionButtons = `
                        <button class="btn btn-secondary" style="width:100%; cursor:not-allowed; opacity:0.7;" disabled>
                            <i class="fa-solid fa-check"></i> Applied
                        </button>`;
                } else {
                    actionButtons = `
                        <button class="btn btn-primary" style="width:100%;" 
                            onclick="applyForJob('${job.id}', '${job.title}', '${job.company}')">
                            Apply Now <i class="fa-solid fa-paper-plane"></i>
                        </button>`;
                }
            }
        } else if (isJobOwner) {
            // Recruiter view - Show View Applicants and Delete buttons
            actionButtons = `
                <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                    <button class="btn btn-primary" style="flex: 1;" 
                        onclick="viewApplicants('${job.id}', '${job.title}')">
                        <i class="fa-solid fa-users"></i> View Applicants
                    </button>
                    <button class="btn btn-error" style="flex: 1; background: var(--error); color: white; border: none;" 
                        onclick="deleteJob('${job.id}')">
                        <i class="fa-solid fa-trash"></i> Delete Job
                    </button>
                </div>`;
        } else if (State.currentUser.role === 'recruiter') {
            // Another recruiter viewing jobs (optional - can be removed)
            actionButtons = `
                <div style="color: var(--text-muted); font-size: 0.9rem; padding: 1rem; text-align: center; border: 1px solid var(--border); border-radius: 8px;">
                    Posted by another recruiter
                </div>`;
        }

        card.innerHTML = `
            ${lockHTML}
            <div style="${isLocked ? 'filter:blur(4px)' : ''}">
                <div style="display:flex; justify-content:space-between; align-items:start;">
                    <div>
                        <h4 style="margin-bottom:0.2rem;">${job.title}</h4>
                        <p style="color:var(--primary); font-weight:bold; margin-bottom:0.5rem;">${job.company}</p>
                    </div>
                    <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.5rem;">
                        <span class="badge" style="background:rgba(255,255,255,0.1); font-size:0.8rem;">${job.type || 'Full Time'}</span>
                        ${isJobOwner ? `<span class="badge" style="background:var(--primary-glow); color:var(--primary); font-size:0.7rem;">Your Post</span>` : ''}
                    </div>
                </div>
                
                <div style="font-size:0.85rem; color:var(--text-muted); margin-bottom:1rem; display:flex; gap:1rem; flex-wrap: wrap;">
                    <span><i class="fa-solid fa-location-dot"></i> ${job.location || 'Remote'}</span>
                    <span><i class="fa-solid fa-clock"></i> ${timeAgoShort(job.createdAt)}</span>
                    <span><i class="fa-solid fa-eye"></i> ${job.views || 0} view${job.views !== 1 ? 's' : ''}</span>
                </div>

                <p style="margin-bottom:1rem; line-height:1.5;">${job.description || 'No description provided.'}</p>
                
                ${job.requirements ? `
                <div style="background:rgba(0,0,0,0.2); padding:0.8rem; border-radius:6px; margin-bottom:1rem; font-size:0.9rem; line-height:1.5;">
                    <strong style="display:block; margin-bottom:0.5rem; color:var(--text-main);">Requirements:</strong>
                    <div style="padding-left:1rem;">
                        ${job.requirements}
                    </div>
                </div>
            ` : ''}

                ${actionButtons}
            </div>
        `;

        container.appendChild(card);
        // Track view when job card is rendered
        setTimeout(() => {
            trackJobViewIfVisible(job.id);
        }, 500);
    });
}

function deleteJob(jobId) {
    if (!confirm("Are you sure you want to permanently delete this job post?")) return;

    db.collection("jobs").doc(jobId).delete()
        .then(() => {
            alert("Job deleted successfully.");
            // Also delete all related applications
            db.collection("applications").where("jobId", "==", jobId).get()
                .then(querySnapshot => {
                    const batch = db.batch();
                    querySnapshot.forEach(doc => {
                        batch.delete(doc.ref);
                    });
                    return batch.commit();
                })
                .catch(error => console.log("Error cleaning up applications:", error));
        })
        .catch((error) => {
            alert("Error deleting job: " + error.message);
        });
}

// --- ACTIONS ---
// Enhanced postJob function with better bullet point formatting
function postJob() {
    const title = document.getElementById('post-title').value;
    const company = State.currentUser.company || document.getElementById('post-company').value;
    const location = document.getElementById('post-location').value;
    const type = document.getElementById('post-type').value;
    const requirementsText = document.getElementById('post-requirements').value;

    if (!title) return alert('Job title is required');

    // Process requirements into clean bullet points
    let formattedRequirements = '';
    if (requirementsText.trim()) {
        // Split by newlines, clean each line, and filter out empties
        const requirementsList = requirementsText
            .split('\n')
            .map(line => {
                // Trim whitespace
                line = line.trim();
                // Remove any existing bullet characters
                line = line.replace(/^[•\-*\d.]+\s*/, '');
                return line;
            })
            .filter(line => line.length > 0);

        // Format with proper bullet points
        if (requirementsList.length > 0) {
            formattedRequirements = requirementsList
                .map(req => `• ${req}`)
                .join('<br>');
        }
    }

    db.collection("jobs").add({
        title,
        company,
        location: location || "Remote",
        type,
        requirements: formattedRequirements,
        rawRequirements: requirementsText, // Store original for editing
        recruiterId: State.currentUser.uid,
        createdAt: Date.now(),
        lockDuration: 20,
        description: "New opportunity posted.",
        views: 0,
        lastViewed: Date.now()
    }).then(() => {
        alert("✓ Job Posted Successfully!");

        // Clear form
        document.getElementById('post-title').value = '';
        document.getElementById('post-company').value = '';
        document.getElementById('post-location').value = '';
        document.getElementById('post-requirements').value = '';

        switchView('feed');
    }).catch(error => {
        alert("Error posting job: " + error.message);
    });
}


function viewStudentProfile(studentId) {
    if (!studentId) return;

    // 1. Show loading text on the button that triggered this
    const btn = document.activeElement;
    let originalText = '';
    // Only change button text if it looks like a button
    if (btn && (btn.tagName === 'BUTTON' || btn.classList.contains('btn'))) {
        originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Opening...';
        btn.disabled = true;
    }

    // 2. Fetch User Data & Resume Data
    Promise.all([
        db.collection("users").doc(studentId).get(),
        db.collection("user_resumes").doc(studentId).get()
    ]).then(([userDoc, resumeDoc]) => {
        if (!userDoc.exists) {
            throw new Error("Student profile not found.");
        }

        const userData = userDoc.data();
        const resumeData = resumeDoc.exists ? resumeDoc.data() : null;

        // 3. Show Modal
        showStudentProfileModal(userData, resumeData);

    }).catch(error => {
        console.error("Error viewing profile:", error);
        alert("Error viewing profile: " + error.message);
    }).finally(() => {
        // 4. Restore button state
        if (btn && (btn.tagName === 'BUTTON' || btn.classList.contains('btn')) && originalText) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });
}

// Function to show student profile modal
function showStudentProfileModal(user, resume) {
    // Remove existing modal if any
    const modalId = 'student-profile-modal';
    const existing = document.getElementById(modalId);
    if (existing) existing.remove();

    // Determine avatar content
    let avatarContent = user.name ? user.name.charAt(0).toUpperCase() : 'U';
    if (user.photoURL) {
        avatarContent = `<img src="${user.photoURL}" style="width:100%; height:100%; object-fit:cover;">`;
    }

    // Resume Section HTML
    let resumeSectionHtml = '';
    if (resume) {
        resumeSectionHtml = `
            <div class="glass-card" style="margin-top: 1rem; border-left: 4px solid var(--primary);">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <div style="font-weight:bold; margin-bottom:0.25rem;">Resume Available</div>
                        <div style="font-size:0.85rem; color:var(--text-muted);">
                            <i class="fa-solid fa-file-lines"></i> ${resume.fileName}
                            <span style="opacity:0.7;">(${Math.round(resume.fileSize / 1024)} KB)</span>
                        </div>
                        <div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.25rem;">
                             Updated: ${new Date(resume.uploadedAt).toLocaleDateString()}
                        </div>
                    </div>
                    <button class="btn btn-primary" onclick="viewStudentResume('${user.uid}')" style="font-size:0.9rem;">
                        <i class="fa-solid fa-eye"></i> View
                    </button>
                </div>
            </div>
        `;
    } else {
        resumeSectionHtml = `
            <div style="text-align:center; padding:1.5rem; background:rgba(255,255,255,0.05); border-radius:8px; margin-top:1rem;">
                <i class="fa-solid fa-file-circle-xmark" style="font-size:1.5rem; color:var(--text-muted); margin-bottom:0.5rem;"></i>
                <p style="color:var(--text-muted); font-size:0.9rem;">No resume uploaded.</p>
            </div>
        `;
    }

    // Modal HTML
    const html = `
        <div class="modal-overlay" id="${modalId}" style="display:flex;">
            <div class="modal-content" style="max-width: 500px; width: 90%; max-height: 85vh; overflow-y: auto;">
                <button onclick="document.getElementById('${modalId}').remove()" 
                    style="position:absolute; top:1.5rem; right:1.5rem; background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:1.5rem;">
                    <i class="fa-solid fa-xmark"></i>
                </button>
                
                <div style="text-align:center; margin-bottom:1.5rem;">
                    <div style="width:80px; height:80px; background:var(--primary); color:white; font-size:2rem; font-weight:bold; 
                        border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 1rem;
                        box-shadow: 0 0 20px var(--primary-glow); overflow: hidden;">
                        ${avatarContent}
                    </div>
                    <h3 style="margin-bottom:0.25rem;">${user.name}</h3>
                    <p style="color:var(--text-muted); font-size:0.9rem;">${user.email}</p>
                    ${user.isVerified ?
            `<span class="badge" style="background:var(--success); color:white; margin-top:0.5rem; display:inline-block;">
                            <i class="fa-solid fa-check-circle"></i> Verified Student
                         </span>` : ''}
                </div>

                <div style="margin-bottom:1.5rem;">
                    <h4 style="border-bottom:1px solid var(--border); padding-bottom:0.5rem; margin-bottom:1rem; color:var(--text-main);">
                        Profile Details
                    </h4>
                    
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem; margin-bottom:1rem;">
                        <div>
                            <div style="font-size:0.8rem; color:var(--text-muted);">Role</div>
                            <div>${user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Student'}</div>
                        </div>
                        <div>
                            <div style="font-size:0.8rem; color:var(--text-muted);">Joined</div>
                            <div>${user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}</div>
                        </div>
                    </div>

                    ${(user.university || user.stream || user.branch) ? `
                    <div style="background: rgba(255,255,255,0.03); padding: 0.8rem; border-radius: 8px; margin-bottom: 1rem;">
                        <h5 style="margin-bottom: 0.8rem; color: var(--primary); font-size: 0.9rem;">Education Details</h5>
                        <div style="display:grid; grid-template-columns: 1fr; gap:0.8rem;">
                            ${user.university ? `
                            <div>
                                <div style="font-size:0.75rem; color:var(--text-muted);">University / College</div>
                                <div style="font-weight: 500;">${user.university}</div>
                            </div>` : ''}
                            
                            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                ${user.stream ? `
                                <div>
                                    <div style="font-size:0.75rem; color:var(--text-muted);">Stream</div>
                                    <div>${user.stream}</div>
                                </div>` : ''}
                                ${user.branch ? `
                                <div>
                                    <div style="font-size:0.75rem; color:var(--text-muted);">Branch</div>
                                    <div>${user.branch}</div>
                                </div>` : ''}
                            </div>
                        </div>
                    </div>` : ''}
                     ${user.squadId ? `
                    <div style="margin-bottom:1rem;">
                        <div style="font-size:0.8rem; color:var(--text-muted);">Squad</div>
                        <div style="display:flex; align-items:center; gap:0.5rem;">
                            <i class="fa-solid fa-users" style="color:var(--secondary);"></i> ${user.squadId}
                        </div>
                    </div>` : ''}
                </div>

                <div>
                    <h4 style="border-bottom:1px solid var(--border); padding-bottom:0.5rem; margin-bottom:0.5rem; color:var(--text-main);">
                        Resume
                    </h4>
                    ${resumeSectionHtml}
                </div>
                
                <div style="margin-top:2rem; text-align:center;">
                    <button class="btn btn-glass" onclick="document.getElementById('${modalId}').remove()" style="width:100%;">
                        Close Profile
                    </button>
                </div>
            </div>
        </div>
    `;

    // Append to body
    const div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div.firstElementChild);
}

// Function to track unique job views (one view per user per job)
function trackJobView(jobId) {
    if (!State.currentUser || !State.currentUser.uid || !jobId) return;

    const viewKey = `viewed_${jobId}_${State.currentUser.uid}`;

    // Check if user has already viewed this job in this session
    if (sessionStorage.getItem(viewKey)) return;

    const jobRef = db.collection("jobs").doc(jobId);

    // Use transaction to ensure atomic read-then-write
    db.runTransaction((transaction) => {
        return transaction.get(jobRef).then((doc) => {
            if (!doc.exists) return; // Job might be deleted

            const data = doc.data();
            const viewedBy = data.viewedBy || [];

            // Check if user has already viewed globally (in database)
            if (viewedBy.includes(State.currentUser.uid)) {
                return;
            }

            // Update database with incremented count and user ID
            transaction.update(jobRef, {
                views: (data.views || 0) + 1,
                lastViewed: Date.now(),
                viewedBy: firebase.firestore.FieldValue.arrayUnion(State.currentUser.uid)
            });
        });
    }).then(() => {
        // Mark as viewed in session storage on success
        sessionStorage.setItem(viewKey, 'true');
        console.log("Job view tracked transactionally:", jobId);
    }).catch((error) => {
        console.error("Error tracking job view:", error);
    });
}

// Call this when a job card is rendered/visible
function trackJobViewIfVisible(jobId) {
    // Simple implementation - track view when job is rendered
    // For production, you might want to use Intersection Observer
    setTimeout(() => {
        trackJobView(jobId);
    }, 1000); // Delay to ensure user actually saw the job
}

// --- SQUAD LOGIC ---
function createSquad() {
    const nameInput = document.getElementById('new-squad-name');
    if (!nameInput) {
        showCreateSquadModal();
        return;
    }

    const name = nameInput.value.trim();
    if (!name) {
        alert('Squad name is required');
        nameInput.focus();
        return;
    }

    // Check if squad name already exists
    const existingSquad = State.liveSquads.find(s => s.name.toLowerCase() === name.toLowerCase());
    if (existingSquad) {
        alert(`A squad named "${name}" already exists. Please choose a different name.`);
        nameInput.focus();
        nameInput.select();
        return;
    }

    // Check if user is already in a squad
    if (State.currentUser.squadId) {
        const leave = confirm(`You're already in squad "${State.currentUser.squadId}". Leave it to create a new squad?`);
        if (leave) {
            leaveSquad(() => {
                createNewSquad(name);
            });
        }
        return;
    }

    createNewSquad(name);
}

function createNewSquad(name) {
    const createBtn = document.querySelector('#create-squad-modal button[onclick*="createSquad"]');
    if (createBtn) {
        createBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating...';
        createBtn.disabled = true;
    }

    db.collection("squads").add({
        name: name,
        creatorId: State.currentUser.uid,
        creatorName: State.currentUser.name,
        members: [{
            id: State.currentUser.uid,
            name: State.currentUser.name,
            email: State.currentUser.email,
            role: "Lead"
        }],
        createdAt: Date.now(),
        memberCount: 1,
        lastUpdated: Date.now()
    }).then((docRef) => {
        console.log("Squad created with ID:", docRef.id);

        return db.collection("users").doc(State.currentUser.uid).update({
            squadId: name
        });
    }).then(() => {
        closeModal('create-squad-modal');

        // SIMPLE ALERT instead of toast
        alert(`✅ Squad "${name}" created successfully!\n\nYou are now the squad leader.`);

        switchView('squad');

        setTimeout(() => {
            const nameInput = document.getElementById('new-squad-name');
            if (nameInput) nameInput.value = '';
        }, 100);

    }).catch((error) => {
        console.error("Error creating squad:", error);
        alert("Error creating squad: " + error.message);

        if (createBtn) {
            createBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Create Squad';
            createBtn.disabled = false;
        }
    });
}

function createNewSquad(name) {
    // Show creating indicator
    const createBtn = document.querySelector('#create-squad-modal button[onclick*="createSquad"]');
    if (createBtn) {
        createBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating...';
        createBtn.disabled = true;
    }

    // Create squad in Firestore
    db.collection("squads").add({
        name: name,
        creatorId: State.currentUser.uid,
        creatorName: State.currentUser.name,
        members: [{
            id: State.currentUser.uid,
            name: State.currentUser.name,
            email: State.currentUser.email,
            role: "Lead"
        }],
        createdAt: Date.now(),
        memberCount: 1,
        lastUpdated: Date.now()
    }).then((docRef) => {
        console.log("Squad created with ID:", docRef.id);

        // Update user's profile with squadId
        return db.collection("users").doc(State.currentUser.uid).update({
            squadId: name
        });
    }).then(() => {
        // Close modal
        closeModal('create-squad-modal');

        // Show success message
        showSquadToast("✅ Squad Created", `"${name}" created successfully! You're now the leader.`);

        // Switch to squad view
        switchView('squad');

        // Clear input for next time
        setTimeout(() => {
            const nameInput = document.getElementById('new-squad-name');
            if (nameInput) nameInput.value = '';
        }, 100);

    }).catch((error) => {
        console.error("Error creating squad:", error);


        // Reset button
        if (createBtn) {
            createBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Create Squad';
            createBtn.disabled = false;
        }
    });
}

function showCreateSquadModal() {
    // Remove existing modal if any
    const existingModal = document.getElementById('create-squad-modal');
    if (existingModal) {
        existingModal.remove();
    }

    const modalHTML = `
        <div class="modal-overlay" id="create-squad-modal">
            <div class="modal-content" style="max-width: 500px;">
                <button onclick="closeModal('create-squad-modal')"
                    style="position:absolute; top:1.5rem; right:1.5rem; background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:1.5rem;">
                    <i class="fa-solid fa-xmark"></i>
                </button>
                <h3 style="margin-bottom: 1.5rem;"><i class="fa-solid fa-users"></i> Create New Squad</h3>
                
                <div class="form-group">
                    <label class="form-label">Squad Name</label>
                    <input type="text" id="new-squad-name" class="form-input" 
                           placeholder="e.g., React Warriors, Data Avengers" autocomplete="off">
                </div>
                
                <div style="background: rgba(0,243,255,0.1); padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
                    <p style="color: var(--text-muted); font-size: 0.9rem; margin: 0;">
                        <i class="fa-solid fa-info-circle" style="color: var(--primary); margin-right: 0.5rem;"></i>
                        As the creator, you'll be the squad leader. You can invite up to 4 more members and manage the squad.
                    </p>
                </div>
                
                <div style="display: flex; gap: 1rem;">
                    <button class="btn btn-primary" onclick="createSquad()" style="flex: 1;" id="create-squad-btn">
                        <i class="fa-solid fa-plus"></i> Create Squad
                    </button>
                    <button class="btn btn-glass" onclick="closeModal('create-squad-modal')" style="flex: 1;">
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    `;

    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHTML;
    document.body.appendChild(modalContainer);

    setTimeout(() => {
        document.getElementById('create-squad-modal').style.display = 'flex';
        // Focus on the input field
        const nameInput = document.getElementById('new-squad-name');
        if (nameInput) {
            nameInput.focus();

            // Add enter key support
            nameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    createSquad();
                }
            });
        }
    }, 10);
}

// In your existing code, update the joinSquad function to include email:
function joinSquad(squadId, squadName) {
    if (!confirm(`Join the squad "${squadName}"?`)) return;

    // Check if user is already in a squad
    if (State.currentUser.squadId) {
        alert(`You're already in squad "${State.currentUser.squadId}". Leave it first to join another.`);
        return;
    }

    // Update squad members in Firestore with email
    db.collection("squads").doc(squadId).update({
        members: firebase.firestore.FieldValue.arrayUnion({
            id: State.currentUser.uid,
            name: State.currentUser.name,
            email: State.currentUser.email, // Add email
            role: "Member"
        }),
        memberCount: firebase.firestore.FieldValue.increment(1)
    })
        .then(() => {
            // Update user's profile
            return updateUserProfile({ squadId: squadName });
        })
        .then(() => {
            alert(`Successfully joined "${squadName}"!`);
            closeModal('squad-members-modal');
        })

}

function leaveSquad(callback = null) {
    if (!State.currentUser.squadId) {
        alert('You are not in any squad');
        return;
    }

    const squad = State.liveSquads.find(s => s.name === State.currentUser.squadId);

    if (!squad) {
        // Just update user's profile
        updateUserProfile({ squadId: null })
            .then(() => {
                alert('You have left the squad');
                if (callback) callback();
            });
        return;
    }

    if (!confirm(`Leave the squad "${State.currentUser.squadId}"?`)) return;

    // Show leaving indicator
    const btn = event?.target;
    if (btn) {
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Leaving...';
        btn.disabled = true;
    }

    // Remove user from squad members
    const memberToRemove = {
        id: State.currentUser.uid,
        name: State.currentUser.name,
        email: State.currentUser.email,
        role: squad.members?.find(m => m.id === State.currentUser.uid)?.role || "Member"
    };

    db.collection("squads").doc(squad.id).update({
        members: firebase.firestore.FieldValue.arrayRemove(memberToRemove),
        memberCount: firebase.firestore.FieldValue.increment(-1),
        lastUpdated: Date.now()
    })
        .then(() => {
            // Update user's profile
            return updateUserProfile({ squadId: null });
        })
        .then(() => {
            showSquadToast("👋 Left Squad", `You left "${squad.name}"`, 'info');

            // If user is the creator and last member, delete the squad
            if (squad.creatorId === State.currentUser.uid) {
                const remainingMembers = (squad.members || []).filter(m => m.id !== State.currentUser.uid);
                if (remainingMembers.length === 0) {
                    // Last member left, delete squad
                    return db.collection("squads").doc(squad.id).delete()
                        .then(() => {
                            showSquadToast("🗑️ Squad Closed", `"${squad.name}" was deleted as all members left`, 'warning');
                        });
                } else {
                    // Transfer leadership to next member
                    const newLeader = remainingMembers[0];
                    return db.collection("squads").doc(squad.id).update({
                        creatorId: newLeader.id,
                        creatorName: newLeader.name,
                        members: remainingMembers.map((m, index) => ({
                            ...m,
                            role: index === 0 ? "Lead" : "Member"
                        }))
                    });
                }
            }
        })
        .then(() => {
            if (callback) callback();

            // Update UI
            setTimeout(() => {
                renderSquads();
                closeModal('squad-members-modal');
            }, 500);
        })
        .catch(error => {
            console.error("Error leaving squad:", error);

            // Reset button
            if (btn) {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        });
}

function showMyCreatedSquads() {
    if (State.currentUser.role !== 'student') return;

    const mySquads = State.liveSquads.filter(s => s.creatorId === State.currentUser.uid);

    if (mySquads.length > 0) {
        const modalHTML = `
            <div class="modal-overlay" id="my-squads-modal">
                <div class="modal-content" style="max-width: 600px;">
                    <button onclick="closeModal('my-squads-modal')"
                        style="position:absolute; top:1.5rem; right:1.5rem; background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:1.5rem;">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                    <h3 style="margin-bottom: 1.5rem;">My Created Squads</h3>
                    <div id="my-squads-list">
                        ${mySquads.map(squad => `
                            <div class="glass-card" style="margin-bottom: 1rem;">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div>
                                        <h4>${squad.name}</h4>
                                        <p style="font-size:0.8rem; color:var(--text-muted);">
                                            <i class="fa-solid fa-users"></i> ${squad.memberCount || 1} members
                                        </p>
                                    </div>
                                    <div style="display: flex; gap: 0.5rem;">
                                        <button class="btn btn-glass" onclick="viewSquadDetails('${squad.id}')">
                                            <i class="fa-solid fa-eye"></i> View
                                        </button>
                                        <button class="btn btn-error" onclick="deleteSquad('${squad.id}', '${squad.name}')">
                                            <i class="fa-solid fa-trash"></i> Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;

        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = modalHTML;
        document.body.appendChild(modalContainer);

        setTimeout(() => {
            document.getElementById('my-squads-modal').style.display = 'flex';
        }, 10);
    } else {
        alert("You haven't created any squads yet.");
    }
}

// --- HELPERS ---
function updateHeader() {
    const btn = document.getElementById('premium-btn');
    const avatarEl = document.getElementById('user-avatar');
    if (State.currentUser.name) {
        if (State.currentUser.photoURL) {
            avatarEl.innerHTML = `<img src="${State.currentUser.photoURL}" style="width:100%; height:100%; object-fit:cover;">`;
        } else {
            avatarEl.innerHTML = State.currentUser.name.charAt(0).toUpperCase();
        }
    }
    if (State.currentUser.role === 'recruiter') { btn.style.display = 'none'; return; }
    btn.style.display = 'inline-flex';
    if (State.currentUser.isVerified) {
        btn.innerHTML = '<i class="fa-solid fa-check-circle"></i> Verified Premium';
        btn.style.background = 'var(--success)'; btn.style.color = 'var(--bg-dark)'; btn.style.borderColor = 'var(--success)'; btn.onclick = null;
    } else {
        btn.innerHTML = 'Take Test for Premium'; btn.style.background = ''; btn.style.color = 'var(--text-main)'; btn.onclick = openAssessment;
    }
}

// Update the updateNavigation function to mark current view as active
function updateNavigation() {
    document.querySelectorAll('.role-student').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.role-recruiter').forEach(el => el.style.display = 'none');

    if (State.currentUser.role === 'student') {
        document.querySelectorAll('.role-student').forEach(el => el.style.display = 'flex');
        if (document.getElementById('nav-analytics')) document.getElementById('nav-analytics').style.display = 'none';
        if (document.getElementById('nav-recruiter')) document.getElementById('nav-recruiter').style.display = 'none';
    }
    else if (State.currentUser.role === 'recruiter') {
        document.querySelectorAll('.role-recruiter').forEach(el => el.style.display = 'flex');
        if (document.getElementById('nav-squad')) document.getElementById('nav-squad').style.display = 'none';
        if (document.getElementById('nav-tests')) document.getElementById('nav-tests').style.display = 'none';
        if (document.getElementById('nav-interviews')) document.getElementById('nav-interviews').style.display = 'none';
    }

    document.getElementById('user-name-display').innerText = State.currentUser.name;
    document.getElementById('user-role-display').innerText = State.currentUser.role.toUpperCase();

    // Set active nav item based on current view
    setTimeout(() => {
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        const currentNav = document.getElementById(`nav-${currentView}`);
        if (currentNav) currentNav.classList.add('active');
    }, 100);
}

function switchView(viewId) {
    document.querySelectorAll('.panel').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

    const viewPanel = document.getElementById(`view-${viewId}`);
    const navItem = document.getElementById(`nav-${viewId}`);

    if (viewPanel) viewPanel.classList.add('active');
    if (navItem) navItem.classList.add('active');

    document.getElementById('app-sidebar').classList.remove('open');
    document.getElementById('mobile-overlay').style.display = 'none';

    // Save the current view to sessionStorage
    currentView = viewId;
    sessionStorage.setItem('currentView', viewId);

    if (viewId === 'squad') renderSquads();
    if (viewId === 'analytics') loadRecruiterAnalytics();
    if (viewId === 'results') loadStudentAnalytics();
    if (viewId === 'profile') updateProfileView();

    // Don't call loadJobs() here - it should only be called once on init
    // loadJobs();
}

// Load recruiter analytics
function loadRecruiterAnalytics() {
    if (!State.currentUser || State.currentUser.role !== 'recruiter') return;

    // Get recruiter's posted jobs
    db.collection("jobs")
        .where("recruiterId", "==", State.currentUser.uid)
        .get()
        .then((jobsSnapshot) => {
            const jobs = [];
            const jobIds = [];

            jobsSnapshot.forEach(doc => {
                const job = { id: doc.id, ...doc.data() };
                jobs.push(job);
                jobIds.push(doc.id);
            });

            // Get applications for these jobs
            if (jobIds.length > 0) {
                return db.collection("applications")
                    .where("jobId", "in", jobIds)
                    .get()
                    .then((appsSnapshot) => {
                        const applications = [];
                        appsSnapshot.forEach(doc => {
                            applications.push(doc.data());
                        });

                        // Calculate analytics
                        const analytics = calculateRecruiterAnalytics(jobs, applications);

                        // Update UI
                        updateRecruiterAnalyticsUI(analytics, jobs, applications);
                    });
            } else {
                // No jobs posted yet
                updateRecruiterAnalyticsUI({
                    totalJobs: 0,
                    totalApplications: 0,
                    avgApplicationsPerJob: 0,
                    jobsWithApplications: 0
                }, [], []);
            }
        })
        .catch((error) => {
            console.error("Error loading recruiter analytics:", error);
            showRecruiterAnalyticsError();
        });
}

// Calculate recruiter analytics
function calculateRecruiterAnalytics(jobs, applications) {
    const totalJobs = jobs.length;
    const totalApplications = applications.length;
    const avgApplicationsPerJob = totalJobs > 0 ? (totalApplications / totalJobs).toFixed(1) : 0;

    // Count jobs that have at least one application
    const jobIdsWithApps = [...new Set(applications.map(app => app.jobId))];
    const jobsWithApplications = jobIdsWithApps.length;

    // Group applications by job
    const applicationsByJob = {};
    applications.forEach(app => {
        if (!applicationsByJob[app.jobId]) {
            applicationsByJob[app.jobId] = [];
        }
        applicationsByJob[app.jobId].push(app);
    });

    // Find most popular job
    let mostPopularJob = null;
    let maxApplications = 0;

    jobs.forEach(job => {
        const jobApps = applicationsByJob[job.id] || [];
        if (jobApps.length > maxApplications) {
            maxApplications = jobApps.length;
            mostPopularJob = job.title;
        }
    });

    return {
        totalJobs,
        totalApplications,
        avgApplicationsPerJob,
        jobsWithApplications,
        mostPopularJob: mostPopularJob || "None",
        maxApplications
    };
    // In calculateRecruiterAnalytics function, add:
    const totalViews = jobs.reduce((sum, job) => sum + (job.views || 0), 0);
    const avgViewsPerJob = totalJobs > 0 ? (totalViews / totalJobs).toFixed(1) : 0;
    const applicationRate = totalViews > 0 ? ((totalApplications / totalViews) * 100).toFixed(1) : 0;

    return {
        totalJobs,
        totalApplications,
        totalViews,
        avgApplicationsPerJob,
        avgViewsPerJob,
        applicationRate: applicationRate + '%',
        jobsWithApplications,
        mostPopularJob: mostPopularJob || "None",
        maxApplications
    };
}

// Update recruiter analytics UI
function updateRecruiterAnalyticsUI(analytics, jobs, applications) {
    const analyticsContainer = document.getElementById('view-analytics');
    if (!analyticsContainer) return;

    analyticsContainer.innerHTML = `
        <h3>Recruiter Analytics</h3>
        <div class="grid-cards" style="margin-top: 1.5rem;">
            <div class="glass-card" style="text-align: center;">
                <div style="font-size: 3rem; color: var(--primary);" id="stat-jobs">${analytics.totalJobs}</div>
                <div>Jobs Posted</div>
            </div>
            <div class="glass-card" style="text-align: center;">
                <div style="font-size: 3rem; color: var(--success);">${analytics.totalApplications}</div>
                <div>Total Applications</div>
            </div>
            <div class="glass-card" style="text-align: center;">
                <div style="font-size: 3rem; color: var(--secondary);">${analytics.avgApplicationsPerJob}</div>
                <div>Avg. Applications/Job</div>
            </div>
            <div class="glass-card" style="text-align: center;">
                <div style="font-size: 3rem; color: var(--error);">${analytics.jobsWithApplications}/${analytics.totalJobs}</div>
                <div>Jobs with Applications</div>
            </div>
        </div>
        
        ${analytics.totalJobs > 0 ? `
        <div class="glass-card" style="margin-top: 2rem; padding: 1.5rem;">
            <h4 style="margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                <i class="fa-solid fa-chart-bar" style="color: var(--primary);"></i> Job Performance
            </h4>
            
            ${analytics.mostPopularJob !== "None" ? `
            <div style="margin-bottom: 1rem;">
                <div style="font-size: 0.9rem; color: var(--text-muted);">Most Popular Job</div>
                <div style="font-weight: bold; color: var(--text-main);">${analytics.mostPopularJob}</div>
                <div style="font-size: 0.8rem; color: var(--success);">${analytics.maxApplications} applications</div>
            </div>
            ` : ''}
            
            <div style="margin-top: 1.5rem;">
                <h5 style="margin-bottom: 1rem; font-size: 1rem; color: var(--text-muted);">
                    <i class="fa-solid fa-list"></i> Your Posted Jobs
                </h5>
                <div id="recruiter-job-list" class="history-list" style="max-height: 300px; overflow-y: auto;">
                    ${jobs.map(job => {
        const jobApps = applications.filter(app => app.jobId === job.id);
        return `
                            <div class="history-item" onclick="viewJobAnalytics('${job.id}')" style="cursor: pointer;">
                                <div>
                                    <div style="font-weight: bold;">${job.title}</div>
                                    <div style="font-size: 0.85rem; color: var(--text-muted);">
                                        ${job.company} • ${job.location || 'Remote'} • ${new Date(job.createdAt).toLocaleDateString()}
                                    </div>
                                </div>
                                <div style="text-align: right;">
                                    <div style="color: var(--primary); font-weight: bold;">${jobApps.length}</div>
                                    <div style="font-size: 0.8rem; color: var(--text-muted);">applications</div>
                                </div>
                            </div>
                        `;
    }).join('')}
                </div>
            </div>
        </div>
        ` : `
        <div class="glass-card" style="margin-top: 2rem; padding: 2rem; text-align: center;">
            <i class="fa-solid fa-chart-line" style="font-size: 3rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
            <h4>No Jobs Posted Yet</h4>
            <p style="color: var(--text-muted); margin-top: 0.5rem;">Post your first job to see analytics here.</p>
            <button class="btn btn-primary" style="margin-top: 1rem;" onclick="switchView('recruiter')">
                <i class="fa-solid fa-plus"></i> Post a Job
            </button>
        </div>
        `}
    `;
}

// Show error in recruiter analytics
function showRecruiterAnalyticsError() {
    const analyticsContainer = document.getElementById('view-analytics');
    if (!analyticsContainer) return;

    analyticsContainer.innerHTML = `
        <h3>Recruiter Analytics</h3>
        <div class="glass-card" style="margin-top: 2rem; padding: 2rem; text-align: center;">
            <i class="fa-solid fa-exclamation-triangle" style="font-size: 3rem; color: var(--error); margin-bottom: 1rem;"></i>
            <h4>Error Loading Analytics</h4>
            <p style="color: var(--text-muted); margin-top: 0.5rem;">Could not load your analytics data.</p>
            <button class="btn btn-primary" style="margin-top: 1rem;" onclick="loadRecruiterAnalytics()">
                <i class="fa-solid fa-refresh"></i> Try Again
            </button>
        </div>
    `;
}

// View detailed analytics for a specific job
function viewJobAnalytics(jobId) {
    // Get job details
    db.collection("jobs").doc(jobId).get()
        .then((jobDoc) => {
            if (!jobDoc.exists) {
                alert("Job not found");
                return;
            }

            const job = { id: jobDoc.id, ...jobDoc.data() };

            // Get applications for this job
            return db.collection("applications")
                .where("jobId", "==", jobId)
                .get()
                .then((appsSnapshot) => {
                    const applications = [];
                    appsSnapshot.forEach(doc => {
                        applications.push({ id: doc.id, ...doc.data() });
                    });

                    showJobAnalyticsModal(job, applications);
                });
        })
        .catch((error) => {
            console.error("Error loading job analytics:", error);
            alert("Error loading job analytics: " + error.message);
        });
}

// Show job analytics in modal
function showJobAnalyticsModal(job, applications) {
    // Create modal HTML
    const modalHTML = `
        <div class="modal-overlay" id="job-analytics-modal">
            <div class="modal-content" style="max-width: 800px; max-height: 90vh; overflow-y: auto;">
                <button onclick="closeModal('job-analytics-modal')"
                    style="position:absolute; top:1.5rem; right:1.5rem; background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:1.5rem;">
                    <i class="fa-solid fa-xmark"></i>
                </button>
                
                <h3 style="margin-bottom: 1rem; color: var(--primary);">${job.title}</h3>
                <div style="color: var(--text-muted); margin-bottom: 2rem;">
                    ${job.company} • ${job.location || 'Remote'} • Posted: ${timeAgoShort(job.createdAt)}
                </div>
                
                <div class="grid-cards" style="margin-bottom: 2rem;">
                    <div class="glass-card" style="text-align: center;">
                        <div style="font-size: 2.5rem; color: var(--primary); font-weight: bold;">${applications.length}</div>
                        <div style="color: var(--text-muted);">Total Applications</div>
                    </div>
                    <div class="glass-card" style="text-align: center;">
                        <div style="font-size: 2.5rem; color: var(--success); font-weight: bold;">
                            ${applications.filter(app => app.hasResume).length}
                        </div>
                        <div style="color: var(--text-muted);">With Resume</div>
                    </div>
                    <div class="glass-card" style="text-align: center;">
                        <div style="font-size: 2.5rem; color: var(--secondary); font-weight: bold;">
                            ${new Set(applications.map(app => app.studentEmail)).size}
                        </div>
                        <div style="color: var(--text-muted);">Unique Applicants</div>
                    </div>
                </div>
                
                <h4 style="margin-bottom: 1rem;">
                    <i class="fa-solid fa-users"></i> Applicants (${applications.length})
                </h4>
                
                <div id="job-applicants-list" style="max-height: 400px; overflow-y: auto; margin-bottom: 1.5rem;">
                    ${applications.length > 0 ?
            applications.map(app => `
                            <div class="history-item" style="margin-bottom: 0.75rem;">
                                <div>
                                    <div style="font-weight: bold;">${app.studentName}</div>
                                    <div style="font-size: 0.85rem; color: var(--text-muted);">
                                        ${app.studentEmail}
                                    </div>
                                    <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem;">
                                        Applied ${timeAgoShort(app.appliedAt)}
                                        ${app.hasResume ?
                    '<span class="resume-badge resume-available"><i class="fa-solid fa-file"></i> Has Resume</span>' :
                    '<span class="resume-badge resume-not-available"><i class="fa-solid fa-file-circle-xmark"></i> No Resume</span>'
                }
                                    </div>
                                </div>
                                <div>
                                    <button class="btn btn-primary" onclick="viewStudentProfile('${app.studentId}')" style="font-size: 0.85rem;">
                                        <i class="fa-solid fa-eye"></i> View
                                    </button>
                                </div>
                            </div>
                        `).join('') :
            `<div style="text-align: center; padding: 2rem; color: var(--text-muted);">
                            <i class="fa-solid fa-users-slash" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                            <p>No applications yet</p>
                        </div>`
        }
                </div>
                
                <div style="display: flex; justify-content: space-between; margin-top: 1.5rem;">
                    <button class="btn btn-primary" onclick="viewApplicants('${job.id}', '${job.title}')">
                        <i class="fa-solid fa-user-check"></i> Manage Applications
                    </button>
                    <button class="btn btn-glass" onclick="closeModal('job-analytics-modal')">
                        Close
                    </button>
                </div>
            </div>
        </div>
    `;

    // Add modal to page
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHTML;
    document.body.appendChild(modalContainer);

    // Show modal
    setTimeout(() => {
        document.getElementById('job-analytics-modal').style.display = 'flex';
    }, 10);
}

// Load student analytics
function loadStudentAnalytics() {
    if (!State.currentUser || State.currentUser.role !== 'student') {
        // Hide student charts for non-students
        const chartsContainer = document.getElementById('student-analytics-charts');
        const resultsTitle = document.getElementById('results-title');

        if (chartsContainer) chartsContainer.style.display = 'none';
        if (resultsTitle) resultsTitle.textContent = "Your Profile Data";

        // Don't load charts for recruiters
        return;
    }

    // Show charts for students
    const chartsContainer = document.getElementById('student-analytics-charts');
    if (chartsContainer) chartsContainer.style.display = 'block';

    // Initialize or update chart
    initStudentAnalyticsChart();
}

// Initialize student analytics chart
function initStudentAnalyticsChart() {
    const ctx = document.getElementById('analyticsChart');
    if (!ctx) return;

    // Get mock test data
    db.collection("users").doc(State.currentUser.uid).collection("mock_tests")
        .orderBy("timestamp", "desc")
        .limit(5)
        .get()
        .then((snapshot) => {
            const mockData = [];
            const dates = [];

            snapshot.forEach(doc => {
                const data = doc.data();
                const percentage = Math.round((data.score / data.total) * 100);
                mockData.push(percentage);
                dates.push(new Date(data.timestamp).toLocaleDateString());
            });

            // Get interview data
            return db.collection("users").doc(State.currentUser.uid).collection("interviews")
                .orderBy("timestamp", "desc")
                .limit(5)
                .get()
                .then((interviewSnapshot) => {
                    const interviewData = [];

                    interviewSnapshot.forEach(doc => {
                        const data = doc.data();
                        const score = data.scores?.technical || 0;
                        interviewData.push(score * 10); // Convert to percentage
                    });

                    // Create or update chart
                    createStudentChart(mockData.reverse(), interviewData.reverse(), dates.reverse());
                });
        })
        .catch((error) => {
            console.error("Error loading analytics data:", error);
        });
}

// Handle profile photo upload
function handleProfilePhotoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!State.currentUser || !State.currentUser.uid) {
        alert("Please login to update profile.");
        return;
    }

    // Validate size (max 500KB)
    if (file.size > 500 * 1024) {
        alert("Image too large. Max size is 500KB.");
        event.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        const photoURL = e.target.result;

        // Show loading state in preview
        const preview = document.getElementById('profile-photo-preview');
        if (preview) preview.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

        // Update in Firestore
        db.collection("users").doc(State.currentUser.uid).update({
            photoURL: photoURL
        }).then(() => {
            // Update local state
            State.currentUser.photoURL = photoURL;

            // Update UI
            updateProfileView();
            updateHeader();

            alert("Profile photo updated!");
        }).catch(err => {
            console.error("Error updating photo:", err);
            alert("Error updating photo: " + err.message);
            updateProfileView(); // Reset UI
        });
    };
    reader.readAsDataURL(file);
    event.target.value = '';
}

function removeProfilePhoto() {
    if (!confirm("Remove profile photo?")) return;

    db.collection("users").doc(State.currentUser.uid).update({
        photoURL: null
    }).then(() => {
        State.currentUser.photoURL = null;
        updateProfileView();
        updateHeader();
    }).catch(err => alert("Error removing photo: " + err.message));
}

// Function to update profile view based on user role
function updateProfileView() {
    // Update Photo Preview
    const preview = document.getElementById('profile-photo-preview');
    const removeBtn = document.getElementById('remove-photo-btn');

    if (preview && State.currentUser) {
        if (State.currentUser.photoURL) {
            preview.innerHTML = `<img src="${State.currentUser.photoURL}" style="width:100%; height:100%; object-fit:cover;">`;
            if (removeBtn) removeBtn.style.display = 'inline-flex';
        } else {
            const initials = State.currentUser.name ? State.currentUser.name.charAt(0).toUpperCase() : 'U';
            preview.innerHTML = initials;
            if (removeBtn) removeBtn.style.display = 'none';
        }
    }

    // Populate form fields
    if (document.getElementById('profile-name') && State.currentUser) {
        document.getElementById('profile-name').value = State.currentUser.name || '';
        document.getElementById('profile-email').value = State.currentUser.email || '';

        const uniInput = document.getElementById('profile-university');
        if (uniInput) uniInput.value = State.currentUser.university || '';

        const streamInput = document.getElementById('profile-stream');
        if (streamInput) streamInput.value = State.currentUser.stream || '';

        const branchInput = document.getElementById('profile-branch');
        if (branchInput) branchInput.value = State.currentUser.branch || '';
    }

    const resumeSection = document.getElementById('resume-section');
    const appliedJobsSection = document.getElementById('applied-jobs-section');

    if (!State.currentUser) return;

    if (State.currentUser.role === 'student') {
        // Show resume and applied jobs for students
        if (resumeSection) {
            resumeSection.innerHTML = `
                <h4 style="margin-bottom: 1rem;"><i class="fa-solid fa-file-pdf"
                        style="color:var(--primary)"></i> My Resume</h4>
                
                <div id="resume-status" style="margin-bottom: 1rem; padding: 1rem; background: rgba(0,0,0,0.1); border-radius: 8px;">
                    <div id="resume-message" style="color: var(--text-muted);">
                        No resume uploaded yet.
                    </div>
                    <div id="resume-file-name" style="display: none; font-weight: bold; color: var(--primary);"></div>
                    <div id="resume-upload-date" style="display: none; font-size: 0.8rem; color: var(--text-muted);"></div>
                </div>
                
                <input type="file" id="resume-upload" accept=".pdf,.doc,.docx,.txt" style="display: none;">
                <div style="display: flex; gap: 1rem;">
                    <button class="btn btn-primary" onclick="document.getElementById('resume-upload').click()">
                        <i class="fa-solid fa-upload"></i> Upload Resume
                    </button>
                    <button id="view-resume-btn" class="btn btn-glass" style="display: none;" onclick="viewMyResume()">
                        <i class="fa-solid fa-eye"></i> View Resume
                    </button>
                    <button id="delete-resume-btn" class="btn btn-error" style="display: none;" onclick="deleteResume()">
                        <i class="fa-solid fa-trash"></i> Delete
                    </button>
                </div>
                <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.5rem;">
                    Supported formats: PDF, DOC, DOCX, TXT (Max 5MB)
                </p>
            `;

            // Re-attach event listener for resume upload
            const resumeUpload = document.getElementById('resume-upload');
            if (resumeUpload) {
                resumeUpload.addEventListener('change', handleResumeUpload);
            }
        }

        if (appliedJobsSection) {
            appliedJobsSection.innerHTML = `
                <h4 style="margin-bottom: 1rem;"><i class="fa-solid fa-briefcase"
                        style="color:var(--primary)"></i> My Applied Jobs</h4>
                <div id="profile-applications-list" class="history-list"
                    style="max-height: 250px; overflow-y: auto;">
                    <!-- Populated by JS -->
                </div>
            `;

            // Load applications for student
            loadMyApplications();
        }

        // Load user's resume data
        loadUserResume();

    } else if (State.currentUser.role === 'recruiter') {
        // Hide resume and applied jobs for recruiters
        if (resumeSection) {
            resumeSection.innerHTML = `
                <div style="text-align: center; padding: 1rem; color: var(--text-muted);">
                    <i class="fa-solid fa-user-tie" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                    <p>Resume upload is for job applicants only.</p>
                    <p style="font-size: 0.9rem;">As a recruiter, you can view applicants' resumes in the job applications.</p>
                </div>
            `;
        }

        if (appliedJobsSection) {
            appliedJobsSection.innerHTML = `
                <div style="text-align: center; padding: 1rem; color: var(--text-muted);">
                    <i class="fa-solid fa-briefcase" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                    <p>Job applications will appear here when candidates apply to your posted jobs.</p>
                    <p style="font-size: 0.9rem;">Check the "View Applicants" button on your job posts.</p>
                </div>
            `;
        }
    }

    // --- PASSWORD MANAGEMENT SECTION ---
    const passwordSection = document.getElementById('password-management-section');
    const user = firebase.auth().currentUser;

    if (passwordSection && user) {
        // providerData is an array of provider objects
        const providers = user.providerData.map(p => p.providerId);
        const hasPassword = providers.includes('password');
        const hasGoogle = providers.includes('google.com');

        // Clear previous
        passwordSection.innerHTML = '';

        let html = '<h4 style="margin-bottom: 1rem;"><i class="fa-solid fa-lock" style="color:var(--primary)"></i> Account Security</h4>';

        if (hasPassword) {
            // User has password set (can be email/password login)
            html += `
                <div class="glass-card" style="padding: 1.5rem;">
                    <h5 style="margin-bottom: 0.5rem;">Change Password</h5>
                    <p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 1rem;">
                        Update your password or send a reset email.
                    </p>
                    
                    <div class="form-group">
                        <label class="form-label" style="font-size:0.8rem;">Current Password</label>
                        <input type="password" id="current-password-input" class="form-input" placeholder="Current Password">
                    </div>

                    <div class="form-group">
                        <label class="form-label" style="font-size:0.8rem;">New Password</label>
                        <input type="password" id="new-password-input" class="form-input" placeholder="New Password (min 6 chars)">
                    </div>
                    
                    <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                         <button class="btn btn-primary" onclick="updateUserPassword()">
                            Update Password
                        </button>
                        <button class="btn btn-glass" onclick="sendPasswordReset()">
                            Send Reset Email
                        </button>
                    </div>
                </div>
            `;
        } else if (hasGoogle) {
            // User logged in with Google but hasn't set up a password yet
            html += `
                <div class="glass-card" style="padding: 1.5rem;">
                    <h5 style="margin-bottom: 0.5rem;">Create Password</h5>
                    <p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 1rem;">
                        Add a password to enable email/password login in addition to Google sign-in.
                    </p>
                    
                    <div class="form-group">
                         <input type="password" id="new-password-input" class="form-input" placeholder="Create Password (min 6 chars)">
                    </div>
                    
                    <button class="btn btn-primary" onclick="updateUserPassword()">
                        Create Password
                    </button>
                </div>
             `;
        }

        passwordSection.innerHTML = html;
    }
}

// Update user password (or create one)
function updateUserPassword() {
    const newPassword = document.getElementById('new-password-input').value;
    if (!newPassword || newPassword.length < 6) {
        alert("Password must be at least 6 characters long.");
        return;
    }

    const user = firebase.auth().currentUser;
    if (user) {
        const updatePassword = () => {
            user.updatePassword(newPassword).then(() => {
                alert("Password updated successfully! You can now log in with email and password.");
                document.getElementById('new-password-input').value = '';
                if (document.getElementById('current-password-input')) {
                    document.getElementById('current-password-input').value = '';
                }
                // Reload page to refresh provider state
                window.location.reload();
            }).catch((error) => {
                console.error(error);
                if (error.code === 'auth/requires-recent-login') {
                    alert("For security, please logout and login again to update your password.");
                } else {
                    alert("Error updating password: " + error.message);
                }
            });
        };

        // Check if we need re-auth (if current password input is visible)
        const currentPassInput = document.getElementById('current-password-input');
        if (currentPassInput) {
            const currentPassword = currentPassInput.value;
            if (!currentPassword) {
                alert("Please enter your current password to verify your identity.");
                return;
            }

            const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
            user.reauthenticateWithCredential(credential)
                .then(() => {
                    // Re-auth successful, proceed to update
                    updatePassword();
                })
                .catch((error) => {
                    console.error("Re-auth error:", error);
                    alert("Incorrect current password.");
                });
        } else {
            // No current password needed (e.g. Google sign-in creating first password)
            updatePassword();
        }
    }
}

// Send password reset email
function sendPasswordReset() {
    const user = firebase.auth().currentUser;
    const email = user ? user.email : (State.currentUser ? State.currentUser.email : null);

    if (!email) {
        alert("Email not found.");
        return;
    }

    if (confirm(`Send password reset email to ${email}?`)) {
        auth.sendPasswordResetEmail(email).then(() => {
            alert("Password reset email sent! Check your inbox.");
        }).catch((error) => {
            alert("Error: " + error.message);
        });
    }
}

// Create student analytics chart
function createStudentChart(mockData, interviewData, dates) {
    const ctx = document.getElementById('analyticsChart').getContext('2d');

    // Destroy existing chart if it exists
    if (window.studentAnalyticsChart) {
        window.studentAnalyticsChart.destroy();
    }

    window.studentAnalyticsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates.length > 0 ? dates : ['Test 1', 'Test 2', 'Test 3', 'Test 4', 'Test 5'],
            datasets: [{
                label: 'Mock Test Score (%)',
                data: mockData.length > 0 ? mockData : [65, 72, 80, 68, 85],
                borderColor: '#00f3ff',
                backgroundColor: 'rgba(0, 243, 255, 0.1)',
                fill: true,
                tension: 0.4
            }, {
                label: 'Interview Rating (%)',
                data: interviewData.length > 0 ? interviewData : [70, 75, 65, 80, 85],
                borderColor: '#8b5cf6',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                fill: true,
                tension: 0.4,
                yAxisID: 'y'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    labels: {
                        color: 'var(--text-muted)',
                        font: { size: 12 }
                    }
                },
                title: {
                    display: true,
                    text: 'Your Performance Trend',
                    color: 'var(--text-main)',
                    font: { size: 16, weight: 'bold' }
                }
            },
            scales: {
                x: {
                    ticks: { color: 'var(--text-muted)' },
                    grid: { color: 'rgba(255,255,255,0.05)' }
                },
                y: {
                    max: 100,
                    min: 0,
                    ticks: { color: 'var(--text-muted)' },
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    title: {
                        display: true,
                        text: 'Score (%)',
                        color: 'var(--text-muted)'
                    }
                }
            }
        }
    });
}


function openSquadDetails(squadIndex) {
    // Use array index as fallback
    if (State.liveSquads[squadIndex]) {
        const squad = State.liveSquads[squadIndex];
        viewSquadMembers(squad.id, squad.name);
    } else {
        alert("Squad not found. Please try again.");
    }
}



// Render available squads
function renderSquads() {
    const container = document.getElementById('squad-container');
    if (!container) return;
    container.innerHTML = '';

    console.log("Rendering squads... Total squads:", State.liveSquads.length);

    // Show current squad status
    if (State.currentUser.squadId) {
        const currentSquad = State.liveSquads.find(s => s.name === State.currentUser.squadId);

        if (currentSquad) {
            document.getElementById('my-squad-status').innerHTML = `
                <div class="glass-card" style="border-color: var(--success); margin-bottom: 2rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <div>
                            <h4 style="margin-bottom: 0.25rem; color: var(--success);">
                                <i class="fa-solid fa-users"></i> ${currentSquad.name}
                            </h4>
                            <div style="font-size: 0.85rem; color: var(--text-muted);">
                                ${currentSquad.members ? currentSquad.members.length : 1} member${(currentSquad.members ? currentSquad.members.length : 1) !== 1 ? 's' : ''}
                                ${currentSquad.creatorId === State.currentUser.uid ? ' • Your Squad' : ''}
                            </div>
                        </div>
                        <div style="display: flex; gap: 0.5rem;">
                            <button class="btn btn-primary" onclick="viewSquadMembers('${currentSquad.id}', '${currentSquad.name}')">
                                <i class="fa-solid fa-eye"></i> View Members
                            </button>
                            <button class="btn btn-glass" onclick="leaveSquad()">
                                Leave Squad
                            </button>
                        </div>
                    </div>
                </div>`;
        }
    } else {
        document.getElementById('my-squad-status').innerHTML = '';
    }

    // Render available squads
    if (State.liveSquads.length === 0) {
        container.innerHTML = `
            <div class="glass-card" style="text-align: center; padding: 4rem 2rem; grid-column: 1 / -1;">
                <i class="fa-solid fa-users-slash" style="font-size: 3rem; color: var(--text-muted); margin-bottom: 1.5rem;"></i>
                <h4 style="color: var(--text-muted); margin-bottom: 1rem;">No Squads Available</h4>
                <p style="color: var(--text-muted); margin-bottom: 2rem;">Be the first to create a squad!</p>
                <button class="btn btn-primary" onclick="showCreateSquadModal()">
                    <i class="fa-solid fa-plus"></i> Create First Squad
                </button>
            </div>
        `;
        return;
    }

    // Show all squads
    State.liveSquads.forEach(s => {
        const isCreator = s.creatorId === State.currentUser.uid;
        const isMember = State.currentUser.squadId === s.name;
        const memberCount = s.members ? s.members.length : 1;
        const maxMembers = 5;

        // Create member preview
        let membersPreview = '';
        if (s.members && s.members.length > 0) {
            membersPreview = s.members.slice(0, 3).map(member => `
                <div style="display: flex; align-items: center; margin-bottom: 0.5rem;">
                    <div style="width: 24px; height: 24px; background: ${member.role === 'Lead' ? 'var(--primary-glow)' : 'rgba(255,255,255,0.1)'}; 
                         border-radius: 50%; margin-right: 0.5rem; display: flex; align-items: center; justify-content: center;">
                        ${member.role === 'Lead' ?
                    '<i class="fa-solid fa-crown" style="font-size: 0.7rem; color: var(--primary);"></i>' :
                    '<i class="fa-solid fa-user" style="font-size: 0.7rem; color: var(--text-muted);"></i>'
                }
                    </div>
                    <div style="font-size: 0.85rem; color: ${member.id === State.currentUser.uid ? 'var(--primary)' : 'var(--text-main)'}">
                        ${member.name} ${member.id === State.currentUser.uid ? '(You)' : ''}
                    </div>
                </div>
            `).join('');

            if (s.members.length > 3) {
                membersPreview += `
                    <div style="font-size: 0.8rem; color: var(--text-muted); text-align: center; padding: 0.25rem;">
                        +${s.members.length - 3} more member${(s.members.length - 3) !== 1 ? 's' : ''}
                    </div>
                `;
            }
        }

        const div = document.createElement('div');
        div.className = 'glass-card';

        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                <div>
                    <h4 style="margin-bottom: 0.25rem;">${s.name}</h4>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">
                        <i class="fa-solid fa-user"></i> ${s.creatorName || 'Unknown'}
                    </div>
                </div>
                <div>
                    ${isCreator ?
                `<span class="badge" style="background: var(--primary-glow); color: var(--primary); font-size: 0.7rem;">
                            <i class="fa-solid fa-crown"></i> Your Squad
                        </span>` :
                ''
            }
                </div>
            </div>
            
            <div style="margin: 1rem 0;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <div style="font-size: 0.85rem; color: var(--text-muted);">
                        <i class="fa-solid fa-users"></i> ${memberCount}/${maxMembers} members
                    </div>
                    <div style="width: 80px; height: 6px; background: var(--border); border-radius: 3px; overflow: hidden;">
                        <div style="width: ${(memberCount / maxMembers) * 100}%; height: 100%; background: var(--primary);"></div>
                    </div>
                </div>
                
                ${membersPreview ? `
                    <div style="margin-top: 1rem; padding: 1rem; background: rgba(0,0,0,0.1); border-radius: 8px;">
                        <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.5rem;">
                            <i class="fa-solid fa-user-group"></i> Members:
                        </div>
                        ${membersPreview}
                    </div>
                ` : ''}
            </div>
            
            <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
                <!-- VIEW MEMBERS BUTTON (Visible to everyone) -->
                <button class="btn btn-primary" style="flex: 1;" onclick="viewSquadMembers('${s.id}', '${s.name}')">
                    <i class="fa-solid fa-eye"></i> View Members
                </button>
                
                ${isCreator ? `
                    <!-- DELETE BUTTON (Only for creator) -->
                    <button class="btn btn-error" style="flex: 1;" onclick="deleteSquad('${s.id}', '${s.name}')">
                        <i class="fa-solid fa-trash"></i> Delete
                    </button>
                ` : isMember ? `
                    <!-- LEAVE BUTTON (For members) -->
                    <button class="btn btn-glass" style="flex: 1;" onclick="leaveSquad()">
                        <i class="fa-solid fa-sign-out-alt"></i> Leave
                    </button>
                ` : `
                    <!-- JOIN BUTTON (For non-members) -->
                    <button class="btn btn-glass" style="flex: 1;" onclick="joinSquad('${s.id}', '${s.name}')">
                        <i class="fa-solid fa-user-plus"></i> Join
                    </button>
                `}
            </div>
        `;

        container.appendChild(div);
    });
}

// Update viewSquadMembers to include real-time updates
function viewSquadMembers(squadId, squadName) {
    const squad = State.liveSquads.find(s => s.id === squadId);

    if (!squad) {
        alert('Squad not found');
        return;
    }

    // Create modal
    createSquadModal(squad);

    // Set up real-time listener for this specific squad
    setupSquadRealTimeListener(squadId);
}

function createSquadModal(squad) {
    const isCreator = squad.creatorId === State.currentUser.uid;
    const isMember = State.currentUser.squadId === squad.name;
    const memberCount = squad.members ? squad.members.length : 1;

    // Build members HTML with real-time updates
    let membersHTML = buildMembersHTML(squad);

    const modalHTML = `
        <div class="modal-overlay" id="squad-members-modal">
            <div class="modal-content" style="max-width: 700px; max-height: 90vh; overflow-y: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <div style="width: 60px; height: 60px; background: var(--primary-glow); border-radius: 12px; 
                             display: flex; align-items: center; justify-content: center;">
                            <i class="fa-solid fa-users" style="color: var(--primary); font-size: 1.8rem;"></i>
                        </div>
                        <div>
                            <h3 style="margin-bottom: 0.25rem;">${squad.name}</h3>
                            <div style="color: var(--text-muted); display: flex; align-items: center; gap: 1rem;">
                                <span id="live-member-count">${memberCount} member${memberCount !== 1 ? 's' : ''}</span>
                                <span id="live-update-indicator" style="display: none;">
                                    <i class="fa-solid fa-circle" style="color: var(--success); font-size: 0.6rem;"></i> 
                                    <span style="font-size: 0.8rem;">Live</span>
                                </span>
                            </div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-glass" onclick="refreshSquadView('${squad.id}')" title="Refresh">
                            <i class="fa-solid fa-rotate"></i>
                        </button>
                        <button onclick="closeModal('squad-members-modal')"
                            style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:1.5rem;">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                </div>
                
                <!-- Quick Stats with real-time updates -->
                <div style="display: flex; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap;" id="squad-stats">
                    ${buildSquadStatsHTML(squad)}
                </div>
                
                <!-- LIVE MEMBERS SECTION -->
                <h4 style="margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                    <i class="fa-solid fa-user-group"></i> 
                    Squad Members 
                    <span id="members-count-badge" class="badge" style="background: var(--primary-glow); color: var(--primary);">
                        ${memberCount}
                    </span>
                </h4>
                
                <div id="squad-members-list" style="max-height: 400px; overflow-y: auto; padding-right: 0.5rem;">
                    ${membersHTML}
                </div>
                
                <!-- ACTIONS SECTION -->
                <div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--border);">
                    <div style="display: flex; gap: 1rem;">
                        ${isCreator ? `
                            <button class="btn btn-primary" onclick="inviteToSquad('${squad.id}', '${squad.name}')" style="flex: 1;">
                                <i class="fa-solid fa-user-plus"></i> Invite Members
                            </button>
                            <button class="btn btn-error" onclick="deleteSquad('${squad.id}', '${squad.name}')" style="flex: 1;">
                                <i class="fa-solid fa-trash"></i> Delete Squad
                            </button>
                        ` : isMember ? `
                            <button class="btn btn-error" onclick="leaveSquad()" style="flex: 1;">
                                <i class="fa-solid fa-sign-out-alt"></i> Leave Squad
                            </button>
                            <button class="btn btn-glass" onclick="closeModal('squad-members-modal')" style="flex: 1;">
                                Close
                            </button>
                        ` : `
                            <button class="btn btn-primary" onclick="joinSquad('${squad.id}', '${squad.name}')" style="flex: 1;">
                                <i class="fa-solid fa-user-plus"></i> Join This Squad
                            </button>
                            <button class="btn btn-glass" onclick="closeModal('squad-members-modal')" style="flex: 1;">
                                <i class="fa-solid fa-xmark"></i> Close
                            </button>
                        `}
                    </div>
                </div>
            </div>
        </div>
    `;

    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHTML;
    modalContainer.id = 'squad-modal-container';
    document.body.appendChild(modalContainer);

    setTimeout(() => {
        document.getElementById('squad-members-modal').style.display = 'flex';
    }, 10);
}

// Set up real-time listener for a specific squad
function setupSquadRealTimeListener(squadId) {
    // Remove existing listener if any
    if (window.squadListener) {
        window.squadListener();
    }

    // Set up new real-time listener
    window.squadListener = db.collection("squads").doc(squadId)
        .onSnapshot((doc) => {
            if (!doc.exists) {
                // Squad was deleted
                closeModal('squad-members-modal');
                showSquadToast("Squad Deleted", "This squad no longer exists");
                return;
            }

            const squad = { id: doc.id, ...doc.data() };
            updateSquadModalInRealTime(squad);

            // Show live indicator
            const indicator = document.getElementById('live-update-indicator');
            if (indicator) {
                indicator.style.display = 'flex';
                indicator.style.alignItems = 'center';
                indicator.style.gap = '0.25rem';

                // Pulse animation
                indicator.style.animation = 'pulse 1s';
                setTimeout(() => {
                    if (indicator) indicator.style.animation = '';
                }, 1000);
            }

        }, (error) => {
            console.error("Real-time squad listener error:", error);
        });
}

// Update squad modal in real-time
function updateSquadModalInRealTime(squad) {
    // Update member count
    const memberCount = squad.members ? squad.members.length : 1;

    // Update counters
    const memberCountEl = document.getElementById('live-member-count');
    const memberBadge = document.getElementById('members-count-badge');

    if (memberCountEl) {
        memberCountEl.textContent = `${memberCount} member${memberCount !== 1 ? 's' : ''}`;
    }
    if (memberBadge) {
        memberBadge.textContent = memberCount;
    }

    // Update stats
    const statsEl = document.getElementById('squad-stats');
    if (statsEl) {
        statsEl.innerHTML = buildSquadStatsHTML(squad);
    }

    // Update members list
    const membersList = document.getElementById('squad-members-list');
    if (membersList) {
        membersList.innerHTML = buildMembersHTML(squad);
    }
}

// Build HTML for members list
function buildMembersHTML(squad) {
    if (!squad.members || squad.members.length === 0) {
        return '<div class="glass-card" style="text-align: center; padding: 3rem; color: var(--text-muted);">' +
            '<i class="fa-solid fa-users-slash" style="font-size: 3rem; margin-bottom: 1rem;"></i>' +
            '<p>No members found</p></div>';
    }

    return squad.members.map((member, index) => {
        const isCurrentUser = member.id === State.currentUser.uid;
        const isLeader = member.role === 'Lead';

        return `
            <div class="glass-card" style="margin-bottom: 1rem; padding: 1rem; ${isCurrentUser ? 'border-left: 4px solid var(--primary);' : ''}
                 animation: fadeIn 0.3s ease;">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 1rem; flex: 1;">
                        <div style="position: relative;">
                            <div style="width: 48px; height: 48px; background: ${isLeader ? 'var(--primary-glow)' : 'rgba(255,255,255,0.1)'}; 
                                 border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                                ${isLeader ?
                '<i class="fa-solid fa-crown" style="color:var(--primary); font-size: 1.2rem;"></i>' :
                `<span style="font-weight: bold; font-size: 1.2rem; color: ${isCurrentUser ? 'var(--primary)' : 'var(--text-main)'}">${member.name.charAt(0).toUpperCase()}</span>`
            }
                            </div>
                            ${isCurrentUser ?
                '<div style="position: absolute; bottom: -2px; right: -2px; background: var(--success); color: white; width: 16px; height: 16px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.6rem;">✓</div>' :
                ''
            }
                        </div>
                        <div style="flex: 1;">
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <h5 style="margin: 0; color: ${isCurrentUser ? 'var(--primary)' : 'var(--text-main)'}">
                                    ${member.name} ${isCurrentUser ? '(You)' : ''}
                                </h5>
                                ${isLeader ?
                '<span class="badge" style="background: var(--primary-glow); color: var(--primary); font-size: 0.7rem;">Leader</span>' :
                '<span class="badge" style="background: rgba(255,255,255,0.1); color: var(--text-muted); font-size: 0.7rem;">Member</span>'
            }
                            </div>
                            <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.25rem;">
                                Member #${index + 1}
                            </div>
                            ${member.email ?
                `<div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem;">
                                    <i class="fa-solid fa-envelope"></i> ${member.email}
                                </div>` :
                ''
            }
                        </div>
                    </div>
                    
                    ${squad.creatorId === State.currentUser.uid && !isLeader && member.id !== State.currentUser.uid ? `
                        <div style="display: flex; gap: 0.5rem;">
                            <button class="btn btn-glass" onclick="promoteToLeader('${squad.id}', '${member.id}', '${member.name}')" 
                                style="font-size: 0.8rem; padding: 0.4rem 0.8rem;">
                                <i class="fa-solid fa-crown"></i> Make Leader
                            </button>
                            <button class="btn btn-error" onclick="removeFromSquad('${squad.id}', '${member.id}', '${member.name}')"
                                style="font-size: 0.8rem; padding: 0.4rem 0.8rem;">
                                <i class="fa-solid fa-user-minus"></i> Remove
                            </button>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// Build HTML for squad stats
function buildSquadStatsHTML(squad) {
    const memberCount = squad.members ? squad.members.length : 1;
    const leaderCount = squad.members ? squad.members.filter(m => m.role === 'Lead').length : 1;

    return `
        <div class="glass-card" style="flex: 1; min-width: 150px; text-align: center;">
            <div style="font-size: 2rem; font-weight: bold; color: var(--primary);">
                ${memberCount}
            </div>
            <div style="font-size: 0.85rem; color: var(--text-muted);">Total Members</div>
        </div>
        <div class="glass-card" style="flex: 1; min-width: 150px; text-align: center;">
            <div style="font-size: 2rem; font-weight: bold; color: var(--success);">
                ${leaderCount}
            </div>
            <div style="font-size: 0.85rem; color: var(--text-muted);">Leaders</div>
        </div>
        <div class="glass-card" style="flex: 1; min-width: 150px; text-align: center;">
            <div style="font-size: 2rem; font-weight: bold; color: var(--secondary);">
                ${5 - memberCount}
            </div>
            <div style="font-size: 0.85rem; color: var(--text-muted);">Spots Available</div>
        </div>
    `;
}

// Refresh squad view manually
function refreshSquadView(squadId) {
    const squad = State.liveSquads.find(s => s.id === squadId);
    if (squad) {
        updateSquadModalInRealTime(squad);

        // Show refresh indicator
        const refreshBtn = event?.target?.closest('button');
        if (refreshBtn) {
            refreshBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            setTimeout(() => {
                refreshBtn.innerHTML = '<i class="fa-solid fa-rotate"></i>';
            }, 1000);
        }
    }
}

// Add CSS animations for real-time updates
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
    }
    
    @keyframes pulse {
        0% { opacity: 1; }
        50% { opacity: 0.5; }
        100% { opacity: 1; }
    }
    
    #live-update-indicator {
        animation: pulse 2s infinite;
    }
`;
document.head.appendChild(style);

function showSquadModal(squad) {
    const isCreator = squad.creatorId === State.currentUser.uid;
    const isMember = State.currentUser.squadId === squad.name;

    console.log("Creating modal for squad:", squad.name);
    console.log("Is creator?", isCreator);
    console.log("Is member?", isMember);

    // Build members HTML
    let membersHTML = '';
    if (squad.members && squad.members.length > 0) {
        membersHTML = squad.members.map((member, index) => {
            const isCurrentUser = member.id === State.currentUser.uid;
            const isLeader = member.role === 'Lead';

            return `
                <div class="glass-card" style="margin-bottom: 1rem; padding: 1rem;">
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <div style="display: flex; align-items: center; gap: 1rem; flex: 1;">
                            <div style="position: relative;">
                                <div style="width: 48px; height: 48px; background: ${isLeader ? 'var(--primary-glow)' : 'rgba(255,255,255,0.1)'}; 
                                     border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                                    ${isLeader ?
                    '<i class="fa-solid fa-crown" style="color:var(--primary); font-size: 1.2rem;"></i>' :
                    `<span style="font-weight: bold; font-size: 1.2rem;">${member.name.charAt(0).toUpperCase()}</span>`
                }
                                </div>
                                ${isCurrentUser ?
                    '<div style="position: absolute; bottom: -2px; right: -2px; background: var(--success); color: white; width: 16px; height: 16px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.6rem;">✓</div>' :
                    ''
                }
                            </div>
                            <div style="flex: 1;">
                                <div style="display: flex; align-items: center; gap: 0.5rem;">
                                    <h5 style="margin: 0;">${member.name}</h5>
                                    ${isLeader ?
                    '<span class="badge" style="background: var(--primary-glow); color: var(--primary); font-size: 0.7rem;">Leader</span>' :
                    '<span class="badge" style="background: rgba(255,255,255,0.1); color: var(--text-muted); font-size: 0.7rem;">Member</span>'
                }
                                </div>
                                <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.25rem;">
                                    Member #${index + 1}
                                </div>
                                ${member.email ?
                    `<div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem;">
                                        <i class="fa-solid fa-envelope"></i> ${member.email}
                                    </div>` :
                    ''
                }
                            </div>
                        </div>
                        
                        ${isCreator && !isLeader && member.id !== State.currentUser.uid ? `
                            <div style="display: flex; gap: 0.5rem;">
                                <button class="btn btn-glass" onclick="promoteToLeader('${squad.id}', '${member.id}', '${member.name}')" 
                                    style="font-size: 0.8rem; padding: 0.4rem 0.8rem;">
                                    <i class="fa-solid fa-crown"></i> Make Leader
                                </button>
                                <button class="btn btn-error" onclick="removeFromSquad('${squad.id}', '${member.id}', '${member.name}')"
                                    style="font-size: 0.8rem; padding: 0.4rem 0.8rem;">
                                    <i class="fa-solid fa-user-minus"></i> Remove
                                </button>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    // Build the modal HTML
    const modalHTML = `
        <div class="modal-overlay" id="squad-members-modal">
            <div class="modal-content" style="max-width: 700px; max-height: 90vh; overflow-y: auto;">
                <button onclick="closeModal('squad-members-modal')"
                    style="position:absolute; top:1.5rem; right:1.5rem; background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:1.5rem;">
                    <i class="fa-solid fa-xmark"></i>
                </button>
                
                <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem;">
                    <div style="width: 60px; height: 60px; background: var(--primary-glow); border-radius: 12px; 
                         display: flex; align-items: center; justify-content: center;">
                        <i class="fa-solid fa-users" style="color: var(--primary); font-size: 1.8rem;"></i>
                    </div>
                    <div>
                        <h3 style="margin-bottom: 0.25rem;">${squad.name}</h3>
                        <div style="color: var(--text-muted);">
                            ${squad.memberCount || squad.members?.length || 1} member${(squad.memberCount || squad.members?.length || 1) !== 1 ? 's' : ''} • 
                            Created by ${squad.creatorName}
                        </div>
                    </div>
                </div>
                
                <div style="display: flex; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap;">
                    <div class="glass-card" style="flex: 1; min-width: 150px; text-align: center;">
                        <div style="font-size: 2rem; font-weight: bold; color: var(--primary);">
                            ${squad.memberCount || squad.members?.length || 1}
                        </div>
                        <div style="font-size: 0.85rem; color: var(--text-muted);">Total Members</div>
                    </div>
                    <div class="glass-card" style="flex: 1; min-width: 150px; text-align: center;">
                        <div style="font-size: 2rem; font-weight: bold; color: var(--success);">
                            ${squad.members ? squad.members.filter(m => m.role === 'Lead').length : 1}
                        </div>
                        <div style="font-size: 0.85rem; color: var(--text-muted);">Leaders</div>
                    </div>
                    <div class="glass-card" style="flex: 1; min-width: 150px; text-align: center;">
                        <div style="font-size: 2rem; font-weight: bold; color: var(--secondary);">
                            ${5 - (squad.memberCount || squad.members?.length || 1)}
                        </div>
                        <div style="font-size: 0.85rem; color: var(--text-muted);">Spots Available</div>
                    </div>
                </div>
                
                <h4 style="margin-bottom: 1rem;">
                    <i class="fa-solid fa-user-group"></i> Squad Members
                </h4>
                
                <div id="squad-members-list" style="max-height: 400px; overflow-y: auto; padding-right: 0.5rem;">
                    ${membersHTML ||
        '<div class="glass-card" style="text-align: center; padding: 3rem; color: var(--text-muted);">' +
        '<i class="fa-solid fa-users-slash" style="font-size: 3rem; margin-bottom: 1rem;"></i>' +
        '<p>No members found</p></div>'
        }
                </div>
                
                ${isCreator ? `
                    <div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--border);">
                        <h5 style="margin-bottom: 1rem; color: var(--primary);">
                            <i class="fa-solid fa-user-gear"></i> Squad Management
                        </h5>
                        <div style="display: flex; gap: 1rem;">
                            <button class="btn btn-primary" onclick="inviteToSquad('${squad.id}', '${squad.name}')" style="flex: 1;">
                                <i class="fa-solid fa-user-plus"></i> Invite Members
                            </button>
                            <button class="btn btn-error" onclick="deleteSquad('${squad.id}', '${squad.name}')" style="flex: 1;">
                                <i class="fa-solid fa-trash"></i> Delete Squad
                            </button>
                        </div>
                    </div>
                ` : ''}
                
                ${!isMember && !isCreator ? `
                    <div style="margin-top: 1.5rem;">
                        <button class="btn btn-primary" onclick="joinSquad('${squad.id}', '${squad.name}')" style="width: 100%;">
                            <i class="fa-solid fa-user-plus"></i> Join This Squad
                        </button>
                    </div>
                ` : ''}
            </div>
        </div>
    `;

    // Create and show the modal
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHTML;
    document.body.appendChild(modalContainer);

    setTimeout(() => {
        document.getElementById('squad-members-modal').style.display = 'flex';
    }, 10);
}

// Promote a member to leader
function promoteToLeader(squadId, memberId, memberName) {
    if (!confirm(`Promote ${memberName} to squad leader? You will become a regular member.`)) return;

    const squad = State.liveSquads.find(s => s.id === squadId);
    if (!squad) return;

    // Find the member
    const member = squad.members.find(m => m.id === memberId);
    if (!member) return;

    // Update member roles
    const updatedMembers = squad.members.map(m => {
        if (m.id === memberId) {
            return { ...m, role: 'Lead' };
        } else if (m.id === State.currentUser.uid) {
            return { ...m, role: 'Member' };
        }
        return m;
    });

    db.collection("squads").doc(squadId).update({
        members: updatedMembers,
        creatorId: memberId, // Update creator ID
        creatorName: memberName
    })
        .then(() => {
            alert(`${memberName} is now the squad leader!`);
            closeModal('squad-members-modal');
            setTimeout(() => {
                viewSquadMembers(squadId, squad.name);
            }, 300);
        })
        .catch(error => {
            alert("Error promoting member: " + error.message);
        });
}

// Remove member from squad
function removeFromSquad(squadId, memberId, memberName) {
    if (!confirm(`Remove ${memberName} from the squad?`)) return;

    const squad = State.liveSquads.find(s => s.id === squadId);
    if (!squad) return;

    // Find the member to remove
    const member = squad.members.find(m => m.id === memberId);
    if (!member) return;

    // Remove from squad
    const updatedMembers = squad.members.filter(m => m.id !== memberId);

    db.collection("squads").doc(squadId).update({
        members: updatedMembers,
        memberCount: firebase.firestore.FieldValue.increment(-1)
    })
        .then(() => {
            // Update user's profile to remove squadId
            return db.collection("users").doc(memberId).update({
                squadId: null
            });
        })
        .then(() => {
            alert(`${memberName} has been removed from the squad.`);
            closeModal('squad-members-modal');
            setTimeout(() => {
                viewSquadMembers(squadId, squad.name);
            }, 300);
        })
        .catch(error => {
            alert("Error removing member: " + error.message);
        });
}

// Invite members to squad
function inviteToSquad(squadId, squadName) {
    const inviteCode = `SQUAD-${squadId.substring(0, 8).toUpperCase()}`;

    const modalHTML = `
        <div class="modal-overlay" id="invite-modal">
            <div class="modal-content" style="max-width: 500px;">
                <button onclick="closeModal('invite-modal')"
                    style="position:absolute; top:1.5rem; right:1.5rem; background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:1.5rem;">
                    <i class="fa-solid fa-xmark"></i>
                </button>
                
                <div style="text-align: center; margin-bottom: 1.5rem;">
                    <div style="width: 80px; height: 80px; background: var(--primary-glow); border-radius: 50%; 
                         display: inline-flex; align-items: center; justify-content: center; margin-bottom: 1rem;">
                        <i class="fa-solid fa-user-plus" style="color: var(--primary); font-size: 2rem;"></i>
                    </div>
                    <h3>Invite to ${squadName}</h3>
                    <p style="color: var(--text-muted);">Share this code with others to join your squad</p>
                </div>
                
                <div class="glass-card" style="text-align: center; padding: 1.5rem; margin-bottom: 1.5rem;">
                    <div style="font-family: monospace; font-size: 1.5rem; font-weight: bold; color: var(--primary); 
                         letter-spacing: 2px; margin-bottom: 0.5rem;">
                        ${inviteCode}
                    </div>
                    <div style="font-size: 0.9rem; color: var(--text-muted);">
                        Valid for 7 days • Max 5 members
                    </div>
                </div>
                
                <div style="display: flex; gap: 1rem;">
                    <button class="btn btn-primary" onclick="copyInviteCode('${inviteCode}')" style="flex: 1;">
                        <i class="fa-solid fa-copy"></i> Copy Code
                    </button>
                    <button class="btn btn-glass" onclick="closeModal('invite-modal')" style="flex: 1;">
                        Done
                    </button>
                </div>
            </div>
        </div>
    `;

    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHTML;
    document.body.appendChild(modalContainer);

    setTimeout(() => {
        document.getElementById('invite-modal').style.display = 'flex';
    }, 10);
}

function copyInviteCode(code) {
    navigator.clipboard.writeText(code)
        .then(() => {
            alert(`Invite code copied: ${code}`);
        })
        .catch(() => {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = code;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            alert(`Invite code copied: ${code}`);
        });
}

function deleteSquad(squadId, squadName) {
    event.stopPropagation();

    const squad = State.liveSquads.find(s => s.id === squadId);

    if (!squad) {
        alert('Squad not found');
        return;
    }

    if (squad.creatorId !== State.currentUser.uid) {
        alert('❌ Only the squad creator can delete this squad.');
        return;
    }

    const memberCount = squad.members ? squad.members.length : 1;

    if (!confirm(`Are you sure you want to delete "${squadName}"?\n\nThis will remove ${memberCount} member${memberCount !== 1 ? 's' : ''} and cannot be undone.`)) {
        return;
    }

    const originalText = event.target.innerHTML;
    event.target.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Deleting...';
    event.target.disabled = true;

    db.collection("squads").doc(squadId).delete()
        .then(() => {
            const updatePromises = [];
            if (squad.members && squad.members.length > 0) {
                squad.members.forEach(member => {
                    if (member.id) {
                        updatePromises.push(
                            db.collection("users").doc(member.id).update({
                                squadId: null
                            })
                        );
                    }
                });
            }

            return Promise.all(updatePromises);
        })
        .then(() => {
            // SIMPLE ALERT instead of toast
            alert(`✅ Squad "${squadName}" deleted successfully.`);

            closeModal('squad-members-modal');

            setTimeout(() => {
                renderSquads();
            }, 500);

        })
        .catch((error) => {
            console.error("Error deleting squad:", error);
            alert("❌ Error deleting squad: " + error.message);

            event.target.innerHTML = originalText;
            event.target.disabled = false;
        });
}

// Assessment & Updates
function updateUserProfile(data) {
    if (State.currentUser && State.currentUser.uid) {
        db.collection("users").doc(State.currentUser.uid).update(data);
    }
}
function saveProfile() {
    const newName = document.getElementById('profile-name').value;
    const university = document.getElementById('profile-university') ? document.getElementById('profile-university').value : '';
    const stream = document.getElementById('profile-stream') ? document.getElementById('profile-stream').value : '';
    const branch = document.getElementById('profile-branch') ? document.getElementById('profile-branch').value : '';

    updateUserProfile({
        name: newName,
        university: university,
        stream: stream,
        branch: branch
    });
    alert('Profile Updated');
}

// Utils
function updateLandingPage(user) {
    const navBtn = document.getElementById('nav-login-btn');
    if (navBtn) {
        navBtn.innerText = "Go to Dashboard";
        navBtn.classList.remove('btn-glass');
        navBtn.classList.add('btn-primary');
        navBtn.href = "dashboard.html";
    }
    const heroCta = document.getElementById('hero-cta');
    if (heroCta) {
        heroCta.innerHTML = `
            <a href="dashboard.html" class="btn btn-primary" style="padding: 0.8rem 1.5rem;">
                <i class="fa-solid fa-arrow-right"></i> Welcome back, ${user.name}
            </a>
            <button class="btn btn-glass" onclick="logout()">Log Out</button>
        `;
    }
}
function resetLandingPage() {
    const navBtn = document.getElementById('nav-login-btn');
    if (navBtn) { navBtn.innerText = "Log In"; navBtn.href = "login.html"; }
}
function updateAnalytics() { if (document.getElementById('stat-jobs')) document.getElementById('stat-jobs').innerText = State.liveJobs.length; }

let quizState = {};
function selectOption(el, q, v) { quizState[q] = v; el.parentElement.querySelectorAll('.mcq-option').forEach(e => e.classList.remove('selected')); el.classList.add('selected'); }
function nextStep() { document.getElementById('quiz-step-1').style.display = 'none'; document.getElementById('quiz-step-2').style.display = 'block'; }

// --- ASSESSMENT SYSTEM ---
let quizHistory = [];

async function openAssessment() {
    currentQuizData = [];
    quizHistory = [];
    currentQIndex = 0;
    userScore = 0;
    selectedValue = null;

    if (State.currentUser && State.currentUser.isVerified) return;

    const modal = document.getElementById('assessment-modal');
    const step1 = document.getElementById('quiz-step-1');

    modal.style.display = 'flex';
    step1.style.display = 'block';

    step1.innerHTML = `
        <button onclick="closeModal('assessment-modal')" style="position:absolute; top:1.5rem; right:1.5rem; background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:1.5rem;">
            <i class="fa-solid fa-xmark"></i>
        </button>
        <div style="text-align:center; padding:3rem;">
            <i class="fa-solid fa-circle-notch fa-spin" style="font-size:3rem; color:var(--primary);"></i>
            <h4 style="margin-top:1.5rem;">Building Your Challenge...</h4>
            <p style="color: var(--text-muted); font-size: 0.9rem;">Fetching Technical & Coding Questions</p>
        </div>`;

    try {
        // Changed category 19 (Math) to 18 (Computers) for technical focus
        const [aptRes, codeRes] = await Promise.all([
            fetch('https://opentdb.com/api.php?amount=3&category=18&type=multiple'),
            fetch(`https://quizapi.io/api/v1/questions?apiKey=${QUIZ_API_KEY}&limit=2&tags=JavaScript`)
        ]);

        const aptData = await aptRes.json();
        const codeData = await codeRes.json();

        currentQuizData = [
            ...aptData.results.map(q => ({
                type: 'Technical (Gen)',
                question: q.question,
                options: [...q.incorrect_answers, q.correct_answer].sort(() => Math.random() - 0.5),
                correct: q.correct_answer
            })),
            ...codeData.map(q => ({
                type: 'Coding (JS)',
                question: q.question,
                options: Object.values(q.answers).filter(a => a !== null),
                correct: q.answers[Object.keys(q.correct_answers).find(k => q.correct_answers[k] === "true").replace('_correct', '')]
            }))
        ];

        currentQIndex = 0;
        userScore = 0;
        renderQuestionInModal();
    } catch (err) {
        console.error("Assessment Error:", err);
        step1.innerHTML = `<p style="color:var(--error); text-align:center;">Failed to connect to question bank. Check your API key.</p>`;
    }
}

function renderQuestionInModal() {
    clearInterval(timerInterval);
    const q = currentQuizData[currentQIndex];
    const step1 = document.getElementById('quiz-step-1');
    let timeLeft = 30;
    const progressPercent = ((currentQIndex + 1) / 5) * 100;

    step1.innerHTML = `
        <button onclick="closeModal('assessment-modal')" style="position:absolute; top:1.5rem; right:1.5rem; background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:1.5rem; z-index:10;">
            <i class="fa-solid fa-xmark"></i>
        </button>

        <div style="width:100%; height:6px; background:var(--border); border-radius:10px; margin-bottom:1.5rem; overflow:hidden;">
            <div style="width:${progressPercent}%; height:100%; background:var(--primary); transition:width 0.3s ease;"></div>
        </div>

        <div style="display:flex; justify-content:space-between; margin-bottom:1rem; align-items:center;">
            <span style="background:var(--primary-glow); color:var(--primary); padding:4px 8px; border-radius:4px; font-weight:bold; font-size:0.75rem;">${q.type}</span>
            <span id="quiz-timer" style="color:var(--error); font-weight:bold; font-family:monospace;"><i class="fa-solid fa-clock"></i> ${timeLeft}s</span>
        </div>

        <h4 style="margin-bottom:1.5rem; line-height:1.4;">${q.question}</h4>
        
        <div id="options-box">
            ${q.options.map((opt, idx) => `
                <div class="mcq-option" onclick="handleSelect(this, ${idx})">${opt}</div>
            `).join('')}
        </div>

        <button class="btn btn-primary" style="width:100%; margin-top:2rem;" onclick="processNext()">
            ${currentQIndex === 4 ? 'Complete Assessment' : 'Next Question'}
        </button>
    `;

    timerInterval = setInterval(() => {
        timeLeft--;
        const timerEl = document.getElementById('quiz-timer');
        if (timerEl) timerEl.innerText = `${timeLeft}s`;
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            processNext(); // Auto-skip if time runs out
        }
    }, 1000);
}

// Add this if not already present
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        // Remove from DOM after animation
        setTimeout(() => {
            if (modal.parentNode) {
                modal.parentNode.removeChild(modal);
            }
        }, 300);
    }
}

function handleSelect(el, idx) {
    document.querySelectorAll('.mcq-option').forEach(o => o.classList.remove('selected'));
    el.classList.add('selected');
    // Store the selected answer value safely
    selectedValue = currentQuizData[currentQIndex].options[idx];
}

function processNext() {
    clearInterval(timerInterval);
    const q = currentQuizData[currentQIndex];
    // If time ran out or user clicked next without selecting, selectedValue might be null
    const userAnswer = selectedValue || "Skipped";
    const isCorrect = userAnswer === q.correct;

    if (isCorrect) userScore++;

    // Record history for THIS question
    quizHistory.push({
        question: q.question,
        userAnswer: userAnswer,
        isCorrect: isCorrect,
        correct: q.correct
    });

    if (currentQIndex < 4) {
        currentQIndex++;
        selectedValue = null;
        renderQuestionInModal();
    } else {
        finishTest();
    }
}

function finishTest() {
    const total = currentQuizData.length;
    const passed = userScore >= 4; // 80% passing

    if (State.currentUser) {
        db.collection("users").doc(State.currentUser.uid).collection("verification_tests").add({
            type: "Premium Assessment",
            score: userScore,
            total: total,
            passed: passed,
            timestamp: Date.now(),
            history: quizHistory, // Save correct history
            certificateId: passed ? "CERT-" + Math.random().toString(36).substr(2, 9).toUpperCase() : null
        }).then(() => {
            loadUserResults();
        });
    }

    if (passed) {
        updateUserProfile({ isVerified: true });
        alert(`✅ Verification Value Unlocked!\nScore: ${userScore}/${total}`);
    } else {
        alert(`Verification Failed.\nScore: ${userScore}/${total}\n(Requires 80% to pass)`);
    }

    closeModal('assessment-modal');
    switchResultTab('verification');
    const resultsView = document.getElementById('view-results');
    if (resultsView) {
        switchView('results'); // Ensure we are on results view
        resultsView.scrollIntoView({ behavior: 'smooth' });
    }
}

// --- TOGGLE THEME ---
function toggleTheme() {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme');
    const target = current === 'light' ? 'dark' : 'light';

    html.setAttribute('data-theme', target);
    localStorage.setItem('theme', target);
    updateThemeIcon(target);
}

function updateThemeIcon(theme) {
    const icons = document.querySelectorAll('.theme-icon-i');
    icons.forEach(i => {
        i.className = theme === 'light' ? 'fa-solid fa-moon theme-icon-i' : 'fa-solid fa-sun theme-icon-i';
    });

    const labels = document.querySelectorAll('.theme-text-span');
    labels.forEach(s => s.innerText = theme === 'light' ? 'Dark Mode' : 'Light Mode');
}

// --- MOCK TEST ENGINE ---
let mockTestPool = [];
let mockIndex = 0;
let mockScore = 0;
let mockSelection = null;

async function startMockTest(track) {
    mockResultsLog = [];
    mockScore = 0;

    const modal = document.getElementById('assessment-modal');
    const container = document.getElementById('quiz-step-1');
    const resultsView = document.getElementById('quiz-results');

    if (resultsView) resultsView.style.display = 'none';
    container.style.display = 'block';

    const headerTitle = modal.querySelector('h3');
    if (headerTitle) headerTitle.innerText = `${track} Mock Test`;

    modal.style.display = 'flex';
    container.innerHTML = `
        <button onclick="closeModal('assessment-modal')" style="position:absolute; top:1.5rem; right:1.5rem; background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:1.5rem; z-index:100;">
            <i class="fa-solid fa-xmark"></i>
        </button>
        <div style="text-align:center; padding:3rem;">
            <i class="fa-solid fa-circle-notch fa-spin" style="font-size:3rem; color:var(--primary);"></i>
            <h4 style="margin-top:1.5rem;">Generating ${track} Challenge...</h4>
            <p style="color:var(--text-muted);">Fetching 20 Aptitude + 10 Technical Questions</p>
        </div>`;

    try {
        let apiTag = "JavaScript";
        if (track === 'Machine Learning' || track === 'Data Science') apiTag = 'Python';
        if (track === 'Testing') apiTag = 'DevOps';

        const aptRes = await fetch('https://opentdb.com/api.php?amount=20&category=18&type=multiple');
        const aptData = await aptRes.json();

        const codeRes = await fetch(`https://quizapi.io/api/v1/questions?apiKey=${QUIZ_API_KEY}&limit=10&tags=${apiTag}`);
        const codeData = await codeRes.json();

        if (!aptData.results || !codeData) throw new Error("API Failure");

        mockTestPool = [
            ...aptData.results.map(q => ({
                category: 'Aptitude',
                question: q.question,
                options: [...q.incorrect_answers, q.correct_answer].sort(() => Math.random() - 0.5),
                correct: q.correct_answer
            })),
            ...codeData.map(q => ({
                category: track,
                question: q.question,
                options: Object.values(q.answers).filter(a => a !== null),
                correct: q.answers[Object.keys(q.correct_answers).find(k => q.correct_answers[k] === "true").replace('_correct', '')]
            }))
        ];

        mockIndex = 0;
        mockScore = 0;
        renderMockQuestion();
    } catch (err) {
        console.error(err);
        container.innerHTML = `
            <div style="text-align:center; padding:2rem;">
                <p style="color:var(--error);">Failed to load questions. Please check your internet or API limits.</p>
                <button class="btn btn-primary" onclick="closeModal('assessment-modal')">Close</button>
            </div>`;
    }
}

function renderMockQuestion() {
    const q = mockTestPool[mockIndex];
    const container = document.getElementById('quiz-step-1');
    const progress = ((mockIndex + 1) / mockTestPool.length) * 100;

    container.innerHTML = `
        <button onclick="closeModal('assessment-modal')" style="position:absolute; top:1.5rem; right:1.5rem; background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:1.5rem; z-index:100;">
            <i class="fa-solid fa-xmark"></i>
        </button>
        
        <div style="width:100%; height:6px; background:var(--border); border-radius:10px; margin-bottom:1.5rem; overflow:hidden;">
            <div style="width:${progress}%; height:100%; background:var(--primary); transition:width 0.3s ease;"></div>
        </div>

        <div style="display:flex; justify-content:space-between; margin-bottom:1rem; align-items:center;">
            <span class="badge" style="background:var(--primary-glow); color:var(--primary); padding:4px 8px; border-radius:4px; font-weight:bold; font-size:0.75rem;">${q.category}</span>
            <span style="color:var(--text-muted); font-size:0.8rem;">Q ${mockIndex + 1} / 30</span>
        </div>

        <h4 style="margin-bottom:1.5rem; line-height:1.4;">${q.question}</h4>
        
        <div id="options-box">
            ${q.options.map(opt => `
                <div class="mcq-option" onclick="handleMockSelect(this, '${opt.replace(/'/g, "&apos;")}')">${opt}</div>
            `).join('')}
        </div>

        <button class="btn btn-primary" style="width:100%; margin-top:2rem;" onclick="processMockNext()">
            ${mockIndex === 29 ? 'Finish Test' : 'Next Question'}
        </button>
    `;
}

function handleMockSelect(el, val) {
    document.querySelectorAll('.mcq-option').forEach(o => o.classList.remove('selected'));
    el.classList.add('selected');
    mockSelection = val;
}

function processMockNext() {
    const currentQ = mockTestPool[mockIndex];
    const isCorrect = mockSelection === currentQ.correct;

    mockResultsLog.push({
        question: currentQ.question,
        category: currentQ.category,
        isCorrect: isCorrect,
        userAnswer: mockSelection || "No Answer",
        correctAnswer: currentQ.correct
    });

    if (isCorrect) mockScore++;

    if (mockIndex < 29) {
        mockIndex++;
        mockSelection = null;
        renderMockQuestion();
    } else {
        clearInterval(timerInterval);
        document.getElementById('quiz-step-1').style.display = 'none';
        const modalHeader = document.querySelector('#assessment-modal .modal-content h3');
        if (modalHeader) modalHeader.style.display = 'none';
        showProfessionalMockResults();
        document.getElementById('quiz-results').style.display = 'block';
    }
}

function showProfessionalMockResults() {
    const percentage = Math.round((mockScore / 30) * 100);

    const testResult = {
        type: mockTestPool[0] ? mockTestPool[0].category + " Mock" : "Mock Test",
        score: mockScore,
        total: 30,
        accuracy: percentage,
        timestamp: Date.now(),
        history: mockResultsLog
    };

    if (State.currentUser) {
        db.collection("users").doc(State.currentUser.uid).collection("mock_tests").add(testResult)
            .then(() => console.log("Mock Test Saved"))
            .catch(e => console.error("Save failed", e));
    }

    document.getElementById('result-score-big').innerText = `${mockScore}/30`;
    document.getElementById('result-percentage').innerText = `${percentage}% Accuracy`;

    const aptCorrect = mockResultsLog.filter(r => r.category === 'Aptitude' && r.isCorrect).length;
    const techCorrect = mockResultsLog.filter(r => r.category !== 'Aptitude' && r.isCorrect).length;

    document.getElementById('score-aptitude').innerText = `${aptCorrect}/20`;
    document.getElementById('score-technical').innerText = `${techCorrect}/10`;

    const feedbackList = document.getElementById('question-feedback-list');
    feedbackList.innerHTML = '<h5 style="margin-bottom:1rem; color:var(--primary);">Question-by-Question Analysis</h5>';

    mockResultsLog.forEach((res, idx) => {
        const item = document.createElement('div');
        item.style.cssText = `
            margin-bottom: 1rem; padding: 1rem; border-radius: 8px;
            background: ${res.isCorrect ? 'rgba(34, 197, 94, 0.05)' : 'rgba(239, 68, 68, 0.05)'};
            border-left: 4px solid ${res.isCorrect ? 'var(--success)' : 'var(--error)'};
        `;
        item.innerHTML = `
            <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-bottom:0.5rem;">
                <span style="font-weight:bold;">Q${idx + 1} (${res.category})</span>
                <span style="color:${res.isCorrect ? 'var(--success)' : 'var(--error)'}; font-weight:bold;">
                    ${res.isCorrect ? 'CORRECT' : 'INCORRECT'}
                </span>
            </div>
            <p style="font-size:0.9rem; margin:0;">${res.question}</p>
            <div style="margin-top:0.5rem; font-size:0.8rem; color:var(--text-muted);">
                Your Answer: <b>${res.userAnswer}</b> 
                ${!res.isCorrect ? `<span style="margin-left:1rem; color:var(--success)">Correct: ${res.correctAnswer}</span>` : ''}
            </div>
        `;
        feedbackList.appendChild(item);
    });
}

// ============================================
// FIXED AI INTERVIEW SYSTEM (WORKING VERSION)
// ============================================

// --- AI MOCK INTERVIEW LOGIC ---
// 3. FIXED PROCESS INTERESTS FUNCTION
function processUserInterests(interestsText) {
    if (!interviewActive) return;

    awaitingUserResponse = false;
    clearTimeout(window.interestsTimeout);

    console.log("Processing interests:", interestsText);

    // Update transcript
    updateTranscript("You", interestsText);

    // Extract interests
    extractInterestsFromText(interestsText);

    // If no interests detected, use defaults
    if (userInterests.length === 0) {
        userInterests = ['javascript', 'react'];
        currentTechStack = 'javascript';
    } else {
        currentTechStack = userInterests[0];
    }

    // Acknowledge
    updateInterviewStatus("thinking", "Analyzing your interests...");

    setTimeout(() => {
        const interestsStr = userInterests.map(i => i.replace('_', ' ')).join(', ');
        const acknowledgment = `Great! I see you're interested in ${interestsStr}. Let's begin the technical questions.`;

        updateTranscript("Interviewer", acknowledgment);

        speakWithPause(acknowledgment, () => {
            // IMPORTANT: Short pause then start questions
            updateInterviewStatus("thinking", "Preparing first question...");

            setTimeout(() => {
                console.log("Starting first question...");
                askNextQuestion();
            }, 1500); // Reduced from 3000 to 1500
        });
    }, 1500);
}

// 4. FIXED ASK NEXT QUESTION FUNCTION
function askNextQuestion() {
    if (!interviewActive) return;

    console.log("askNextQuestion called");

    // Check if we should end interview
    if (chatHistory.length >= 8) {
        console.log("Maximum questions reached, ending interview");
        endInterview();
        return;
    }

    awaitingUserResponse = true;

    // Get a new question
    let questionText;

    // FORCE TECHNICAL QUESTIONS primarily, only rare behavioral/system design
    // Changed probability: 90% Technical, 10% System Design (if applicable)
    // Removed random Behavioral for now to keep focus on technical skills as requested
    const questionType = Math.random() < 0.9 ? "technical" : "system_design";

    if (questionType === "technical") {
        questionText = getUnaskedTechnicalQuestion();
    } else {
        questionText = getUnaskedSystemDesignQuestion();
    }

    if (!questionText) {
        // Fallback if no questions found
        console.log("No unique questions available, using fallback");
        questionText = getUnaskedBehavioralQuestion();
    }

    if (!questionText) {
        endInterview();
        return;
    }

    // Store current question
    currentQuestion = {
        text: questionText,
        type: questionType,
        timestamp: Date.now()
    };

    // Mark as asked
    askedQuestions.push({
        text: questionText,
        type: questionType,
        timestamp: Date.now(),
        techStack: currentTechStack
    });

    // Save to localStorage
    localStorage.setItem(`askedQuestions_${State.currentUser?.uid}`, JSON.stringify(askedQuestions));

    console.log("Asking question:", questionText.substring(0, 50) + "...");

    // Update UI and ask question
    updateInterviewStatus("speaking", "Asking question...");
    updateTranscript("Interviewer", questionText);

    speakWithPause(questionText, () => {
        console.log("Question spoken, now listening for answer");
        updateInterviewStatus("listening", "Listening to your answer...");
        startListeningForAnswer();
    });
}

// 5. FIXED GET UNASKED TECHNICAL QUESTION
function getUnaskedTechnicalQuestion() {
    // Get all questions from user's interests
    let allQuestions = [];
    console.log("Getting questions for interests:", userInterests);

    userInterests.forEach(tech => {
        if (QUESTION_DATABASE[tech]) {
            const techQuestions = QUESTION_DATABASE[tech].map(q => ({
                text: q,
                tech: tech,
                type: "technical"
            }));
            allQuestions = allQuestions.concat(techQuestions);
        }
    });

    // If no questions from interests, use Computer Science/General as default instead of JS
    if (allQuestions.length === 0) {
        console.log("No specific questions found for interests. Defaulting to Computer Science.");
        if (QUESTION_DATABASE.computer_science) {
            allQuestions = QUESTION_DATABASE.computer_science.map(q => ({
                text: q,
                tech: "computer_science",
                type: "technical"
            }));
        } else {
            // Ultimate fallback
            allQuestions = QUESTION_DATABASE.javascript.map(q => ({
                text: q,
                tech: "javascript",
                type: "technical"
            }));
        }
    }

    // Remove already asked questions
    const askedTexts = askedQuestions.map(q => q.text);
    const availableQuestions = allQuestions.filter(q => !askedTexts.includes(q.text));

    if (availableQuestions.length === 0) {
        console.log("No more unique technical questions");
        return null;
    }

    // Weight by primary interest
    const weightedQuestions = [];
    availableQuestions.forEach(q => {
        const weight = q.tech === currentTechStack ? 3 : 1;
        for (let i = 0; i < weight; i++) {
            weightedQuestions.push(q);
        }
    });

    const selected = weightedQuestions[Math.floor(Math.random() * weightedQuestions.length)];
    console.log("Selected technical question from:", selected.tech);
    return selected.text;
}

// ... existing helper functions ...

// ======================
// RECOVERED HELPER FUNCTIONS
// ======================

function updateTranscript(speaker, text) {
    const box = document.getElementById('ai-transcript');
    if (!box) return;

    const color = speaker === "Interviewer" ? "var(--primary)" : "var(--text-main)";
    const bgColor = speaker === "Interviewer" ? "rgba(0, 243, 255, 0.1)" : "rgba(139, 92, 246, 0.1)";

    const div = document.createElement('div');
    div.style.cssText = `
        margin: 10px 0;
        padding: 12px;
        border-left: 4px solid ${color};
        background: ${bgColor};
        border-radius: 0 8px 8px 0;
        animation: fadeIn 0.3s ease;
    `;

    div.innerHTML = `<strong style="color:${color}">${speaker}:</strong> ${text}`;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
}

function extractInterestsFromText(text) {
    const lowerText = text.toLowerCase();
    userInterests = [];

    const keywords = {
        'javascript': ['javascript', 'js', 'frontend', 'web'],
        'react': ['react', 'react.js', 'hooks', 'redux'],
        'nodejs': ['node', 'node.js', 'backend', 'express'],
        'python': ['python', 'py', 'django', 'flask'],
        'machine_learning': ['machine learning', 'ml', 'ai', 'artificial intelligence', 'deep learning'],
        'data_science': ['data science', 'data scientist', 'analytics', 'statistics', 'pandas'],
        'full_stack': ['full stack', 'fullstack', 'mern', 'mean'],
        'cloud_computing': ['cloud', 'aws', 'azure', 'gcp', 'devops', 'docker', 'kubernetes'],
        'computer_science': ['computer science', 'cs', 'algorithms', 'data structures', 'general', 'software', 'coding', 'programming', 'intern', 'development', 'engineer'],
        'system_design': ['system design', 'architecture', 'scalability', 'distributed systems']
    };


    for (const [tech, matchers] of Object.entries(keywords)) {
        if (matchers.some(k => lowerText.includes(k))) {
            if (!userInterests.includes(tech)) userInterests.push(tech);
        }
    }

    // Default if none found
    if (userInterests.length === 0) {
        console.log("No specific interests found, defaulting to Computer Science");
        userInterests.push('computer_science');
        currentTechStack = 'computer_science';
    } else {
        currentTechStack = userInterests[0];
    }

    console.log("Extracted interests:", userInterests);
}

// 6. ADD THESE HELPER FUNCTIONS IF NOT PRESENT
function getUnaskedBehavioralQuestion() {
    const askedTexts = askedQuestions.map(q => q.text);
    const availableQuestions = BEHAVIORAL_QUESTIONS.filter(q => !askedTexts.includes(q));

    if (availableQuestions.length === 0) {
        // If all behavioral asked, use technical
        return getUnaskedTechnicalQuestion();
    }

    const selected = availableQuestions[Math.floor(Math.random() * availableQuestions.length)];
    console.log("Selected behavioral question");
    return selected;
}

function getUnaskedSystemDesignQuestion() {
    const systemDesignQuestions = QUESTION_DATABASE.system_design || [];
    const askedTexts = askedQuestions.map(q => q.text);
    const availableQuestions = systemDesignQuestions.filter(q => !askedTexts.includes(q));

    if (availableQuestions.length === 0) {
        return getUnaskedTechnicalQuestion();
    }

    const selected = availableQuestions[Math.floor(Math.random() * availableQuestions.length)];
    console.log("Selected system design question");
    return selected;
}

// 7. FIXED START LISTENING FOR ANSWER
// 7. FIXED START LISTENING FOR ANSWER
function startListeningForAnswer() {
    if (!interviewActive || !awaitingUserResponse) {
        console.log("Cannot start listening: inactive or not awaiting response");
        return;
    }

    console.log("startListeningForAnswer called");

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        console.warn("SpeechRecognition not supported, using mock");
        // Mock answer for testing
        setTimeout(() => {
            processUserAnswer("I would approach this by analyzing the problem first, then designing a solution.");
        }, 2000);
        return;
    }

    // Stop any existing recognition
    if (recognition) {
        try {
            recognition.stop();
        } catch (e) {
            console.log("Error stopping recognition:", e);
        }
    }

    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let finalTranscript = "";
    let latestInterim = "";
    let silenceTimer;

    recognition.onstart = () => {
        console.log("Listening for answer started");
        updateInterviewStatus("listening", "Listening... (Speak now)");
        const micBtn = document.getElementById('mic-btn');
        if (micBtn) micBtn.style.display = 'inline-flex';
    };

    recognition.onresult = (event) => {
        clearTimeout(silenceTimer);

        let interimTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }

        latestInterim = interimTranscript;

        // Show we're getting input
        if (interimTranscript.length > 0) {
            console.log("Interim transcript:", interimTranscript);
            updateInterviewStatus("listening", "Hearing: " + interimTranscript);
        }

        // Reset silence timer - 3 seconds of silence (increased from 2)
        silenceTimer = setTimeout(() => {
            console.log("Silence detected, stopping recognition");
            if ((finalTranscript + latestInterim).trim().length > 0) {
                recognition.stop();
            }
        }, 3000);
    };

    recognition.onend = () => {
        console.log("Recognition ended");
        clearTimeout(silenceTimer);
        const micBtn = document.getElementById('mic-btn');
        if (micBtn) micBtn.style.display = 'none';

        // Combine final and interim if needed (sometimes last chunk is interim)
        let fullText = finalTranscript + latestInterim;
        // Clean up duplicates if any

        if (fullText.trim().length > 2) {
            console.log("Processing answer:", fullText.substring(0, 50) + "...");
            processUserAnswer(fullText);
        } else {
            console.log("No answer detected, prompting again");

            // Check if user manually cancelled or if it was just silence
            if (!interviewActive) return;

            updateTranscript("Interviewer", "I didn't hear your answer. Could you please answer?");
            speakWithPause("I didn't hear your answer. Could you please answer?", () => {
                updateInterviewStatus("listening", "Listening for answer...");
                startListeningForAnswer();
            });
        }
    };

    recognition.onerror = (event) => {
        console.error("Recognition error:", event.error);
        clearTimeout(silenceTimer);

        if (event.error === 'no-speech') {
            // Ignore no-speech error, handled in onend
            return;
        }

        // Handle error
        updateInterviewStatus("error", "Microphone error: " + event.error);

        // Fallback to mock answer after delay if it persists? 
        // Better to ask user to type or retry. 
        // For this demo, we can fallback to text input or retry.
    };

    // Start listening
    try {
        recognition.start();
        console.log("Recognition started successfully");
    } catch (e) {
        console.error("Failed to start recognition:", e);
        // Fallback
        setTimeout(() => {
            processUserAnswer("My approach would involve careful analysis and systematic implementation.");
        }, 1000);
    }
}

// 8. FIXED PROCESS USER ANSWER
function processUserAnswer(answerText) {
    awaitingUserResponse = false;

    console.log("Processing answer of length:", answerText.length);

    // Add to chat history
    chatHistory.push({
        question: currentQuestion.text,
        answer: answerText,
        type: currentQuestion.type,
        timestamp: Date.now()
    });

    updateTranscript("You", answerText);
    updateInterviewStatus("thinking", "Analyzing your answer...");

    // Evaluate answer
    const evaluation = evaluateAnswer(answerText, currentQuestion);
    console.log("Answer evaluation score:", evaluation.score);

    // Decide next action
    setTimeout(() => {
        const nextAction = decideNextStep(evaluation);
        console.log("Next action:", nextAction.action);
        executeNextAction(nextAction, evaluation);
    }, 1000);
}

// 9. FIXED DECIDE NEXT STEP
function decideNextStep(evaluation) {
    const questionsAsked = chatHistory.length;
    console.log("Questions asked so far:", questionsAsked);

    if (questionsAsked >= 6) {
        return { action: 'end', reason: 'enough_questions' };
    }

    if (questionsAsked >= 4 && Math.random() > 0.7) {
        return { action: 'end', reason: 'good_coverage' };
    }

    if (evaluation.score < 4 && Math.random() > 0.5) {
        return { action: 'followup', reason: 'needs_clarification' };
    }

    return { action: 'next', reason: 'continue' };
}

// 10. FIXED EXECUTE NEXT ACTION
function executeNextAction(action, evaluation) {
    console.log("Executing action:", action.action);

    switch (action.action) {
        case 'next':
            const acknowledgment = getAcknowledgment(evaluation.score);
            console.log("Acknowledgment:", acknowledgment);

            updateTranscript("Interviewer", acknowledgment);
            speakWithPause(acknowledgment, () => {
                // Short pause then next question
                setTimeout(() => {
                    askNextQuestion();
                }, 1000);
            });
            break;

        case 'followup':
            const followUp = "Could you elaborate more on that point? I'd like to understand your thinking better.";
            console.log("Asking follow-up");

            updateTranscript("Interviewer", followUp);
            speakWithPause(followUp, () => {
                updateInterviewStatus("listening", "Listening for elaboration...");
                awaitingUserResponse = true;
                startListeningForAnswer();
            });
            break;

        case 'end':
            console.log("Ending interview");
            endInterview();
            break;
    }
}

// 11. ADD SIMPLE EVALUATION FUNCTION (if missing)
function evaluateAnswer(answer, question) {
    const answerLower = answer.toLowerCase();
    const wordCount = answer.split(' ').length;

    let score = 5; // Base score

    // Add points for length
    if (wordCount > 30) score += 2;
    else if (wordCount > 15) score += 1;

    // Add points for technical terms
    const technicalTerms = ['because', 'example', 'approach', 'solution', 'optimize', 'design', 'pattern'];
    technicalTerms.forEach(term => {
        if (answerLower.includes(term)) score += 0.5;
    });

    // Cap score
    score = Math.min(10, Math.max(1, score));

    return {
        score: score,
        wordCount: wordCount,
        hasDepth: wordCount > 25,
        isRelevant: true
    };
}

// 13. GET ACKNOWLEDGMENT
function getAcknowledgment(score) {
    if (score >= 8) {
        const responses = [
            "Excellent answer, very thorough.",
            "Great explanation, very clear.",
            "Perfect, that's exactly what I was looking for."
        ];
        return responses[Math.floor(Math.random() * responses.length)];
    } else if (score >= 6) {
        const responses = [
            "Good answer, thanks for explaining.",
            "I understand your approach.",
            "Thanks for sharing that perspective."
        ];
        return responses[Math.floor(Math.random() * responses.length)];
    } else {
        const responses = [
            "Okay, I see.",
            "Alright.",
            "Got it."
        ];
        return responses[Math.floor(Math.random() * responses.length)];
    }
}

// 14. END INTERVIEW
function endInterview() {
    interviewActive = false;
    awaitingUserResponse = false;

    window.speechSynthesis.cancel();
    if (recognition) {
        recognition.stop();
        recognition = null;
    }

    const closing = "Thank you for the interview. I have a good understanding of your skills now. Let me provide some feedback.";
    updateTranscript("Interviewer", closing);
    updateInterviewStatus("thinking", "Generating feedback...");

    speakWithPause(closing, () => {
        setTimeout(() => {
            generatePersonalizedFeedback();
        }, 2000);
    });
}

// 15. GENERATE PERSONALIZED FEEDBACK
function generatePersonalizedFeedback() {
    document.getElementById('interview-container').style.display = 'none';
    const resultCard = document.getElementById('interview-result-card');
    resultCard.style.display = 'block';

    // Calculate scores
    const scores = calculateInterviewScores();

    // Get tech stack name
    const techStackName = currentTechStack.replace('_', ' ');

    const feedbackHTML = `
        <div style="margin-bottom: 2rem;">
            <h4 style="color: var(--primary); margin-bottom: 1rem;">
                <i class="fa-solid fa-chart-line"></i> Interview Feedback
            </h4>
            <div style="background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                <p><strong>Focus Areas:</strong> ${userInterests.map(i => i.replace('_', ' ')).join(', ')}</p>
                <p><strong>Questions Answered:</strong> ${chatHistory.length}</p>
                <p><strong>Primary Technology:</strong> ${techStackName}</p>
            </div>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-bottom: 2rem;">
            <div style="text-align:center; padding: 1rem; background: rgba(0,243,255,0.1); border-radius: 8px;">
                <div style="font-size:1.5rem; color:var(--primary); font-weight: bold;">${scores.technical}/10</div>
                <div style="font-size:0.8rem; color:var(--text-muted);">${techStackName.toUpperCase()} Knowledge</div>
            </div>
            <div style="text-align:center; padding: 1rem; background: rgba(139,92,246,0.1); border-radius: 8px;">
                <div style="font-size:1.5rem; color:var(--secondary); font-weight: bold;">${scores.communication}/10</div>
                <div style="font-size:0.8rem; color:var(--text-muted);">Communication</div>
            </div>
        </div>
        
        <div id="ai-feedback-text" style="margin-top:1.5rem; font-size:0.95rem; line-height: 1.6;">
            <h5>Strengths in ${techStackName}:</h5>
            <ul>
                ${getStrengthsFeedback()}
            </ul>
            
            <h5 style="margin-top: 1rem;">Recommendations for ${techStackName}:</h5>
            <ul>
                ${getRecommendationsFeedback()}
            </ul>
            
            <h5 style="margin-top: 1rem;">Next Interview Suggestions:</h5>
            <ul>
                <li>Try focusing on: ${getNextFocusArea()}</li>
                <li>Review: ${getReviewTopics()}</li>
                <li>Practice building: ${getProjectSuggestions()}</li>
            </ul>
        </div>
        
        <div style="margin-top: 1.5rem; font-size: 0.8rem; color: var(--text-muted); text-align: center;">
            <p>Interview completed on ${new Date().toLocaleString()}</p>
            <p><small>Questions asked: ${askedQuestions.length} | Unique topics covered: ${new Set(askedQuestions.map(q => q.techStack)).size}</small></p>
        </div>
    `;

    const buttonsHTML = `
        <div data-html2canvas-ignore="true" style="margin-top: 2rem; display: flex; gap: 1rem; justify-content: center;">
            <button class="btn btn-primary" onclick="location.reload()">
                <i class="fa-solid fa-redo"></i> Take Another Interview
            </button>
            <button class="btn btn-glass" onclick="downloadInterviewPDF()">
                <i class="fa-solid fa-download"></i> Download Report
            </button>
        </div>
    `;

    document.getElementById('interview-result-card').innerHTML = feedbackHTML + buttonsHTML;

    // Save to Firebase
    saveInterviewToFirebase(scores, feedbackHTML);

    resultCard.scrollIntoView({ behavior: 'smooth' });
}

// 16. CALCULATE SCORES
function calculateInterviewScores() {
    if (chatHistory.length === 0) {
        return { technical: 6, communication: 6 };
    }

    let totalScore = 0;
    let totalWords = 0;

    chatHistory.forEach(entry => {
        const evaluation = evaluateAnswer(entry.answer || "", { text: entry.question });
        totalScore += evaluation.score;
        if (entry.answer) {
            totalWords += entry.answer.split(' ').length;
        }
    });

    const avgScore = totalScore / chatHistory.length;
    const avgWords = totalWords / chatHistory.length;

    return {
        technical: Math.round(avgScore * 10) / 10,
        communication: Math.min(10, Math.round((avgWords / 30) * 10))
    };
}

// 17. GET DYNAMIC FEEDBACK
function getStrengthsFeedback() {
    const strengths = [
        "Good understanding of core concepts",
        "Clear problem-solving approach",
        "Practical thinking",
        "Learning mindset",
        "Good communication structure"
    ];

    // Pick 2-3 random strengths
    const selected = [];
    while (selected.length < 3 && strengths.length > 0) {
        const index = Math.floor(Math.random() * strengths.length);
        selected.push(strengths.splice(index, 1)[0]);
    }

    return selected.map(s => `<li>${s}</li>`).join('');
}

function getRecommendationsFeedback() {
    const recommendations = {
        "react": [
            "Build a complex React app with state management",
            "Learn React performance optimization techniques",
            "Practice with React testing library"
        ],
        "javascript": [
            "Master advanced JavaScript concepts",
            "Build projects using modern ES6+ features",
            "Practice algorithm challenges"
        ],
        "nodejs": [
            "Build a REST API with authentication",
            "Learn about microservices architecture",
            "Practice database optimization"
        ],
        "python": [
            "Build data processing pipelines",
            "Practice with Python frameworks",
            "Learn about async programming"
        ],
        "machine_learning": [
            "Work on a real ML project with datasets",
            "Learn model deployment techniques",
            "Practice feature engineering"
        ]
    };

    const techRecs = recommendations[currentTechStack] || [
        "Build complete projects",
        "Practice system design",
        "Contribute to open source"
    ];

    return techRecs.map(r => `<li>${r}</li>`).join('');
}

function getNextFocusArea() {
    const allTechs = Object.keys(QUESTION_DATABASE);
    const unaskedTechs = allTechs.filter(tech =>
        !askedQuestions.some(q => q.techStack === tech)
    );

    if (unaskedTechs.length > 0) {
        return unaskedTechs[0].replace('_', ' ');
    }

    return "Advanced system design";
}

function getReviewTopics() {
    const weakTopics = askedQuestions
        .filter(q => q.type === "technical")
        .slice(0, 2)
        .map(q => q.text.split('?')[0]);

    if (weakTopics.length > 0) {
        return weakTopics.join(', ');
    }

    return `${currentTechStack} best practices`;
}

function getProjectSuggestions() {
    const projects = {
        "react": "a React dashboard with real-time data",
        "javascript": "a JavaScript library or utility",
        "nodejs": "a Node.js microservices system",
        "python": "a Python data analysis tool",
        "machine_learning": "an ML model with a web interface"
    };

    return projects[currentTechStack] || "a full-stack application";
}

// 18. SAVE TO FIREBASE
function saveInterviewToFirebase(scores, reportHTML) {
    if (auth.currentUser) {
        db.collection("users").doc(auth.currentUser.uid).collection("interviews").add({
            type: "Dynamic Technical Interview",
            scores: scores,
            report: reportHTML,
            techStack: currentTechStack,
            interests: userInterests,
            questionsAsked: askedQuestions.length,
            chatHistory: chatHistory,
            timestamp: Date.now(),
            duration: chatHistory.length > 0 ?
                (Date.now() - chatHistory[0].timestamp) / 60000 : 0
        }).catch(error => console.error("Save error:", error));
    }
}

// 19. UPDATE STATUS HELPER
function updateInterviewStatus(status, message) {
    const statusEl = document.getElementById('interview-status-display');
    const statusText = document.getElementById('status-text');
    const aiStatus = document.getElementById('ai-status');

    if (statusEl && statusText) {
        statusEl.style.display = 'flex';
        statusEl.className = `interview-status status-${status}`;
        statusText.textContent = message;
    }

    if (aiStatus) {
        aiStatus.textContent = message.toUpperCase();
    }
}

// 20. CLEAR QUESTION HISTORY (Optional - for testing)
function clearInterviewHistory() {
    if (State.currentUser?.uid) {
        localStorage.removeItem(`askedQuestions_${State.currentUser.uid}`);
        askedQuestions = [];
        alert("Interview history cleared!");
    }
}

// ======================
// INTERVIEW SYSTEM GLOBAL STATE
// ======================
let interviewActive = false;
let recognition = null;
let chatHistory = [];
let userInterests = [];
let askedQuestions = [];
let currentQuestion = null;
let awaitingUserResponse = false;
let currentTechStack = "javascript"; // Default


// ======================
// INTERVIEW SYSTEM DATA
// ======================

const QUESTION_DATABASE = {
    javascript: [
        "What is the difference between 'let', 'const', and 'var'?",
        "Explain closures and give an example.",
        "What is the Event Loop in JavaScript?",
        "Explain 'this' keyword behavior.",
        "What are Promises and async/await?",
        "How does prototypal inheritance work?",
        "What is event bubbling and capturing?",
        "Explain the concept of hoisting."
    ],
    react: [
        "What is the Virtual DOM?",
        "Explain the Component Lifecycle.",
        "What are React Hooks? Name commonly used ones.",
        "What is the difference between State and Props?",
        "Explain the useEffect hook dependency array.",
        "What is Prop Drilling and how to avoid it?",
        "What is the Context API?",
        "Explain React.memo and useMemo."
    ],
    python: [
        "What are Python decorators?",
        "Explain list comprehensions.",
        "Difference between list and tuple.",
        "How is memory managed in Python?",
        "What is the Global Interpreter Lock (GIL)?",
        "Explain inheritance in Python."
    ],
    nodejs: [
        "What is the difference between process.nextTick and setImmediate?",
        "Explain the Event Loop in Node.js.",
        "What is middleware in Express?",
        "How does Node.js handle concurrency?"
    ],
    machine_learning: [
        "What is the difference between supervised and unsupervised learning?",
        "Explain the bias-variance tradeoff.",
        "What is overfitting and how do you prevent it?",
        "Explain the concept of regularization (L1 vs L2).",
        "How does a decision tree work?",
        "What is a confusion matrix?",
        "Explain Gradient Descent."
    ],
    data_science: [
        "What is the difference between data science and data analytics?",
        "How do you handle missing data in a dataset?",
        "Explain the Central Limit Theorem.",
        "What is p-value?",
        "Difference between correlation and causation.",
        "What is A/B testing?"
    ],
    full_stack: [
        "Describe the MVC architecture.",
        "What is the difference between SQL and NoSQL databases?",
        "How does HTTPS work?",
        "What is CORS?",
        "Explain REST vs GraphQL.",
        "How do you scale a web application?"
    ],
    cloud_computing: [
        "What are the different service models in cloud (IaaS, PaaS, SaaS)?",
        "Explain the concept of virtualization.",
        "What is a container and how is it different from a VM?",
        "What is Load Balancing in the cloud?",
        "Explain serverless computing."
    ],
    computer_science: [
        "Explain Big O notation.",
        "Difference between stack and queue.",
        "How does a hash map work?",
        "Explain the difference between a process and a thread.",
        "What is a deadlock?",
        "Explain TCP vs UDP."
    ],
    system_design: [
        "How would you design a URL shortener?",
        "Design a rate limiter.",
        "How do you scale a database?",
        "Explain Load Balancing techniques.",
        "What are Microservices?"
    ]
};

const BEHAVIORAL_QUESTIONS = [
    "Tell me about a challenging project you worked on.",
    "How do you handle conflict in a team?",
    "Describe a time you failed and what you learned.",
    "Where do you see yourself in 5 years?",
    "What is your greatest strength and weakness?"
];

// ======================
// SYSTEM GLUE CODE
// ======================

function manualStopRecognition() {
    console.log("Manual stop triggered");
    if (recognition) {
        recognition.stop();
    }
}

function exitInterview() {
    if (confirm("End interview?")) {
        interviewActive = false;
        window.speechSynthesis.cancel();
        if (recognition) recognition.stop();
        document.getElementById('interview-container').style.display = 'none';
        location.reload();
    }
}

// 1. START INTERVIEW
function startAIInterview(topic) {
    console.log("Starting Fixed AI Interview...", topic);
    interviewActive = true;
    chatHistory = [];
    userInterests = [];
    askedQuestions = [];

    // Ensure SpeechSynthesis is cancelled
    window.speechSynthesis.cancel();

    // Toggle UI
    const selectionGrid = document.getElementById('interview-selection');
    const container = document.getElementById('interview-container');

    if (selectionGrid) selectionGrid.style.display = 'none';
    if (container) container.style.display = 'block';

    // Reset UI
    const startBtn = document.getElementById('start-ai-btn');
    if (startBtn) startBtn.style.display = 'none';

    const statusEl = document.getElementById('ai-status');
    if (statusEl) statusEl.innerText = "INITIALIZING...";

    const transcriptEl = document.getElementById('ai-transcript');
    if (transcriptEl) transcriptEl.innerHTML = "";

    document.getElementById('mic-btn').style.display = 'none';

    // Start flow
    if (topic) {
        currentTechStack = topic;
        userInterests = [topic];
        setTimeout(() => {
            startTopicInterview(topic);
        }, 1000);
    } else {
        setTimeout(() => {
            askInterests();
        }, 1000);
    }
}

function startTopicInterview(topic) {
    // Format topic for speech
    const formatTopic = topic.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    // Introductory logic
    let msg = `Starting ${formatTopic} interview. I will ask you a series of technical questions related to ${formatTopic}.`;

    if (topic === 'computer_science') msg = "Starting Computer Science Fundamentals interview. I will ask about Data Structures, Algorithms, OS, and Networks.";

    updateTranscript("Interviewer", msg);

    speakWithPause(msg, () => {
        updateInterviewStatus("thinking", "Preparing first question...");
        setTimeout(() => {
            askNextQuestion();
        }, 1500);
    });
}

function askInterests() {
    const msg = "Welcome. To begin, please tell me which technologies or roles you are interested in.";
    updateTranscript("Interviewer", msg);

    speakWithPause(msg, () => {
        const aiStatus = document.getElementById('ai-status');
        if (aiStatus) aiStatus.innerText = "LISTENING...";
        document.getElementById('mic-btn').style.display = 'inline-flex';
        listenForInterests();
    });
}

// ======================
// RECOVERED HELPER FUNCTIONS
// ======================

function updateTranscript(speaker, text) {
    const box = document.getElementById('ai-transcript');
    if (!box) return;

    const color = speaker === "Interviewer" ? "var(--primary)" : "var(--text-main)";
    const bgColor = speaker === "Interviewer" ? "rgba(0, 243, 255, 0.1)" : "rgba(139, 92, 246, 0.1)";

    const div = document.createElement('div');
    div.style.cssText = `
        margin: 10px 0;
        padding: 12px;
        border-left: 4px solid ${color};
        background: ${bgColor};
        border-radius: 0 8px 8px 0;
        animation: fadeIn 0.3s ease;
    `;

    div.innerHTML = `<strong style="color:${color}">${speaker}:</strong> ${text}`;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
}

// [Removed duplicate extractInterestsFromText function - use the one defined earlier]

function listenForInterests() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        console.warn("Speech recognition not supported");
        setTimeout(() => processUserInterests("React and JavaScript"), 1500);
        return;
    }

    // Use GLOBAL recognition variable
    if (recognition) {
        try { recognition.stop(); } catch (e) { }
    }

    recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = false; // Single utterance for interests

    recognition.onstart = () => {
        console.log("Listening for interests...");
        updateInterviewStatus("listening", "Listening...");
    };

    recognition.onresult = (e) => {
        const text = e.results[0][0].transcript;
        console.log("Interests heard:", text);
        processUserInterests(text);
    };

    recognition.onerror = (e) => {
        console.error("Interest speech error", e);
        // Fallback or retry?
        // Let's assume user is silent or error, prompt manually
        updateInterviewStatus("error", "Microphone error. Using defaults.");
        setTimeout(() => processUserInterests("JavaScript and React"), 2000);
    };

    try {
        recognition.start();
    } catch (e) {
        console.error("Failed to start recognition", e);
    }
}

// Ensure speakWithPause is globally available and robust
function speakWithPause(text, callback) {
    if (!window.speechSynthesis) {
        if (callback) setTimeout(callback, 1000);
        return;
    }

    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.0;
    u.pitch = 1.0;

    u.onend = () => {
        if (callback) setTimeout(callback, 500);
    };

    u.onerror = (e) => {
        console.error("TTS Error:", e);
        if (callback) setTimeout(callback, 500);
    };

    window.speechSynthesis.speak(u);
}

// 13. INITIALIZE ON PAGE LOAD
document.addEventListener('DOMContentLoaded', function () {
    console.log("Interview system initialized");

    // Make sure functions are available globally
    window.startAIInterview = startAIInterview;
    window.manualStopRecognition = manualStopRecognition;
    window.exitInterview = exitInterview;

    // Test if everything is working
    const testBtn = document.getElementById('start-ai-btn');
    if (testBtn) {
        console.log("Start button found, interview system ready");
    }
});

// --- ANALYTICS AND RESULTS ---
function switchResultTab(tabId) {
    document.querySelectorAll('.btn-tab').forEach(b => b.classList.remove('active'));
    event.currentTarget.classList.add('active');

    document.querySelectorAll('.result-tab-content').forEach(c => c.style.display = 'none');
    document.getElementById(`tab-${tabId}`).style.display = 'block';
}

function renderStorageResults() {
    const list = document.getElementById('mock-history-list');
    if (!list) return;

    const history = JSON.parse(localStorage.getItem('user_mock_history') || '[]');
    if (history.length === 0) return;

    history.forEach(data => {
        const div = document.createElement('div');
        div.className = 'history-item';
        div.style.opacity = '0.7';
        div.innerHTML = `
            <div style="display:flex; align-items:center;">
                <div style="width:40px; height:40px; border-radius:50%; background:rgba(255,255,255,0.1); display:flex; align-items:center; justify-content:center; margin-right:1rem;">
                    <i class="fa-solid fa-clock-rotate-left" style="color:var(--text-muted)"></i>
                </div>
                <div>
                    <div style="font-weight:bold;">${data.track || data.type} (Local)</div>
                    <div style="font-size:0.8rem; color:var(--text-muted);">${data.date}</div>
                </div>
            </div>
            <div style="text-align:right;">
                <div style="font-weight:bold; color:var(--primary)">${data.score}/30</div>
                <div style="font-size:0.75rem; color:var(--text-muted)">${data.accuracy}%</div>
            </div>
          `;
        list.appendChild(div);
    });
}
function downloadInterviewPDF() {
    // Select the result text and scores for the PDF
    const element = document.getElementById('interview-result-card');
    const userName = State.currentUser ? State.currentUser.name : "Student";

    const options = {
        margin: 0.5,
        filename: `${userName}_Interview_Report.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    html2pdf().set(options).from(element).save();
}

function loadUserResults() {
    if (!auth.currentUser) {
        renderStorageResults();
        return;
    }
    const uid = auth.currentUser.uid;

    // Mock Tests Listener
    db.collection("users").doc(uid).collection("mock_tests")
        .orderBy("timestamp", "desc")
        .onSnapshot(snapshot => {
            const list = document.getElementById('mock-history-list');
            if (list) list.innerHTML = '';

            snapshot.forEach(doc => {
                const data = doc.data();
                if (list) {
                    const div = document.createElement('div');
                    div.className = 'history-item';
                    div.onclick = () => openResultDetail('mock', data);
                    div.innerHTML = `
                    <div style="display:flex; align-items:center;">
                        <div style="width:40px; height:40px; border-radius:50%; background:rgba(0,243,255,0.1); display:flex; align-items:center; justify-content:center; margin-right:1rem;">
                            <i class="fa-solid fa-code" style="color:var(--primary)"></i>
                        </div>
                        <div>
                            <div style="font-weight:bold;">${data.type}</div>
                            <div style="font-size:0.8rem; color:var(--text-muted);">${new Date(data.timestamp).toLocaleDateString()}</div>
                        </div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-weight:bold; color:${data.score / data.total >= 0.7 ? 'var(--success)' : 'var(--text-main)'}">${Math.round((data.score / data.total) * 100)}%</div>
                        <div style="font-size:0.75rem; color:var(--text-muted);">${data.score}/${data.total} Score</div>
                    </div>
                  `;
                    list.appendChild(div);
                }
            });

            renderStorageResults();
        });

    // Interviews Listener
    db.collection("users").doc(uid).collection("interviews")
        .orderBy("timestamp", "desc")
        .onSnapshot(snapshot => {
            const list = document.getElementById('interview-history-list');
            if (list) list.innerHTML = '';

            if (snapshot.empty) {
                if (list) list.innerHTML = '<p class="text-muted text-center p-4">No interviews yet.</p>';
            } else {
                snapshot.forEach(doc => {
                    const data = doc.data();
                    let techScore = '?';
                    let commScore = '?';

                    if (data.scores) {
                        techScore = data.scores.technical;
                        commScore = data.scores.communication;
                    } else if (typeof data.report === 'object' && data.report.scores) {
                        techScore = data.report.scores.technical;
                        if (data.report.scores.communication) commScore = data.report.scores.communication;
                    } else if (typeof data.report === 'string') {
                        const techMatch = data.report.match(/Technical:?\s*(\d+)/i);
                        if (techMatch) techScore = techMatch[1];
                    }

                    if (list) {
                        const div = document.createElement('div');
                        div.className = 'history-item';
                        div.onclick = () => openResultDetail('interview', { ...data, techScore, commScore });
                        div.innerHTML = `
                        <div style="display:flex; align-items:center;">
                             <div style="width:40px; height:40px; border-radius:50%; background:rgba(139, 92, 246, 0.1); display:flex; align-items:center; justify-content:center; margin-right:1rem;">
                                <i class="fa-solid fa-microphone" style="color:var(--secondary)"></i>
                            </div>
                            <div>
                                <div style="font-weight:bold;">${data.type}</div>
                                <div style="font-size:0.8rem; color:var(--text-muted);">${new Date(data.timestamp).toLocaleDateString()}</div>
                            </div>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-weight:bold; color:var(--secondary)">${techScore}/10</div>
                            <div style="font-size:0.75rem; color:var(--text-muted)">Rating</div>
                        </div>
                      `;
                        list.appendChild(div);
                    }
                });
            }
        });

    // Verification Listener
    db.collection("users").doc(uid).collection("verification_tests")
        .orderBy("timestamp", "desc")
        .onSnapshot(snapshot => {
            const list = document.getElementById('verification-history-list');
            if (list) list.innerHTML = '';

            if (!snapshot.empty) {
                snapshot.forEach(doc => {
                    const data = doc.data();
                    const passed = data.passed || data.score >= 4;
                    if (list) {
                        const div = document.createElement('div');
                        div.className = 'history-item';
                        div.onclick = () => openResultDetail('verification', data);
                        div.innerHTML = `
                        <div style="display:flex; align-items:center;">
                             <div style="width:40px; height:40px; border-radius:50%; background:${passed ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'}; display:flex; align-items:center; justify-content:center; margin-right:1rem;">
                                <i class="fa-solid fa-certificate" style="color:${passed ? 'var(--success)' : 'var(--error)'}"></i>
                            </div>
                            <div>
                                <div style="font-weight:bold;">${data.type}</div>
                                <div style="font-size:0.8rem; color:var(--text-muted);">${new Date(data.timestamp).toLocaleDateString()}</div>
                            </div>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-weight:bold; color:${passed ? 'var(--success)' : 'var(--error)'}">${passed ? 'PASSED' : 'FAILED'}</div>
                            <div style="font-size:0.75rem; color:var(--text-muted)">${data.score}/${data.total}</div>
                        </div>
                      `;
                        list.appendChild(div);
                    }
                });
            } else {
                if (list) list.innerHTML = '<p class="text-muted text-center p-4">Not verified yet.</p>';
            }
        });
}

function timeAgo(ts) {
    const now = new Date();
    const date = new Date(ts);

    const todayStr = now.toDateString();
    const dateStr = date.toDateString();

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    if (todayStr === dateStr) {
        const min = Math.floor((now - date) / 60000);
        if (min < 1) return 'Just now';
        if (min < 60) return min + 'm ago';
        return Math.floor(min / 60) + 'h ago';
    } else if (yesterdayStr === dateStr) {
        return 'Yesterday';
    } else {
        return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    }
}

// Toggle mobile menu
function toggleMobileMenu() {
    document.getElementById('app-sidebar').classList.toggle('open');
    document.getElementById('mobile-overlay').style.display =
        document.getElementById('app-sidebar').classList.contains('open') ? 'block' : 'none';
}

// Close modal function
function closeModal(id) {
    document.getElementById(id).style.display = 'none';
}




// Initialize analytics chart
let analyticsChart = null;
function initAnalyticsChart() {
    const ctx = document.getElementById('analyticsChart').getContext('2d');
    analyticsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Mock Test Score (%)',
                data: [],
                borderColor: '#00f3ff',
                backgroundColor: 'rgba(0, 243, 255, 0.1)',
                fill: true,
                tension: 0.4
            }, {
                label: 'Interview Rating (/10)',
                data: [],
                borderColor: '#8b5cf6',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                fill: true,
                tension: 0.4,
                yAxisID: 'y1'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: { legend: { labels: { color: '#a1a1aa' } } },
            scales: {
                x: { ticks: { color: '#a1a1aa' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                y: {
                    max: 100,
                    ticks: { color: '#a1a1aa' },
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    title: { display: true, text: 'Test Score %', color: '#a1a1aa' }
                },
                y1: {
                    max: 10,
                    position: 'right',
                    grid: { drawOnChartArea: false },
                    ticks: { color: '#a1a1aa' },
                    title: { display: true, text: 'Interview Rating', color: '#a1a1aa' }
                }
            }
        }
    });
}

// Open result detail modal
function openResultDetail(type, data) {
    const modal = document.getElementById('result-detail-modal');
    const content = document.getElementById('result-modal-content');
    modal.style.display = 'flex';

    let html = '';

    if (type === 'mock') {
        html = `
            <div class="result-detail-header">
                <h2 style="color:var(--primary)">${data.type} Result</h2>
                <div style="font-size:3rem; font-weight:bold; margin:1rem 0;">${data.score}/${data.total}</div>
                <div style="color:${data.score / data.total >= 0.7 ? 'var(--success)' : 'var(--error)'}; font-weight:bold;">
                    ${Math.round((data.score / data.total) * 100)}% Accuracy
                </div>
                <div style="color:var(--text-muted); font-size:0.9rem; margin-top:0.5rem;">
                    Attempted on ${new Date(data.timestamp).toLocaleString()}
                </div>
            </div>
            
            <h4 style="margin-bottom:1rem;">Question Analysis</h4>
            <div>
                ${data.history.map((h, i) => `
                    <div style="padding:1rem; margin-bottom:1rem; border-radius:8px; background: ${h.isCorrect ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'}; border-left: 4px solid ${h.isCorrect ? 'var(--success)' : 'var(--error)'}">
                        <div style="font-weight:bold; font-size:0.9rem; margin-bottom:0.5rem;">Q${i + 1}: ${h.question}</div>
                        <div style="display:flex; justify-content:space-between; font-size:0.85rem;">
                            <span>Tag: <span style="background:rgba(0,0,0,0.3); padding:2px 6px; border-radius:4px;">${h.category}</span></span>
                            <span>Your Answer: <b>${h.userAnswer}</b> ${!h.isCorrect ? `(Correct: ${h.correctAnswer})` : '✅'}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    } else if (type === 'interview') {
        html = `
            <div class="result-detail-header">
                <h2 style="color:var(--secondary)">Interview Report</h2>
                <div style="font-size:1.1rem; margin-top:0.5rem; color:var(--text-muted);">
                    ${new Date(data.timestamp).toLocaleString()}
                </div>
            </div>
            <div class="result-stat-grid">
                <div class="result-stat-box">
                    <div style="font-size:2rem; font-weight:bold; color:var(--primary)">${data.techScore || '-'}/10</div>
                    <div style="font-size:0.8rem; color:var(--text-muted)">Technical</div>
                </div>
                <div class="result-stat-box">
                    <div style="font-size:2rem; font-weight:bold; color:var(--secondary)">${data.commScore || '-'}/10</div>
                    <div style="font-size:0.8rem; color:var(--text-muted)">Communication</div>
                </div>
            </div>
            <h4>Detailed Feedback</h4>
            <div class="transcript-box">${data.report}</div>
        `;
    } else if (type === 'verification') {
        html = `
            <div class="result-detail-header">
                <h2 style="color:var(--success)">Verification Status</h2>
                <div style="font-size:3rem; font-weight:bold; margin:1rem 0; color:${data.score >= 4 ? 'var(--success)' : 'var(--error)'}">
                    ${data.score >= 4 ? 'PASSED' : 'FAILED'}
                </div>
                <div>Score: ${data.score}/${data.total}</div>
                <div style="color:var(--text-muted); font-size:0.9rem; margin-top:0.5rem;">
                    ${new Date(data.timestamp).toLocaleString()}
                </div>
            </div>
            <h4 style="margin-bottom:1rem;">Skill Breakdown</h4>
            ${data.history ? `
                <div>
                     ${data.history.map((h, i) => `
                    <div style="padding:0.8rem; marginBottom:0.5rem; border-bottom:1px solid var(--border);">
                        <div style="font-size:0.9rem;">${h.question}</div>
                        <div style="text-align:right; font-size:0.8rem; font-weight:bold; color:${h.isCorrect ? 'var(--success)' : 'var(--error)'}">
                            ${h.isCorrect ? 'Correct' : 'Incorrect'}
                        </div>
                    </div>
                `).join('')}
                </div>
            ` : '<p>No detailed breakdown available.</p>'}
        `;
    }

    content.innerHTML = html;
}

// ======================
// UI INTERACTION FIXES
// ======================

// Mobile Menu Toggle
function toggleMobileMenu() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('mobile-overlay');

    if (sidebar) {
        sidebar.classList.toggle('open');

        // Handle overlay visibility
        if (sidebar.classList.contains('open')) {
            if (overlay) overlay.style.display = 'block';
        } else {
            if (overlay) overlay.style.display = 'none';
        }
    }
}

// Theme Toggle
function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';

    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);

    updateThemeIcon(newTheme);
}

// Update Theme Icon
function updateThemeIcon(theme) {
    const icons = document.querySelectorAll('.theme-icon-i');
    icons.forEach(icon => {
        if (theme === 'light') {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
        } else {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        }
    });
}
