        let isLoginView = true;
        const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzbKwLSbJs4HOlLdFk-LKBm9iIOxY16fmusxlhmaV7fxD9ZqooliykKrQ72l6THaYYX/exec"; 
        let cachedAllLeaves = [];
        let cachedEmployeeLeaves = [];
        let cachedManagerPending = []; 
        let isEditMode = false;
        let editingRequestId = "";
        let lastApprovedCount = parseInt(localStorage.getItem('lastAppCount') || "0");
        
        let liveSyncTimer = null; 

        window.addEventListener('DOMContentLoaded', () => {
            const savedUser = sessionStorage.getItem('currentUser');
            const savedPass = sessionStorage.getItem('currentPass');
            if (savedUser && savedPass) {
                const userObj = JSON.parse(savedUser);
                silentFetchData(userObj.code, savedPass);
                startLiveSync(); 
            } else {
                document.getElementById('login-screen').style.display = 'flex';
            }
        });

        function startLiveSync() {
            if (liveSyncTimer) clearInterval(liveSyncTimer);
            liveSyncTimer = setInterval(() => {
                const user = JSON.parse(sessionStorage.getItem('currentUser'));
                const pass = sessionStorage.getItem('currentPass');
                if (user && pass && !isEditMode) { 
                    silentFetchData(user.code, pass);
                }
            }, 10000); 
        }

        // دالة تأمين التواريخ ومنع اختيار أي تاريخ قديم من الماضي (للبداية والنهاية)
function setupDateConstraints() {
    const startDateInput = document.getElementById('leave-start');
    const endDateInput = document.getElementById('leave-end');
    
    // 1. حساب تاريخ اليوم الحالي بتوقيت مصر بصيغة YYYY-MM-DD
    const today = new Date();
    const year = today.getFullYear();
    const month = ("0" + (today.getMonth() + 1)).slice(-2);
    const day = ("0" + today.getDate()).slice(-2);
    const todayStr = `${year}-${month}-${day}`;
    
    // 2. إجبار تاريخ البداية والنهاية ألا يقبلا أي يوم قبل النهاردة (حظر الماضي تماماً)
    startDateInput.min = todayStr;
    if (!endDateInput.min) {
        endDateInput.min = todayStr;
    }

    // 3. مراقبة التغيير: أول ما يختار البداية، تقفل تقويم النهاية على التواريخ اللي قبلها
    startDateInput.addEventListener('change', function() {
        const selectedStart = startDateInput.value;
        if (selectedStart) {
            endDateInput.min = selectedStart; // النهاية تبدأ من يوم البداية فصاعداً
            
            // لو الموظف كان كاتب تاريخ نهاية قديم بالخطأ، يصححه تلقائياً لنفس يوم البداية
            if (endDateInput.value && endDateInput.value < selectedStart) {
                endDateInput.value = selectedStart;
            }
        }
    });
}

