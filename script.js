const QUIZ_API_KEY = '76mUsmb1UhTMts4eFS7Ac0fzI1JIugpc71sTT876';
let currentQuizData = [];
let userScore = 0;
let currentQIndex = 0;
let timerInterval;
let selectedValue = null;
let mockResultsLog = [];

// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyCj4ubO2mPo3iz-YiyhJUxq6JkrtEfuhiU",
    authDomain: "earlyedge-d031b.firebaseapp.com",
    projectId: "earlyedge-d031b",
    storageBucket: "earlyedge-d031b.firebasestorage.app",
    messagingSenderId: "725641625876",
    appId: "1:725641625876:web:52d07b673b0ce439090201"
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


// Update the Firebase initialization to include storage
const storage = firebase.storage();


// ========================
// RESUME UPLOAD FUNCTIONS
// ========================

let userResumeData = null;

// Load user's resume data
function loadUserResume() {
    if (!State.currentUser || !State.currentUser.uid) return;
    
    db.collection("user_resumes").doc(State.currentUser.uid).get()
        .then((doc) => {
            if (doc.exists) {
                userResumeData = doc.data();
                updateResumeUI();
            }
        })
        .catch((error) => {
            console.error("Error loading resume:", error);
        });
    
    // Set up file upload listener
    const resumeUpload = document.getElementById('resume-upload');
    if (resumeUpload) {
        resumeUpload.addEventListener('change', handleResumeUpload);
    }
}

// Handle resume file upload
// Simplified version without actual file storage
// Handle resume file upload - UPDATED VERSION
function handleResumeUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
        alert("File size too large. Maximum size is 5MB.");
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
    
    // Store metadata (simplified - no actual file upload)
    userResumeData = {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        uploadedAt: Date.now(),
        userId: State.currentUser.uid,
        userName: State.currentUser.name,
        userEmail: State.currentUser.email,
        // Add a placeholder for download URL (in real implementation, this would be the actual URL)
        downloadURL: `#simulated-url-for-${file.name}`
    };
    
    // Save to Firestore
    db.collection("user_resumes").doc(State.currentUser.uid).set(userResumeData, { merge: true })
        .then(() => {
            updateResumeUI();
            
            if (messageEl) {
                messageEl.textContent = "Resume uploaded successfully!";
                setTimeout(() => {
                    messageEl.textContent = "Resume uploaded:";
                }, 2000);
            }
            
            console.log("Resume metadata saved to Firestore");
        })
        .catch((error) => {
            console.error("Upload error:", error);
            alert("Error saving resume metadata: " + error.message);
            
            if (messageEl) {
                messageEl.textContent = "Upload failed. Please try again.";
            }
        });
    
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
    if (!userResumeData || !userResumeData.downloadURL) {
        alert("No resume found");
        return;
    }
    
    window.open(userResumeData.downloadURL, '_blank');
}