// تشغيل الدالة تلقائياً فور تحميل الصفحة لتأمين الحقول فوراً
document.addEventListener('DOMContentLoaded', () => {
    // أضف هذا السطر جوه دالة الـ DOMContentLoaded الموجودة عندك بالأسفل
    setupDateConstraints();
});

        function toggleForm() {
            const loginPanel = document.getElementById('login-panel'); const registerPanel = document.getElementById('register-panel');
            const toggleBtn = document.getElementById('toggle-btn'); const welcomeTitle = document.getElementById('welcome-title'); const welcomeDesc = document.getElementById('welcome-desc');
            if (isLoginView) {
                loginPanel.classList.remove('active'); registerPanel.classList.add('active');
                welcomeTitle.innerText = "لديك حساب بالفعل؟"; welcomeDesc.innerText = "عد لتسجيل الدخول مباشرة لمتابعة نظامك."; toggleBtn.innerText = "تسجيل الدخول"; isLoginView = false;
            } else {
                registerPanel.classList.remove('active'); loginPanel.classList.add('active');
                welcomeTitle.innerText = "مرحباً بك!"; welcomeDesc.innerText = "نظام تقديم ومتابعة الإجازات الإلكتروني التفاعلي."; toggleBtn.innerText = "إنشاء حساب"; isLoginView = true;
            }
        }

        function handleRegister(e) {
            e.preventDefault();
            const code = document.getElementById('reg-code').value.trim();
            const password = document.getElementById('reg-pass').value.trim();
            const submitBtn = e.target.querySelector('button');
            submitBtn.innerText = "جاري الحفظ والتحقق..."; submitBtn.disabled = true;

            fetch(`${SCRIPT_URL}?action=register&code=${encodeURIComponent(code)}&password=${encodeURIComponent(password)}`)
            .then(res => res.json()).then(data => { alert(data.message); if (data.status === "success") { e.target.reset(); toggleForm(); } })
            .catch(() => alert("عفواً، تأكد من اتصال الشبكة وصلاحية الكود في الشيت."))
            .finally(() => { submitBtn.innerText = "إنشاء الحساب"; submitBtn.disabled = false; });
        }

        function handleLogin(e) {
            e.preventDefault();
            const code = document.getElementById('login-code').value.trim();
            const password = document.getElementById('login-pass').value.trim();
            const submitBtn = e.target.querySelector('button');
            submitBtn.innerText = "جاري الدخول..."; submitBtn.disabled = true;

            fetch(`${SCRIPT_URL}?action=login&code=${encodeURIComponent(code)}&password=${encodeURIComponent(password)}`)
            .then(res => res.json()).then(data => {
                if (data.status === "success") {
                    sessionStorage.setItem('currentUser', JSON.stringify(data.user));
                    sessionStorage.setItem('currentPass', password);
                    updateDashboardUI(data);
                    startLiveSync(); 
                } else { alert(data.message); }
            })
            .catch(() => alert("خطأ في الاتصال بالسيرفر الرئيسي."))
            .finally(() => { submitBtn.innerText = "دخول"; submitBtn.disabled = false; });
        }

        function updateDashboardUI(data) {
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('dashboard-screen').style.display = 'flex';
            document.getElementById('db-user-name').innerText = data.user.name;
            document.getElementById('db-user-dept-role').innerText = `${data.user.department} - (${data.user.role})`;

            const empLayout = document.getElementById('employee-layout');
            const mgrLayout = document.getElementById('manager-layout');
            const badge = document.getElementById('main-bell-badge');

            if (data.user.role === "مدير") {
                mgrLayout.style.display = 'flex';   
                empLayout.style.display = 'none';   
                
                cachedManagerPending = data.managerPending || [];
                filterManagerPendingTable(); 
                
                cachedAllLeaves = data.allLeaves || [];
                filterHistoryByMonth(); 

                let pendingCount = cachedManagerPending.length;
                if (pendingCount > 0) {
                    badge.innerText = pendingCount;
                    badge.style.display = "flex";
                } else {
                    badge.style.display = "none";
                }
            } else {
                empLayout.style.display = 'flex';   
                mgrLayout.style.display = 'none';   
                document.getElementById('lbl-annual').innerText = `${data.user.annualBalance} يوم`;
                document.getElementById('lbl-casual').innerText = `${data.user.casualBalance} يوم`;
                document.getElementById('lbl-holiday').innerText = `${data.user.holidayBalance} يوم`;
                
                cachedEmployeeLeaves = data.myLeaves || [];
                filterEmployeeLeavesByMonth();

                // 🔔 تشغيل النوتفيكشن باللون الأحمر لو المدير وافق أو رفض على طلب جديد
                let currentProcessed = cachedEmployeeLeaves.filter(l => l.status === 'مقبول' || l.status === 'مرفوض').length;
                
                if (currentProcessed > lastApprovedCount && lastApprovedCount !== 0) {
                    badge.innerText = "!"; 
                    badge.style.display = "flex"; // تظهر النقطة الحمراء فوراً
                } else {
                    if (badge.innerText !== "!") {
                        badge.style.display = "none";
                    }
                }
                
                if (lastApprovedCount === 0) {
                    lastApprovedCount = currentProcessed;
                }
            }
        }

        function filterManagerPendingTable() {
            const searchCode = document.getElementById('pending-emp-code').value.trim().toLowerCase();
            const selectedMonth = document.getElementById('pending-month-filter').value;
            const tbody = document.getElementById('manager-table-body');
            
            let filtered = cachedManagerPending;
            
            if (searchCode !== "") {
                filtered = filtered.filter(l => l.code && l.code.toLowerCase().includes(searchCode));
            }
            if (selectedMonth !== "all") {
                filtered = filtered.filter(l => l.start && l.start.split('-')[1] === selectedMonth);
            }
            
            if(!filtered || filtered.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#999;">لا توجد طلبات معلقة متوافقة مع اختيارات البحث الحالية.</td></tr>`; return;
            }
            
            tbody.innerHTML = filtered.map(l => `
                <tr>
                    <td>${l.id}</td>
                    <td>${l.name} (${l.code})</td>
                    <td>${l.type}</td>
                    <td>من ${l.start.split('T')[0]} إلى ${l.end.split('T')[0]}</td>
                    <td>${l.days} يوم</td>
                    <td>
                        <button class="btn-action approve" onclick="processLeave('${l.id}', 'مقبول')">✅ موافق</button>
                        <button class="btn-action reject" onclick="processLeave('${l.id}', 'مرفوض')">❌ رفض</button>
                    </td>
                </tr>
            `).join('');
        }

     function clearNotificationBadge() {
    document.getElementById('main-bell-badge').style.display = "none";
    document.getElementById('main-bell-badge').innerText = "0";

    // 👑 الجزء الخاص بالموظف فقط: قفل التنبيه في الكاش عشان ميرجعش ينور تاني
    if (typeof cachedEmployeeLeaves !== 'undefined' && cachedEmployeeLeaves && cachedEmployeeLeaves.length > 0) {
        let currentProcessed = cachedEmployeeLeaves.filter(l => l.status === 'مقبول' || l.status === 'مرفوض').length;
        lastApprovedCount = currentProcessed;
        localStorage.setItem('lastAppCount', currentProcessed);
    }
}

        function refreshDashboardData() {
            const user = JSON.parse(sessionStorage.getItem('currentUser'));
            const pass = sessionStorage.getItem('currentPass');
            if(user && pass) {
                silentFetchData(user.code, pass);
            }
        }

        function silentFetchData(code, pass) {
            fetch(`${SCRIPT_URL}?action=login&code=${encodeURIComponent(code)}&password=${encodeURIComponent(pass)}`)
            .then(res => res.json()).then(data => {
                if (data.status === "success") {
                    sessionStorage.setItem('currentUser', JSON.stringify(data.user));
                    updateDashboardUI(data);
                }
            }).catch(err => {
                console.log("خطأ أثناء تحديث البيانات بالخلفية:", err);
            });
        }

        function filterEmployeeLeavesByMonth() {
            const selectedMonth = document.getElementById('emp-month-filter').value;
            const tbody = document.getElementById('employee-table-body');
            
            let filtered = cachedEmployeeLeaves;
            if (selectedMonth !== "all") {
                filtered = filtered.filter(l => l.start && l.start.split('-')[1] === selectedMonth);
            }
            
            if(!filtered || filtered.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #999;">لا توجد طلبات إجازات متوافقة مع هذا الشهر.</td></tr>`; return;
            }
            
            tbody.innerHTML = filtered.map(l => {
                let badgeClass = l.status === 'قيد الانتظار' ? 'pending' : (l.status === 'مقبول' ? 'approved' : 'rejected');
                let editAction = "";
                if (l.status === 'قيد الانتظار') {
                    editAction = `
                        <button class="btn-action edit-btn" title="تعديل هذا الطلب" onclick="activateRequestEdit('${l.id}', '${l.type}', '${l.start}', '${l.end}')"><i class="fa-solid fa-pen-to-square"></i></button>
                        <button class="btn-action delete-btn" title="إلغاء وسحب هذا الطلب نهائياً" onclick="handleDeleteLeave('${l.id}')"><i class="fa-solid fa-trash-can"></i></button>
                    `;
                }

                return `<tr>
                    <td>${l.id} ${editAction}</td>
                    <td>${l.type}</td>
                    <td>من ${l.start.split('T')[0]} إلى ${l.end.split('T')[0]}</td>
                    <td>${l.days} أيام</td>
                    <td><span class="badge ${badgeClass}">${l.status}</span></td>
                </tr>`;
            }).join('');
        }

        function handleDeleteLeave(requestId) {
            if (!confirm(`هل أنت متأكد من إلغاء وسحب طلب الإجازة (${requestId}) نهائياً من السيستم؟`)) return;
            const url = `${SCRIPT_URL}?action=deleteLeave&requestId=${requestId}`;
            fetch(url).then(res => res.json()).then(data => {
                alert(data.message);
                if (isEditMode && editingRequestId === requestId) {
                    cancelEditMode();
                }
                refreshDashboardData();
            })
            .catch(() => alert("حدث خطأ أثناء محاولة إلغاء الطلب من السيرفر."));
        }

        function activateRequestEdit(id, type, start, end) {
            isEditMode = true;
            editingRequestId = id;
            
            document.getElementById('form-action-title').innerText = `تعديل طلب الإجازة (${id}) ✏️`;
            document.getElementById('btn-submit-text').innerText = "تحديث وحفظ الطلب الآن";
            document.getElementById('btn-cancel-edit').style.display = "block";
            
            document.getElementById('leave-type').value = type;
            document.getElementById('leave-start').value = start.split('T')[0];
            document.getElementById('leave-end').value = end.split('T')[0];
            
            syncEndDateMin();
            document.getElementById('form-action-title').scrollIntoView({ behavior: 'smooth' });
        }

        function cancelEditMode() {
            isEditMode = false;
            editingRequestId = "";
            document.getElementById('leave-form').reset();
            document.getElementById('leave-end').removeAttribute('min'); 
            document.getElementById('form-action-title').innerText = "طلب إجازة جديد";
            document.getElementById('btn-submit-text').innerText = "إرسال الطلب";
            document.getElementById('btn-cancel-edit').style.display = "none";
        }

        function filterHistoryByMonth() {
            const selectedMonth = document.getElementById('month-filter').value;
            const searchCode = document.getElementById('search-emp-code').value.trim().toLowerCase();
            const tbody = document.getElementById('manager-history-table-body');
            
            let approvedLeaves = cachedAllLeaves.filter(l => l.status === 'مقبول');
            let filteredTable = cachedAllLeaves.filter(l => l.status === 'مقبول' || l.status === 'مرفوض');
            
            if (selectedMonth !== "all") {
                approvedLeaves = approvedLeaves.filter(l => l.start && l.start.split('-')[1] === selectedMonth);
                filteredTable = filteredTable.filter(l => l.start && l.start.split('-')[1] === selectedMonth);
            }
            
            if (searchCode !== "") {
                approvedLeaves = approvedLeaves.filter(l => l.code && l.code.toLowerCase().includes(searchCode));
                filteredTable = filteredTable.filter(l => l.code && l.code.toLowerCase().includes(searchCode));
            }
            
            let totalAnnual = 0;
            let totalCasual = 0;
            let totalHoliday = 0;

            approvedLeaves.forEach(l => {
                const days = parseInt(l.days) || 0;
                if (l.type === "اعتيادي") totalAnnual += days;
                else if (l.type === "عارضة") totalCasual += days;
                else if (l.type === "بدل أعياد") totalHoliday += days;
            });

            document.getElementById('mgr-total-annual').innerText = `${totalAnnual} يوم`;
            document.getElementById('mgr-total-casual').innerText = `${totalCasual} يوم`;
            document.getElementById('mgr-total-holiday').innerText = `${totalHoliday} يوم`;
            
            const targetRecord = approvedLeaves.find(l => l.code && l.code.toLowerCase() === searchCode);
            
            if(searchCode !== "" && targetRecord) {
                document.getElementById('mgr-rem-annual').innerText = targetRecord.annualBalance !== undefined ? `${targetRecord.annualBalance} يوم` : "متاح";
                document.getElementById('mgr-rem-casual').innerText = targetRecord.casualBalance !== undefined ? `${targetRecord.casualBalance} يوم` : "متاح";
                document.getElementById('mgr-rem-holiday').innerText = targetRecord.holidayBalance !== undefined ? `${targetRecord.holidayBalance} يوم` : "متاح";
            } else {
                document.getElementById('mgr-rem-annual').innerText = "--";
                document.getElementById('mgr-rem-casual').innerText = "--";
                document.getElementById('mgr-rem-holiday').innerText = "--";
            }
            
            if(filteredTable.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#999;">لا توجد طلبات متوافقة مع اختيارات البحث الحالية.</td></tr>`; return;
            }
            
            tbody.innerHTML = filteredTable.map(l => {
                let badgeClass = l.status === 'مقبول' ? 'approved' : 'rejected';
                return `
                    <tr>
                        <td>${l.id}</td>
                        <td>${l.name || 'موظف'} (${l.code})</td>
                        <td>${l.type}</td>
                        <td>من ${l.start.split('T')[0]} إلى ${l.end.split('T')[0]}</td>
                        <td>${l.days} يوم</td>
                        <td><span class="badge ${badgeClass}">${l.status}</span></td>
                    </tr>
                `;
            }).join('');
        }

        function handleLeaveSubmit(e) {
            e.preventDefault();
            const user = JSON.parse(sessionStorage.getItem('currentUser'));
            const type = document.getElementById('leave-type').value;
            const start = document.getElementById('leave-start').value;
            const end = document.getElementById('leave-end').value;
            
            if(!start || !end) return;

            const todayStr = new Date().toISOString().split('T')[0];
            if (start < todayStr) {
                alert("عفواً يا فنان، لا يمكن تقديم طلب إجازة بتاريخ قديم من الماضي! رجاءً اختر تاريخاً يبدأ من اليوم فصاعداً.");
                return;
            }

            if (end < start) {
                alert("عفواً يا فنان، لا يمكن أن يكون تاريخ نهاية الإجازة قبل تاريخ بدايتها! رجاءً راجع الحقول.");
                return;
            }

            let hasOverlap = cachedEmployeeLeaves.some(l => {
                if (l.status === 'مرفوض') return false;
                if (isEditMode && l.id === editingRequestId) return false;

                let cachedStart = l.start.split('T')[0];
                let cachedEnd = l.end.split('T')[0];

                return (start <= cachedEnd && end >= cachedStart);
            });

            if (hasOverlap) {
                alert("عفواً يا فنان! لديك طلب إجازة آخر (مقبول أو قيد الانتظار) يتداخل مع هذه الفترة بالظبط. رجاءً راجع جدول سجل طلباتك.");
                return;
            }

            const diffTime = Math.abs(new Date(end) - new Date(start));
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

            const submitBtn = document.getElementById('btn-submit-text');
            submitBtn.disabled = true;

            let url = "";
            if (isEditMode) {
              submitBtn.innerText = "جاري تحديث طلبك...";
              url = `${SCRIPT_URL}?action=updateLeave&requestId=${editingRequestId}&type=${encodeURIComponent(type)}&start=${start}&end=${end}&days=${diffDays}`;
            } else {
              submitBtn.innerText = "جاري إرسال طلبك...";
              url = `${SCRIPT_URL}?action=submitLeave&code=${user.code}&name=${encodeURIComponent(user.name)}&type=${encodeURIComponent(type)}&start=${start}&end=${end}&days=${diffDays}`;
            }

            fetch(url).then(res => res.json()).then(data => { 
                alert(data.message); 
                cancelEditMode(); 
                refreshDashboardData(); 
            })
            .catch(() => alert("حدثت مشكلة أثناء معالجة طلبك بالسيرفر."))
            .finally(() => submitBtn.disabled = false);
        }

        function processLeave(requestId, decision) {
            if(!confirm(`هل أنت متأكد من تسجيل قرارك بـ (${decision})؟`)) return;
            fetch(`${SCRIPT_URL}?action=processLeave&requestId=${requestId}&decision=${encodeURIComponent(decision)}`)
            .then(res => res.json()).then(data => { 
                alert(data.message); 
                refreshDashboardData(); 
            });
        }

        function handleUpdateHoliday(e) {
            e.preventDefault();
            const targetCode = document.getElementById('target-emp-code').value.trim();
            const newBalance = document.getElementById('new-holiday-balance').value.trim();
            const submitBtn = e.target.querySelector('button');
            submitBtn.innerText = "جاري حفظ التعديل..."; submitBtn.disabled = true;
            
            fetch(`${SCRIPT_URL}?action=updateHolidayBalance&targetCode=${encodeURIComponent(targetCode)}&newBalance=${encodeURIComponent(newBalance)}`)
            .then(res => res.json()).then(data => { 
                alert(data.message); 
                if(data.status === "success") {
                    e.target.reset(); 
                    document.getElementById('emp-name-preview').style.display = "none"; // إخفاء شريط الاسم بعد الحفظ
                    refreshDashboardData();
                }
            })
            .catch(() => alert("خطأ في الاتصال بالسيرفر وتحديث الرصيد."))
            .finally(() => { submitBtn.innerText = "تحديث الرصيد الآن"; submitBtn.disabled = false; });
        }

        function handleLogout() { 
            if (liveSyncTimer) clearInterval(liveSyncTimer); 
            sessionStorage.removeItem('currentUser'); 
            sessionStorage.removeItem('currentPass');
            location.reload(); 
        }
        // 👑 دالة قراءة الكود وإظهار اسم الموظف آلياً في شريط النص تحت الخانة للمدير
function showEmpNameLocally() {
    const codeInput = document.getElementById('target-emp-code').value.trim().toLowerCase();
    const previewBar = document.getElementById('emp-name-preview');
    const nameLabel = document.getElementById('lbl-preview-name');
    
    if (codeInput === "") {
        previewBar.style.display = "none";
        return;
    }
    
    // البحث عن كود الموظف داخل الطلبات المخزنة في الكاش لجلب الاسم فوراً
    let targetRecord = cachedAllLeaves.find(l => l.code && l.code.toLowerCase() === codeInput);
    
    if (targetRecord && targetRecord.name) {
        nameLabel.innerText = targetRecord.name;
        previewBar.style.display = "block"; // إظهار شريط الاسم باللون الأزرق البروفيشنال
    } else {
        nameLabel.innerText = "جاري البحث عن الكود أو الكود غير مسجل بطلب سابق...";
        previewBar.style.display = "block";
    }
}