// Delete resume
// Delete resume - FIXED VERSION
function deleteResume() {
    if (!confirm("Are you sure you want to delete your resume?")) return;
    
    if (!State.currentUser || !State.currentUser.uid) return;
    
    // Show deleting status
    const messageEl = document.getElementById('resume-message');
    if (messageEl) {
        messageEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Deleting resume...';
    }
    
    // Only delete from Firestore (since we're not storing actual files in this simplified version)
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
            
            console.log("Resume metadata deleted successfully");
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
function incrementJobViews(jobId) {
    if (!jobId) return;
    
    // Get current views
    db.collection("jobs").doc(jobId).get()
        .then((doc) => {
            if (doc.exists) {
                const currentViews = doc.data().views || 0;
                
                // Increment views by 1
                return db.collection("jobs").doc(jobId).update({
                    views: currentViews + 1,
                    lastViewed: Date.now()
                });
            }
        })
        .then(() => {
            console.log("Job views incremented for job:", jobId);
        })
        .catch((error) => {
            console.error("Error incrementing job views:", error);
        });
}

// Update the applyForJob function to include resume in application
function applyForJob(jobId, jobTitle, jobCompany) {
    if (!confirm(`Apply for ${jobTitle} at ${jobCompany}?`)) return;
    
    // Check if user has uploaded a resume
    if (!userResumeData) {
        const uploadResume = confirm("You haven't uploaded a resume. Would you like to upload one before applying?");
        if (uploadResume) {
            document.getElementById('resume-upload').click();
            return;
        }
    }
    
    const applicationData = {
        jobId: jobId,
        jobTitle: jobTitle,
        company: jobCompany,
        studentId: State.currentUser.uid,
        studentName: State.currentUser.name,
        studentEmail: State.currentUser.email,
        appliedAt: Date.now(),
        hasResume: !!userResumeData,
        resumeURL: userResumeData ? userResumeData.downloadURL : null,
        resumeFileName: userResumeData ? userResumeData.fileName : null
    };
    
    db.collection("applications").add(applicationData)
        .then(() => {
            // INCREMENT JOB VIEWS WHEN SOMEONE APPLIES
            incrementJobViews(jobId);
            
            alert("Application sent successfully!");
        }).catch(err => alert("Error applying: " + err.message));
}

// Update the viewApplicants function to show resume download option
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
                const item = document.createElement('div');
                item.className = 'glass-card';
                item.style.marginBottom = '1rem';
                
                let resumeButton = '';
                if (data.hasResume && data.resumeURL) {
                    resumeButton = `
                        <button class="btn btn-primary" style="font-size:0.85rem; margin-left: 0.5rem;" 
                            onclick="window.open('${data.resumeURL}', '_blank')">
                            <i class="fa-solid fa-download"></i> Download Resume
                        </button>`;
                } else {
                    resumeButton = `
                        <span style="font-size:0.85rem; color:var(--text-muted); margin-left: 0.5rem;">
                            <i class="fa-solid fa-file-circle-xmark"></i> No resume
                        </span>`;
                }
                
                item.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:start;">
                        <div style="flex: 1;">
                            <h4 style="margin-bottom:0.5rem; color:var(--text-main);">${data.studentName}</h4>
                            <p style="color:var(--text-muted); margin-bottom:0.5rem;">
                                <i class="fa-solid fa-envelope"></i> ${data.studentEmail}
                            </p>
                            <p style="color:var(--text-muted); font-size:0.85rem;">
                                <i class="fa-solid fa-clock"></i> Applied ${timeAgoShort(data.appliedAt)}
                                ${data.resumeFileName ? `<br><i class="fa-solid fa-file"></i> ${data.resumeFileName}` : ''}
                            </p>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-left: 1rem;">
                            <button class="btn btn-glass" style="font-size:0.85rem;" 
                                onclick="viewStudentProfile('${data.studentId}')">
                                <i class="fa-solid fa-eye"></i> View Profile
                            </button>
                            ${resumeButton}
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

// Update the initDashboard function to load resume
function initDashboard() {
    const loader = document.getElementById('app-loading');
    if (loader) loader.style.display = 'none';

    renderStorageResults();
    updateNavigation();
    updateHeader();

    // Load Data
    loadJobs();
    loadSquads();
    loadUserResults();
    loadUserResume(); // ADD THIS LINE

    if (State.currentUser.role === 'student') {
        loadMyApplications();
        switchView('feed');
        document.getElementById('feed-heading').innerText = "Live Opportunities";
    } else if (State.currentUser.role === 'recruiter') {
        switchView('recruiter');
        document.getElementById('feed-heading').innerText = "My Posted Jobs";
    }
}

// --- AUTHENTICATION ---
function authSignUp(email, password, role, name, company = '') {
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
                createdAt: Date.now()
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

function logout() {
    auth.signOut().then(() => window.location.href = "index.html");
}

// --- INITIALIZATION FLOW ---
document.addEventListener('DOMContentLoaded', () => {
    // THEME INITIALIZATION
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    const isDashboard = document.getElementById('feed-container');
    const isLanding = document.querySelector('.landing-nav');

    auth.onAuthStateChanged((user) => {
        if (user) {
            db.collection("users").doc(user.uid).onSnapshot((doc) => {
                if (doc.exists) {
                    State.currentUser = doc.data();
                    if (isDashboard) initDashboard();
                    if (isLanding) updateLandingPage(State.currentUser);
                }
            });
        } else {
            State.currentUser = null;
            if (isDashboard) window.location.href = "login.html";
            if (isLanding) resetLandingPage();
        }
    });
});


// --- DATA LISTENERS ---
function loadJobs() {
    let query = db.collection("jobs");

    // IMPORTANT CHANGE: Recruiters should see ALL jobs in Live Feed
    // Only filter by recruiterId in analytics view
    if (State.currentUser.role === 'recruiter' && document.getElementById('view-analytics').classList.contains('active')) {
        // Only filter in analytics view
        query = query.where("recruiterId", "==", State.currentUser.uid);
    }
    
    // Always order by date, newest first
    query = query.orderBy("createdAt", "desc");

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

function loadSquads() {
    db.collection("squads").onSnapshot((snapshot) => {
        State.liveSquads = [];
        snapshot.forEach((doc) => State.liveSquads.push({ id: doc.id, ...doc.data() }));
        if (document.getElementById('squad-container')) renderSquads();
    });
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
        container.innerHTML = `
            <div style="text-align:center; color:var(--text-muted); padding:2rem;">
                No jobs found.
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
    alert("Student profile view would open here for student ID: " + studentId);
    // In a real implementation, you would navigate to a profile page or open a modal
    // with detailed student information, test scores, interview results, etc.
}

// Function to track unique job views (one view per user per job)
function trackJobView(jobId) {
    if (!State.currentUser || !State.currentUser.uid || !jobId) return;
    
    const viewKey = `viewed_${jobId}_${State.currentUser.uid}`;
    
    // Check if user has already viewed this job in this session
    if (sessionStorage.getItem(viewKey)) return;
    
    // Mark as viewed in session storage
    sessionStorage.setItem(viewKey, 'true');
    
    // Increment view count in database
    db.collection("jobs").doc(jobId).get()
        .then((doc) => {
            if (doc.exists) {
                const currentViews = doc.data().views || 0;
                return db.collection("jobs").doc(jobId).update({
                    views: currentViews + 1,
                    lastViewed: Date.now(),
                    // Optional: Track unique viewers
                    viewedBy: firebase.firestore.FieldValue.arrayUnion(State.currentUser.uid)
                });
            }
        })
        .then(() => {
            console.log("Job view tracked for job:", jobId);
        })
        .catch((error) => {
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
    const name = document.getElementById('new-squad-name').value;
    if (!name) return alert('Name required');
    db.collection("squads").add({
        name: name,
        members: [{ name: State.currentUser.name, role: "Lead" }]
    }).then(() => {
        updateUserProfile({ squadId: name });
        closeModal('create-squad-modal');
    });
}

function joinSquad(docId, name) { updateUserProfile({ squadId: name }); }
function leaveSquad() { updateUserProfile({ squadId: null }); }

// --- HELPERS ---
function updateHeader() {
    const btn = document.getElementById('premium-btn');
    const avatarEl = document.getElementById('user-avatar');
    if (State.currentUser.name) {
        avatarEl.innerText = State.currentUser.name.charAt(0).toUpperCase();
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

    if (viewId === 'squad') renderSquads();
    if (viewId === 'analytics') loadRecruiterAnalytics(); // Load recruiter analytics
    if (viewId === 'results') loadStudentAnalytics(); // Load student analytics
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

function renderSquads() {
    const container = document.getElementById('squad-container');
    if (!container) return;
    container.innerHTML = '';
    if (State.currentUser.squadId) {
        document.getElementById('my-squad-status').innerHTML = `
            <div class="glass-card" style="border-color:var(--success); display:flex; justify-content:space-between; align-items:center;">
                <div>Squad: <strong style="color:var(--success)">${State.currentUser.squadId}</strong></div> 
                <button class="btn btn-glass" onclick="leaveSquad()">Leave</button>
            </div>`;
    } else {
        document.getElementById('my-squad-status').innerHTML = '';
    }
    State.liveSquads.forEach(s => {
        if (s.name === State.currentUser.squadId) return;
        const div = document.createElement('div');
        div.className = 'glass-card';
        div.innerHTML = `<h4>${s.name}</h4><p style="font-size:0.8rem; color:var(--text-muted);">${s.members ? s.members.length : 1} Members</p><button class="btn btn-glass" style="width:100%" onclick="joinSquad('${s.id}', '${s.name}')">Join</button>`;
        container.appendChild(div);
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
    updateUserProfile({ name: newName });
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
async function openAssessment() {
    currentQuizData = [];
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
        </div>`;

    try {
        const [aptRes, codeRes] = await Promise.all([
            fetch('https://opentdb.com/api.php?amount=3&category=19&type=multiple'),
            fetch(`https://quizapi.io/api/v1/questions?apiKey=${QUIZ_API_KEY}&limit=2&tags=JavaScript`)
        ]);

        const aptData = await aptRes.json();
        const codeData = await codeRes.json();

        currentQuizData = [
            ...aptData.results.map(q => ({
                type: 'Aptitude',
                question: q.question,
                options: [...q.incorrect_answers, q.correct_answer].sort(() => Math.random() - 0.5),
                correct: q.correct_answer
            })),
            ...codeData.map(q => ({
                type: 'Coding',
                question: q.question,
                options: Object.values(q.answers).filter(a => a !== null),
                correct: q.answers[Object.keys(q.correct_answers).find(k => q.correct_answers[k] === "true").replace('_correct', '')]
            }))
        ];

        currentQIndex = 0;
        userScore = 0;
        renderQuestionInModal();
    } catch (err) {
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
            ${q.options.map(opt => `
                <div class="mcq-option" onclick="handleSelect(this, '${opt.replace(/'/g, "&apos;")}')">${opt}</div>
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
            processNext();
        }
    }, 1000);
}

// Add this if not already present
function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.style.display = 'none';
        // Remove from DOM if it was dynamically created
        setTimeout(() => {
            if (modal.parentNode && modal.id === id) {
                modal.parentNode.removeChild(modal);
            }
        }, 300);
    }
}

function handleSelect(el, val) {
    document.querySelectorAll('.mcq-option').forEach(o => o.classList.remove('selected'));
    el.classList.add('selected');
    selectedValue = val;
}

function processNext() {
    clearInterval(timerInterval);
    if (selectedValue === currentQuizData[currentQIndex].correct) userScore++;

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
    const passed = userScore >= 4;

    if (State.currentUser) {
        db.collection("users").doc(State.currentUser.uid).collection("verification_tests").add({
            type: "Premium Assessment",
            score: userScore,
            total: total,
            passed: passed,
            timestamp: Date.now(),
            history: currentQuizData.map(q => ({
                question: q.question,
                isCorrect: q.correct === selectedValue
            })),
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
    document.getElementById('view-results').scrollIntoView({ behavior: 'smooth' });
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
    const questionType = Math.random() < 0.7 ? "technical" : 
                         Math.random() < 0.9 ? "behavioral" : "system_design";
    
    if (questionType === "technical") {
        questionText = getUnaskedTechnicalQuestion();
    } else if (questionType === "behavioral") {
        questionText = getUnaskedBehavioralQuestion();
    } else {
        questionText = getUnaskedSystemDesignQuestion();
    }
    
    if (!questionText) {
        console.log("No more unique questions available");
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
    
    // If no questions from interests, use JavaScript as default
    if (allQuestions.length === 0) {
        allQuestions = QUESTION_DATABASE.javascript.map(q => ({
            text: q,
            tech: "javascript",
            type: "technical"
        }));
    }
    
    // Remove already asked questions
    const askedTexts = askedQuestions.map(q => q.text);
    const availableQuestions = allQuestions.filter(q => !askedTexts.includes(q.text));
    
    if (availableQuestions.length === 0) {
        console.log("No more unique technical questions, using behavioral");
        return getUnaskedBehavioralQuestion();
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
    let silenceTimer;
    
    recognition.onstart = () => {
        console.log("Listening for answer started");
        updateInterviewStatus("listening", "Listening... (Speak your answer)");
        document.getElementById('mic-btn').style.display = 'inline-flex';
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
        
        // Show we're getting input
        if (interimTranscript.length > 0) {
            console.log("Interim transcript:", interimTranscript);
        }
        
        // Reset silence timer - 2 seconds of silence
        silenceTimer = setTimeout(() => {
            console.log("Silence detected, stopping recognition");
            if (finalTranscript.trim().length > 0) {
                recognition.stop();
            }
        }, 2000);
    };
    
    recognition.onend = () => {
        console.log("Recognition ended");
        clearTimeout(silenceTimer);
        document.getElementById('mic-btn').style.display = 'none';
        
        if (finalTranscript.trim().length > 3) {
            console.log("Processing answer:", finalTranscript.substring(0, 50) + "...");
            processUserAnswer(finalTranscript);
        } else {
            console.log("No answer detected, prompting again");
            updateTranscript("Interviewer", "I didn't hear your answer. Could you please respond to the question?");
            speakWithPause("I didn't hear your answer. Could you please respond to the question?", () => {
                updateInterviewStatus("listening", "Listening for answer...");
                startListeningForAnswer();
            });
        }
    };
    
    recognition.onerror = (event) => {
        console.error("Recognition error:", event.error);
        clearTimeout(silenceTimer);
        
        // Handle error
        updateInterviewStatus("error", "Microphone error");
        
        // Fallback to mock answer
        setTimeout(() => {
            processUserAnswer("I would solve this by applying appropriate design patterns and best practices.");
        }, 1000);
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
    
    document.getElementById('interview-result-card').innerHTML = feedbackHTML;
    document.getElementById('download-pdf-btn').style.display = 'inline-flex';
    
    // Save to Firebase
    saveInterviewToFirebase(scores);
    
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
function saveInterviewToFirebase(scores) {
    if (auth.currentUser) {
        db.collection("users").doc(auth.currentUser.uid).collection("interviews").add({
            type: "Dynamic Technical Interview",
            scores: scores,
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
// COMPLETE INTERVIEW SYSTEM
// ======================

// Global state
let interviewActive = false;
let recognition = null;
let currentQuestion = null;
let chatHistory = [];
let userInterests = [];

// 1. START INTERVIEW (FIXED)
function startAIInterview() {
    console.log("🚀 Starting interview...");
    
    // Reset state
    interviewActive = true;
    chatHistory = [];
    userInterests = [];
    
    // Update UI
    document.getElementById('start-ai-btn').style.display = 'none';
    document.getElementById('ai-status').textContent = "STARTING...";
    
    // Clear transcript
    const transcriptEl = document.getElementById('ai-transcript');
    transcriptEl.innerHTML = '';
    
    // Show mic button
    document.getElementById('mic-btn').style.display = 'inline-flex';
    
    // Ask for interests
    setTimeout(() => {
        askForInterests();
    }, 1000);
}

// 2. ASK FOR INTERESTS
function askForInterests() {
    if (!interviewActive) return;
    
    const question = "First, tell me what technologies or areas you're interested in or working with?";
    
    // Update UI
    updateTranscript("Interviewer", question);
    document.getElementById('ai-status').textContent = "ASKING QUESTION";
    
    // Speak the question
    speakQuestion(question, () => {
        console.log("Question spoken, now listening...");
        document.getElementById('ai-status').textContent = "LISTENING...";
        startListeningForAnswer("interests");
    });
}

// 3. SPEAK QUESTION WITH CALLBACK
function speakQuestion(text, onComplete) {
    if (!window.speechSynthesis) {
        console.log("Speech synthesis not available");
        if (onComplete) setTimeout(onComplete, 1000);
        return;
    }
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    
    utterance.onend = function() {
        console.log("Speech ended");
        if (onComplete) {
            setTimeout(onComplete, 500);
        }
    };
    
    utterance.onerror = function(e) {
        console.error("Speech error:", e);
        if (onComplete) {
            setTimeout(onComplete, 500);
        }
    };
    
    window.speechSynthesis.speak(utterance);
}

// 4. START LISTENING FOR ANSWER
function startListeningForAnswer(type) {
    if (!interviewActive) return;
    
    console.log(`Listening for ${type}...`);
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        console.warn("SpeechRecognition not supported");
        // Simulate answer for testing
        setTimeout(() => {
            if (type === "interests") {
                processInterestsAnswer("I work with JavaScript and React");
            } else {
                processTechnicalAnswer("I would solve this by...");
            }
        }, 2000);
        return;
    }
    
    // Stop any existing recognition
    if (recognition) {
        recognition.stop();
    }
    
    // Create new recognition
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;
    
    let finalTranscript = '';
    let silenceTimer;
    
    recognition.onstart = () => {
        console.log("🎤 Listening started");
        document.getElementById('ai-status').textContent = "LISTENING... (Speak now)";
    };
    
    recognition.onresult = (event) => {
        console.log("Got speech result");
        clearTimeout(silenceTimer);
        
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }
        
        // Show we're getting input
        if (interimTranscript) {
            console.log("Interim:", interimTranscript);
        }
        
        // Set silence detection timer
        silenceTimer = setTimeout(() => {
            console.log("Silence detected, processing...");
            if (finalTranscript.trim().length > 0) {
                recognition.stop();
            }
        }, 2000); // 2 seconds of silence
    };
    
    recognition.onend = () => {
        console.log("Recognition ended");
        clearTimeout(silenceTimer);
        
        if (finalTranscript.trim().length > 3) {
            console.log("Final transcript:", finalTranscript);
            
            if (type === "interests") {
                processInterestsAnswer(finalTranscript);
            } else {
                processTechnicalAnswer(finalTranscript);
            }
        } else {
            console.log("No speech detected");
            // Ask again
            updateTranscript("Interviewer", "I didn't hear anything. Could you please answer?");
            speakQuestion("I didn't hear anything. Could you please answer?", () => {
                startListeningForAnswer(type);
            });
        }
    };
    
    recognition.onerror = (event) => {
        console.error("Recognition error:", event.error);
        
        // Handle specific errors
        if (event.error === 'no-speech') {
            updateTranscript("Interviewer", "I didn't hear anything. Could you please answer?");
            speakQuestion("I didn't hear anything. Could you please answer?", () => {
                startListeningForAnswer(type);
            });
        } else {
            // Other error - continue with mock response
            if (type === "interests") {
                processInterestsAnswer("Web development technologies");
            } else {
                processTechnicalAnswer("I would approach this systematically.");
            }
        }
    };
    
    // Start listening
    try {
        recognition.start();
        console.log("Recognition started successfully");
    } catch (e) {
        console.error("Failed to start recognition:", e);
        // Fallback
        if (type === "interests") {
            processInterestsAnswer("Software development");
        }
    }
}

// 5. PROCESS INTERESTS ANSWER
function processInterestsAnswer(answer) {
    console.log("Processing interests:", answer);
    
    updateTranscript("You", answer);
    
    // Extract interests from answer
    const answerLower = answer.toLowerCase();
    if (answerLower.includes('react') || answerLower.includes('javascript') || answerLower.includes('js')) {
        userInterests = ['javascript', 'react'];
    } else if (answerLower.includes('python') || answerLower.includes('ml') || answerLower.includes('ai')) {
        userInterests = ['python', 'machine_learning'];
    } else if (answerLower.includes('node') || answerLower.includes('backend')) {
        userInterests = ['nodejs', 'databases'];
    } else {
        userInterests = ['javascript', 'system_design'];
    }
    
    // Acknowledge
    const interestsStr = userInterests.join(', ').replace('_', ' ');
    const acknowledgment = `Great! I see you're interested in ${interestsStr}. Let's start with technical questions.`;
    
    updateTranscript("Interviewer", acknowledgment);
    
    speakQuestion(acknowledgment, () => {
        // Ask first technical question
        setTimeout(() => {
            askTechnicalQuestion();
        }, 1000);
    });
}

// 6. ASK TECHNICAL QUESTION
function askTechnicalQuestion() {
    if (!interviewActive) return;
    
    // Questions database
    const questions = {
        javascript: [
            "Explain the difference between let, const, and var in JavaScript.",
            "What are closures and how are they useful?",
            "How does JavaScript handle asynchronous operations?"
        ],
        react: [
            "What is the virtual DOM and how does React use it?",
            "Explain the difference between state and props.",
            "What are React hooks and when would you use them?"
        ],
        nodejs: [
            "How does Node.js handle multiple requests concurrently?",
            "What is the event loop in Node.js?",
            "How would you handle errors in an async/await function?"
        ],
        python: [
            "Explain Python's list comprehensions.",
            "What is the difference between @staticmethod and @classmethod?",
            "How does Python handle memory management?"
        ]
    };
    
    // Get a question based on interests
    let availableQuestions = [];
    userInterests.forEach(interest => {
        if (questions[interest]) {
            availableQuestions = availableQuestions.concat(questions[interest]);
        }
    });
    
    // Fallback to JavaScript if no questions found
    if (availableQuestions.length === 0) {
        availableQuestions = questions.javascript;
    }
    
    // Select random question
    const question = availableQuestions[Math.floor(Math.random() * availableQuestions.length)];
    currentQuestion = question;
    
    console.log("Asking technical question:", question);
    
    updateTranscript("Interviewer", question);
    document.getElementById('ai-status').textContent = "ASKING QUESTION";
    
    speakQuestion(question, () => {
        console.log("Technical question spoken, listening for answer...");
        document.getElementById('ai-status').textContent = "LISTENING FOR ANSWER...";
        startListeningForAnswer("technical");
    });
}

// 7. PROCESS TECHNICAL ANSWER
function processTechnicalAnswer(answer) {
    console.log("Processing technical answer");
    
    updateTranscript("You", answer);
    
    // Store in history
    chatHistory.push({
        question: currentQuestion,
        answer: answer,
        timestamp: Date.now()
    });
    
    // Evaluate answer length
    const wordCount = answer.split(' ').length;
    let feedback;
    
    if (wordCount < 10) {
        feedback = "Could you elaborate more on that?";
    } else if (wordCount < 20) {
        feedback = "Good. Let's try another question.";
    } else {
        feedback = "Great detailed answer! Let's continue.";
    }
    
    updateTranscript("Interviewer", feedback);
    
    speakQuestion(feedback, () => {
        // Decide next action
        if (chatHistory.length >= 5) {
            endInterview();
        } else {
            // Ask next question after delay
            setTimeout(() => {
                askTechnicalQuestion();
            }, 1500);
        }
    });
}

// 8. UPDATE TRANSCRIPT
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
    
    // Scroll to bottom
    box.scrollTop = box.scrollHeight;
}

// 9. MANUAL STOP RECOGNITION
function manualStopRecognition() {
    console.log("Manual stop triggered");
    
    if (recognition) {
        recognition.stop();
    }
    
    document.getElementById('mic-btn').style.display = 'none';
    document.getElementById('ai-status').textContent = "PROCESSING...";
    
    // Process whatever was captured
    setTimeout(() => {
        if (currentQuestion) {
            processTechnicalAnswer("I've finished speaking.");
        } else {
            processInterestsAnswer("Web development");
        }
    }, 500);
}

// 10. END INTERVIEW
function endInterview() {
    console.log("Ending interview");
    interviewActive = false;
    
    // Stop speech
    window.speechSynthesis.cancel();
    if (recognition) {
        recognition.stop();
        recognition = null;
    }
    
    const closing = "Thank you for the interview! I've asked " + chatHistory.length + " questions. Here's your feedback.";
    
    updateTranscript("Interviewer", closing);
    document.getElementById('ai-status').textContent = "COMPLETED";
    
    speakQuestion(closing, () => {
        // Show results
        setTimeout(() => {
            showInterviewResults();
        }, 1500);
    });
}

// 11. SHOW RESULTS
function showInterviewResults() {
    document.getElementById('interview-container').style.display = 'none';
    const resultCard = document.getElementById('interview-result-card');
    resultCard.style.display = 'block';
    
    const score = Math.min(10, Math.max(5, chatHistory.length * 1.5));
    
    resultCard.innerHTML = `
        <h4><i class="fa-solid fa-medal" style="color:var(--secondary)"></i> Performance Feedback</h4>
        <div class="grid-cards" style="margin-top:1.5rem; display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div style="text-align:center; padding: 1rem; background: rgba(0,0,0,0.1); border-radius: 8px;">
                <div style="font-size:1.5rem; color:var(--primary); font-weight: bold;">${score}/10</div>
                <div style="font-size:0.8rem; color:var(--text-muted);">Technical Score</div>
            </div>
            <div style="text-align:center; padding: 1rem; background: rgba(0,0,0,0.1); border-radius: 8px;">
                <div style="font-size:1.5rem; color:var(--secondary); font-weight: bold;">${chatHistory.length}</div>
                <div style="font-size:0.8rem; color:var(--text-muted);">Questions Answered</div>
            </div>
        </div>
        <div id="ai-feedback-text" style="margin-top:1.5rem; font-size:0.95rem; border-top:1px solid var(--border); padding-top:1rem; line-height: 1.6;">
            <p><strong>Areas covered:</strong> ${userInterests.join(', ').replace('_', ' ')}</p>
            <p><strong>Feedback:</strong> You demonstrated good understanding of the topics. Continue practicing and building projects.</p>
            <p><strong>Recommendations:</strong></p>
            <ul>
                <li>Build a complete project using ${userInterests[0]}</li>
                <li>Practice explaining technical concepts clearly</li>
                <li>Review system design patterns</li>
            </ul>
        </div>
        <button class="btn btn-primary" style="width: 100%; margin-top: 1rem;" onclick="location.reload()">
            <i class="fa-solid fa-rotate-right"></i> Take Another Interview
        </button>
    `;
    
    document.getElementById('download-pdf-btn').style.display = 'inline-flex';
}

// 12. EXIT INTERVIEW
function exitInterview() {
    if (interviewActive && confirm("Exit the interview? Progress will be saved.")) {
        interviewActive = false;
        window.speechSynthesis.cancel();
        if (recognition) {
            recognition.stop();
            recognition = null;
        }
        showInterviewResults();
    }
}

// 13. INITIALIZE ON PAGE LOAD
document.addEventListener('DOMContentLoaded', function() {
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
                    if (typeof data.report === 'object' && data.report.scores) {
                        techScore = data.report.scores.technical;
                    } else if (typeof data.report === 'string') {
                        const techMatch = data.report.match(/Technical:?\s*(\d+)/i);
                        if (techMatch) techScore = techMatch[1];
                    }

                    if (list) {
                        const div = document.createElement('div');
                        div.className = 'history-item';
                        div.onclick = () => openResultDetail('interview', { ...data, techScore });
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
        return Math.floor(min/60) + 'h ago';
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

// Show create squad modal
function showCreateSquadModal() {
    document.getElementById('create-squad-modal').style.display = 'flex';
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